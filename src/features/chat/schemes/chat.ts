import { MessageReactionValues } from '@chat/interfaces/message.interface';
import Joi, { ObjectSchema } from 'joi';

const addMessageSchema: ObjectSchema = Joi.object()
  .keys({
    conversationId: Joi.string().trim().min(1).optional(),
    receiverId: Joi.string().trim().min(1).optional(),
    replyTo: Joi.string(),
    receiverData: Joi.any().optional(),

    // Content fields
    body: Joi.string().optional().max(5000).allow(null, ''),
    gifUrl: Joi.string().optional().allow(null, ''),
    selectedImage: Joi.string().optional().allow(null, ''),
    selectedVideo: Joi.string().optional().allow(null, ''),
    selectedAudio: Joi.string().optional().allow(null, ''),

    // Message type
    type: Joi.string().required().valid('text', 'image', 'video', 'gif', 'audio'),

    // Socket
    socketId: Joi.string().required()
  })
  .xor('receiverId', 'conversationId')
  .custom((value, helpers) => {
    const { body, gifUrl, selectedImage, selectedVideo, selectedAudio, type } = value;

    // Count how many content types are present
    const contentCount = [!!body, !!gifUrl, !!selectedImage, !!selectedVideo, !!selectedAudio].filter(Boolean).length;

    // Rule 1: At least one content type must be sent
    if (contentCount === 0) {
      return helpers.error('any.required', { message: 'At least one content type must be sent' });
    }

    // Rule 2: Maximum 2 content types allowed
    if (contentCount > 2) {
      return helpers.error('any.invalid', { message: 'Cannot send more than 2 content types together' });
    }

    // Rule 3: Only allowed combinations are: (text + image) OR (text + video)
    if (contentCount === 2) {
      const hasText = !!body;
      const hasImage = !!selectedImage;
      const hasVideo = !!selectedVideo;
      const hasGif = !!gifUrl;
      const hasAudio = !!selectedAudio;

      // Only allow text+image or text+video combinations
      const isValidCombination =
        (hasText && hasImage && !hasVideo && !hasGif && !hasAudio) || (hasText && hasVideo && !hasImage && !hasGif && !hasAudio);

      if (!isValidCombination) {
        return helpers.error('any.invalid', {
          message: 'Only allowed combinations are: text + image OR text + video'
        });
      }
    }

    // Rule 4: Two content types combination rules
    if (contentCount === 2) {
      // If sending image + text, type must be 'image'
      if (selectedImage && body && type !== 'image') {
        return helpers.error('any.invalid', {
          message: 'When sending image with text, type must be "image"'
        });
      }

      // If sending video + text, type must be 'video'
      if (selectedVideo && body && type !== 'video') {
        return helpers.error('any.invalid', {
          message: 'When sending video with text, type must be "video"'
        });
      }
    }

    // Rule 5: If type is 'text', it must be sent alone (no other content)
    if (type === 'text' && contentCount > 1) {
      return helpers.error('any.invalid', {
        message: 'When type is "text", it must be sent alone without other content types'
      });
    }

    // Rule 6: Check that required fields for each type are present
    if (type === 'image' && !selectedImage) {
      return helpers.error('any.required', { message: 'selectedImage is required when type is image' });
    }
    if (type === 'video' && !selectedVideo) {
      return helpers.error('any.required', { message: 'selectedVideo is required when type is video' });
    }
    if (type === 'gif' && !gifUrl) {
      return helpers.error('any.required', { message: 'gifUrl is required when type is gif' });
    }
    if (type === 'audio' && !selectedAudio) {
      return helpers.error('any.required', { message: 'selectedAudio is required when type is audio' });
    }
    if (type === 'text' && !body) {
      return helpers.error('any.required', { message: 'body is required when type is text' });
    }

    return value;
  });

const markChatSchema = Joi.object().keys({
  conversationId: Joi.string().required(),
  socketId: Joi.string().required(),
  messageId: Joi.string().required()
});

const deleteMessageSchema: ObjectSchema = Joi.object().keys({
  messageId: Joi.string().required(),
  conversationId: Joi.string().required(),
  type: Joi.string().required().valid('me', 'everyone'),
  socketId: Joi.string().required()
});

const messageReactionSchema = Joi.object({
  conversationId: Joi.string().required(),
  messageId: Joi.string().required(),
  socketId: Joi.string().required(),
  reaction: Joi.string()
    .valid(...MessageReactionValues)
    .required()
});

export { addMessageSchema, markChatSchema, deleteMessageSchema, messageReactionSchema };
