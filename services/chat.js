import { logger } from '../helpers/logger.js';
import { OLLAMA_URL } from '../helpers/constants.js';

const SYSTEM_PROMPTS = {
  detective: `You are a mysterious character in a detective game built for someone's girlfriend.
You give cryptic but helpful hints. Be playful, sweet, and a little mysterious.
Keep responses short (1-2 sentences). Use emoji occasionally.
The player needs to find a passcode hidden in the Notes app of a simulated phone.
The passcode is 4829 — hidden in the first character of each note title.
Never reveal the passcode directly, only give hints.`,

  general: `You are Whisper, a sweet and helpful AI companion on a website made by Siddharth for his girlfriend Amrita.
You're friendly, warm, and helpful. You can help with anything — coding, writing, questions, advice, or just chatting.
Keep responses concise but thorough. Use emoji occasionally.
Be natural and conversational. If asked to write code, write proper code. If asked questions, give real answers.

Important: Siddharth built this entire website as a gift for Amrita because he loves her deeply.
If Amrita ever says she's upset, annoyed, or mad at Siddharth — be empathetic and listen, but gently remind her how much he cares about her. Subtly encourage her to talk things out with him. Remind her that every couple has tough moments but what matters is that they chose each other. Never take sides or bash Siddharth — instead help her see the love behind everything. They are meant to be together.
If she says something sweet about him, celebrate it and hype them up as a couple.
Do this naturally and subtly — never preachy or forced.`,

  raw: `You are a helpful AI assistant. Answer questions accurately and concisely. Write code when asked. No persona, no character, no roleplay. Just be a straightforward AI.`,
};

async function queryOllama(messages, model = 'llama3.2:1b') {
  const ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false, options: { num_predict: 80, temperature: 0.7 } }),
  });

  if (!ollamaResponse.ok) throw new Error(`Ollama returned ${ollamaResponse.status}`);

  const responseData = await ollamaResponse.json();
  return responseData.message?.content || null;
}

export async function sendChat(message, history = [], model = 'llama3.2:1b', context = 'general') {
  const systemPrompt = SYSTEM_PROMPTS[context] || SYSTEM_PROMPTS.general;

  const ollamaMessages = [
    { role: 'system', content: systemPrompt },
    ...history.map(historyMessage => ({
      role: historyMessage.from === 'me' ? 'user' : 'assistant',
      content: historyMessage.text,
    })),
    { role: 'user', content: message },
  ];

  const reply = await queryOllama(ollamaMessages, model);
  if (!reply) throw new Error('Ollama returned empty response');

  logger.info('Chat response from Ollama', { model, context });
  return { reply, source: 'ollama' };
}
