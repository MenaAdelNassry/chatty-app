import Joi, { ObjectSchema } from 'joi';

const addChatSchema: ObjectSchema = Joi.object().keys({
  conversationId: Joi.string().optional().allow(null, ''),

  receiverId: Joi.string().required().messages({
    'any.required': 'Receiver is required',
    'string.empty': 'Receiver is required'
  }),

  receiverUsername: Joi.string().required().messages({
    'any.required': 'Receiver username is required',
    'string.empty': 'Receiver username is required'
  }),

  receiverAvatarColor: Joi.string().required().messages({
    'any.required': 'Receiver avatar color is required',
    'string.empty': 'Receiver avatar color is required'
  }),

  receiverProfilePicture: Joi.string().required().messages({
    'any.required': 'Receiver profile picture is required',
    'string.empty': 'Receiver profile picture is required'
  }),

  body: Joi.string().optional().allow(null, ''),
  gifUrl: Joi.string().optional().allow(null, ''),
  selectedImage: Joi.string().optional().allow(null, ''),

  isRead: Joi.boolean().optional() // we should delete it , we cannot trust that client determine read or not

}).custom((value, helpers) => {
  const { body, gifUrl, selectedImage } = value;
  if (!body && !gifUrl && !selectedImage) {
    return helpers.message({ custom: 'You must provide at least one: message body, gif, or image' });
  }

  return value;
});

const addMessageReactionSchema: ObjectSchema = Joi.object().keys({
  conversationId: Joi.string().required().messages({
    'any.required': 'Conversation ID is a required property',
    'string.empty': 'Conversation ID is not allowed to be empty'
  }),
  messageId: Joi.string().required().messages({
    'any.required': 'Message ID is a required property',
    'string.empty': 'Message ID is not allowed to be empty'
  }),
  reaction: Joi.string().required().messages({
    'any.required': 'Reaction string is a required property',
    'string.empty': 'Reaction string is not allowed to be empty'
  }),
  type: Joi.string().valid('add', 'remove').required().messages({
    'any.required': 'Type is a required property',
    'string.empty': 'Type is not allowed to be empty',
    'any.only': 'Type must be either "add" or "remove"'
  })
});

export { addChatSchema, addMessageReactionSchema };
