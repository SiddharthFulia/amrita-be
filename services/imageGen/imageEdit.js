import { CF_ACCOUNT_ID, CF_API_TOKEN } from '../../helpers/constants.js';

/**
 * Cloudflare Workers AI img2img — takes a source image + prompt, returns edited image.
 * Model: @cf/runwayml/stable-diffusion-v1-5-img2img
 */
export async function editImage(imageDataUrl, prompt, opts = {}) {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    throw new Error('Cloudflare Workers AI not configured (CF_ACCOUNT_ID + CF_API_TOKEN required)');
  }
  if (!imageDataUrl) throw new Error('Source image is required');
  if (!prompt) throw new Error('Prompt is required');

  const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  const byteArray = Array.from(new Uint8Array(buffer));

  const model = '@cf/runwayml/stable-diffusion-v1-5-img2img';
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${model}`;

  const cfResponse = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image: byteArray,
      strength: typeof opts.strength === 'number' ? opts.strength : 0.7,
      num_steps: typeof opts.steps === 'number' ? Math.min(20, Math.max(1, opts.steps)) : 20,
    }),
  });

  if (!cfResponse.ok) {
    const errorData = await cfResponse.json().catch(() => ({}));
    if (cfResponse.status === 429) throw new Error('Cloudflare daily limit reached');
    if (cfResponse.status === 401 || cfResponse.status === 403) throw new Error('Cloudflare auth failed — check CF_API_TOKEN');
    const msg = errorData.errors?.[0]?.message || errorData.message || `Cloudflare error: ${cfResponse.status}`;
    throw new Error(msg);
  }

  const arrayBuf = await cfResponse.arrayBuffer();
  const outBase64 = Buffer.from(arrayBuf).toString('base64');

  return {
    image: `data:image/png;base64,${outBase64}`,
    model,
    provider: 'cloudflare',
  };
}
