import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Module routes will be registered here in subsequent prompts
// e.g. router.use('/auth', authRoutes);

export default router;
