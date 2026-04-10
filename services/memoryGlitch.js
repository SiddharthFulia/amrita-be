import { logger } from '../helpers/logger.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

const DIFFICULTIES = {
  easy: { paragraphs: 3, diffs: 3 },
  medium: { paragraphs: 4, diffs: 5 },
  hard: { paragraphs: 5, diffs: 7 },
};

export async function generateTextPair(difficulty = 'easy') {
  const config = DIFFICULTIES[difficulty] || DIFFICULTIES.easy;

  const prompt = `Write a ${config.paragraphs}-paragraph diary entry about a sweet moment. Each paragraph is 1 sentence. Then make a copy with exactly ${config.diffs} words changed to similar but different words.

Return ONLY valid JSON like this example:
{"title":"My Day","original":["First sentence.","Second sentence.","Third sentence."],"glitched":["First sentence.","Changed sentence.","Third sentence."],"diffCount":${config.diffs}}`;

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

      if (!parsedPair.original || !parsedPair.glitched) {
        throw new Error('Missing original or glitched');
      }

      const originalArray = Array.isArray(parsedPair.original) ? parsedPair.original : [parsedPair.original];
      const glitchedArray = Array.isArray(parsedPair.glitched) ? parsedPair.glitched : [parsedPair.glitched];

      if (originalArray.length === 0 || glitchedArray.length === 0) {
        throw new Error('Empty arrays');
      }

      const minLength = Math.min(originalArray.length, glitchedArray.length);

      logger.info('Generated memory glitch pair', { difficulty, title: parsedPair.title, model: currentModel });

      return {
        title: parsedPair.title || 'A Sweet Memory',
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
