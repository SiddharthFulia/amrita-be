import responseHelper from '../../helpers/res_helper.js';
import { logger } from '../../helpers/logger.js';
import { summarizeText, textToSpeech } from '../../services/huggingface.js';
import { generateImage, editImage, PROVIDERS } from '../../services/imageGen/index.js';

export const postImageGen = async (req, res) => {
  try {
    const { prompt, model, provider = 'cloudflare' } = req.body;
    if (!prompt) return responseHelper.error(res, 'prompt is required', 400);

    const providerLower = String(provider).toLowerCase();
    if (!PROVIDERS.includes(providerLower) && !['cf', 'hf'].includes(providerLower)) {
      return responseHelper.error(res, `Invalid provider. Use one of: ${PROVIDERS.join(', ')}`, 400);
    }

    logger.info(`IMAGE REQ | provider=${provider} | prompt="${prompt.slice(0, 60)}"`);
    const startTime = Date.now();
    const result = await generateImage(prompt, { provider, model });

    logger.info(`IMAGE RES | ${Date.now() - startTime}ms | provider=${result.provider}`);
    return responseHelper.success(res, result, 'Image generated');
  } catch (controllerError) {
    logger.error(`postImageGen error: ${controllerError.message}`, { service: 'HFController' });
    const status = controllerError.message.includes('loading') ? 503
      : controllerError.message.includes('depleted') || controllerError.message.includes('limit') ? 402
      : 500;
    return responseHelper.error(res, controllerError.message, status);
  }
};

export const postImageEdit = async (req, res) => {
  try {
    const { image, prompt, strength, steps } = req.body;
    if (!image) return responseHelper.error(res, 'Image is required', 400);
    if (!prompt) return responseHelper.error(res, 'Prompt is required', 400);

    logger.info(`IMAGE EDIT REQ | prompt="${prompt.slice(0, 60)}" | strength=${strength}`);
    const startTime = Date.now();
    const result = await editImage(image, prompt, { strength, steps });

    logger.info(`IMAGE EDIT RES | ${Date.now() - startTime}ms`);
    return responseHelper.success(res, result, 'Image edited');
  } catch (controllerError) {
    logger.error(`postImageEdit error: ${controllerError.message}`, { service: 'HFController' });
    const status = controllerError.message.includes('limit') ? 402 : 500;
    return responseHelper.error(res, controllerError.message, status);
  }
};

export const postTTS = async (req, res) => {
  try {
    const { text, voice, lang } = req.body;
    if (!text) return responseHelper.error(res, 'text is required', 400);

    const startTime = Date.now();
    const result = await textToSpeech(text, voice, lang);

    logger.info(`TTS RES | ${Date.now() - startTime}ms | chars=${result.chars}`);
    return responseHelper.success(res, result, 'TTS complete');
  } catch (controllerError) {
    logger.error(`postTTS error: ${controllerError.message}`, { service: 'HFController' });
    return responseHelper.error(res, controllerError.message);
  }
};

export const postSummarize = async (req, res) => {
  try {
    const { text, model } = req.body;
    if (!text) return responseHelper.error(res, 'text is required', 400);

    const startTime = Date.now();
    const result = await summarizeText(text, model);

    logger.info(`HF SUMMARIZE RES | ${Date.now() - startTime}ms`);
    return responseHelper.success(res, result, 'Text summarized');
  } catch (controllerError) {
    logger.error(`postSummarize error: ${controllerError.message}`, { service: 'HFController' });
    return responseHelper.error(res, controllerError.message);
  }
};
