import express from 'express';
import CommunityController from '../controllers/communityController.js';
import AuthMiddleware from '../middleware/auth.js';
import ValidationMiddleware from '../middleware/validation.js';

const router = express.Router();

// Public routes
router.get('/', CommunityController.getAll);
router.get('/search', CommunityController.search);
router.get('/:id', CommunityController.getById);

// Protected routes
router.post('/', 
  AuthMiddleware.authenticate,
  CommunityController.create
);

router.post('/:id/join',
  AuthMiddleware.authenticate,
  CommunityController.join
);

router.post('/:id/leave',
  AuthMiddleware.authenticate,
  CommunityController.leave
);

export default router;