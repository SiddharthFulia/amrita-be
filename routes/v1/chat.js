import { Router } from 'express';
import { postChat, getHealth } from '../../controllers/v1/chat.js';
import { getStats } from '../../controllers/v1/stats.js';
import { postAI } from '../../controllers/v1/ai.js';
import { postGroq } from '../../controllers/v1/groq.js';
import { postGenerate } from '../../controllers/v1/memoryGlitch.js';
import { postUpload } from '../../controllers/v1/upload.js';
import { getImageSearch } from '../../controllers/v1/imageSearch.js';
import { postTattooSave } from '../../controllers/v1/tattooSave.js';
import { postFaceAnalyze, getFaceHealth } from '../../controllers/v1/faceAnalyze.js';
import { postDetectObjects } from '../../controllers/v1/objectDetect.js';

const router = Router();

router.post('/whisper', postChat);
router.post('/ai', postAI);
router.post('/groq', postGroq);
router.post('/memory-glitch/generate', postGenerate);
router.post('/upload', postUpload);
router.post('/tattoo-save', postTattooSave);
router.post('/face-analyze', postFaceAnalyze);
router.post('/detect-objects', postDetectObjects);
router.get('/face-health', getFaceHealth);
router.get('/health', getHealth);
router.get('/stats', getStats);
router.get('/image-search', getImageSearch);

export default router;
