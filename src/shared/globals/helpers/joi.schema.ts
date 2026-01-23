import Joi from 'joi';

export const objectIdSchema = Joi.object().keys({
  param: Joi.string().required().hex().length(24).messages({
    'string.base': 'ID must be a string',
    'string.hex': 'ID must be a valid hex string',
    'string.length': 'ID must be a valid MongoDB ObjectId',
    'any.required': 'ID is required'
  })
});
