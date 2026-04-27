import responseHelper from '../../helpers/res_helper.js';
import { logger } from '../../helpers/logger.js';
import { chatGemini, analyzeImageGemini } from '../../services/gemini.js';

export const postGemini = async (req, res) => {
  try {
    const { message, history = [], model, system, maxTokens, temperature } = req.body;
    if (!message) return responseHelper.error(res, 'message is required', 400);

    const normalizedHistory = history.map(msg => {
      if (msg.role && msg.content) return msg;
      return {
        role: msg.from === 'me' || msg.from === 'user' ? 'user' : 'assistant',
        content: msg.text || msg.content || '',
      };
    });

    const startTime = Date.now();
    logger.info(`GEMINI REQ | model=${model || 'gemini-flash'} | msg="${message.substring(0, 60)}"`);

    const geminiResult = await chatGemini(message, normalizedHistory, model, { system, maxTokens, temperature });

    logger.info(`GEMINI RES | ${Date.now() - startTime}ms | tokens=${geminiResult.tokens}`);
    return responseHelper.success(res, geminiResult, 'Gemini response');
  } catch (controllerError) {
    logger.error(`postGemini error: ${controllerError.message}`, { service: 'GeminiController' });
    return responseHelper.error(res, controllerError.message);
  }
};

export const postAnalyzeImage = async (req, res) => {
  try {
    const { image, prompt, model } = req.body;
    if (!image) return responseHelper.error(res, 'image is required', 400);

    const startTime = Date.now();
    logger.info(`GEMINI VISION REQ | prompt="${(prompt || 'describe').substring(0, 40)}"`);

    const result = await analyzeImageGemini(image, prompt, model);

    logger.info(`GEMINI VISION RES | ${Date.now() - startTime}ms`);
    return responseHelper.success(res, result, 'Image analysis complete');
  } catch (controllerError) {
    logger.error(`postAnalyzeImage error: ${controllerError.message}`, { service: 'GeminiController' });
    return responseHelper.error(res, controllerError.message);
  }
};
