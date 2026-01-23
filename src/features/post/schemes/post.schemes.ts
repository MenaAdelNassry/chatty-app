import Joi, { ObjectSchema } from 'joi';

// ---------------------------------------------------------
// 1. Base Definitions
// ---------------------------------------------------------
const basicFields = {
  post: Joi.string().optional().allow(null, ''),
  bgColor: Joi.string().optional().allow(null, ''),
  privacy: Joi.string().valid('Public', 'Private', 'public', 'private').optional().allow(null, ''),
  feelings: Joi.string().optional().allow(null, ''),
  gifUrl: Joi.string().optional().allow(null, ''),
  imgVersion: Joi.string().optional().allow(null, ''),
  imgId: Joi.string().optional().allow(null, ''),
  videoVersion: Joi.string().optional().allow(null, ''),
  videoId: Joi.string().optional().allow(null, '')
};

// ---------------------------------------------------------
// 2. Create Schemas
// ---------------------------------------------------------

// A. Text Only Post
const postSchema: ObjectSchema = Joi.object()
  .keys({
    ...basicFields,
    bgColor: Joi.string().optional().default('#ffffff'),
    privacy: Joi.string().valid('Public', 'Private', 'public', 'private').default('Public')
  })
  .custom((value, helpers) => {
    const hasText = value.post && value.post.trim().length > 0;
    const hasGif = value.gifUrl && value.gifUrl.trim().length > 0;

    if (!hasText && !hasGif) {
      return helpers.message({ custom: 'Post must contain at least text or a GIF' });
    }
    return value;
  });

// B. Post With Image
const postWithImageSchema: ObjectSchema = Joi.object().keys({
  ...basicFields,
  bgColor: Joi.string().optional().default('#ffffff'),
  privacy: Joi.string().valid('Public', 'Private', 'public', 'private').default('Public'),

  image: Joi.string().required().messages({
    'any.required': 'Image is required',
    'string.base': 'Image must be a valid string (base64)'
  })
});

// C. Post With Video
const postWithVideoSchema: ObjectSchema = Joi.object().keys({
  ...basicFields,
  bgColor: Joi.string().optional().default('#ffffff'),
  privacy: Joi.string().valid('Public', 'Private', 'public', 'private').default('Public'),

  video: Joi.string().required().messages({
    'any.required': 'Video is required',
    'string.base': 'Video must be a valid string'
  })
});

// ---------------------------------------------------------
// 3. Unified Update Schema
// ---------------------------------------------------------
const updatePostSchema: ObjectSchema = Joi.object()
  .keys({
    ...basicFields,
    image: Joi.string().allow('').optional(),
    video: Joi.string().allow('').optional(),
    gifUrl: Joi.string().uri().optional(),
  })
  .min(1)
  .messages({
    'object.min': 'You must provide at least one field to update'
  })
  .oxor('image', 'video', 'gifUrl');;

export { postSchema, postWithImageSchema, postWithVideoSchema, updatePostSchema };
