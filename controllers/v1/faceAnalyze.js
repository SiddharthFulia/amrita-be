import responseHelper from '../../helpers/res_helper.js';
import { logger } from '../../helpers/logger.js';

const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || 'http://localhost:5000';

export const postFaceAnalyze = async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return responseHelper.error(res, 'image required', 400);

    const clientIp = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip;
    logger.info(`FACE ANALYZE REQ | ip=${clientIp}`);

    const startTime = Date.now();
    const pythonResponse = await fetch(`${FACE_SERVICE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });

    if (!pythonResponse.ok) {
      const errorData = await pythonResponse.json().catch(() => ({}));
      throw new Error(errorData.error || `Python service returned ${pythonResponse.status}`);
    }

    const analysisResult = await pythonResponse.json();
    const responseTime = Date.now() - startTime;

    logger.info(`FACE ANALYZE RES | ${responseTime}ms | faces=${analysisResult.faceCount}`);
    return responseHelper.success(res, analysisResult, 'Face analysis complete');
  } catch (controllerError) {
    logger.error(`postFaceAnalyze error: ${controllerError.message}`, { service: 'FaceAnalyzeController' });
    return responseHelper.error(res, controllerError.message || 'Face analysis failed');
  }
};

export const getFaceHealth = async (req, res) => {
  try {
    const pythonResponse = await fetch(`${FACE_SERVICE_URL}/health`);
    const healthData = await pythonResponse.json();
    return responseHelper.success(res, healthData, 'Face service status');
  } catch {
    return responseHelper.error(res, 'Face service offline');
  }
};
