import 'dotenv/config';
import OpenAI from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const qdrant = new QdrantClient({ url: process.env.QDRANT_URL || 'http://localhost:6333', checkCompatibility: false });

const queries = ["what is ayurveda", "what is aruerveda", "how old is ayurveda", "nutrition value of roti"];

for (const q of queries) {
  const emb = await openai.embeddings.create({ model: 'text-embedding-3-small', input: q });
  const vector = emb.data[0].embedding;
  
  // Main search (threshold 0.35)
  const main = await qdrant.search('ayurveda_core_data', {
    vector, limit: 3, with_payload: true, score_threshold: 0.0
  });
  
  console.log(`\n=== "${q}" ===`);
  main.forEach((r, i) => {
    const t = r.payload.type || 'unknown';
    const txt = (r.payload.text || '').substring(0, 120);
    console.log(`  [${i+1}] score=${r.score.toFixed(4)} type=${t} | ${txt}...`);
  });
  console.log(`  Would pass 0.35 threshold: ${main.filter(r => r.score >= 0.35).length} results`);
  console.log(`  Would pass 0.20 threshold: ${main.filter(r => r.score >= 0.20).length} results`);
}
