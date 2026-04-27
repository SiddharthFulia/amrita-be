import { HF_TOKEN, GOOGLE_TTS_KEY } from '../helpers/constants.js';

const HF_API = 'https://router.huggingface.co/hf-inference/models';

export async function generateImage(prompt, model = 'black-forest-labs/FLUX.1-schnell') {
  if (!HF_TOKEN) throw new Error('Hugging Face token not configured');

  const hfResponse = await fetch(`${HF_API}/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { seed: Math.floor(Math.random() * 2147483647), num_inference_steps: 4 },
    }),
  });

  if (!hfResponse.ok) {
    const errorData = await hfResponse.json().catch(() => ({}));
    if (hfResponse.status === 503) throw new Error('Model is loading, try again in 30 seconds');
    throw new Error(errorData.error || `HF API error: ${hfResponse.status}`);
  }

  const buffer = await hfResponse.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return { image: `data:image/png;base64,${base64}`, model, source: 'huggingface' };
}

export async function summarizeText(text, model = 'facebook/bart-large-cnn') {
  if (!HF_TOKEN) throw new Error('Hugging Face token not configured');

  const hfResponse = await fetch(`${HF_API}/${model}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: text, parameters: { max_length: 150, min_length: 30 } }),
  });

  if (!hfResponse.ok) {
    const errorData = await hfResponse.json().catch(() => ({}));
    throw new Error(errorData.error || `HF Summarize error: ${hfResponse.status}`);
  }

  const responseData = await hfResponse.json();
  return { summary: responseData[0]?.summary_text || '', model, source: 'huggingface' };
}

const ttsRateLimit = { count: 0, resetAt: 0 };
const TTS_MAX_RPM = 10;
let ttsDailyChars = 0;
let ttsDayReset = 0;
const TTS_MAX_DAILY_CHARS = 50000;

const ALLOWED_VOICES = [
  'en-US-Standard-A', 'en-US-Standard-B', 'en-US-Standard-C', 'en-US-Standard-D',
  'en-US-Standard-E', 'en-US-Standard-F', 'en-US-Standard-G', 'en-US-Standard-H',
  'en-GB-Standard-A', 'en-GB-Standard-B', 'en-GB-Standard-C', 'en-GB-Standard-D',
  'en-IN-Standard-A', 'en-IN-Standard-B', 'en-IN-Standard-C', 'en-IN-Standard-D',
  'hi-IN-Standard-A', 'hi-IN-Standard-B', 'hi-IN-Standard-C', 'hi-IN-Standard-D',
];

export async function textToSpeech(text, voice = 'en-US-Standard-D', lang = 'en-US') {
  if (!GOOGLE_TTS_KEY) throw new Error('Google TTS key not configured');
  if (!text || text.length === 0) throw new Error('Text is required');
  if (text.length > 200) throw new Error(`Text too long (${text.length} chars). Max 200 characters.`);

  const safeVoice = ALLOWED_VOICES.includes(voice) ? voice : 'en-US-Standard-D';

  const now = Date.now();
  if (now > ttsRateLimit.resetAt) { ttsRateLimit.count = 0; ttsRateLimit.resetAt = now + 60000; }
  if (ttsRateLimit.count >= TTS_MAX_RPM) throw new Error('TTS rate limit: max 10 requests per minute.');
  ttsRateLimit.count++;

  const today = new Date().setHours(0, 0, 0, 0);
  if (today > ttsDayReset) { ttsDailyChars = 0; ttsDayReset = today + 86400000; }
  if (ttsDailyChars + text.length > TTS_MAX_DAILY_CHARS) throw new Error(`TTS daily limit reached.`);
  ttsDailyChars += text.length;

  const ttsResponse = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: lang, name: safeVoice },
      audioConfig: { audioEncoding: 'MP3' },
    }),
  });

  if (!ttsResponse.ok) {
    const errorData = await ttsResponse.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Google TTS error: ${ttsResponse.status}`);
  }

  const responseData = await ttsResponse.json();
  if (!responseData.audioContent) throw new Error('No audio returned');

  return {
    audio: `data:audio/mp3;base64,${responseData.audioContent}`,
    voice: safeVoice,
    chars: text.length,
    dailyUsed: ttsDailyChars,
    dailyLimit: TTS_MAX_DAILY_CHARS,
    source: 'google-tts',
  };
}
