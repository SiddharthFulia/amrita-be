// ─── Master Router ───────────────────────────────────────────────────────────

import { Router } from 'express';
import chatRoutes from './v1/chat.js';

const router = Router();

// v1 routes
router.use('/', chatRoutes);

export default router;
