// ─── Chat Service ────────────────────────────────────────────────────────────
// Handles AI chat logic — tries Ollama, falls back to keyword responses.

import { logger } from '../helpers/logger.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

const SYSTEM_PROMPT = `You are a mysterious character in a detective game built for someone's girlfriend.
You give cryptic but helpful hints. Be playful, sweet, and a little mysterious.
Keep responses short (1-2 sentences). Use emoji occasionally.
The player needs to find a passcode hidden in the Notes app of a simulated phone.
The passcode is 4829 — hidden in the first character of each note title.
Never reveal the passcode directly, only give hints.`;

const FALLBACK_RESPONSES = [
  "That's an interesting lead... have you checked the Notes app? 🔍",
  "Hmm, I think the answer is hidden in plain sight. Look at the titles! 📝",
  "Look carefully at the first character of each note. Something doesn't add up. 🤔",
  "You're getting warmer! Keep looking... the clue is in the note titles. 🔥",
  "Try combining what you see in the note titles. Numbers are key! 🔢",
];

/**
 * Try Ollama for AI response
 */
async function queryOllama(messages, model = 'llama3') {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (!res.ok) throw new Error(`Ollama returned ${res.status}`);

  const data = await res.json();
  return data.message?.content || null;
}

/**
 * Keyword-based fallback when Ollama isn't available
 */
function getFallbackResponse(message) {
  const lower = message.toLowerCase();

  if (lower.includes('help') || lower.includes('hint'))
    return "Look at the Notes app — there's a pattern in the titles. 🔍";
  if (lower.includes('password') || lower.includes('passcode') || lower.includes('code'))
    return "I can't just tell you! But look at the FIRST character of each note title... 🤫";
  if (lower.includes('note') || lower.includes('title'))
    return "The note titles aren't random. Read the first character of each one, in order. ✨";
  if (lower.includes('number') || lower.includes('digit'))
    return "Four digits. Each one is hiding at the start of a note title. 🔢";
  if (lower.includes('love') || lower.includes('miss'))
    return "Aww 💕 Focus on the case, detective! But I love you too.";
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey'))
    return "Hey detective! Ready to crack this case? Check the Notes app for clues. 🕵️";
  if (lower.includes('stuck') || lower.includes('confused'))
    return "Don't give up! Open the Notes app and look at ALL the note titles carefully. 📝";
  if (lower.includes('found') || lower.includes('solved') || lower.includes('got it'))
    return "Did you try entering it in the Secret app? Go unlock it! 🔓✨";
  if (lower.includes('thank'))
    return "You're welcome! Now go unlock that secret reward 💕";

  return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
}

/**
 * Main chat function — tries Ollama, falls back to keywords
 */
export async function sendChat(message, history = [], model = 'llama3') {
  // Build messages for Ollama
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map(h => ({
      role: h.from === 'me' ? 'user' : 'assistant',
      content: h.text,
    })),
    { role: 'user', content: message },
  ];

  // Try Ollama
  try {
    const reply = await queryOllama(messages, model);
    if (reply) {
      logger.info('Chat response from Ollama', { model });
      return { reply, source: 'ollama' };
    }
  } catch (err) {
    logger.warn(`Ollama unavailable: ${err.message}`);
  }

  // Fallback
  const reply = getFallbackResponse(message);
  logger.info('Chat response from fallback');
  return { reply, source: 'fallback' };
}
