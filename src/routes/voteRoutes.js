import express from 'express';
import VoteController from '../controllers/voteController.js';
import AuthMiddleware from '../middleware/auth.js';

const router = express.Router();

// All vote routes require authentication
router.use(AuthMiddleware.authenticate);

router.post('/', VoteController.vote);
router.delete('/', VoteController.removeVote);

export default router;