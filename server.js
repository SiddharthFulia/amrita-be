import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

app.use(cors());
app.use(express.json());

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ─── AI Chat (proxies to Ollama) ─────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], model = 'llama3' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    // Build Ollama messages format
    const systemPrompt = `You are a mysterious character in a detective game built for someone's girlfriend.
You give cryptic but helpful hints. Be playful, sweet, and a little mysterious.
Keep responses short (1-2 sentences). Use emoji occasionally.
The player needs to find a passcode hidden in the Notes app of a simulated phone.
The passcode is 4829 — hidden in the first character of each note title.
Never reveal the passcode directly, only give hints.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.from === 'me' ? 'user' : 'assistant', content: h.text })),
      { role: 'user', content: message },
    ];

    // Try Ollama first
    try {
      const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: false }),
      });

      if (ollamaRes.ok) {
        const data = await ollamaRes.json();
        return res.json({ reply: data.message?.content || 'Hmm, let me think about that...' });
      }
    } catch (ollamaErr) {
      console.log('Ollama not available, using fallback responses');
    }

    // Fallback — smart keyword-based responses
    const reply = getFallbackResponse(message);
    res.json({ reply });

  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Fallback responses when Ollama is not running ───────────────────────────
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

  const fallbacks = [
    "That's an interesting lead... have you checked the Notes app? 🔍",
    "Hmm, I think the answer is hidden in plain sight. Look at the titles! 📝",
    "Look carefully at the first character of each note. Something doesn't add up. 🤔",
    "You're getting warmer! Keep looking... the clue is in the note titles. 🔥",
    "Try combining what you see in the note titles. Numbers are key! 🔢",
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// ─── Start server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  🚀 amrita-be running on http://localhost:${PORT}`);
  console.log(`  📡 Ollama endpoint: ${OLLAMA_URL}`);
  console.log(`  💕 Health check: http://localhost:${PORT}/api/health\n`);
});
