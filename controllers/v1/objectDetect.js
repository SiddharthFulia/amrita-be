import responseHelper from '../../helpers/res_helper.js';
import { logger } from '../../helpers/logger.js';
import { FACE_SERVICE_URL } from '../../helpers/constants.js';

export const postDetectObjects = async (req, res) => {
  try {
    const { image, threshold } = req.body;
    if (!image) return responseHelper.error(res, 'image required', 400);

    const startTime = Date.now();
    const pythonResponse = await fetch(`${FACE_SERVICE_URL}/detect-objects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, threshold: threshold || 0.5 }),
    });

    if (!pythonResponse.ok) {
      const errorData = await pythonResponse.json().catch(() => ({}));
      throw new Error(errorData.error || `Python service returned ${pythonResponse.status}`);
    }

    const detectionResult = await pythonResponse.json();
    const responseTime = Date.now() - startTime;

    logger.info(`OBJECT DETECT | ${responseTime}ms | objects=${detectionResult.count}`);
    return responseHelper.success(res, detectionResult, 'Object detection complete');
  } catch (controllerError) {
    logger.error(`postDetectObjects error: ${controllerError.message}`, { service: 'ObjectDetectController' });
    return responseHelper.error(res, controllerError.message || 'Object detection failed');
  }
};
