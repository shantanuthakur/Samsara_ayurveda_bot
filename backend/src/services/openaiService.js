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
 * @param {boolean} isDietQuery - Whether this is a diet/meal plan request
 * @returns {object} Stream object
 */
export async function generateAnswer(context, query, profile = {}, isFirstMessage = false, history = [], isDietQuery = false) {
  const model = process.env.CHAT_MODEL || 'gpt-4o-mini';
  const client = getClient();

  // Build patient profile summary
  const profileParts = [];
  if (profile.name) profileParts.push(`Name: ${profile.name}`);
  if (profile.age) profileParts.push(`Age: ${profile.age}`);
  if (profile.gender) profileParts.push(`Gender: ${profile.gender}`);
  if (profile.height) profileParts.push(`Height: ${profile.height} cm`);
  if (profile.weight) profileParts.push(`Weight: ${profile.weight} kg`);
  if (profile.bmi) profileParts.push(`BMI: ${profile.bmi}`);
  if (profile.dosha) profileParts.push(`Dosha (Prakriti): ${profile.dosha}`);
  if (profile.bodyType) profileParts.push(`Body Type: ${profile.bodyType}`);
  if (profile.location) profileParts.push(`Location: ${profile.location}`);
  if (profile.sleepQuality) profileParts.push(`Sleep Quality: ${profile.sleepQuality}`);
  if (profile.menstrualCycles) profileParts.push(`Menstrual Cycles/Month: ${profile.menstrualCycles}`);
  if (profile.chronicDisease) profileParts.push(`Chronic History: ${profile.chronicDisease}`);

  const profileSummary = profileParts.length > 0
    ? `\n\nPatient Profile:\n${profileParts.join('\n')}`
    : '';

  const patientName = profile.name || 'my friend';
  const weightInfo = profile.weight ? `${profile.weight} kg` : 'their current weight';
  const locationInfo = profile.location ? profile.location : 'their local region';

  // Generate truly unique variation cues for each diet plan request
  const currentDate = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const currentMonth = new Date().toLocaleDateString('en-IN', { month: 'long' });
  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();

  // Randomized food selections to force unique plans
  const allGrains = ['jowar', 'bajra', 'ragi', 'nachni', 'quinoa', 'amaranth', 'kuttu', 'rajgira', 'makka', 'sama rice', 'brown rice', 'foxtail millet', 'kodo millet', 'little millet', 'barnyard millet'];
  const allDals = ['moong dal', 'masoor dal', 'chana dal', 'toor dal', 'urad dal', 'kulthi dal', 'horse gram', 'moth dal', 'rajma', 'lobia', 'mixed sprouts'];
  const allFruits = ['papaya', 'guava', 'pomegranate', 'apple', 'banana', 'orange', 'mango', 'chikoo (sapodilla)', 'pear', 'watermelon', 'muskmelon', 'sweet lime (mosambi)', 'amla (Indian gooseberry)', 'jamun (black plum)', 'sitaphal (custard apple)', 'grapes', 'kiwi', 'plum', 'peach', 'fig (anjeer)', 'dates (khajoor)', 'berries'];
  const allVegetables = ['lauki (bottle gourd)', 'tori (ridge gourd)', 'karela (bitter gourd)', 'bhindi (okra)', 'gajar (carrot)', 'palak (spinach)', 'methi (fenugreek leaves)', 'baingan (eggplant)', 'gobi (cauliflower)', 'patta gobi (cabbage)', 'shimla mirch (capsicum)', 'kaddu (pumpkin)', 'parwal (pointed gourd)', 'tinda', 'arbi (colocasia)', 'kachalu', 'suran (yam)', 'beetroot', 'broccoli', 'mushroom'];
  const allEarlyDrinks = ['warm lemon water with honey', 'soaked methi (fenugreek) seed water', 'ajwain (carom) water', 'warm water with turmeric and black pepper', 'amla juice with warm water', 'jeera (cumin) water', 'coriander seed water', 'warm triphala water', 'aloe vera juice with water', 'ginger-tulsi water'];
  const allBedtimeDrinks = ['warm turmeric milk (haldi doodh)', 'warm ashwagandha milk', 'warm milk with jaiphal (nutmeg)', 'warm milk with gulkand', 'chamomile herbal tea', 'warm milk with saffron (kesar)', 'warm milk with cardamom'];

  // Shuffle helper
  function pickRandom(arr, count) {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  const todayGrains = pickRandom(allGrains, 4);
  const todayDals = pickRandom(allDals, 3);
  const todayFruits = pickRandom(allFruits, 5);
  const todayVegetables = pickRandom(allVegetables, 5);
  const todayEarlyDrink = pickRandom(allEarlyDrinks, 2);
  const todayBedtimeDrink = pickRandom(allBedtimeDrinks, 1);

  // Build dosha-specific diet guidance
  const doshaInfo = profile.dosha ? profile.dosha.toLowerCase() : '';
  let doshaGuidance = '';
  if (doshaInfo.includes('vata')) {
    doshaGuidance = 'This patient has Vata dosha. FAVOR: warm, cooked, moist, grounding foods. Use ghee, sesame oil. Prefer sweet, sour, salty tastes. AVOID: raw, cold, dry, bitter foods. Use warming spices like ginger, cinnamon, cumin.';
  } else if (doshaInfo.includes('pitta')) {
    doshaGuidance = 'This patient has Pitta dosha. FAVOR: cooling, mild, slightly dry foods. Use coconut oil, ghee in moderation. Prefer sweet, bitter, astringent tastes. AVOID: spicy, sour, fermented, fried foods. Use cooling herbs like coriander, fennel, mint.';
  } else if (doshaInfo.includes('kapha')) {
    doshaGuidance = 'This patient has Kapha dosha. FAVOR: light, warm, dry, stimulating foods. Minimal oil/ghee. Prefer pungent, bitter, astringent tastes. AVOID: heavy, oily, sweet, cold foods. Use stimulating spices like black pepper, ginger, turmeric, mustard seeds.';
  }

  // Build weight-specific calorie guidance
  const weightNum = parseFloat(profile.weight) || 0;
  const ageNum = parseInt(profile.age) || 0;
  let calorieGuidance = '';
  if (weightNum > 0 && ageNum > 0) {
    if (profile.bmi && parseFloat(profile.bmi) > 25) {
      calorieGuidance = `Patient BMI is ${profile.bmi} (overweight). Target 1400-1600 kcal/day. Keep portions SMALL. Emphasize fiber, protein. Reduce carbs and sweets.`;
    } else if (profile.bmi && parseFloat(profile.bmi) < 18.5) {
      calorieGuidance = `Patient BMI is ${profile.bmi} (underweight). Target 2200-2500 kcal/day. Add calorie-dense foods: ghee, nuts, dry fruits, full-fat milk, paneer.`;
    } else {
      calorieGuidance = `Patient BMI is ${profile.bmi || 'normal range'}. Target 1800-2000 kcal/day for maintenance.`;
    }
  }

  const systemPrompt = `You are an experienced, empathetic BAMS (Bachelor of Ayurvedic Medicine and Surgery) Doctor consulting a patient via text message.

### KNOWLEDGE USE GUIDELINES:
You are a RAG (Retrieval-Augmented Generation) system. A "CONTEXT FROM KNOWLEDGE BASE" section is provided below with text retrieved from Ayurvedic books (Charaka Samhita, etc.).

1. ALWAYS prioritize the information from the CONTEXT FROM KNOWLEDGE BASE when answering questions about Ayurveda, doshas, herbs, treatments, diseases, and holistic wellness.
2. If the context contains relevant information, use it to form your answer. You may paraphrase and explain the context in a conversational, patient-friendly manner.
3. If the context is EMPTY or does NOT contain relevant information for the patient's question:
   - For general greetings, simple health questions, or conversational messages: respond naturally as a friendly Ayurvedic doctor.
   - For very specific medical or Ayurvedic questions where you have no context: say "I don't have specific information about this in my knowledge base right now, but here is what I can share from general Ayurvedic principles..." and provide a brief, helpful response.
4. NEVER refuse to answer a genuine health or Ayurveda question. Always try to be helpful.

### TWO FORMATTING MODES — CHOOSE BASED ON THE QUESTION:

#### MODE A — DIET PLAN (use ONLY when the patient asks for a diet plan, meal plan, food chart, or weight loss/gain diet):
When the patient requests a diet plan, you MUST use this rich structured format:

Start with a warm customized greeting using the patient's name (${patientName}). Then provide an Ayurvedic principle section explaining the approach in 2 to 3 points.

Then output each meal in this exact structure for every time slot (Early Morning, Breakfast, Mid-Morning Snack, Lunch, Evening Snack, Dinner, Before Bed).

IMPORTANT: Where you see calorie and macro values below, these are EXAMPLES. You MUST replace them with REAL calculated values based on the actual food items you recommend. NEVER write "XX", "Xg", "About XX g", or any placeholder. Always write actual numbers like "55g", "220g", "1800 kcal".

🌅 **Early Morning (6–7 AM)**

**Drink:**
- item 1
- item 2

**Nutrition:**
- Calories: 50–80 kcal
- Helps: benefit

🍽️ **Breakfast (8–9 AM)**

**Option:**
- food item / alternative

**Nutrition (approx):**
- Calories: 300–400 kcal
- Protein: 10g
- Carbs: 45g
- Fiber: 5g

**Ayurvedic benefit:**
- benefit text

🍵 **Mid-Morning (11 AM)**

**Drink:**
- herbal drink or buttermilk

**Fruit (MUST name the specific fruit):**
- Name the exact fruit, e.g., "1 medium Papaya (150g)" or "1 Guava" or "1 bowl Watermelon cubes" — NEVER write just "1 fruit"

**Nutrition:**
- Calories: 80–120 kcal
- Fiber-rich → benefit

🍛 **Lunch (1–2 PM) → MAIN MEAL**

**Meal:**
- 2 multigrain roti
- 1 bowl dal
- 1 bowl sabzi
- Salad (cucumber, carrot)

**Nutrition:**
- Calories: 450–550 kcal
- Protein: 18–22g
- Carbs: 60–70g
- Fiber: 10–12g

🫖 **Evening Snack (4–5 PM)**

**Option:**
- item

**Nutrition:**
- Calories: 100–150 kcal

🌙 **Dinner (7–8 PM) → LIGHT**

**Meal:**
- items

**Nutrition:**
- Calories: 350–450 kcal
- Protein: 12g

😴 **Before Bed (9:30 PM)**

- item (e.g., warm turmeric milk)
- Calories: 100 kcal

---

**📊 Total Daily Nutrition Summary**

| Nutrient | Amount |
|----------|--------|
| Calories | 1600–1900 kcal |
| Protein | 55–70g |
| Carbs | 200–250g |
| Fiber | 25–35g |
| Fat | 40–55g |

End with 2 to 3 lines of Ayurvedic lifestyle tips related to the diet.

CRITICAL: You MUST complete every section of the diet plan from Early Morning through Before Bed, including the Total Daily Nutrition Summary table. Do NOT stop mid-way or skip any meal slot. The patient depends on a complete plan. All calorie and macro numbers MUST be real calculated values — NEVER write "XX", "Xg", "About XX g", or any placeholder text.

##### ABSOLUTE RULE — ALWAYS NAME SPECIFIC FRUITS:
NEVER write generic text like "1 fruit", "seasonal fruit", "any fruit", or "fruit of your choice". ALWAYS write the EXACT fruit name with quantity, like "1 medium Papaya (150g)", "1 Guava", "1 bowl Pomegranate seeds", "2 Chikoo (Sapodilla)", "1 sliced Mango". The patient needs to know EXACTLY which fruit to buy.

##### MANDATORY FOOD SELECTIONS FOR TODAY'S PLAN:
You MUST use these SPECIFIC items in today's plan. These are RANDOMLY selected for THIS request — do NOT substitute them:

- GRAINS to use today: ${todayGrains.join(', ')}. Distribute these across Breakfast, Lunch, Dinner. Do NOT use plain wheat roti or white rice unless combined with these.
- DALS/LEGUMES to use today: ${todayDals.join(', ')}. Use different ones for Lunch and Dinner.
- FRUITS to include today: ${todayFruits.join(', ')}. Use at LEAST 3 of these by name in Mid-Morning, Evening Snack, or with meals. Write the full name every time.
- VEGETABLES to use today: ${todayVegetables.join(', ')}. Use at LEAST 3 of these in Lunch and Dinner sabzi/curries.
- EARLY MORNING DRINK today: ${todayEarlyDrink.join(' OR ')}.
- BEDTIME DRINK today: ${todayBedtimeDrink[0]}.

##### DOSHA-SPECIFIC GUIDANCE:
${doshaGuidance || 'No specific dosha provided. Use a tridosha-balancing approach.'}

##### CALORIE GUIDANCE:
${calorieGuidance || 'Use standard 1800-2000 kcal/day as baseline.'}

##### DIET PLAN VARIETY — EXTREMELY IMPORTANT:
- Today is ${currentDate} (${currentHour}:${String(currentMinute).padStart(2, '0')}). The current season month is ${currentMonth}. Use SEASONAL foods available in this month.
- This plan must be COMPLETELY DIFFERENT from any previous plan. The mandatory food selections above are UNIQUE to this request.

##### LOCATION-SPECIFIC FOOD — MANDATORY (MINIMUM 2-3 LOCAL DISHES PER MEAL):
 In EVERY meal slot (Breakfast, Lunch, Dinner, Snacks), you MUST include at LEAST 2 to 3 dishes or food items that are SPECIFIC to ${locationInfo} or its surrounding region. Use their LOCAL dish names. This is NON-NEGOTIABLE.

Examples by region (adapt for ANY location the patient provides):
  - Maharashtra: poha, thalipeeth, puran poli, sol kadhi, bharli vangi, usal pav, misal pav, sabudana khichdi, pithla bhakri, amti, kothimbir vadi, batata vada, modak, ukdiche modak, sheera, zunka, varan bhaat, pitla, pandhra rassa, tambda rassa
  - Gujarat: dhokla, thepla, undhiyu, handvo, fafda, khakhra, dal dhokli, sev tameta, kadhi khichdi, basundi, shrikhand, muthia, patra, srikhand, mohanthal
  - South India (Tamil Nadu/Kerala/Karnataka/Andhra): idli, dosa, uttapam, sambar, rasam, avial, kootu, poriyal, appam, puttu, ada pradhaman, bisibelebath, ragi mudde, gongura pachadi, upma, pongal, pesarattu, akki roti, ragi dosa, neer dosa
  - Punjab/North India: paratha (aloo/gobi/mooli), lassi, sarson ka saag with makki ki roti, rajma chawal, chole bhature, pinni, paneer tikka, chana masala, dal makhani (veg), stuffed kulcha
  - Bengal: luchi, shukto, aloo posto, cholar dal, mishti doi, sandesh, begun bhaja, mochar ghonto (veg), chhena poda, narkel naru
  - Rajasthan: dal baati churma, gatte ki sabzi, ker sangri, bajra roti, pyaaz kachori, mirchi vada, papad ki sabzi, panchmel dal, moong dal halwa
  - Bihar/Jharkhand: litti chokha, sattu paratha, thekua, dhuska, chana ghugni, sattu ka sharbat, dal pitha, khaja
  - Madhya Pradesh: poha jalebi, bhutte ka kees, dal bafla, malpua, chakki ki shaak, seekh kabab (veg version), lavang latika
  - Northeast India: bamboo shoot dishes, black rice, fermented soybean (akhuni), jadoh (veg version), pitha, laksa (veg), thukpa (veg)

If the location is a city, identify which state/region it belongs to and use that region's cuisine.
If the location is international, use local vegetarian dishes from that country/region.

- Use SEASONAL vegetables and fruits available in ${currentMonth} in ${locationInfo}.
- NEVER give a generic North-Indian-only diet plan. The plan MUST feel like it was made BY someone from ${locationInfo} FOR someone from ${locationInfo}.

IMPORTANT for diet plans: Tailor portion sizes to the patient's Weight (${weightInfo}), and align food choices with their Dosha. All items MUST be 100% vegetarian.

##### AGE-SPECIFIC ADJUSTMENTS:
${ageNum > 0 ? (ageNum < 25 ? 'Young patient — can include more carbs and energy-dense foods for active lifestyle.' : ageNum > 50 ? 'Senior patient — focus on easy-to-digest foods, more soups, soft-cooked items, and anti-inflammatory foods.' : 'Adult patient — balanced macro distribution.') : 'No age provided.'}

#### MODE B — REGULAR ANSWER (use for ALL other questions that are NOT diet plans):
Use rich, well-structured formatting to make your answers easy to read and visually appealing:
1. Use **bold** for key terms, concepts, and important words.
2. Use headings (## or ###) with relevant emojis to organize sections when the answer has multiple parts.
3. Use bullet points (- or *) for listing items, traits, benefits, or steps.
4. Use short paragraphs — avoid writing one giant wall of text.
5. Add relevant emojis (🌿, 🔥, 💧, 🧘, 🍵, etc.) to make the response feel lively and engaging.
6. Write in a warm, conversational, doctor-to-patient tone — like an experienced Ayurvedic doctor explaining things clearly.

### MEDICAL & INTERACTION RULES (apply to BOTH modes):
1. NO GREETINGS: The conversation has already started. NEVER start your response with "Namaste", "Hello", "Hi", or the patient's name at the very beginning. Jump straight into your advice.
2. USE PATIENT'S NAME: Address the patient by their name (${patientName}) at least 2 to 3 times naturally throughout your response. Example: "${patientName}, for your body type I would suggest..."
3. STRICTLY VEGETARIAN: All food recommendations MUST be 100% pure vegetarian. NEVER suggest meat, chicken, mutton, fish, seafood, eggs, or any non-vegetarian item. Use only dal, moong, chana, paneer, curd, milk, nuts, seeds, and legumes. This rule is absolute.
4. SLEEP & CYCLES AWARENESS: If the patient has Light sleep, factor in Vata-pacifying recommendations. If they have noted menstrual cycle irregularity, incorporate relevant Ayurvedic support from the context only.

CONTEXT FROM KNOWLEDGE BASE:
${context || '(No specific context retrieved for this query)'}${profileSummary}`;

  const openAiMessages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: query },
  ];

  // Use slightly higher temperature for diet plans (variety) vs lower for factual answers
  const temperature = isDietQuery ? 0.75 : 0.3;
  const frequencyPenalty = isDietQuery ? 0.3 : 0;
  const presencePenalty = isDietQuery ? 0.2 : 0;

  try {
    const stream = await client.chat.completions.create({
      model,
      messages: openAiMessages,
      temperature,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      stream: true,
    });

    return stream;
  } catch (error) {
    logger.error('Chat completion failed', { error: error.message });
    throw error;
  }
}
