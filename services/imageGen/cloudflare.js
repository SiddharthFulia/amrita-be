import { CF_ACCOUNT_ID, CF_API_TOKEN } from '../../helpers/constants.js';

const DEFAULT_MODEL = '@cf/black-forest-labs/flux-1-schnell';

const MODEL_ALIASES = {
  'flux': '@cf/black-forest-labs/flux-1-schnell',
  'flux-schnell': '@cf/black-forest-labs/flux-1-schnell',
  'sd': '@cf/stabilityai/stable-diffusion-xl-base-1.0',
  'sdxl': '@cf/stabilityai/stable-diffusion-xl-base-1.0',
  'sd-lightning': '@cf/bytedance/stable-diffusion-xl-lightning',
};

/**
 * Cloudflare Workers AI — FLUX.1-schnell. Free tier: ~10k neurons/day.
 * Returns base64 data URL.
 */
export async function generateImage(prompt, model) {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    throw new Error('Cloudflare Workers AI not configured (CF_ACCOUNT_ID + CF_API_TOKEN required)');
  }

  // Resolve aliases or fall back to default; if caller passed a full @cf/... path, honor it
  const resolvedModel = !model
    ? DEFAULT_MODEL
    : (MODEL_ALIASES[model] || (model.startsWith('@cf/') ? model : DEFAULT_MODEL));

  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${resolvedModel}`;

  const cfResponse = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, steps: 4 }),
  });

  if (!cfResponse.ok) {
    const errorData = await cfResponse.json().catch(() => ({}));
    if (cfResponse.status === 429) throw new Error('Cloudflare daily limit reached');
    if (cfResponse.status === 401 || cfResponse.status === 403) throw new Error('Cloudflare auth failed — check CF_API_TOKEN');
    const msg = errorData.errors?.[0]?.message || errorData.message || `Cloudflare error: ${cfResponse.status}`;
    throw new Error(msg);
  }

  const data = await cfResponse.json();
  const b64 = data?.result?.image;
  if (!b64) throw new Error('Cloudflare returned no image data');

  return {
    image: `data:image/jpeg;base64,${b64}`,
    model: resolvedModel,
    provider: 'cloudflare',
  };
}
