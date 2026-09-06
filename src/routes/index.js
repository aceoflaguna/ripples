import express from 'express';
import authRoutes from './authRoutes.js';
import communityRoutes from './communityRoutes.js';
import postRoutes from './postRoutes.js';
import commentRoutes from './commentRoutes.js';
import voteRoutes from './voteRoutes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/communities', communityRoutes);
router.use('/posts', postRoutes);
router.use('/comments', commentRoutes);
router.use('/votes', voteRoutes);

export default router;