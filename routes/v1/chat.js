import { Router } from 'express';
import { postChat, getHealth } from '../../controllers/v1/chat.js';
import { getStats } from '../../controllers/v1/stats.js';
import { postAI } from '../../controllers/v1/ai.js';
import { postGenerate } from '../../controllers/v1/memoryGlitch.js';

const router = Router();

router.post('/whisper', postChat);
router.post('/ai', postAI);
router.post('/memory-glitch/generate', postGenerate);
router.get('/health', getHealth);
router.get('/stats', getStats);

export default router;
