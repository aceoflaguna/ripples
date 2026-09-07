import express from 'express';
import UserController from '../controllers/userController.js';
import AuthMiddleware from '../middleware/auth.js';
import ValidationMiddleware from '../middleware/validation.js';

const router = express.Router();

// Public routes
router.get('/:username', UserController.getUserByUsername);
router.get('/:username/stats', UserController.getUserStats);
router.get('/:username/posts', UserController.getUserPosts);
router.get('/:username/comments', UserController.getUserComments);
router.get('/:username/communities', UserController.getUserCommunities);

// Protected routes (require authentication)
router.use(AuthMiddleware.authenticate);

// Current user routes
router.get('/me/profile', UserController.getCurrentUser);
router.put('/me/profile', 
  ValidationMiddleware.updateProfileValidation(),
  ValidationMiddleware.validate,
  UserController.updateProfile
);

// Follow/unfollow routes (if implementing social features)
router.post('/:username/follow', UserController.followUser);
router.post('/:username/unfollow', UserController.unfollowUser);

// Account management
router.delete('/me/account', UserController.deleteAccount);

export default router;