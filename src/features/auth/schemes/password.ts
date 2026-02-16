import Joi, { ObjectSchema } from 'joi';

export const emailField = Joi.string().email().required().messages({
  'string.base': 'Email must be valid',
  'string.email': 'Email must be valid',
  'any.required': 'Email must be valid'
});

const emailSchema: ObjectSchema = Joi.object().keys({
  email: emailField
});

const verifyOtpSchema: ObjectSchema = Joi.object().keys({
  email: emailField,
  otp: Joi.string().length(6).pattern(/^\d+$/).required().messages({
    'string.base': 'OTP must be a string',
    'string.length': 'OTP must be exactly 6 digits',
    'string.pattern.base': 'OTP must contain only numbers',
    'any.required': 'OTP is required'
  })
});

export const passwordObject = Joi.string().required().min(7).max(20).messages({
  'string.base': 'Password should be of type string',
  'string.min': 'Invalid password',
  'string.max': 'Invalid password',
  'string.empty': 'Password is a required field'
});

const passwordSchema: ObjectSchema = Joi.object().keys({
  password: passwordObject,
  confirmPassword: Joi.string().required().valid(Joi.ref('password')).messages({
    'any.only': 'Passwords should match',
    'any.required': 'Confirm password is a required field'
  }),
  resetToken: Joi.string().required()
});

export { emailSchema, passwordSchema, verifyOtpSchema };
