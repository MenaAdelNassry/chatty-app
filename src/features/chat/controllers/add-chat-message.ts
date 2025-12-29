import { IMessageData, IMessageNotification } from '@chat/interfaces/message.interface';
import { addChatSchema } from '@chat/schemes/chat';
import { uploadToCloudinary } from '@global/helpers/cloudinary-upload';
import { BadRequestError, joiRequestValidationError } from '@global/helpers/error-handler';
import { INotificationTemplate } from '@notification/interfaces/notification.interface';
import { notificationTemplate } from '@service/emails/templates/notifications/notification-template';
import { chatQueue } from '@service/queues/chat.queue';
import { emailQueue } from '@service/queues/email.queue';
import { MessageCache } from '@service/redis/message.cache';
import { UserCache } from '@service/redis/user.cache';
import { socketIOChatObject } from '@socket/chat';
import { IUserDocument } from '@user/interfaces/user.interface';
import { UploadApiResponse } from 'cloudinary';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import mongoose from 'mongoose';

const userCache: UserCache = new UserCache();
const messageCache: MessageCache = new MessageCache();

class Add {
  public message = async (req: Request, res: Response): Promise<void> => {
    // -------------------------------------------------------------------------
    // 1. VALIDATION
    // Validate request body against the schema.
    // -------------------------------------------------------------------------
    const { value, error } = addChatSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error.details[0].message);
    }

    // -------------------------------------------------------------------------
    // 2. DATA PREPARATION & UPLOAD
    // Handle image upload if exists, and generate ObjectIds.
    // -------------------------------------------------------------------------
    const {
      conversationId,
      receiverId,
      receiverUsername,
      receiverAvatarColor,
      receiverProfilePicture,
      body,
      gifUrl,
      selectedImage,
      isRead
    } = value;

    let imageUrl = '';
    const messageObjectId: mongoose.Types.ObjectId = new mongoose.Types.ObjectId();
    const conversationObjectId: mongoose.Types.ObjectId = !conversationId
      ? new mongoose.Types.ObjectId()
      : new mongoose.Types.ObjectId(conversationId);

    // Fetch Sender Data (Safe Source)
    const sender: IUserDocument = (await userCache.getUserFromCache(`${req.currentUser!.userId}`)) as IUserDocument;

    if (selectedImage) {
      const result: UploadApiResponse = await uploadToCloudinary(selectedImage, {
        public_id: `${messageObjectId}`,
        invalidate: true,
        overwrite: true,
      });
      imageUrl = `https://res.cloudinary.com/dyamr9ym3/image/upload/v${result.version}/${result.public_id}`;
    }

    // -------------------------------------------------------------------------
    // 3. CONSTRUCT MESSAGE DTO
    //
    // TODO: ⚠️ SECURITY RISK (Receiver Data Spoofing)
    // currently, we accept receiver details (username, avatar) from 'req.body'.
    // A malicious user can send a message to User A but provide User B's details in the body.
    // FUTURE FIX: Fetch receiver data from Cache/DB using 'receiverId' instead of trusting the body.
    // -------------------------------------------------------------------------
    const messageData: IMessageData = {
      _id: messageObjectId,
      conversationId: conversationObjectId,
      receiverId,
      receiverAvatarColor, // <--- Risk
      receiverUsername, // <--- Risk
      receiverProfilePicture, // <--- Risk
      senderUsername: `${req.currentUser!.username}`,
      senderId: `${req.currentUser!.userId}`,
      senderAvatarColor: `${req.currentUser!.avatarColor}`,
      senderProfilePicture: `${sender.profilePicture}`,
      body,
      isRead, // Note: Ideally, backend should force this to 'false' initially.
      gifUrl,
      selectedImage: imageUrl,
      reaction: [],
      createdAt: new Date(),
      deleteForEveryone: false,
      deleteForMe: false
    };

    // -------------------------------------------------------------------------
    // 4. SOCKET.IO EMISSION
    // Broadcast message to clients.
    // -------------------------------------------------------------------------
    this.emitSocketIOEvent(messageData);

    // -------------------------------------------------------------------------
    // 5. EMAIL NOTIFICATION
    // Send email if the message is unread.
    // -------------------------------------------------------------------------
    if (!isRead) {
      this.messageNotification({
        receiverId,
        receiverName: receiverUsername,
        currentUser: req.currentUser!,
        message: body,
        messageData
      });
    }

    // -------------------------------------------------------------------------
    // 6. PERSISTENCE (TODO)
    // 1- add sender to chat list in cache
    // 2- add re// TODO: ⚠️ INBOX ORDERING ISSUE (Technical Debt)
    //
    // Current Logic:
    // `addChatListToCache` checks if the receiver exists in the list.
    // - If NOT exists: Adds to the list.
    // - If EXISTS: Does NOTHING.
    //
    // Problem:
    // In a real chat app, sending a new message should "Bump" the conversation
    // to the TOP of the list (Most Recent). Currently, old conversations stay
    // at the bottom even if they are active.
    //
    // FUTURE FIX:
    // Logic should be: If exists, REMOVE it and RE-ADD it at the top (or use Sorted Sets).ceiver to chat list in cache
    await Promise.all([
      messageCache.addChatListToCache(`${req.currentUser!.userId}`, `${receiverId}`, `${conversationObjectId}`),
      messageCache.addChatListToCache(`${receiverId}`, `${req.currentUser!.userId}`, `${conversationObjectId}`)
    ]);

    await messageCache.addChatMessageToCache(`${conversationObjectId}`, messageData);

    chatQueue.addChatJob('addChatMessageToDB', messageData);

    res.status(HTTP_STATUS.OK).json({ message: 'Message added', conversationId: conversationObjectId });
  };

  // -------------------------------------------------------------------------
  // TODO: ⚠️ PRESENCE SYSTEM FLAW (Zombie State Risk)
  //
  // Current Logic:
  // We manually add/remove users from the Redis 'chatUsers' list via HTTP endpoints
  // triggered by the Frontend (useEffect mount/unmount).
  //
  // Problem:
  // If the user closes the browser tab abruptly, the browser crashes, or internet drops
  // BEFORE the 'removeChatUsers' request is sent, the user will remain in the Redis list
  // indefinitely. This creates a "Zombie State" where they appear online/busy forever.
  //
  // FUTURE FIX:
  // Leverage Socket.io Native capabilities:
  // 1. Use `socket.join('room_id')` when chat opens.
  // 2. Socket.io AUTOMATICALLY removes the socket from rooms on `disconnect`.
  // 3. Use the 'disconnect' event on the server to clean up status if needed.
  // -------------------------------------------------------------------------
  public addChatUsers = async (req: Request, res: Response): Promise<void> => {
    const chatUsers = await messageCache.addChatUsersToCache(req.body);
    socketIOChatObject.emit('add chat users', chatUsers);
    res.status(HTTP_STATUS.OK).json({ message: 'Users added' });
  };

  public async removeChatUsers(req: Request, res: Response): Promise<void> {
    const chatUsers = await messageCache.removeChatUsersFromCache(req.body);
    socketIOChatObject.emit('add chat users', chatUsers);
    res.status(HTTP_STATUS.OK).json({ message: 'Users removed' });
  }

  private emitSocketIOEvent = (data: IMessageData): void => {
    // -------------------------------------------------------------------------
    // TODO: 🚀 PRIVACY UPGRADE (Socket Rooms)
    // Currently emitting to global namespace. Everyone connected receives the event.
    // FUTURE FIX: Use `io.to(receiverId).emit(...)` to send only to the specific user.
    // -------------------------------------------------------------------------
    socketIOChatObject.emit('message received', data);
    socketIOChatObject.emit('chat list', data);
  };

  private messageNotification = async ({ receiverId, receiverName, currentUser, message }: IMessageNotification): Promise<void> => {
    const cachedUser: IUserDocument = (await userCache.getUserFromCache(`${receiverId}`)) as IUserDocument;
    if (cachedUser.notifications.messages) {
      const templateParams: INotificationTemplate = {
        username: receiverName,
        message,
        header: `Message notification from ${currentUser.username}`
      };

      const template: string = notificationTemplate.notificationTemplate(templateParams);
      emailQueue.addEmailJob('directMessageEmail', {
        receiverEmail: `${cachedUser.email}`,
        template,
        subject: `You've received messages from ${currentUser.username}`
      });
    }
  };
}

export const add: Add = new Add();
