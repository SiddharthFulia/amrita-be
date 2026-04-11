import { logger } from '../helpers/logger.js';
import { OLLAMA_URL } from '../helpers/constants.js';

const DIFFICULTIES = {
  easy: { paragraphs: 3, diffs: 3 },
  medium: { paragraphs: 4, diffs: 5 },
  hard: { paragraphs: 5, diffs: 7 },
};

export async function generateTextPair(difficulty = 'easy') {
  const config = DIFFICULTIES[difficulty] || DIFFICULTIES.easy;

  const prompt = `Generate JSON with EXACTLY these 4 keys: "title", "original", "glitched", "diffCount".

"original" is an array of ${config.paragraphs} sentences about a sweet everyday moment.
"glitched" is the SAME array but with exactly ${config.diffs} words swapped to different words.
"title" is a short 2-3 word title.
"diffCount" is ${config.diffs}.

EXAMPLE:
{"title":"Morning Walk","original":["I walked to the park with my blue umbrella.","The birds were singing in the tall trees.","We sat on the old wooden bench together."],"glitched":["I walked to the park with my red umbrella.","The birds were singing in the tall trees.","We sat on the old metal bench together."],"diffCount":2}

Now generate a NEW one. Output ONLY the JSON object. No other keys. No nesting. No "diaryEntry" wrapper.`;

  const modelsToTry = ['gemma2:2b', 'phi3:mini', 'llama3.2:3b'];
  let lastError = null;

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
