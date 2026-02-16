import { authMiddleware } from '@global/helpers/authMiddleware';
import express, { Router } from 'express';
import { add } from '@chat/controllers/add-chat-message';
import { get } from '@chat/controllers/get-chat-message';
import { update } from '@chat/controllers/update-chat-message';
import { del } from '@chat/controllers/delete-chat-message';
import { messageReaction } from '@chat/controllers/update-message-reaction';
import { validateMediaSize } from '@global/helpers/image-size-validator';
import { checkReceiverExists } from '@global/helpers/receiver-check.middleware';
import { chatLimiter } from '@global/helpers/rate-limiters';

const MAX_SIZE_IMAGE_IN_MB = 10;
const MAX_SIZE_VIDEO_IN_MB = 30;

class ChatRoutes {
  private router: Router;

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    // 1. Get Chat List (Inbox)
    this.router.get('/chat/conversation-list', authMiddleware.checkAuthentication, get.conversationList);

    // 2. Get Messages (Chat History)
    this.router.get('/chat/user/:receiverId', authMiddleware.checkAuthentication, get.messages);

    // 3. Send Message
    this.router.post(
      '/chat/message',
      chatLimiter,
      authMiddleware.checkAuthentication,
      validateMediaSize('selectedImage', MAX_SIZE_IMAGE_IN_MB),
      validateMediaSize('selectedVideo', MAX_SIZE_VIDEO_IN_MB),
      checkReceiverExists,
      add.message
    );

    // 4. Mark as Read Route
    this.router.put('/chat/mark-as-read', authMiddleware.checkAuthentication, update.message);

    // 5. Delete Message
    this.router.delete('/chat/message', authMiddleware.checkAuthentication, del.message);

    // 6. Reaction On Message
    this.router.put('/chat/reaction', authMiddleware.checkAuthentication, messageReaction.reaction);

    return this.router;
  }
}

export const chatRoutes: ChatRoutes = new ChatRoutes();
