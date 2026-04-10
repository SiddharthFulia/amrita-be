import { logger } from '../helpers/logger.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

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
You're not a detective game character — you're a real helpful assistant.`,
};

const FALLBACK_RESPONSES = {
  detective: [
    "That's an interesting lead... have you checked the Notes app? 🔍",
    "Hmm, I think the answer is hidden in plain sight. Look at the titles! 📝",
    "Look carefully at the first character of each note. Something doesn't add up. 🤔",
    "You're getting warmer! Keep looking... the clue is in the note titles. 🔥",
    "Try combining what you see in the note titles. Numbers are key! 🔢",
  ],
  general: [
    "I'd love to help! Could you tell me a bit more? 😊",
    "That's a great question! Let me think about it... 💭",
    "Sure thing! What specifically would you like to know? ✨",
    "I'm here for you! Ask me anything 💕",
    "Interesting! Let me help you with that 🌟",
  ],
};

async function queryOllama(messages, model = 'llama3.2:1b') {
  const ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false, options: { num_predict: 120, temperature: 0.7 } }),
  });

  if (!ollamaResponse.ok) throw new Error(`Ollama returned ${ollamaResponse.status}`);

  const responseData = await ollamaResponse.json();
  return responseData.message?.content || null;
}

function getFallbackResponse(message, context = 'general') {
  const lower = message.toLowerCase();
  const pool = FALLBACK_RESPONSES[context] || FALLBACK_RESPONSES.general;

  if (context === 'detective') {
    if (lower.includes('help') || lower.includes('hint'))
      return "Look at the Notes app — there's a pattern in the titles. 🔍";
    if (lower.includes('password') || lower.includes('passcode') || lower.includes('code'))
      return "I can't just tell you! But look at the FIRST character of each note title... 🤫";
    if (lower.includes('note') || lower.includes('title'))
      return "The note titles aren't random. Read the first character of each one, in order. ✨";
  }

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey'))
    return "Hey there! 👋 How can I help you today?";
  if (lower.includes('thank'))
    return "You're welcome! 💕 Anything else I can help with?";
  if (lower.includes('love') || lower.includes('miss'))
    return "Aww 💕 That's so sweet!";

  return pool[Math.floor(Math.random() * pool.length)];
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

  try {
    const reply = await queryOllama(ollamaMessages, model);
    if (reply) {
      logger.info('Chat response from Ollama', { model, context });
      return { reply, source: 'ollama' };
    }
  } catch (ollamaError) {
    logger.warn(`Ollama unavailable: ${ollamaError.message}`);
  }

  const fallbackReply = getFallbackResponse(message, context);
  logger.info('Chat response from fallback');
  return { reply: fallbackReply, source: 'fallback' };
}
