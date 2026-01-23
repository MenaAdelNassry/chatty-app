import HTTP_STATUS from 'http-status-codes';
import { AuthPayload } from '@auth/interfaces/auth.interface';
import { postQueue } from '@service/queues/post.queue';
import { PostCache } from '@service/redis/post.cache';
import { socketIOPostObject } from '@socket/post';
import { Request, Response } from 'express';
import { postService } from '@service/db/post.service';
import { NotAuthorizedError, NotFoundError } from '@global/helpers/error-handler';

const postCache: PostCache = new PostCache();

class Delete {
  public post = async (req: Request, res: Response): Promise<void> => {
    const { postId } = req.params;
    const { userId } = req.currentUser as AuthPayload;

    const cashedPost = (await postCache.getPostFromCache(postId, userId));
    const currentPost = cashedPost || (await postService.getOnePost(postId, userId));

    if (!currentPost) throw new NotFoundError('Post Not Found');
    if (`${currentPost.userId}` !== userId) {
      throw new NotAuthorizedError('Not authorized to delete this post');
    }

    socketIOPostObject.emit('delete post', postId);

    if(cashedPost) await postCache.deletePostFromCache(postId, `${userId}`);
    postQueue.addPostJob('deletePostFromDB', {
      keyOne: postId,
      keyTwo: `${userId}`,
      imgId: currentPost.imgId,
      videoId: currentPost.videoId
    });

    res.status(HTTP_STATUS.OK).json({ message: 'Post deleted successfully' });
  };
}

export const del: Delete = new Delete();
