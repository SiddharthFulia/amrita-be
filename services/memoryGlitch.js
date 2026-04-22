import { logger } from '../helpers/logger.js';
import { OLLAMA_URL, GROQ_API_KEY } from '../helpers/constants.js';
import { chatGroq } from './groq.js';

const DIFFICULTIES = {
  easy: { paragraphs: 3, diffs: 3 },
  medium: { paragraphs: 4, diffs: 5 },
  hard: { paragraphs: 5, diffs: 7 },
};

export async function generateTextPair(difficulty = 'easy') {
  const config = DIFFICULTIES[difficulty] || DIFFICULTIES.easy;

  const prompt = `Generate JSON with EXACTLY these 4 keys: "title", "original", "glitched", "diffCount".

RULES:
- "original" is an array of ${config.paragraphs} sentences about a sweet everyday moment. Each sentence ends with a period.
- "glitched" is the EXACT same array but with exactly ${config.diffs} WORDS replaced with DIFFERENT words. NOT punctuation changes. Swap nouns, adjectives, colors, numbers, or names. Every other word and ALL punctuation must stay identical.
- "title" is a short 2-3 word title.
- "diffCount" is ${config.diffs}.
- Do NOT swap pronouns (he/she/his/her). Swap meaningful words like colors (blue→red), animals (cat→dog), foods (coffee→tea), numbers (three→five), places (park→beach), adjectives (old→new).
- Do NOT introduce typos or made-up words. Every word must be a real English word.
- Keep sentences simple and warm.

EXAMPLE:
{"title":"Morning Walk","original":["I walked to the park with my blue umbrella.","The birds were singing in the tall oak trees.","We sat on the old wooden bench together."],"glitched":["I walked to the garden with my blue umbrella.","The birds were singing in the tall oak trees.","We sat on the old metal bench together."],"diffCount":2}

Notice: "park" changed to "garden" and "wooden" changed to "metal". Those are real word swaps. Do NOT just add or remove periods.

Now generate a completely NEW one with a different topic. Output ONLY the JSON object.`;

  let lastError = null;

  // Try Groq first (sub-1s response)
  if (GROQ_API_KEY) {
    try {
      logger.info('Memory glitch trying Groq (llama-3.1-8b)');
      const groqResult = await chatGroq(prompt, [], 'llama-3.1-8b', { system: 'Output ONLY valid JSON. No markdown. No code fences. No explanation. Just the JSON object.', maxTokens: 600, temperature: 0.9 });
      const rawContent = groqResult.reply;
      if (rawContent) {
        logger.info(`Memory glitch Groq raw: ${rawContent.substring(0, 100)}...`);
        const cleanedContent = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedPair = JSON.parse(jsonMatch[0]);
          const unwrapped = parsedPair.original ? parsedPair : parsedPair.diaryEntry || parsedPair.data || parsedPair.entry || parsedPair;
          const originalData = unwrapped.original || unwrapped.paragraphs || unwrapped.sentences;
          const glitchedData = unwrapped.glitched || unwrapped.modified || unwrapped.changed;
          if (originalData && glitchedData) {
            const originalArray = Array.isArray(originalData) ? originalData : [originalData];
            const glitchedArray = Array.isArray(glitchedData) ? glitchedData : [glitchedData];
            const minLength = Math.min(originalArray.length, glitchedArray.length);
            logger.info('Generated memory glitch pair via Groq', { difficulty, title: unwrapped.title || parsedPair.title });
            return {
              title: unwrapped.title || parsedPair.title || 'A Sweet Memory',
              difficulty,
              diffCount: parsedPair.diffCount || config.diffs,
              original: originalArray.slice(0, minLength),
              glitched: glitchedArray.slice(0, minLength),
            };
          }
        }
      }
    } catch (groqError) {
      lastError = groqError;
      logger.warn(`Memory glitch Groq failed: ${groqError.message}, falling back to Ollama...`);
    }
  }

  // Fallback to Ollama models
  const modelsToTry = ['llama3.2:3b', 'qwen2.5:3b', 'gemma2:2b'];

  for (let attempt = 0; attempt < modelsToTry.length; attempt++) {
    const currentModel = modelsToTry[attempt];
    try {
      logger.info(`Memory glitch trying ${currentModel} (attempt ${attempt + 1})`);
      const ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: currentModel,
          messages: [
            { role: 'system', content: 'Output ONLY valid JSON. No markdown. No code fences. No explanation. Just the JSON object.' },
            { role: 'user', content: prompt },
          ],
          stream: false,
          options: { num_predict: 600, temperature: 0.9 },
          format: 'json',
        }),
      });

      if (!ollamaResponse.ok) throw new Error(`Ollama returned ${ollamaResponse.status}`);

      const responseData = await ollamaResponse.json();
      const rawContent = responseData.message?.content;
      if (!rawContent) throw new Error('Empty response');

      logger.info(`Memory glitch raw (attempt ${attempt + 1}): ${rawContent.substring(0, 100)}...`);

      const cleanedContent = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      const parsedPair = JSON.parse(jsonMatch[0]);

      // Handle models that wrap in a parent key like "diaryEntry"
      const unwrapped = parsedPair.original ? parsedPair
        : parsedPair.diaryEntry ? parsedPair.diaryEntry
        : parsedPair.data ? parsedPair.data
        : parsedPair.entry ? parsedPair.entry
        : parsedPair;

      // Also handle "paragraphs" instead of "original"
      const originalData = unwrapped.original || unwrapped.paragraphs || unwrapped.sentences;
      const glitchedData = unwrapped.glitched || unwrapped.modified || unwrapped.changed;

      if (!originalData || !glitchedData) {
        throw new Error(`Missing original or glitched. Keys found: ${Object.keys(parsedPair).join(', ')}`);
      }

      unwrapped.original = originalData;
      unwrapped.glitched = glitchedData;

      const originalArray = Array.isArray(unwrapped.original) ? unwrapped.original : [unwrapped.original];
      const glitchedArray = Array.isArray(unwrapped.glitched) ? unwrapped.glitched : [unwrapped.glitched];

      if (originalArray.length === 0 || glitchedArray.length === 0) {
        throw new Error('Empty arrays');
      }

      const minLength = Math.min(originalArray.length, glitchedArray.length);

      logger.info('Generated memory glitch pair', { difficulty, title: unwrapped.title || parsedPair.title, model: currentModel });

      return {
        title: unwrapped.title || parsedPair.title || 'A Sweet Memory',
        difficulty,
        diffCount: parsedPair.diffCount || config.diffs,
        original: originalArray.slice(0, minLength),
        glitched: glitchedArray.slice(0, minLength),
      };
    } catch (attemptError) {
      lastError = attemptError;
      logger.warn(`Memory glitch ${currentModel} failed: ${attemptError.message}, trying next model...`);
    }
  }

  throw new Error(`Failed all models: ${lastError?.message}`);
}
