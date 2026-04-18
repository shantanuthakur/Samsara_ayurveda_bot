import { getEmbedding, generateAnswer } from '../services/openaiService.js';
import { searchSimilar } from '../services/qdrantService.js';
import logger from '../utils/logger.js';

// Diet/meal plan keywords — used to detect if profile is required server-side
const DIET_KEYWORDS = [
  'diet plan', 'meal plan', 'food chart', 'food plan', 'calorie plan',
  'weight loss diet', 'weight gain diet', 'what should i eat',
  'daily diet', 'eating plan', 'nutrition plan', 'diet chart',
  'breakfast lunch dinner', 'khana', 'aahaar', 'bhojan',
  'suggest food', 'suggest diet', 'recommend diet', 'recommend food',
  'meal chart', 'food schedule', 'diet schedule', 'kya khana chahiye',
  'diet food', 'food recommendation', 'diet item', 'diet recommendation',
  'what to eat', 'what can i eat', 'what i eat', 'food suggestion',
  'food for me', 'best food', 'healthy food', 'healthy diet',
  'weight loss food', 'weight gain food', 'food advice', 'eating advice',
  'my diet', 'my food', 'my meal', 'give me diet', 'give me food',
  'give me meal', 'create diet', 'create meal', 'make diet', 'make meal',
  'plan my diet', 'plan my meal', 'diet for me', 'meal for me',
  'food for weight', 'food for health', 'diet tips', 'food tips',
  'kya khaye', 'kya khau', 'khana batao', 'diet batao',
];

function isDietPlanQuery(text) {
  const lower = text.toLowerCase();
  return DIET_KEYWORDS.some(kw => lower.includes(kw));
}

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
    const isDiet = isDietPlanQuery(userQuery);
    logger.info('Chat request received', { queryLength: userQuery.length, isDietQuery: isDiet });

    // Server-side check: diet plan requires complete profile
    if (isDiet) {
      const requiredFields = { name, age, gender, height, weight, dosha, bodyType, location, sleepQuality };
      const missing = Object.entries(requiredFields)
        .filter(([, v]) => !v || v.toString().trim() === '')
        .map(([k]) => k);
      if (missing.length > 0) {
        logger.info('Diet plan requested but profile incomplete', { missing });
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.write('To create a personalized diet plan, I need your complete profile information. Please fill in your details in the Patient Profile sidebar.');
        return res.end();
      }
    }

    // Get embedding and search knowledge base
    const queryVector = await getEmbedding(userQuery);
    const topK = parseInt(process.env.TOP_K) || 5;
    const results = await searchSimilar(queryVector, topK);

    // Build context from search results (may be empty — that's OK)
    let context = '';
    let topScore = 0;
    if (results && results.length > 0) {
      topScore = results[0]?.score ?? 0;
      const contextChunks = results.map((r, i) => {
        const payload = r.payload || {};
        const text = payload.text || payload.content || payload.chunk || payload.document || JSON.stringify(payload);
        return `[Source ${i + 1} | Relevance: ${(r.score * 100).toFixed(1)}%]\n${text}`;
      });
      context = contextChunks.join('\n\n---\n\n');
    }

    logger.debug('Context built from results', {
      numResults: results?.length || 0,
      topScore,
      contextLength: context.length,
    });

    const profile = {
      name, age, gender, height, weight, bmi,
      dosha, bodyType, location, chronicDisease,
      sleepQuality, menstrualCycles,
    };

    const isFirstMessage = history.length <= 1;

    const stream = await generateAnswer(context, userQuery, profile, isFirstMessage, history, isDiet);

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