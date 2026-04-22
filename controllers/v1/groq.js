import responseHelper from '../../helpers/res_helper.js';
import { logger } from '../../helpers/logger.js';
import { chatGroq } from '../../services/groq.js';

export const postGroq = async (req, res) => {
  try {
    const { message, history = [], model, system, maxTokens, temperature } = req.body;
    const clientIp = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip;

    if (!message) return responseHelper.error(res, 'message is required', 400);

    logger.info(`GROQ REQ | ip=${clientIp} | model=${model || 'llama-3.1-8b'} | msg="${message.substring(0, 60)}"`);

    const normalizedHistory = history.map(msg => {
      if (msg.role && msg.content) return msg;
      return {
        role: msg.from === 'me' || msg.from === 'user' ? 'user' : 'assistant',
        content: msg.text || msg.content || '',
      };
    });

    const startTime = Date.now();
    const groqResult = await chatGroq(message, normalizedHistory, model, { system, maxTokens, temperature });
    const responseTime = Date.now() - startTime;

    logger.info(`GROQ RES | ${responseTime}ms | tokens=${groqResult.tokens} | reply="${groqResult.reply.substring(0, 60)}..."`);

    return responseHelper.success(res, groqResult, 'Groq response');
  } catch (controllerError) {
    logger.error(`postGroq error: ${controllerError.message}`, { service: 'GroqController' });
    return responseHelper.error(res, controllerError.message || 'Groq failed');
  }
};
