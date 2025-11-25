import { Request, Response } from 'express';
import { get } from '@image/controllers/get-images';
import { imageService } from '@service/db/image.service';
import { imageMockRequest, imageMockResponse, mockImageDocument } from '@root/mocks/image.mock';
import { authUserPayload } from '@root/mocks/auth.mock';
import HTTP_STATUS from 'http-status-codes';

jest.mock('@service/db/image.service');

describe('Get Images Controller', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('should send correct json response', async () => {
    const req: Request = imageMockRequest({}, authUserPayload, { userId: '12345' }) as Request;
    const res: Response = imageMockResponse();

    jest.spyOn(imageService, 'getImages').mockResolvedValue([mockImageDocument]);

    await get.images(req, res);

    expect(imageService.getImages).toHaveBeenCalledWith('12345');
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User images',
      images: [mockImageDocument]
    });
  });
});
