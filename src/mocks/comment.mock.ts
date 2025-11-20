import { AuthPayload } from "@auth/interfaces/auth.interface";
import { IJWT } from "./auth.mock";
import { Response } from 'express';
import { ICommentDocument, ICommentNameList } from '@comment/interfaces/comment.interface';

export interface IParams {
  postId?: string;
  commentId?: string;
  page?: string;
}

export interface IBody {
  postId?: string;
  comment?: string;
  profilePicture?: string;
  userTo?: string;
}

export const commentMockRequest = (session: IJWT, body: IBody, currentUser?: AuthPayload | null, params?: IParams) => ({
  session,
  body,
  currentUser,
  params
});

export const commentMockResponse = (): Response => {
  const res: Response = {} as Response;
  res.json = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  return res;
}

export const mockComment: ICommentDocument = {
  _id: '6064861bc25eaa5a5d2f9bf4',
  postId: '6027f77087c9d9ccb1555268',
  username: 'Manny',
  avatarColor: 'red',
  profilePicture: 'http://place-hold.it/500x500',
  comment: 'This is a comment',
  createdAt: new Date(),
  userTo: '60263f14648fed5246e322d9',
} as unknown as ICommentDocument;

export const mockNameList: ICommentNameList = {
  count: 1,
  names: ['Manny']
};
