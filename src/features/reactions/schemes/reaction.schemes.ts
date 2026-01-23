import Joi, { ObjectSchema } from "joi";

const addReactionSchema: ObjectSchema = Joi.object().keys({
  postId: Joi.string().required().messages({
    'any.required': 'postId is a required property'
  }),

  type: Joi.string().required().valid('like', 'love', 'happy', 'wow', 'sad', 'angry').messages({
    'any.required': 'Reaction type is a required property',
    'any.only': 'Invalid reaction type'
  }),
});

export { addReactionSchema };
