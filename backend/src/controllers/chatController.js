import { getEmbedding, generateAnswer } from '../services/openaiService.js';
import { searchSimilar } from '../services/qdrantService.js';
import logger from '../utils/logger.js';

// Minimum relevance score — results below this are treated as "not found"
const MIN_RELEVANCE_SCORE = parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.65;

const NO_DB_DATA_RESPONSE = "I'm sorry, I don't have information about this in my Ayurvedic knowledge base. Please ask me about Ayurveda, doshas, herbs, lifestyle, or holistic wellness.";

export async function chatHandler(req, res, next) {
  try {

    const {
      prompt,
      history = [],
      name, age, gender, height, weight, bmi,
      dosha, bodyType, location, chronicDisease,
      sleepQuality, menstrualCycles,
    } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'A non-empty "prompt" field is required.' });
    }

    const userQuery = prompt.trim();
    logger.info('Chat request received', { queryLength: userQuery.length });

    const queryVector = await getEmbedding(userQuery);

    const topK = parseInt(process.env.TOP_K) || 5;
    const results = await searchSimilar(queryVector, topK);

    // Gate 1: No results at all
    if (!results || results.length === 0) {
      logger.info('No results from DB — sending "no data" response', { query: userQuery });
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.write(NO_DB_DATA_RESPONSE);
      return res.end();
    }

    // Gate 2: Best match score is below the minimum relevance threshold
    const topScore = results[0]?.score ?? 0;
    if (topScore < MIN_RELEVANCE_SCORE) {
      logger.info('Top result score too low — sending "no data" response', { topScore, query: userQuery });
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.write(NO_DB_DATA_RESPONSE);
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
      topScore,
      contextLength: context.length,
    });

    const profile = {
      name, age, gender, height, weight, bmi,
      dosha, bodyType, location, chronicDisease,
      sleepQuality, menstrualCycles,
    };

    const isFirstMessage = history.length <= 1;

    const stream = await generateAnswer(context, userQuery, profile, isFirstMessage, history);

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