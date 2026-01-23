import Joi, { CustomHelpers, ObjectSchema } from 'joi';

const LIMIT_IN_MB = 5;

const validateImageSize = (value: string, helpers: CustomHelpers) => {
  const sizeInBytes = value.length * 0.75;

  const limitInBytes = LIMIT_IN_MB * 1024 * 1024;

  if (sizeInBytes > limitInBytes) {
    return helpers.error('any.invalid');
  }

  return value;
};

const addImageSchema: ObjectSchema = Joi.object().keys({
  image: Joi.string()
    .optional()
    .custom(validateImageSize)
    .messages({
      'any.invalid': `File size is too large. Max limit is ${LIMIT_IN_MB}MB.`
    }),
  existingPublicId: Joi.string().optional(),
  existingVersion: Joi.string().optional(),
})
  .xor('image', 'existingPublicId')
  .with('existingPublicId', 'existingVersion')
  .messages({
    'object.xor': 'You must provide either a new Image (Base64) or an Existing Image ID.',
    'object.with': 'If you provide an existing Public ID, you must also provide the Version.'
  });

export { addImageSchema };
