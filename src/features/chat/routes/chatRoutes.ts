import { authMiddleware } from "@global/helpers/authMiddleware";
import express, { Router } from "express";
import { add } from "@chat/controllers/add-chat-message";
import { get } from "@chat/controllers/get-chat-message";
import { del } from "@chat/controllers/delete-chat-message";
import { update } from "@chat/controllers/update-chat-message";
import { message } from "@chat/controllers/update-message-reaction";

class ChatRoutes {
  private router: Router

  constructor() {
    this.router = express.Router();
  }

  public routes(): Router {
    this.router.get('/chat/message/conversation-list', authMiddleware.checkAuthentication, get.conversationList);
    this.router.get('/chat/check/:receiverId', authMiddleware.checkAuthentication, get.checkConversation);
    this.router.get('/chat/message/user/:conversationId', authMiddleware.checkAuthentication, get.messages);

    this.router.post("/chat/message", authMiddleware.checkAuthentication, add.message);
    this.router.post('/chat/message/add-chat-users', authMiddleware.checkAuthentication, add.addChatUsers);
    this.router.post('/chat/message/remove-chat-users', authMiddleware.checkAuthentication, add.removeChatUsers);

    this.router.put('/chat/message/mark-as-read/:conversationId', authMiddleware.checkAuthentication, update.markMessageAsRead);
    this.router.put('/chat/message/reaction', authMiddleware.checkAuthentication, message.reaction);

    this.router.delete('/chat/message/mark-as-deleted/:conversationId/:type/:messageId', authMiddleware.checkAuthentication, del.markMessageAsDeleted);

    return this.router;
  }
}

export const chatRoutes: ChatRoutes = new ChatRoutes();
