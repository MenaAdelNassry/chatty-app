import Joi, { ObjectSchema } from "joi";

const addCommentSchema: ObjectSchema = Joi.object().keys({
  postId: Joi.string().required().messages({
    'any.required': 'postId is a required property',
    'string.empty': 'postId cannot be empty'
  }),
  comment: Joi.string().required().messages({
    'any.required': 'comment is a required property',
    'string.empty': 'comment cannot be empty'
  })
});

export { addCommentSchema };
