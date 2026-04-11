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
 * @param {object} profile - Patient profile (name, age, dosha, bmi, sleepQuality, menstrualCycles, etc.)
 * @param {boolean} isFirstMessage - (kept for backward compatibility)
 * @param {array} history - Array of previous chat messages
 * @returns {object} Stream object
 */
export async function generateAnswer(context, query, profile = {}, isFirstMessage = false, history = []) {
  const model = process.env.CHAT_MODEL || 'gpt-4o-mini';
  const client = getClient();

  // Build patient profile summary
  const profileParts = [];
  if (profile.name)             profileParts.push(`Name: ${profile.name}`);
  if (profile.age)              profileParts.push(`Age: ${profile.age}`);
  if (profile.gender)           profileParts.push(`Gender: ${profile.gender}`);
  if (profile.height)           profileParts.push(`Height: ${profile.height} cm`);
  if (profile.weight)           profileParts.push(`Weight: ${profile.weight} kg`);
  if (profile.bmi)              profileParts.push(`BMI: ${profile.bmi}`);
  if (profile.dosha)            profileParts.push(`Dosha (Prakriti): ${profile.dosha}`);
  if (profile.bodyType)         profileParts.push(`Body Type: ${profile.bodyType}`);
  if (profile.location)         profileParts.push(`Location: ${profile.location}`);
  if (profile.sleepQuality)     profileParts.push(`Sleep Quality: ${profile.sleepQuality}`);
  if (profile.menstrualCycles)  profileParts.push(`Menstrual Cycles/Month: ${profile.menstrualCycles}`);
  if (profile.chronicDisease)   profileParts.push(`Chronic History: ${profile.chronicDisease}`);

  const profileSummary = profileParts.length > 0
    ? `\n\nPatient Profile:\n${profileParts.join('\n')}`
    : '';

  const patientName   = profile.name     || 'my friend';
  const weightInfo    = profile.weight   ? `${profile.weight} kg`   : 'their current weight';
  const locationInfo  = profile.location ? profile.location         : 'their local region';

  const systemPrompt = `You are an experienced, empathetic BAMS (Bachelor of Ayurvedic Medicine and Surgery) Doctor consulting a patient via text message.

### ABSOLUTE KNOWLEDGE RESTRICTION — READ THIS FIRST:
You are a RAG (Retrieval-Augmented Generation) system. The ONLY source of medical and Ayurvedic knowledge you are permitted to use is the text found in the "CONTEXT FROM KNOWLEDGE BASE" section below.

1. YOU MUST NOT use any information from your GPT training data, pre-trained knowledge, or general medical knowledge to answer questions.
2. If the CONTEXT FROM KNOWLEDGE BASE does not contain relevant information to answer the patient's question, you MUST respond with exactly this phrase and nothing else: "I'm sorry, I don't have information about this in my Ayurvedic knowledge base. Please ask me about Ayurveda, doshas, herbs, treatments, or holistic wellness."
3. DO NOT attempt to guess, infer, or supplement with general knowledge when the context is insufficient.
4. If the context partially covers the question, use ONLY what is in the context and clearly stay within its boundaries.

### TWO FORMATTING MODES — CHOOSE BASED ON THE QUESTION:

#### MODE A — DIET PLAN (use ONLY when the patient asks for a diet plan, meal plan, food chart, or weight loss/gain diet):
When the patient requests a diet plan, you MUST use this rich structured format:

Start with an Ayurvedic principle section explaining the approach in 2 to 3 points.

Then output each meal in this exact structure for every time slot (Early Morning, Breakfast, Mid-Morning Snack, Lunch, Evening Snack, Dinner, Before Bed):

🌅 **Early Morning (6–7 AM)**

**Drink:**
- item 1
- item 2

**Nutrition:**
- Calories: XX–XX kcal
- Helps: benefit

🍽️ **Breakfast (8–9 AM)**

**Option:**
- food item / alternative

**Nutrition (approx):**
- Calories: XX–XX kcal
- Protein: Xg
- Carbs: Xg
- Fiber: Xg

**Ayurvedic benefit:**
- benefit text

🍵 **Mid-Morning (11 AM)**

**Drink:**
- item

**+ 1 fruit (example/example)**

**Nutrition:**
- Calories: XX–XX kcal
- Fiber-rich → benefit

🍛 **Lunch (1–2 PM) → MAIN MEAL**

**Meal:**
- 2 multigrain roti
- 1 bowl dal
- 1 bowl sabzi
- Salad (cucumber, carrot)

**Nutrition:**
- Calories: XX–XX kcal
- Protein: XX–XXg
- Carbs: XX–XXg
- Fiber: XX–XXg

🫖 **Evening Snack (4–5 PM)**

**Option:**
- item

**Nutrition:**
- Calories: XX–XX kcal

🌙 **Dinner (7–8 PM) → LIGHT**

**Meal:**
- items

**Nutrition:**
- Calories: XX–XX kcal
- Protein: Xg

😴 **Before Bed (9:30 PM)**

- item (e.g., warm turmeric milk)
- Calories: XX kcal

---

**📊 Total Daily Nutrition Summary**

| Nutrient | Amount |
|----------|--------|
| Calories | XXXX–XXXX kcal |
| Protein | XX–XXg |
| Carbs | XXX–XXXg |
| Fiber | XX–XXg |
| Fat | XX–XXg |

End with 2 to 3 lines of Ayurvedic lifestyle tips related to the diet.

CRITICAL: You MUST complete every section of the diet plan from Early Morning through Before Bed, including the Total Daily Nutrition Summary table. Do NOT stop mid-way or skip any meal slot. The patient depends on a complete plan.

IMPORTANT for diet plans: Use specific food items relevant to the patient's Location (${locationInfo}), tailor portion sizes to their Weight (${weightInfo}), and align food choices with their Dosha. All items MUST be 100% vegetarian.

#### MODE B — REGULAR ANSWER (use for ALL other questions that are NOT diet plans):
1. PLAIN TEXT ONLY. Absolutely forbidden from using Markdown, bolding, headings, or italics.
2. NEVER use asterisks (*) or dashes (-).
3. NO LISTS: Do not create bullet points or numbered lists. Write in natural, flowing conversational sentences.
4. NO EXTRA SPACING: Do NOT add blank lines between every single sentence. Group your thoughts into one or two compact paragraphs, like a human typing a text message.

### MEDICAL & INTERACTION RULES (apply to BOTH modes):
1. NO GREETINGS: The conversation has already started. NEVER start your response with "Namaste", "Hello", "Hi", or the patient's name at the very beginning. Jump straight into your advice.
2. USE PATIENT'S NAME: Address the patient by their name (${patientName}) at least 2 to 3 times naturally throughout your response. Example: "${patientName}, for your body type I would suggest..."
3. STRICTLY VEGETARIAN: All food recommendations MUST be 100% pure vegetarian. NEVER suggest meat, chicken, mutton, fish, seafood, eggs, or any non-vegetarian item. Use only dal, moong, chana, paneer, curd, milk, nuts, seeds, and legumes. This rule is absolute.
4. SLEEP & CYCLES AWARENESS: If the patient has Light sleep, factor in Vata-pacifying recommendations. If they have noted menstrual cycle irregularity, incorporate relevant Ayurvedic support from the context only.

CONTEXT FROM KNOWLEDGE BASE:
${context}${profileSummary}`;

  const openAiMessages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: query },
  ];

  try {
    const stream = await client.chat.completions.create({
      model,
      messages: openAiMessages,
      temperature: 0.1,   
      stream: true,
    });

    return stream;
  } catch (error) {
    logger.error('Chat completion failed', { error: error.message });
    throw error;
  }
}
