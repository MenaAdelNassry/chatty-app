import HTTP_STATUS from 'http-status-codes';
import { AuthPayload } from "@auth/interfaces/auth.interface";
import { postQueue } from "@service/queues/post.queue";
import { PostCache } from "@service/redis/post.cache";
import { socketIOPostObject } from "@socket/post";
import { Request, Response } from "express";

const postCache: PostCache = new PostCache();

class Delete {
  public post = async (req: Request, res: Response): Promise<void> => {
    const { postId } = req.params;
    const { userId } = req.currentUser as AuthPayload;

    socketIOPostObject.emit("delete post", postId);
    await postCache.deletePostFromCache(postId, `${userId}`);
    postQueue.addPostJob('deletePostFromDB', { keyOne: postId, keyTwo: `${userId}` });

    res.status(HTTP_STATUS.OK).json({ message: 'Post deleted successfully' });
  }
}

export const del: Delete = new Delete();
