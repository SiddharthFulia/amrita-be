import { logger } from '../helpers/logger.js';
import { OLLAMA_URL } from '../helpers/constants.js';

export async function queryAI(messages, model = 'llama3.2:3b', options = {}) {
  const ollamaPayload = {
    model,
    messages,
    stream: false,
    options: {
      num_predict: options.maxTokens || 200,
      temperature: options.temperature || 0.7,
    },
  };

  const ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ollamaPayload),
  });

  if (!ollamaResponse.ok) throw new Error(`Ollama returned ${ollamaResponse.status}`);

  const responseData = await ollamaResponse.json();
  const reply = responseData.message?.content;
  if (!reply) throw new Error('Ollama returned empty response');

  logger.info('AI response', { model, tokens: responseData.eval_count, duration: responseData.total_duration });

  return {
    reply,
    model: responseData.model,
    tokens: responseData.eval_count || 0,
    duration: responseData.total_duration || 0,
  };
}
