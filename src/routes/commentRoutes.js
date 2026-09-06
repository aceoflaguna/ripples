import express from 'express';
import CommentController from '../controllers/commentController.js';
import AuthMiddleware from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/post/:postId', CommentController.getPostComments);
router.get('/:id/replies', CommentController.getReplies);

// Protected routes
router.post('/',
  AuthMiddleware.authenticate,
  CommentController.create
);

router.put('/:id',
  AuthMiddleware.authenticate,
  CommentController.update
);

router.delete('/:id',
  AuthMiddleware.authenticate,
  CommentController.delete
);

export default router;