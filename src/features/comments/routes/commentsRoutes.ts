import express, { Router } from 'express';
import { authMiddleware } from '@global/helpers/authMiddleware';
import { get } from '@comment/controllers/get-comments';
import { add } from '@comment/controllers/add-comment';

class CommentRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get('/post/comments/:postId', authMiddleware.checkAuthentication, get.comments);
    this.router.get('/post/commentsnames/:postId', authMiddleware.checkAuthentication, get.commentsNamesFromCache);
    this.router.get('/post/single/comment/:postId/:commentId', authMiddleware.checkAuthentication, get.singleComment);

    this.router.post('/post/comment', authMiddleware.checkAuthentication, add.comment);

    return this.router;
  }
}

export const commentRoutes: CommentRoutes = new CommentRoutes();
