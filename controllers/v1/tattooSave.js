import responseHelper from '../../helpers/res_helper.js';
import { logger } from '../../helpers/logger.js';
import { uploadToDrive } from '../../services/upload.js';

export const postTattooSave = async (req, res) => {
  try {
    const { imageUrl, name } = req.body;
    if (!imageUrl) return responseHelper.error(res, 'imageUrl required', 400);

    const clientIp = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip;
    logger.info(`TATTOO SAVE | ip=${clientIp} | url=${imageUrl.substring(0, 60)}...`);

    const startTime = Date.now();
    const imageResponse = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(15000),
    });

    if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.status}`);

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const fileName = name ? `${name}-${Date.now()}.jpg` : `tattoo-${Date.now()}.jpg`;

    const result = await uploadToDrive(imageBuffer, fileName, contentType, 'tattoos');
    const responseTime = Date.now() - startTime;

    logger.info(`TATTOO SAVED | ${responseTime}ms | id=${result.id}`);
    return responseHelper.success(res, result, 'Tattoo saved');
  } catch (controllerError) {
    logger.error(`postTattooSave error: ${controllerError.message}`, { service: 'TattooSaveController' });
    return responseHelper.error(res, controllerError.message || 'Save failed');
  }
};
