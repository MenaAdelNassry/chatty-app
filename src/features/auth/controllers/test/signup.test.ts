import { signup } from '@auth/controllers/signup';
import { Request, Response } from 'express';
import * as cloudinaryUploads from '@global/helpers/cloudinary-upload';
import { authMock, authMockRequest, authMockResponse } from '@root/mocks/auth.mock';
import { CustomError } from '@global/helpers/error-handler';
import { authService } from '@service/db/auth.service';
import { UserCache } from '@service/redis/user.cache';

jest.mock('@service/queues/base.queue');
jest.mock('@service/queues/user.queue');
jest.mock('@service/queues/auth.queue');
jest.mock('@service/redis/user.cache');
jest.mock('@global/helpers/cloudinary-upload');

const validInput = {
  username: 'Manny',
  email: 'manny@test.com',
  password: 'qwerty',
  avatarColor: 'red',
  avatarImage: 'data:text/plain;base64,SGVsbG8sIFdvcmxkIQ=='
};

describe('Signup', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  // --------------------  Testing For Username  --------------------
  it('should throw an error if username is not available', () => {
    const body = { ...validInput };
    body.username = '';

    const req: Request = authMockRequest(
      {}, body
    ) as Request;
    const res: Response = authMockResponse();

    signup.create(req, res).catch((error: CustomError) => {
      expect(error.statusCode).toEqual(400);
      expect(error.serializeErrors().message).toEqual('Username is a required field');
    });
  });

  it('should throw an error if username length is less than minimum length', () => {
    const body = { ...validInput };
    body.username = 'Ma';

    const req: Request = authMockRequest(
      {}, body
    ) as Request;
    const res: Response = authMockResponse();

    signup.create(req, res).catch((error: CustomError) => {
      expect(error.statusCode).toEqual(400);
      expect(error.serializeErrors().message).toEqual('Invalid username');
    });
  });

  it('should throw an error if username length is greater than maximum length', () => {
    const body = { ...validInput };
    body.username = 'k'.repeat(40);

    const req: Request = authMockRequest(
      {}, body
    ) as Request;
    const res: Response = authMockResponse();

    signup.create(req, res).catch((error: CustomError) => {
      expect(error.statusCode).toEqual(400);
      expect(error.serializeErrors().message).toEqual('Invalid username');
    });
  });

  // --------------------  Testing For Email  --------------------
  it('should throw an error if email is not valid', () => {
    const body = { ...validInput };
    body.email = 'invalid email';

    const req: Request = authMockRequest(
      {}, body
    ) as Request;
    const res: Response = authMockResponse();

    signup.create(req, res).catch((error: CustomError) => {
      expect(error.statusCode).toEqual(400);
      expect(error.serializeErrors().message).toEqual('Email must be valid');
    });
  });

  it('should throw an error if email is not available', () => {
    const body = { ...validInput };
    body.email = '';

    const req: Request = authMockRequest(
      {}, body
    ) as Request;
    const res: Response = authMockResponse();

    signup.create(req, res).catch((error: CustomError) => {
      expect(error.statusCode).toEqual(400);
      expect(error.serializeErrors().message).toEqual('Email is a required field');
    });
  });

  // --------------------  Testing For Password  --------------------
  it('should throw an error if password is not available', () => {
    const body = { ...validInput };
    body.password = '';

    const req: Request = authMockRequest(
      {}, body
    ) as Request;
    const res: Response = authMockResponse();

    signup.create(req, res).catch((error: CustomError) => {
      expect(error.statusCode).toEqual(400);
      expect(error.serializeErrors().message).toEqual('Password is a required field');
    });
  });

  it('should throw an error if password length is less than minimum length', () => {
    const body = { ...validInput };
    body.password = '12';

    const req: Request = authMockRequest(
      {}, body
    ) as Request;
    const res: Response = authMockResponse();

    signup.create(req, res).catch((error: CustomError) => {
      expect(error.statusCode).toEqual(400);
      expect(error.serializeErrors().message).toEqual('Invalid password');
    });
  });

  it('should throw an error if password length is greater than maximum length', () => {
    const body = { ...validInput };
    body.password = '1'.repeat(40);

    const req: Request = authMockRequest(
      {}, body
    ) as Request;
    const res: Response = authMockResponse();

    signup.create(req, res).catch((error: CustomError) => {
      expect(error.statusCode).toEqual(400);
      expect(error.serializeErrors().message).toEqual('Invalid password');
    });
  });

  // --------------------  Testing For Existing User  --------------------
  it('should throw unauthorize error is user already exist', () => {
    const body = { ...validInput };

    const req: Request = authMockRequest(
      {}, body
    ) as Request;
    const res: Response = authMockResponse();

    jest.spyOn(authService, "getUserByUsernameOrEmail").mockResolvedValue(authMock);
    signup.create(req, res).catch((error: CustomError) => {
      expect(error.statusCode).toEqual(400);
      expect(error.serializeErrors().message).toEqual("Invalid credentials");
    });
  });

  // --------------------  Testing For Success Creating User  --------------------
  it("should set session data for valid credentials and send correct json response", async () => {
    const body = { ...validInput };

    const req: Request = authMockRequest(
      {}, body
    ) as Request;
    const res: Response = authMockResponse();

    jest.spyOn(authService, "getUserByUsernameOrEmail").mockResolvedValue(null);
    const userSpy = jest.spyOn(UserCache.prototype, 'saveUserToCache');
    jest.spyOn(cloudinaryUploads, 'uploads').mockImplementation((): any => Promise.resolve({ version: '1234737373', public_id: '123456' }));

    await signup.create(req, res);
    expect(req.session?.token).toBeDefined();
    expect(res.json).toHaveBeenCalledWith({
      message: 'User created successfully',
      user: userSpy.mock.calls[0][2],
      token: req.session?.token
    });
  });
});
