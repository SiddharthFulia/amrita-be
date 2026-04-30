import { HF_TOKEN } from '../../helpers/constants.js';

const HF_API = 'https://router.huggingface.co/hf-inference/models';

const MODEL_ALIASES = {
  'flux': 'black-forest-labs/FLUX.1-schnell',
  'flux-schnell': 'black-forest-labs/FLUX.1-schnell',
  'flux-dev': 'black-forest-labs/FLUX.1-dev',
  'sd': 'stabilityai/stable-diffusion-xl-base-1.0',
  'sdxl': 'stabilityai/stable-diffusion-xl-base-1.0',
};

/**
 * Hugging Face Inference — FLUX.1-schnell. Free monthly credits per account.
 */
export async function generateImage(prompt, model = 'black-forest-labs/FLUX.1-schnell') {
  const token = HF_TOKEN || process.env.HF_TOKEN;
  if (!token) throw new Error('Hugging Face token not configured');

  model = MODEL_ALIASES[model] || model;

  const hfResponse = await fetch(`${HF_API}/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
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
    if (hfResponse.status === 402) throw new Error('Hugging Face monthly credits depleted — try Cloudflare');
    throw new Error(errorData.error || `HF API error: ${hfResponse.status}`);
  }

  const buffer = await hfResponse.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return {
    image: `data:image/png;base64,${base64}`,
    model,
    provider: 'huggingface',
  };
}
