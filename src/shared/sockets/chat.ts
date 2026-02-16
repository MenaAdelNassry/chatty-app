import { ConversationModel } from '@chat/models/conversation.schema';
import { config } from '@root/config';
import { chatQueue } from '@service/queues/chat.queue';
import { UserCache } from '@service/redis/user.cache';
import Logger from 'bunyan';
import { Server, Socket } from 'socket.io';

const log: Logger = config.createLogger('notificationSocket');
const userCache: UserCache = new UserCache();

export let socketIOChatObject: Server;

export class SocketIOChatHandler {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    socketIOChatObject = io;
  }

  public listen(): void {
    this.io.on('connection', (socket: Socket) => {
      log.info('🟢 User connected to Chat Socket:', socket.id);

      // 1. Setup (Join Room)
      // The front end, as soon as the app is opened, must send this event
      socket.on('setup chat', async () => {
        try {
          const { userId } = socket.data.user;
          socket.join(userId);
          socket.emit('connected');
          log.info(`👤 User ${userId} joined their private room.`);

          await userCache.addOnlineUserToCache(userId, socket.id);

          const allOnlineUsers = await userCache.getOnlineUsersFromCache();

          socket.emit('get online users', allOnlineUsers);
          this.io.emit('user online', userId);

          // Join all conversation rooms for this user
          const conversations = await ConversationModel.find({
            participants: userId
          }).select('_id');

          conversations.forEach((conv) => {
            socket.join(conv._id.toString());
          });

          log.info(`User ${userId} joined ${conversations.length} rooms`);
        } catch (error) {
          log.error(`Setup error for socket ${socket.id}:`, error);
          socket.emit('error', { message: 'Failed to connect to chat system' });
        }
      });

      // 2. Join Chat (Optional - for Typing Indicators)
      socket.on('join chat', (room: string) => {
        socket.join(room);
        log.info(`User joined chat room: ${room}`);
      });

      // 3. Typing Indicator
      socket.on('typing', (room: string) =>
        socket.in(room).emit('typing', {
          senderId: socket.data.user.userId,
          roomId: room
        })
      );
      socket.on('stop typing', (room: string) =>
        socket.in(room).emit('stop typing', {
          senderId: socket.data.user.userId,
          roomId: room
        })
      );

      // 4. Mark as delivered
      socket.on('mark as delivered', async (data) => {
        const { conversationId, messageId, senderId } = data;
        const userId = socket.data.user.userId;

        chatQueue.addChatJob('markMessageAsDelivered', {
          conversationId,
          userId,
          messageId
        });

        socket.to(senderId).emit('message delivered', {
          conversationId,
          userId,
          messageId
        });
      });

      // 4. Handle Disconnect
      socket.on('disconnect', async () => {
        log.info('User disconnected:', socket.id);

        if (!socket.data.user || !socket.data.user.userId) {
          return;
        }

        const userId = socket.data.user.userId;

        const remainingSockets = await userCache.removeOnlineUserFromCache(userId, socket.id);
        if (remainingSockets.length === 0) {
          log.info(`🔴 User ${userId} went completely offline.`);
          this.io.emit('user offline', userId);
        } else {
          log.info(`🟡 User ${userId} disconnected one device, but is still online on others.`);
        }
      });
    });
  }
}
