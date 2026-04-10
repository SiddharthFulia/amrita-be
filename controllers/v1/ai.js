import responseHelper from '../../helpers/res_helper.js';
import { logger } from '../../helpers/logger.js';
import { queryAI } from '../../services/ai.js';

export const postAI = async (req, res) => {
  try {
    const { message, history = [], model, system, maxTokens, temperature } = req.body;
    const clientIp = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip;

    if (!message) {
      return responseHelper.error(res, 'message is required', 400);
    }

    logger.info(`AI REQ | ip=${clientIp} | model=${model || 'default'} | msg="${message.substring(0, 80)}"`);

    const ollamaMessages = [];
    if (system) ollamaMessages.push({ role: 'system', content: system });
    history.forEach(historyMessage => {
      ollamaMessages.push({
        role: historyMessage.role || (historyMessage.from === 'me' ? 'user' : 'assistant'),
        content: historyMessage.text || historyMessage.content,
      });
    });
    ollamaMessages.push({ role: 'user', content: message });

    const startTime = Date.now();
    const aiResult = await queryAI(ollamaMessages, model, { maxTokens, temperature });
    const responseTime = Date.now() - startTime;

    logger.info(`AI RES | ${responseTime}ms | tokens=${aiResult.tokens} | reply="${aiResult.reply.substring(0, 80)}..."`);

    return responseHelper.success(res, aiResult, 'AI response');
  } catch (controllerError) {
    logger.error(`postAI error: ${controllerError.message}`, { service: 'AIController' });
    return responseHelper.error(res, controllerError.message || 'AI unavailable');
  }
};
