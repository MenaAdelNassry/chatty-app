import Joi, { ObjectSchema } from 'joi';

const addImageSchema: ObjectSchema = Joi.object().keys({
  image: Joi.string().required().messages({
    'any.required': 'Image is a required field',
    'string.empty': 'Image property is not allowed to be empty'
  }),
});

export { addImageSchema };
