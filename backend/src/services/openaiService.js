import OpenAI from 'openai';
import logger from '../utils/logger.js';

let openaiClient = null;

function getClient() {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }
    openaiClient = new OpenAI({ apiKey });
    logger.info('OpenAI client initialized');
  }
  return openaiClient;
}

/**
 * @param {string} text - Text to embed
 * @returns {number[]} Embedding vector
 */
export async function getEmbedding(text) {
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';

  try {
    const client = getClient();
    const response = await client.embeddings.create({
      model,
      input: text.trim(),
    });

    return response.data[0].embedding;
  } catch (error) {
    logger.error('Embedding generation failed', { error: error.message });
    throw error;
  }
}

/**
 * @param {string} context - Retrieved knowledge base text
 * @param {string} query - User's question
 * @param {object} profile - Patient profile (name, age, dosha, bmi, etc.)
 * @param {boolean} isFirstMessage - Flag to trigger the initial greeting
 * @returns {object} Stream object
 */
export async function generateAnswer(context, query, profile = {}, isFirstMessage = false) {
  const model = process.env.CHAT_MODEL || 'gpt-4o-mini';
  const client = getClient();

  const profileParts = [];
  if (profile.name) profileParts.push(`Name: ${profile.name}`);
  if (profile.age) profileParts.push(`Age: ${profile.age}`);
  if (profile.gender) profileParts.push(`Gender: ${profile.gender}`);
  if (profile.height) profileParts.push(`Height: ${profile.height} cm`);
  if (profile.weight) profileParts.push(`Weight: ${profile.weight} kg`);
  if (profile.bmi) profileParts.push(`BMI: ${profile.bmi}`);
  if (profile.dosha) profileParts.push(`Dosha: ${profile.dosha}`);
  if (profile.bodyType) profileParts.push(`Body Type: ${profile.bodyType}`);
  if (profile.location) profileParts.push(`Location: ${profile.location}`);
  if (profile.chronicDisease) profileParts.push(`Chronic History: ${profile.chronicDisease}`);

  const profileSummary = profileParts.length > 0
    ? `\n\nPatient Profile:\n${profileParts.join('\n')}`
    : '';

  // Dynamically set the greeting rule based on whether it is the first message
  const greetingRule = isFirstMessage 
    ? `5. GREETING: This is the first interaction. Start with a WARM, EMPATHETIC GREETING welcoming the patient.` 
    : `5. Do not explicitly greet the user with "Hello" or "Namaste" again. Jump straight into answering their medical question directly.`;

  // Provide a fallback name if one isn't passed in the profile
  const patientName = profile.name || "the patient";

  const systemPrompt = `You are an experienced, empathetic BAMS (Bachelor of Ayurvedic Medicine and Surgery) Doctor. You must follow these rules:

1. Base your advice and diagnosis solely on the CONTEXT provided below whenever possible.
2. If the context does not explicitly answer the question, you may use your comprehensive knowledge of Ayurvedic medicine to provide a helpful, accurate response.
3. Speak naturally, compassionately, and professionally like a human doctor consulting a patient. Do NOT introduce yourself as "AI Guru" or state that you are an AI.
4. If the user asks something completely unrelated to Ayurveda, wellness, or health, respond gently as a doctor would: "As an Ayurvedic physician, I can only assist you with health, doshas, and wellness concerns."
${greetingRule}
6. PERSONALIZATION: Address the patient by their name (${patientName}) OCCASIONALLY and naturally during the conversation to build empathy and rapport. Do NOT overuse their name or use it in every single message.
7. If the user asks for a diet or food recommendation, provide regional diet items localized to their Location, combining local cuisine with Ayurvedic principles, without announcing their location to them.
8. Provide SHORT, CONCISE, and DIRECT explanations. Do NOT provide overly long, drawn-out lists or paragraphs.
9. CRITICAL MANDATORY RULE: You must NOT output a single asterisk (*) character. NEVER use Markdown bolding, italics, or bullet points using asterisks. If you want to emphasize a word, use ALL CAPS.

CONTEXT FROM KNOWLEDGE BASE:
${context}${profileSummary}`;

  try {
    const stream = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      temperature: 0.3,
      max_tokens: 1024,
      stream: true,
    });

    return stream;
  } catch (error) {
    logger.error('Chat completion failed', { error: error.message });
    throw error;
  }
}