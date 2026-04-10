import { Router } from 'express';
import { postChat, getHealth } from '../../controllers/v1/chat.js';
import { getStats } from '../../controllers/v1/stats.js';

const router = Router();

router.post('/chat', postChat);
router.get('/health', getHealth);
router.get('/stats', getStats);

export default router;
