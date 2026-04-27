import { GEMINI_API_KEY } from '../helpers/constants.js';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

const MODELS = {
  'gemini-flash': 'gemini-2.5-flash',
  'gemini-pro': 'gemini-2.5-pro',
  'gemini-flash-lite': 'gemini-2.5-flash-lite',
};

export async function chatGemini(message, history = [], model = 'gemini-flash', options = {}) {
  const apiKey = GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not configured');

  const modelId = MODELS[model] || model;
  const systemInstruction = options.system || 'You are a helpful AI assistant. Be concise and direct.';

  const contents = [];
  for (const msg of history.slice(-6)) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }
  contents.push({ role: 'user', parts: [{ text: message }] });

  const geminiResponse = await fetch(`${BASE_URL}/models/${modelId}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        maxOutputTokens: options.maxTokens || 500,
        temperature: options.temperature ?? 0.7,
      },
    }),
  });

  if (!geminiResponse.ok) {
    const errorData = await geminiResponse.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gemini API error: ${geminiResponse.status}`);
  }

  const responseData = await geminiResponse.json();
  return {
    reply: responseData.candidates?.[0]?.content?.parts?.[0]?.text || '',
    model: modelId,
    tokens: responseData.usageMetadata?.candidatesTokenCount || 0,
    totalTokens: responseData.usageMetadata?.totalTokenCount || 0,
    source: 'gemini',
  };
}

export async function analyzeImageGemini(imageBase64, prompt = 'Describe this image in detail.', model = 'gemini-flash') {
  const apiKey = GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not configured');

  const modelId = MODELS[model] || model;

  let base64Data = imageBase64;
  let mimeType = 'image/jpeg';
  if (imageBase64.includes(',')) {
    const match = imageBase64.match(/^data:(image\/\w+);base64,/);
    if (match) mimeType = match[1];
    base64Data = imageBase64.split(',')[1];
  }

  const geminiResponse = await fetch(`${BASE_URL}/models/${modelId}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Data } },
        ],
      }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.4 },
    }),
  });

  if (!geminiResponse.ok) {
    const errorData = await geminiResponse.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gemini Vision error: ${geminiResponse.status}`);
  }

  const responseData = await geminiResponse.json();
  return {
    reply: responseData.candidates?.[0]?.content?.parts?.[0]?.text || '',
    model: modelId,
    tokens: responseData.usageMetadata?.candidatesTokenCount || 0,
    source: 'gemini',
  };
}
