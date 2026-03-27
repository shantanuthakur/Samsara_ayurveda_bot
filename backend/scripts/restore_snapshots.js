#!/usr/bin/env node

/*
 * restore_snapshots.js
 *
 * Loads .snapshot files from data/snapshots/ into Qdrant.
 * This is the fastest way to seed the database because
 * no OpenAI API calls are needed.
 *
 * Run from the backend folder:
 *   npm run restore-snapshots
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SNAPSHOTS_DIR = path.join(PROJECT_ROOT, 'data', 'snapshots');

const QDRANT_URL     = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || null;

function makeRequest(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const url   = new URL(urlPath, QDRANT_URL);
    const proto = url.protocol === 'https:' ? https : http;
    const headers = {};
    if (QDRANT_API_KEY) headers['api-key'] = QDRANT_API_KEY;
    if (body) headers['Content-Type'] = 'application/json';

    const req = proto.request({
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search,
      method, headers,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve(data); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function uploadSnapshot(collection, filePath) {
  return new Promise((resolve, reject) => {
    const url      = new URL(`/collections/${collection}/snapshots/upload`, QDRANT_URL);
    const proto    = url.protocol === 'https:' ? https : http;
    const fileSize = fs.statSync(filePath).size;
    const fileName = path.basename(filePath);
    const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);

    const header = `--${boundary}\r\nContent-Disposition: form-data; name="snapshot"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;
    const total  = Buffer.byteLength(header) + fileSize + Buffer.byteLength(footer);

    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': total,
    };
    if (QDRANT_API_KEY) headers['api-key'] = QDRANT_API_KEY;

    const req = proto.request({
      hostname: url.hostname, port: url.port,
      path: url.pathname + '?priority=snapshot',
      method: 'POST', headers,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve(data); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);

    // stream the file as multipart form data
    req.write(header);
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => req.write(chunk));
    stream.on('end', () => { req.write(footer); req.end(); });
    stream.on('error', reject);
  });
}

async function main() {
  console.log('\n--- Qdrant Snapshot Restore ---\n');

  // check that snapshot files exist
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    console.error('  no snapshots directory found at: data/snapshots/');
    console.error('  run "npm run export-snapshots" first, or use "npm run seed" instead.\n');
    process.exit(1);
  }

  const files = fs.readdirSync(SNAPSHOTS_DIR).filter(f => f.endsWith('.snapshot'));
  if (files.length === 0) {
    console.error('  no .snapshot files found in data/snapshots/');
    console.error('  run "npm run export-snapshots" first.\n');
    process.exit(1);
  }

  console.log(`  found ${files.length} snapshot(s):`);
  files.forEach(f => {
    const size = (fs.statSync(path.join(SNAPSHOTS_DIR, f)).size / 1024 / 1024).toFixed(1);
    console.log(`    ${f} (${size} MB)`);
  });
  console.log();

  // check qdrant connection
  console.log('[1] connecting to qdrant...');
  try {
    await makeRequest('GET', '/collections');
    console.log(`  connected to ${QDRANT_URL}\n`);
  } catch (err) {
    console.error(`  cannot connect to qdrant at ${QDRANT_URL}`);
    console.error('  make sure qdrant is running: docker compose up -d\n');
    process.exit(1);
  }

  // restore each snapshot
  console.log('[2] restoring snapshots...\n');
  for (const file of files) {
    const name = file.replace('.snapshot', '');
    const fp   = path.join(SNAPSHOTS_DIR, file);

    console.log(`  restoring "${name}"...`);
    try {
      // if the collection already exists, ask what to do
      try {
        const info = await makeRequest('GET', `/collections/${name}`);
        const pts  = info.result?.points_count || 0;
        console.log(`  collection "${name}" already exists (${pts} points)`);

        const readline = await import('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise(resolve => {
          rl.question('  delete and restore from snapshot? (y/N): ', resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== 'y') {
          console.log(`  skipping "${name}"\n`);
          continue;
        }
        await makeRequest('DELETE', `/collections/${name}`);
        console.log('  deleted existing collection');
      } catch {
        // collection doesn't exist yet, that's fine
      }

      console.log('  uploading snapshot (this may take a moment)...');
      await uploadSnapshot(name, fp);

      const info = await makeRequest('GET', `/collections/${name}`);
      const pts  = info.result?.points_count || 0;
      console.log(`  restored "${name}" – ${pts} points\n`);
    } catch (err) {
      console.error(`  failed to restore "${name}": ${err.message}\n`);
    }
  }

  console.log('--- restore complete ---');
  console.log('next step: cd backend && npm run dev\n');
}

main().catch(err => {
  console.error('\nrestore failed:', err.message);
  process.exit(1);
});
