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
  const collectionsParam = process.env.QDRANT_COLLECTION || 'ayurveda_core_data';
  const collections = collectionsParam.split(',').map(c => c.trim());
  const threshold = parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.65;

  try {
    const qdrant = getClient();
    
  
    const searchPromises = collections.map(collection => 
      qdrant.search(collection, {
        vector: queryVector,
        limit: topK,
        with_payload: true,
        score_threshold: threshold,
      }).catch(err => {
        logger.error(`Qdrant search failed for collection ${collection}`, { error: err.message });
        return [];
      })
    );

    const resultsArray = await Promise.all(searchPromises);
    
    const combinedResults = resultsArray
      .flat()
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    logger.debug(`Qdrant search across ${collections.length} collection(s) returned ${combinedResults.length} overall results above threshold.`);
    return combinedResults;
  } catch (error) {
    logger.error('Qdrant search failed', { error: error.message });
    throw error;
  }
}

export async function healthCheck() {
  try {
    const qdrant = getClient();
    const collectionsParam = process.env.QDRANT_COLLECTION || 'ayurveda_core_data';
    const collections = collectionsParam.split(',').map(c => c.trim());
   
    const infoPromises = collections.map(c => qdrant.getCollection(c));
    const infoArray = await Promise.all(infoPromises);
    
    const totalPoints = infoArray.reduce((sum, info) => sum + info.points_count, 0);
    return { status: 'ok', collections, pointsCount: totalPoints };
  } catch (error) {
    logger.error('Qdrant health check failed', { error: error.message });
    return { status: 'error', message: error.message };
  }
}
