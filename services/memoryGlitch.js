import { logger } from '../helpers/logger.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

const DIFFICULTIES = {
  easy: { paragraphs: 3, diffs: 3, wordCount: '30-40' },
  medium: { paragraphs: 4, diffs: 5, wordCount: '50-60' },
  hard: { paragraphs: 5, diffs: 7, wordCount: '70-80' },
};

export async function generateTextPair(difficulty = 'easy') {
  const config = DIFFICULTIES[difficulty] || DIFFICULTIES.easy;

  const prompt = `Generate a short diary entry with exactly ${config.paragraphs} paragraphs, total ${config.wordCount} words. Topic should be a sweet everyday moment (like a walk, cooking, a rainy day, a gift, a pet, a trip, stargazing, baking, etc). Use simple warm language.

Then create a SECOND version of the EXACT same text but change exactly ${config.diffs} words to different words. The changes should be subtle — swap a color, a number, a name, an adjective, a time of day, etc.

Respond ONLY in this exact JSON format, no other text:
{"title":"Short Title","original":["paragraph 1","paragraph 2","paragraph 3"],"glitched":["paragraph 1 with changes","paragraph 2 with changes","paragraph 3 with changes"],"diffCount":${config.diffs}}`;

  const ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2:1b',
      messages: [
        { role: 'system', content: 'You are a JSON generator. Only output valid JSON. No markdown, no code blocks, no explanation.' },
        { role: 'user', content: prompt },
      ],
      stream: false,
      options: { num_predict: 500, temperature: 0.8 },
    }),
  });

  if (!ollamaResponse.ok) throw new Error(`Ollama returned ${ollamaResponse.status}`);

  const responseData = await ollamaResponse.json();
  const rawContent = responseData.message?.content;
  if (!rawContent) throw new Error('Empty response from Ollama');

  const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No valid JSON in response');

  const parsedPair = JSON.parse(jsonMatch[0]);

  if (!parsedPair.title || !parsedPair.original || !parsedPair.glitched) {
    throw new Error('Invalid text pair structure');
  }

  logger.info('Generated memory glitch pair', { difficulty, title: parsedPair.title });

  return {
    title: parsedPair.title,
    difficulty,
    diffCount: parsedPair.diffCount || config.diffs,
    original: Array.isArray(parsedPair.original) ? parsedPair.original : [parsedPair.original],
    glitched: Array.isArray(parsedPair.glitched) ? parsedPair.glitched : [parsedPair.glitched],
  };
}
