import express from 'express';
import PostController from '../controllers/postController.js';
import AuthMiddleware from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', AuthMiddleware.optionalAuth, PostController.getFeed);
router.get('/search', PostController.search);
router.get('/:id', AuthMiddleware.optionalAuth, PostController.getById);

// Protected routes
router.post('/', 
  AuthMiddleware.authenticate,
  PostController.create
);

router.put('/:id',
  AuthMiddleware.authenticate,
  PostController.update
);

router.delete('/:id',
  AuthMiddleware.authenticate,
  PostController.delete
);

export default router;