import Joi, { ObjectSchema } from 'joi';
import { emailField, passwordObject } from '@auth/schemes/password';

export const usernameObject = Joi.string().required().min(4).max(20).messages({
  'string.base': 'Username must be of type string',
  'string.min': 'Invalid username',
  'string.max': 'Invalid username',
  'string.empty': 'Username is a required field'
});

const signupSchema: ObjectSchema = Joi.object().keys({
  username: usernameObject,
  password: passwordObject,
  email: emailField,
  avatarColor: Joi.string().required().messages({
    'any.required': 'Avatar color is required'
  }),
  avatarImage: Joi.string().required().messages({
    'any.required': 'Avatar image is required'
  })
});

export { signupSchema };
