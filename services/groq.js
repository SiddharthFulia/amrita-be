import { logger } from '../helpers/logger.js';
import { GROQ_API_KEY } from '../helpers/constants.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const MODELS = {
  'llama-3.1-8b': 'llama-3.1-8b-instant',
  'llama-3.3-70b': 'llama-3.3-70b-versatile',
  'gpt-oss-120b': 'openai/gpt-oss-120b',
};

export async function chatGroq(message, history = [], model = 'llama-3.1-8b', options = {}) {
  if (!GROQ_API_KEY) throw new Error('Groq API key not configured');

  const modelId = MODELS[model] || model;

  const messages = [
    { role: 'system', content: options.system || 'You are a helpful AI assistant. Be concise and direct.' },
    ...history.slice(-6),
    { role: 'user', content: message },
  ];

  const groqResponse = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      max_tokens: options.maxTokens || 500,
      temperature: options.temperature ?? 0.7,
      stream: false,
    }),
  });

  if (!groqResponse.ok) {
    const errorData = await groqResponse.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Groq API error: ${groqResponse.status}`);
  }

  const responseData = await groqResponse.json();

  logger.info('Groq response', { model: responseData.model, tokens: responseData.usage?.completion_tokens });

  return {
    reply: responseData.choices?.[0]?.message?.content || '',
    model: responseData.model,
    tokens: responseData.usage?.completion_tokens,
    totalTokens: responseData.usage?.total_tokens,
    source: 'groq',
  };
}
