import Joi, { ObjectSchema } from 'joi';

// 1. General Schema (Base properties shared by all)
const basicPostProps = {
  post: Joi.string().optional().allow(null, ''),
  bgColor: Joi.string().optional().allow(null, ''),
  privacy: Joi.string().optional().allow(null, ''),
  feelings: Joi.string().optional().allow(null, ''),
  gifUrl: Joi.string().optional().allow(null, ''),
  profilePicture: Joi.string().uri().optional().allow(null, ''),

  imgVersion: Joi.string().optional().allow(null, ''),
  imgId: Joi.string().optional().allow(null, ''),
  image: Joi.string().optional().allow(null, ''),
  videoVersion: Joi.string().optional().allow(null, ''),
  videoId: Joi.string().optional().allow(null, ''),
  video: Joi.string().optional().allow(null, ''),
};

// ---------------------------------------------------------
// Schema for TEXT POSTS (No Image/Video required)
// ---------------------------------------------------------
const postSchema: ObjectSchema = Joi.object().keys({
  ...basicPostProps,
});

// ---------------------------------------------------------
// Schema for IMAGE POSTS (Supports Create & Update)
// ---------------------------------------------------------
const postWithImageSchema: ObjectSchema = Joi.object().keys({
  ...basicPostProps,

}).custom((value, helpers) => {
  if(!value.image && !value.imgId) {
    return helpers.message({ custom: 'You must provide either an image file or an existing imageID' });
  }
  return value;
});

// ---------------------------------------------------------
// Schema for VIDEO POSTS (Supports Create & Update)
// ---------------------------------------------------------
const postWithVideoSchema: ObjectSchema = Joi.object().keys({
  ...basicPostProps,

}).custom((value, helpers) => {
  if(!value.video && !value.videoId) {
    return helpers.message({ custom: 'You must provide either a video file or an existing videoID' });
  }
  return value;
});

export { postSchema, postWithImageSchema, postWithVideoSchema };
