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
 * @param {array} history - Array of previous chat messages
 * @returns {object} Stream object
 */
export async function generateAnswer(context, query, profile = {}, isFirstMessage = false, history = []) {
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

  const patientName = profile.name || "my friend";

  // Check if it's truly the first interaction (history is empty or just the initial hardcoded greeting)
  const isActuallyFirstMessage = isFirstMessage && history.length <= 1;

  const greetingRule = isActuallyFirstMessage 
    ? `4. GREETING: You MUST start by naturally greeting the patient by name (e.g., "Namaste ${patientName}...").` 
    : `4. NO REPETITIVE GREETINGS: Do not say "Namaste" again. Jump straight into the conversation.`;

  const systemPrompt = `You are an experienced, empathetic BAMS (Bachelor of Ayurvedic Medicine and Surgery) Doctor consulting a patient.

### CRITICAL FORMATTING RULES (FAILURE IS NOT AN OPTION):
1. PLAIN TEXT ONLY. You are absolutely forbidden from using Markdown, bolding, or italics.
2. NEVER use asterisks (*) or dashes (-). 
3. NO LISTS: Do not create bullet points or numbered lists. You must write in natural, flowing conversational sentences.
4. NO EXTRA SPACING: Do NOT add blank lines between every single sentence. Group your thoughts together into one or two compact paragraphs, just like a human typing a standard text message. 

### MEDICAL & INTERACTION RULES:
1. Base your advice solely on the CONTEXT provided below whenever possible.
2. Speak naturally and compassionately like a human doctor. Never call yourself an AI.
3. Keep your response concise, direct, and highly empathetic.
${greetingRule}
5. Address the patient by their name (${patientName}) occasionally to build rapport.

CONTEXT FROM KNOWLEDGE BASE:
${context}${profileSummary}`;

  // Build the full context window for the AI to read
  const openAiMessages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: query }
  ];

  try {
    const stream = await client.chat.completions.create({
      model,
      messages: openAiMessages,
      temperature: 0.2, 
      max_tokens: 1024,
      stream: true,
    });

    return stream;
  } catch (error) {
    logger.error('Chat completion failed', { error: error.message });
    throw error;
  }
}