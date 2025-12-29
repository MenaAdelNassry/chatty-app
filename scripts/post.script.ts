import mongoose from 'mongoose';
import { PostModel } from '../src/features/post/models/post.schema';
import { PostCache } from '../src/shared/services/redis/post.cache';

async function rehydrate() {
  await mongoose.connect(process.env.MONGO_URI!);

  const postCache = new PostCache();

  const posts = await PostModel.find().lean();

  for (const post of posts) {
    await postCache.savePostToCache({
      key: post._id.toString(),
      currentUserId: post.userId.toString(),
      uId: post.uId.toString(),
      createdPost: post
    });
  }

  console.log('Redis rehydrated successfully');
  process.exit(0);
}

rehydrate();
