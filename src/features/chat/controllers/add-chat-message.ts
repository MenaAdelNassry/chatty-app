import { ObjectId } from 'mongodb';
import { MessageType } from '@chat/interfaces/conversation.interface';
import { IMessageData, IMessageSocketData } from '@chat/interfaces/message.interface';
import { addMessageSchema } from '@chat/schemes/chat';
import { uploadToCloudinary } from '@global/helpers/cloudinary-upload';
import { joiRequestValidationError, NotFoundError } from '@global/helpers/error-handler';
import { ChatCache } from '@service/redis/chat.cache';
import { socketIOChatObject } from '@socket/chat';
import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { chatQueue } from '@service/queues/chat.queue';
import { UploadApiResponse } from 'cloudinary';
import { MessageModel } from '@chat/models/message.schema';
import mongoose from 'mongoose';

const chatCache: ChatCache = new ChatCache();

class Add {
  public message = async (req: Request, res: Response): Promise<void> => {
    // 1️⃣ Validate request
    const { error } = addMessageSchema.validate(req.body);
    if (error?.details) {
      throw new joiRequestValidationError(error.details[0].message.replace(/"/g, ''));
    }

    // 2️⃣ Upload media logic (Valid)
    const { type, selectedAudio, selectedVideo, selectedImage, socketId, conversationId: bodyConversationId } = req.body;
    const uploadedMedia = type === MessageType.AUDIO ? selectedAudio : type === MessageType.IMAGE ? selectedImage : selectedVideo;
    const uploadedMediaType = type === MessageType.IMAGE ? 'image' : 'video';
    if (uploadedMedia) {
      const result: UploadApiResponse = await uploadToCloudinary(uploadedMedia, { resource_type: uploadedMediaType });
      if (uploadedMedia === selectedAudio) req.body.selectedAudio = result.secure_url;
      if (uploadedMedia === selectedVideo) req.body.selectedVideo = result.secure_url;
      if (uploadedMedia === selectedImage) req.body.selectedImage = result.secure_url;
    }

    // 3️⃣ Prepare messageData
    const messageData: IMessageData = this.assignMessageData(req.body, req.currentUser!.userId);

    // First edit: Make sure the conversationId is present in all cases
    const isNewConversation = !bodyConversationId;
    if (isNewConversation) {
      messageData.conversationId = new mongoose.Types.ObjectId().toString();
    } else {
      messageData.conversationId = bodyConversationId;
    }

    // 4️⃣ Socket Payload & Populating Reply
    const socketPayload: IMessageSocketData = { ...messageData };

    if (req.body.replyTo) {
      const repliedMessage = await MessageModel.findById(req.body.replyTo);
      if (repliedMessage) {
        const populatedReply = {
          _id: repliedMessage._id,
          body: repliedMessage.body,
          senderId: repliedMessage.senderId,
          type: repliedMessage.type
        };

        messageData.replyTo = populatedReply as any;
        socketPayload.replyTo = populatedReply as any;
      } else {
        throw new NotFoundError("Replied Message Not Found");
      }
    }

    socketPayload.senderData = {
      username: req.currentUser!.username,
      avatarColor: req.currentUser!.avatarColor,
      profilePicture: req.currentUser!.profilePicture
    };

    // 5️⃣ Redis Cache
    await chatCache.addMessageToCache(`${messageData.conversationId}`, messageData);

    // 6️⃣ Queue Job
    const dbMessageData = {
      ...messageData,
      replyTo: req.body.replyTo,
      receiverId: isNewConversation ? req.body.receiverId : undefined
    };
    chatQueue.addChatJob('addChatMessageToDB', { message: dbMessageData, isNewConversation });

    // 7️⃣ Socket Emission
    if (!isNewConversation) {
      socketIOChatObject.to(`${messageData.conversationId}`).except(socketId).emit('sendMessage', socketPayload);
    } else if (req.body.receiverId) {
      socketIOChatObject.to(req.body.receiverId).emit('sendMessage', socketPayload);
      socketIOChatObject.to(req.currentUser!.userId).except(socketId).emit('sendMessage', socketPayload);
    }

    // 8️⃣ HTTP Response
    res.status(HTTP_STATUS.OK).json({
      message: 'Message added successfully',
      messageData: socketPayload
    });
  }

  private assignMessageData = (data: any, userId: string): IMessageData => {
    return {
      gifUrl: data.gifUrl || '',
      selectedAudio: data.selectedAudio || '',
      selectedVideo: data.selectedVideo || '',
      selectedImage: data.selectedImage || '',
      type: data.type,
      body: data.body || '',
      replyTo: data.replyTo || null,
      senderId: userId,
      createdAt: new Date().toISOString(),
      reaction: [],
      deletedFor: [],
      isDeleted: false,
      _id: new mongoose.Types.ObjectId().toString()
    } as unknown as IMessageData;
  }
}

export const add: Add = new Add();
