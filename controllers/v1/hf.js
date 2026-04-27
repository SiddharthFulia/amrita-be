import responseHelper from '../../helpers/res_helper.js';
import { logger } from '../../helpers/logger.js';
import { generateImage, summarizeText, textToSpeech } from '../../services/huggingface.js';

export const postImageGen = async (req, res) => {
  try {
    const { prompt, model } = req.body;
    if (!prompt) return responseHelper.error(res, 'prompt is required', 400);

    logger.info(`HF IMAGE REQ | prompt="${prompt.slice(0, 60)}"`);
    const startTime = Date.now();
    const result = await generateImage(prompt, model);

    logger.info(`HF IMAGE RES | ${Date.now() - startTime}ms`);
    return responseHelper.success(res, result, 'Image generated');
  } catch (controllerError) {
    logger.error(`postImageGen error: ${controllerError.message}`, { service: 'HFController' });
    return responseHelper.error(res, controllerError.message, controllerError.message.includes('loading') ? 503 : 500);
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
