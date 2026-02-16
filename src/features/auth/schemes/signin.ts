import Joi, { ObjectSchema } from 'joi';
import { emailField, passwordObject } from '@auth/schemes/password';

const loginSchema: ObjectSchema = Joi.object().keys({
  email: emailField,
  password: passwordObject,
  keepLoggedIn: Joi.boolean().default(false),
});

export { loginSchema };
