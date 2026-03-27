#!/usr/bin/env node

/*
 * export_snapshots.js
 *
 * Creates .snapshot backup files for each qdrant collection.
 * These can be shared so the database can be restored on any
 * machine without re-generating embeddings.
 *
 * Run from the backend folder:
 *   npm run export-snapshots
 */

import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';
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

function initClient() {
  const opts = { url: QDRANT_URL, checkCompatibility: false };
  if (QDRANT_API_KEY) opts.apiKey = QDRANT_API_KEY;
  return new QdrantClient(opts);
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file  = fs.createWriteStream(destPath);
    const headers = {};
    if (QDRANT_API_KEY) headers['api-key'] = QDRANT_API_KEY;

    proto.get(url, { headers }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} downloading snapshot`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('\n--- Qdrant Snapshot Exporter ---\n');
  const qdrant = initClient();

  // connect and list collections
  console.log('[1] connecting to qdrant...');
  let collections;
  try {
    const result = await qdrant.getCollections();
    collections = result.collections.map(c => c.name);
    console.log(`  connected. found ${collections.length} collection(s): ${collections.join(', ')}\n`);
  } catch (err) {
    console.error(`  cannot connect to qdrant at ${QDRANT_URL}`);
    console.error(`  ${err.message}\n`);
    process.exit(1);
  }

  // skip test collections
  const targets = collections.filter(c => !c.startsWith('test'));
  if (targets.length === 0) {
    console.log('  no collections to export.\n');
    return;
  }

  // make sure snapshot directory exists
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  console.log(`[2] exporting to: ${SNAPSHOTS_DIR}\n`);

  // export each collection
  for (const collection of targets) {
    console.log(`  creating snapshot for "${collection}"...`);
    try {
      const info = await qdrant.getCollection(collection);
      console.log(`    points: ${info.points_count}, vector size: ${info.config.params.vectors.size}`);

      const snap = await qdrant.createSnapshot(collection);
      const url  = `${QDRANT_URL}/collections/${collection}/snapshots/${snap.name}`;
      const dest = path.join(SNAPSHOTS_DIR, `${collection}.snapshot`);

      console.log('    downloading...');
      await downloadFile(url, dest);

      const sizeMB = (fs.statSync(dest).size / 1024 / 1024).toFixed(1);
      console.log(`  saved: ${collection}.snapshot (${sizeMB} MB)\n`);
    } catch (err) {
      console.error(`  failed to export "${collection}": ${err.message}\n`);
    }
  }

  console.log('--- export complete ---');
  console.log(`snapshots saved to: data/snapshots/`);
  console.log('restore command: cd backend && npm run restore-snapshots\n');
}

main().catch(err => {
  console.error('\nexport failed:', err.message);
  process.exit(1);
});
