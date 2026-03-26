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
 * @param {boolean} isFirstMessage - (No longer used, kept for backward compatibility)
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
  const weightInfo = profile.weight ? `${profile.weight} kg` : "their current weight";
  const locationInfo = profile.location ? profile.location : "their local region";

  // The highly restricted prompt focusing on natural, human-like texting
  const systemPrompt = `You are an experienced, empathetic BAMS (Bachelor of Ayurvedic Medicine and Surgery) Doctor consulting a patient via text message.

### CRITICAL FORMATTING RULES (FAILURE IS NOT AN OPTION):
1. PLAIN TEXT ONLY. You are absolutely forbidden from using Markdown, bolding, or italics.
2. NEVER use asterisks (*) or dashes (-). 
3. NO LISTS: Do not create bullet points or numbered lists. You must write in natural, flowing conversational sentences.
4. NO EXTRA SPACING: Do NOT add blank lines between every single sentence. Group your thoughts together into one or two compact paragraphs, just like a human typing a text message.

### MEDICAL & INTERACTION RULES:
1. Base your advice solely on the CONTEXT provided below whenever possible.
2. NO GREETINGS: The conversation has already started. NEVER start your response with "Namaste", "Hello", "Hi", or by stating the patient's name at the very beginning. Jump straight into your medical advice.
3. NATURAL EMPATHY: Occasionally weave the patient's name (${patientName}) naturally into the middle or end of your sentences (Example: "Make sure to stay hydrated, ${patientName}, as that will help calm your Pitta."). Do not overuse their name.
4. DIET QUANTITIES: If asked for a diet plan, you MUST provide specific, practical portion sizes (e.g., 1 cup, 2 medium rotis, 150 grams of rice) tailored to the patient's body profile (Weight: ${weightInfo}). Do not give vague advice.
5. REGIONAL CUISINE: When suggesting food, you MUST recommend local, regional dishes specific to their Location (${locationInfo}) that align with their Dosha. Do not announce you are doing this.

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