import { Request, Response } from 'express';
import HTTP_STATUS from 'http-status-codes';
import { imageService } from '@service/db/image.service';
import { imageTypes } from '@image/interfaces/image.interface';

const allowedTypes = ['profile', 'background', 'post', 'all'] as const;

class Get {
  public async images(req: Request, res: Response): Promise<void> {
    // 1. Extract Data
    const { userId } = req.params;

    // Example: /images/12345?page=2&type=profile
    const page = Number(req.params.page) || 1; // Default to page 1
    const typeParam = req.params.type;

    let type = allowedTypes.includes(typeParam as imageTypes) ? typeParam : 'all';

    // 2. Call Service 📞
    const { images, total } = await imageService.getImages(userId, page, 12, type as imageTypes);

    // 3. Send Response 🚀
    res.status(HTTP_STATUS.OK).json({
      message: 'User images',
      images,
      total
    });
  }
}

export const get: Get = new Get();
