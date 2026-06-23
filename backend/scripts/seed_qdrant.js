#!/usr/bin/env node

/*
 * seed_qdrant.js
 *
 * Seeds the Qdrant vector database from the raw JSON data files
 * stored in the data/ directory. It generates fresh embeddings
 * using the OpenAI API and upserts everything into one collection.
 *
 * Run from the backend folder:
 *   npm run seed
 */

import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

// paths
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR     = path.join(PROJECT_ROOT, 'data');

// config
const QDRANT_URL       = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY   = process.env.QDRANT_API_KEY || null;
const OPENAI_API_KEY   = process.env.OPENAI_API_KEY;
const EMBEDDING_MODEL  = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
const VECTOR_SIZE      = 1536;
const COLLECTION_NAME  = 'ayurveda_core_data';
const BATCH_SIZE       = 500;
const UPSERT_BATCH     = 500;

let qdrant;
let openai;

function initClients() {
  if (!OPENAI_API_KEY) {
    console.error('\n[error] OPENAI_API_KEY is not set.');
    console.error('  Create backend/.env with your key: OPENAI_API_KEY=sk-...\n');
    process.exit(1);
  }

  const opts = { url: QDRANT_URL, checkCompatibility: false };
  if (QDRANT_API_KEY) opts.apiKey = QDRANT_API_KEY;
  qdrant = new QdrantClient(opts);
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
}

// ---------------------------------------------------------------------------
// data loaders – each returns an array of { id, text, metadata }
// ---------------------------------------------------------------------------

function loadRemedies() {
  const filePath = path.join(DATA_DIR, 'samsara_remedies_db.json');
  if (!fs.existsSync(filePath)) return [];
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`  loaded ${raw.length} remedies`);

  return raw.map((item, idx) => ({
    id: `remedy_${idx}`,
    text: `Condition: ${item.condition}\nDosha: ${item.dosha}\nRemedies: ${item.remedies.join(', ')}`,
    metadata: {
      source: 'samsara_remedies_db',
      type: 'remedy',
      condition: item.condition,
      dosha: item.dosha,
    }
  }));
}

function loadNutrition() {
  const filePath = path.join(DATA_DIR, 'samsara_nutrition.json');
  if (!fs.existsSync(filePath)) return [];
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`  loaded ${raw.length} nutrition entries`);

  return raw.map((item, idx) => {
    const dosha = item.dosha_effect
      ? `Vata: ${item.dosha_effect.vata}, Pitta: ${item.dosha_effect.pitta}, Kapha: ${item.dosha_effect.kapha}`
      : '';
    return {
      id: `nutrition_${idx}`,
      text: `Food: ${item.food}\nCalories: ${item.calories} kcal per 100g\nProtein: ${item.protein}g, Carbs: ${item.carbs}g, Fat: ${item.fat}g\nVitamins: ${(item.vitamins || []).join(', ')}\nDosha Effect: ${dosha}`,
      metadata: { source: 'samsara_nutrition', type: 'nutrition', food: item.food, calories: item.calories }
    };
  });
}

function loadIndiaFoods() {
  const filePath = path.join(DATA_DIR, 'Samsara_india_foods.json');
  if (!fs.existsSync(filePath)) return [];
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`  loaded ${raw.length} regional food regions`);

  const chunks = [];
  raw.forEach((region, ri) => {
    (region.foods || []).forEach((food, fi) => {
      const dosha = food.dosha_effect
        ? `Vata: ${food.dosha_effect.vata}, Pitta: ${food.dosha_effect.pitta}, Kapha: ${food.dosha_effect.kapha}`
        : '';
      const n = food.nutrition_per_100g || {};
      chunks.push({
        id: `indiafood_${ri}_${fi}`,
        text: `Regional Food: ${food.food_name}\nState: ${region.state}, District: ${region.district}\nCategory: ${food.category}\nVegetarian: ${food.is_vegetarian ? 'Yes' : 'No'}\nCalories: ${n.calories || 'N/A'} kcal, Protein: ${n.protein_g || 'N/A'}g, Carbs: ${n.carbohydrates_g || 'N/A'}g, Fat: ${n.fat_g || 'N/A'}g\nVitamins: ${(food.vitamins || []).join(', ')}\nDosha Effect: ${dosha}`,
        metadata: {
          source: 'samsara_india_foods', type: 'regional_food',
          food_name: food.food_name, state: region.state,
          district: region.district, category: food.category,
          is_vegetarian: food.is_vegetarian,
        }
      });
    });
  });
  return chunks;
}

function loadVectorExport() {
  const filePath = path.join(DATA_DIR, 'vector_export.jsonl');
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n');
  console.log(`  loaded ${lines.length} text chunks from vector_export`);

  return lines
    .filter(l => l.trim())
    .map((line, idx) => {
      const item = JSON.parse(line);
      if (!item.text || item.text.trim().length < 20) return null;
      return {
        id: `bookchunk_${idx}`,
        text: item.text,
        metadata: { source: item.source || 'vector_export', type: 'book_chunk', chunk_index: item.chunk_index }
      };
    })
    .filter(Boolean);
}

function loadHerbs() {
  const filePath = path.join(DATA_DIR, 'Herbs.json');
  if (!fs.existsSync(filePath)) return [];
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`  loaded ${raw.length} herbs`);

  return raw.map((herb, idx) => {
    // Build other names string
    const otherNames = [];
    if (herb.other_names) {
      if (herb.other_names.hindi && herb.other_names.hindi.length)
        otherNames.push(`Hindi: ${herb.other_names.hindi.join(', ')}`);
      if (herb.other_names.english && herb.other_names.english.length)
        otherNames.push(`English: ${herb.other_names.english.join(', ')}`);
      if (herb.other_names.sanskrit && herb.other_names.sanskrit.length)
        otherNames.push(`Sanskrit: ${herb.other_names.sanskrit.join(', ')}`);
    }

    // Build properties string
    const props = herb.properties || {};
    const propParts = [];
    if (props.rasa && props.rasa.length) propParts.push(`Rasa: ${props.rasa.join(', ')}`);
    if (props.virya) propParts.push(`Virya: ${props.virya}`);
    if (props.vipaka) propParts.push(`Vipaka: ${props.vipaka}`);
    if (props.guna && props.guna.length) propParts.push(`Guna: ${props.guna.join(', ')}`);

    // Build dosha effect
    const dosha = herb.dosha_effect || {};
    const doshaParts = [];
    if (dosha.vata) doshaParts.push(`Vata: ${dosha.vata}`);
    if (dosha.pitta) doshaParts.push(`Pitta: ${dosha.pitta}`);
    if (dosha.kapha) doshaParts.push(`Kapha: ${dosha.kapha}`);

    // Build uses
    const uses = herb.uses || {};
    const benefits = (uses.benefits || []).join(', ');
    const symptoms = (uses.symptoms_targeted || []).map(s => s.symptom).join(', ');
    const diseases = (uses.diseases_targeted || []).map(d => d.disease).join(', ');

    // Build contraindications
    const contras = (herb.contraindications || []).map(c => `${c.condition}: ${c.reason}`).join('; ');

    // Build dosage
    const dosage = herb.dosage || {};
    const dosageParts = [];
    if (dosage.amount) dosageParts.push(dosage.amount);
    if (dosage.vehicle) dosageParts.push(`with ${dosage.vehicle}`);
    if (dosage.frequency) dosageParts.push(dosage.frequency);

    // Build precautions
    const precautions = (herb.precautions || []).join('; ');

    // Compose full text chunk
    const textParts = [
      `Herb: ${herb.name}${herb.botanical_name ? ` (${herb.botanical_name})` : ''}`,
    ];
    if (otherNames.length) textParts.push(`Also known as: ${otherNames.join(' | ')}`);
    if (propParts.length) textParts.push(`Properties: ${propParts.join(' | ')}`);
    if (doshaParts.length) textParts.push(`Dosha Effect: ${doshaParts.join(', ')}`);
    if (benefits) textParts.push(`Benefits: ${benefits}`);
    if (symptoms) textParts.push(`Symptoms targeted: ${symptoms}`);
    if (diseases) textParts.push(`Diseases targeted: ${diseases}`);
    if (contras) textParts.push(`Contraindications: ${contras}`);
    if (dosageParts.length) textParts.push(`Dosage: ${dosageParts.join(', ')}`);
    if (precautions) textParts.push(`Precautions: ${precautions}`);
    if (herb.tags && herb.tags.length) textParts.push(`Tags: ${herb.tags.join(', ')}`);

    return {
      id: `herb_${idx}`,
      text: textParts.join('\n'),
      metadata: {
        source: 'herbs_db',
        type: 'herb',
        name: herb.name,
        botanical_name: herb.botanical_name || '',
        tags: (herb.tags || []).join(','),
      }
    };
  });
}


async function loadNewBooks() {
  const filePath = path.join(DATA_DIR, 'New_books.jsonl');
  if (!fs.existsSync(filePath)) return [];

  console.log(`  streaming New_books.jsonl...`);

  const chunks = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let idx = 0;
  let skipped = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const item = JSON.parse(line);
      if (!item.text || item.text.trim().length < 20 || !item.embedding || !Array.isArray(item.embedding)) {
        skipped++;
        continue;
      }
      chunks.push({
        text: item.text,
        metadata: {
          source: item.source || 'new_books',
          type: 'book_data',
          chunk_index: item.chunk_index || idx,
        },
        embedding: item.embedding,
      });
      idx++;
    } catch (e) {
      skipped++;
    }
  }

  console.log(`  loaded ${chunks.length} book chunks with pre-computed embeddings (skipped ${skipped})`);
  return chunks;
}

// ---------------------------------------------------------------------------
// embedding helpers
// ---------------------------------------------------------------------------

async function generateEmbeddings(texts) {
  const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: texts });
  return res.data.map(d => d.embedding);
}

async function embedInBatches(chunks) {
  const all = new Array(chunks.length);
  const total = Math.ceil(chunks.length / BATCH_SIZE);

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const num   = Math.floor(i / BATCH_SIZE) + 1;
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.text);

    process.stdout.write(`  embedding batch ${num}/${total} (${batch.length} items)...`);
    try {
      const vectors = await generateEmbeddings(texts);
      vectors.forEach((v, j) => { all[i + j] = v; });
      console.log(' done');
    } catch (err) {
      console.log(' failed');
      if (batch.length > 10) {
        console.log('  retrying with smaller batches...');
        for (let k = 0; k < batch.length; k += 10) {
          const micro = batch.slice(k, k + 10).map(c => c.text);
          const vecs  = await generateEmbeddings(micro);
          vecs.forEach((v, j) => { all[i + k + j] = v; });
        }
        console.log('  retry succeeded');
      } else {
        throw err;
      }
    }

    // small delay to stay within rate limits
    if (i + BATCH_SIZE < chunks.length) await new Promise(r => setTimeout(r, 200));
  }
  return all;
}

// ---------------------------------------------------------------------------
// qdrant helpers
// ---------------------------------------------------------------------------

async function ensureCollection(name, size) {
  const existing = await qdrant.getCollections();
  const found = existing.collections.some(c => c.name === name);

  if (found) {
    const info = await qdrant.getCollection(name);
    console.log(`  collection "${name}" already exists (${info.points_count} points)`);

    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => {
      rl.question('  delete and recreate? (y/N): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() === 'y') {
      await qdrant.deleteCollection(name);
      console.log(`  deleted "${name}"`);
    } else {
      console.log('  keeping existing collection, skipping seed.');
      return false;
    }
  }

  await qdrant.createCollection(name, { vectors: { size, distance: 'Cosine' } });
  console.log(`  created collection "${name}" (${size}-dim, cosine)`);
  return true;
}

async function upsertVectors(name, chunks, embeddings) {
  const total = Math.ceil(chunks.length / UPSERT_BATCH);

  for (let i = 0; i < chunks.length; i += UPSERT_BATCH) {
    const num   = Math.floor(i / UPSERT_BATCH) + 1;
    const batch = chunks.slice(i, i + UPSERT_BATCH);
    const vecs  = embeddings.slice(i, i + UPSERT_BATCH);

    const points = batch.map((chunk, j) => ({
      id: i + j,
      vector: vecs[j],
      payload: { text: chunk.text, ...chunk.metadata },
    }));

    process.stdout.write(`  upserting batch ${num}/${total}...`);
    await qdrant.upsert(name, { points });
    console.log(' done');
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n--- Ayurveda RAG Chatbot – Database Seeder ---\n');
  initClients();

  // step 1 – check qdrant
  console.log('[1] connecting to qdrant...');
  try {
    const cols = await qdrant.getCollections();
    console.log(`  connected to ${QDRANT_URL}`);
    console.log(`  existing collections: ${cols.collections.map(c => c.name).join(', ') || '(none)'}\n`);
  } catch (err) {
    console.error(`  cannot connect to qdrant at ${QDRANT_URL}`);
    console.error('  make sure qdrant is running: docker compose up -d\n');
    console.error(`  ${err.message}`);
    process.exit(1);
  }

  // step 2 – load data
  console.log('[2] loading data files...');
  const remedies   = loadRemedies();
  const nutrition  = loadNutrition();
  const indiaFoods = loadIndiaFoods();
  const bookChunks = loadVectorExport();
  const herbs      = loadHerbs();
  const newBooks   = await loadNewBooks();

  // Chunks that need fresh embeddings from OpenAI
  const chunksNeedingEmbeddings = [...remedies, ...nutrition, ...indiaFoods, ...bookChunks, ...herbs];
  // Chunks with pre-computed embeddings (New_books.jsonl)
  const preEmbeddedChunks = newBooks;

  const totalChunks = chunksNeedingEmbeddings.length + preEmbeddedChunks.length;
  console.log(`\n  total chunks to seed: ${totalChunks}`);
  console.log(`    remedies:             ${remedies.length}`);
  console.log(`    nutrition:            ${nutrition.length}`);
  console.log(`    regional foods:       ${indiaFoods.length}`);
  console.log(`    book chunks (legacy): ${bookChunks.length}`);
  console.log(`    herbs:                ${herbs.length}`);
  console.log(`    new books (pre-emb):  ${newBooks.length}`);
  console.log(`\n  needing OpenAI embeddings: ${chunksNeedingEmbeddings.length}`);
  console.log(`  pre-computed embeddings:   ${preEmbeddedChunks.length}\n`);

  if (totalChunks === 0) {
    console.error('  no data found. make sure the data/ directory has the JSON files.');
    process.exit(1);
  }

  // step 3 – create collection
  console.log('[3] setting up qdrant collection...');
  const shouldSeed = await ensureCollection(COLLECTION_NAME, VECTOR_SIZE);
  if (!shouldSeed) {
    console.log('\nseeding skipped.\n');
    return;
  }

  const t0 = Date.now();

  // step 4 – generate embeddings for chunks that need them
  if (chunksNeedingEmbeddings.length > 0) {
    console.log(`\n[4] generating embeddings for ${chunksNeedingEmbeddings.length} chunks (${EMBEDDING_MODEL})...`);
    console.log(`  this will make ~${Math.ceil(chunksNeedingEmbeddings.length / BATCH_SIZE)} API calls to OpenAI\n`);

    const embeddings = await embedInBatches(chunksNeedingEmbeddings);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n  embedding took ${elapsed}s\n`);

    // step 5a – upsert freshly-embedded chunks
    console.log('[5a] upserting freshly-embedded vectors into qdrant...');
    await upsertVectors(COLLECTION_NAME, chunksNeedingEmbeddings, embeddings);
  } else {
    console.log('\n[4] no chunks need fresh embeddings, skipping OpenAI calls.\n');
  }

  // step 5b – upsert pre-embedded book chunks (no OpenAI needed)
  if (preEmbeddedChunks.length > 0) {
    console.log(`\n[5b] upserting ${preEmbeddedChunks.length} pre-embedded book vectors into qdrant...`);
    const preEmbedOffset = chunksNeedingEmbeddings.length; // offset IDs so they don't collide
    const preTotal = Math.ceil(preEmbeddedChunks.length / UPSERT_BATCH);

    for (let i = 0; i < preEmbeddedChunks.length; i += UPSERT_BATCH) {
      const num   = Math.floor(i / UPSERT_BATCH) + 1;
      const batch = preEmbeddedChunks.slice(i, i + UPSERT_BATCH);

      const points = batch.map((chunk, j) => ({
        id: preEmbedOffset + i + j,
        vector: chunk.embedding,
        payload: { text: chunk.text, ...chunk.metadata },
      }));

      process.stdout.write(`  upserting pre-embedded batch ${num}/${preTotal}...`);
      await qdrant.upsert(COLLECTION_NAME, { points });
      console.log(' done');
    }
  }

  // step 6 – verify
  console.log('\n[6] verifying...');
  const info = await qdrant.getCollection(COLLECTION_NAME);
  console.log(`  collection: ${COLLECTION_NAME}`);
  console.log(`  points:     ${info.points_count}`);
  console.log(`  vector dim: ${info.config.params.vectors.size}`);
  console.log(`  distance:   ${info.config.params.vectors.distance}`);

  console.log(`\n--- seeding complete (${((Date.now() - t0) / 1000).toFixed(1)}s) ---`);
  console.log('next step: cd backend && npm run dev\n');
}

main().catch(err => {
  console.error('\nseeding failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
