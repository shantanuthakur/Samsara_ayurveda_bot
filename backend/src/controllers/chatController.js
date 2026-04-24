import { getEmbedding, generateAnswer } from '../services/openaiService.js';
import { searchSimilar, searchByTypes } from '../services/qdrantService.js';
import logger from '../utils/logger.js';

// Common misspelling corrections for Ayurveda-related terms
const SPELL_CORRECTIONS = [
  [/\b(a+r[ue]+r?v?e?d+a?|a+y?u?r[uv]?e?d+a?|aay?u?rv?e?d+a?|aaruerveda|aruerveda|aurveda|ayurvda|aryuveda|ayurvedia|ayurved)\b/gi, 'ayurveda'],
  [/\b(nuration|nutration|nutrtion|nutriton|nurtition)\b/gi, 'nutrition'],
  [/\b(patato|potao|ptato)\b/gi, 'potato'],
  [/\b(pumpin|pumpkn|pumkin)\b/gi, 'pumpkin'],
  [/\b(vatta|vaata|vat[ah])\b/gi, 'vata'],
  [/\b(piita|pita|pittah)\b/gi, 'pitta'],
  [/\b(kaph|kapah|kaffa)\b/gi, 'kapha'],
  [/\b(dosh[ah]?s?)\b/gi, match => match.toLowerCase().startsWith('dosha') ? match : 'dosha'],
];

function correctSpelling(text) {
  let corrected = text;
  for (const [pattern, replacement] of SPELL_CORRECTIONS) {
    corrected = corrected.replace(pattern, replacement);
  }
  return corrected;
}

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
  'gym diet', 'gym food', 'gym meal', 'workout diet', 'workout food',
  'fitness diet', 'fitness food', 'muscle diet', 'protein diet',
  'bodybuilding diet', 'exercise diet', 'training diet',
];

function isDietPlanQuery(text) {
  const lower = text.toLowerCase();
  return DIET_KEYWORDS.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(lower));
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

    const rawQuery = prompt.trim();
    const userQuery = correctSpelling(rawQuery);
    const isDiet = isDietPlanQuery(userQuery);
    if (rawQuery !== userQuery) {
      logger.info('Spell-corrected query', { original: rawQuery, corrected: userQuery });
    }
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
        res.write('📋 **Profile Incomplete**\n\nTo create a personalized diet plan, I need your complete profile information.\n\n**Please fill in your details:**\n- 👤 **Name**, **Age**, **Gender**\n- 📏 **Height** & **Weight**\n- 🧬 **Body Type** & **Dosha**\n- 📍 **Location**\n- 😴 **Sleep Quality**\n\nOpen the **Patient Profile** sidebar ➡️ to fill in your details, then ask me again! 🙏');
        return res.end();
      }
    }

    // Get embedding and search knowledge base
    const queryVector = await getEmbedding(userQuery);
    const topK = parseInt(process.env.TOP_K) || 5;

    // Run main search + supplementary filtered search in parallel
    const [results, supplementaryResults] = await Promise.all([
      searchSimilar(queryVector, topK),
      searchByTypes(queryVector, ['nutrition', 'remedy', 'regional_food', 'book_chunk'], 5)
    ]);

    // Build context from main search results
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

    // Append supplementary results (from filtered Qdrant search with lower threshold)
    if (supplementaryResults && supplementaryResults.length > 0) {
      // Avoid duplicates — only add results not already in main results
      const mainIds = new Set((results || []).map(r => r.id));
      const extraChunks = supplementaryResults
        .filter(r => !mainIds.has(r.id))
        .map((r, i) => {
          const payload = r.payload || {};
          const text = payload.text || payload.content || payload.chunk || payload.document || JSON.stringify(payload);
          const typeLabel = payload.type ? `[${payload.type}]` : '';
          return `[Supplementary ${typeLabel} | Relevance: ${(r.score * 100).toFixed(1)}%]\n${text}`;
        });

      if (extraChunks.length > 0) {
        context = context
          ? `${context}\n\n---\n\n${extraChunks.join('\n\n---\n\n')}`
          : extraChunks.join('\n\n---\n\n');
      }
    }

    logger.debug('Context built from results', {
      mainResults: results?.length || 0,
      supplementaryResults: supplementaryResults?.length || 0,
      topScore,
      contextLength: context.length,
      contextPreview: context.substring(0, 200),
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