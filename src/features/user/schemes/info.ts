import Joi, { ObjectSchema } from "joi";

const basicInfoSchema: ObjectSchema = Joi.object().keys({
  quote: Joi.string().optional().allow("", null),
  work: Joi.string().optional().allow("", null),
  school: Joi.string().optional().allow("", null),
  location: Joi.string().optional().allow("", null),
});

const socialLinksSchema: ObjectSchema = Joi.object().keys({
  facebook: Joi.string().uri().optional().allow("", null).messages({
    'string.uri': 'Facebook must be a valid URL (e.g., https://facebook.com/username)'
  }),

  twitter: Joi.string().uri().optional().allow("", null).messages({
    'string.uri': 'Twitter must be a valid URL (e.g., https://twitter.com/username)'
  }),

  instagram: Joi.string().uri().optional().allow("", null).messages({
    'string.uri': 'Instagram must be a valid URL (e.g., https://instagram.com/username)'
  }),

  youtube: Joi.string().uri().optional().allow("", null).messages({
    'string.uri': 'YouTube must be a valid URL (e.g., https://youtube.com/channel/...)'
  }),
});

const changePasswordSchema: ObjectSchema = Joi.object().keys({
  currentPassword: Joi.string().required().min(4).max(8).messages({
    'string.base': 'Password should be a type of string',
    'string.min': 'Password must have a minimum length of {#limit}',
    'string.max': 'Password should have a maximum length of {#limit}',
    'string.empty': 'Password is a not allowed to be empty',
    'any.required': 'Password is a required field',
  }),
  newPassword: Joi.string().required().min(4).max(8).messages({
    'string.base': 'Password should be a type of string',
    'string.min': 'Password must have a minimum length of {#limit}',
    'string.max': 'Password should have a maximum length of {#limit}',
    'string.empty': 'Password is a not allowed to be empty',
    'any.required': 'Password is a required field',
  }),
  confirmPassword: Joi.any().equal(Joi.ref('newPassword')).required().messages({
    'any.only': 'Confirm password does not match new password.'
  }),
});

const notificationSettingsSchema: ObjectSchema = Joi.object().keys({
  messages: Joi.boolean().optional(),
  reactions: Joi.boolean().optional(),
  comments: Joi.boolean().optional(),
  follows: Joi.boolean().optional()
});

export { basicInfoSchema, socialLinksSchema, changePasswordSchema, notificationSettingsSchema };
