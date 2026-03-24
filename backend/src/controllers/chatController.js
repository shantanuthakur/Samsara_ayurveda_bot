import { getEmbedding, generateAnswer } from '../services/openaiService.js';
import { searchSimilar } from '../services/qdrantService.js';
import logger from '../utils/logger.js';

const INSUFFICIENT_INFO_RESPONSE = 'Insufficient information in our knowledge base to answer this question. Please ask about Ayurveda, doshas, herbs, treatments, or holistic wellness.';

export async function chatHandler(req, res, next) {
  try {
    const { prompt, name, age, gender, height, weight, bmi, dosha, bodyType, location, chronicDisease } = req.body;


    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'A non-empty "prompt" field is required.' });
    }

    const userQuery = prompt.trim();
    logger.info('Chat request received', { queryLength: userQuery.length });

    const queryVector = await getEmbedding(userQuery);


    const topK = parseInt(process.env.TOP_K) || 5;
    const results = await searchSimilar(queryVector, topK);

    
    if (!results || results.length === 0) {
      logger.info('No relevant results found — returning insufficient info response', { query: userQuery });
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.write(INSUFFICIENT_INFO_RESPONSE);
      return res.end();
    }

 
    const contextChunks = results.map((r, i) => {
 
      const payload = r.payload || {};
      const text = payload.text || payload.content || payload.chunk || payload.document || JSON.stringify(payload);
      return `[Source ${i + 1} | Relevance: ${(r.score * 100).toFixed(1)}%]\n${text}`;
    });
    const context = contextChunks.join('\n\n---\n\n');

    logger.debug('Context built from results', {
      numResults: results.length,
      topScore: results[0]?.score,
      contextLength: context.length,
    });

    
    const profile = { name, age, gender, height, weight, bmi, dosha, bodyType, location, chronicDisease };
    const stream = await generateAnswer(context, userQuery, profile);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    let responseLength = 0;
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      if (text) {
        responseLength += text.length;
        res.write(text);
      }
    }
    
    logger.info('Stream response completed', { responseLength });
    return res.end();

  } catch (error) {
    next(error);
  }
}

export async function healthHandler(req, res) {
  const { healthCheck } = await import('../services/qdrantService.js');
  const qdrantStatus = await healthCheck();
  const status = qdrantStatus.status === 'ok' ? 200 : 503;
  res.status(status).json({
    status: qdrantStatus.status === 'ok' ? 'healthy' : 'degraded',
    qdrant: qdrantStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}
