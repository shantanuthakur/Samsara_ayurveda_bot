import { getEmbedding } from './src/services/openaiService.js';
import { searchSimilar } from './src/services/qdrantService.js';
import logger from './src/utils/logger.js';
import 'dotenv/config';

async function testQuery() {
  const query = "What is Vata dosha?";
  console.log(`Testing query: "${query}"`);
  
  try {
    const vector = await getEmbedding(query);
    console.log(`Generated embedding of length ${vector.length}`);
    
    process.env.SIMILARITY_THRESHOLD = "0.0";
    
    // Pass threshold directly into qdrant search logic
    const results = await searchSimilar(vector, 5, 0.0);
    console.log(`\nFound ${results.length} results:`);
    
    results.forEach((r, i) => {
      console.log(`\n[${i+1}] Score: ${r.score}`);
      console.log(`Payload preview: ${JSON.stringify(r.payload).substring(0, 100)}...`);
    });
    
  } catch (err) {
    console.error("Test failed:", err);
  }
}

testQuery();
