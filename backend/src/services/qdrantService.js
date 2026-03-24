import { QdrantClient } from '@qdrant/js-client-rest';
import logger from '../utils/logger.js';

let client = null;

function getClient() {
  if (!client) {
    const url = process.env.QDRANT_URL || 'http://localhost:6333';
    client = new QdrantClient({ url });
    logger.info(`Qdrant client initialized: ${url}`);
  }
  return client;
}

/**

 * @param {number[]} queryVector - The embedding vector to search with
 * @param {number} topK - Number of results to return
 * @returns {Array<{score: number, payload: object}>} Scored results
 */
export async function searchSimilar(queryVector, topK = 5) {
  const collection = process.env.QDRANT_COLLECTION || 'ayurveda_core_data';
  const threshold = parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.65;

  try {
    const qdrant = getClient();
    const results = await qdrant.search(collection, {
      vector: queryVector,
      limit: topK,
      with_payload: true,
      score_threshold: threshold,
    });

    logger.debug(`Qdrant search returned ${results.length} results above threshold ${threshold}`);
    return results;
  } catch (error) {
    logger.error('Qdrant search failed', { error: error.message });
    throw error;
  }
}


export async function healthCheck() {
  try {
    const qdrant = getClient();
    const collection = process.env.QDRANT_COLLECTION || 'ayurveda_core_data';
    const info = await qdrant.getCollection(collection);
    return { status: 'ok', collection, pointsCount: info.points_count };
  } catch (error) {
    logger.error('Qdrant health check failed', { error: error.message });
    return { status: 'error', message: error.message };
  }
}
