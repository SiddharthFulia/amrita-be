// ─── Chat Routes ─────────────────────────────────────────────────────────────

import { Router } from 'express';
import { postChat, getHealth } from '../../controllers/v1/chat.js';

const router = Router();

router.post('/chat', postChat);
router.get('/health', getHealth);

export default router;
