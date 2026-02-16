import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '@global/helpers/error-handler';

const getBase64SizeInMB = (base64String: string): number => {
  if (!base64String) return 0;
  const lengthInChars = base64String.length;
  const sizeInBytes = lengthInChars * 0.75;
  return sizeInBytes / (1024 * 1024); // Convert to MB
};

export const validateMediaSize = (field: string, limitMB: number) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const base64Data = req.body[field];

    if (base64Data) {
      const size = getBase64SizeInMB(base64Data);
      if (size > limitMB) {
        throw new BadRequestError(`File size too large. Maximum allowed is ${limitMB}MB.`);
      }
    }
    next();
  };
};
