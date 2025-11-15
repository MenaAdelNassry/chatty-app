import { authMock, authMockRequest, authMockResponse } from "@root/mocks/auth.mock";
import { Request, Response } from "express";
import { password } from "@auth/controllers/password";
import { CustomError } from "@global/helpers/error-handler";
import { authService } from "@service/db/auth.service";
import { emailQueue } from "@service/queues/email.queue";

const WRONG_EMAIL = 'test@email.com';
const CORRECT_EMAIL = 'manny@me.com';
const INVALID_EMAIL = 'test';
const CORRECT_PASSWORD = 'manny';

jest.mock("@service/db/auth.service.ts");
jest.mock("@service/emails/mail.transport.ts");
jest.mock("@service/queues/base.queue.ts");
jest.mock("@service/queues/email.queue.ts");

describe("Password", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should throw an error if email is invalid", () => {
      const req: Request = authMockRequest({}, { email: INVALID_EMAIL }) as Request;
      const res: Response = authMockResponse();

      password.create(req, res).catch((error: CustomError) => {
        expect(error.statusCode).toEqual(400);
        expect(error.serializeErrors().message).toEqual('Field must be valid');
      });
    });

    it('should throw "Invalid credentials" if email does not exist', () => {
      const req: Request = authMockRequest({}, { email: WRONG_EMAIL }) as Request;
      const res: Response = authMockResponse();
      jest.spyOn(authService, "getAuthUserByEmail").mockResolvedValue(null as any);

      password.create(req, res).catch((error: CustomError) => {
        expect(error.statusCode).toEqual(400);
        expect(error.serializeErrors().message).toEqual('Invalid credentials');
      });
    });

    it('should send correct json response', async () => {
      const req: Request = authMockRequest({}, { email: CORRECT_EMAIL }) as Request;
      const res: Response = authMockResponse();
      jest.spyOn(authService, "getAuthUserByEmail").mockResolvedValue(authMock);
      jest.spyOn(emailQueue, 'addEmailJob');

      await password.create(req, res);
      expect(emailQueue.addEmailJob).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Password reset email sent."
      });
    });
  });

  describe("update", () => {
    it("should throw an error if password is empty", () => {
      const req: Request = authMockRequest({}, { password: '' }) as Request;
      const res: Response = authMockResponse();

      password.update(req, res).catch((error: CustomError) => {
        expect(error.statusCode).toEqual(400);
        expect(error.serializeErrors().message).toEqual("Password is a required field");
      });
    });

    it('should throw an error if password and confirmPassword are different', () => {
      const req: Request = authMockRequest({}, { password: CORRECT_PASSWORD, confirmPassword: `${CORRECT_PASSWORD}1` }) as Request;
      const res: Response = authMockResponse();

      password.update(req, res).catch((error: CustomError) => {
        expect(error.statusCode).toEqual(400);
        expect(error.serializeErrors().message).toEqual("Passwords should match");
      });
    });

    it('should throw error if reset token has expired', () => {
      const req: Request = authMockRequest(
        {},
        { password: CORRECT_PASSWORD, confirmPassword: `${CORRECT_PASSWORD}` },
        null,
        { token: "", userId: "12123sfsd54dg" }) as Request;
      const res: Response = authMockResponse();
      jest.spyOn(authService, "getAuthUserByPasswordToken").mockResolvedValue(null as any);

      password.update(req, res).catch((error: CustomError) => {
        expect(error.statusCode).toEqual(400);
        expect(error.serializeErrors().message).toEqual("Invalid or expired password reset token");
      });
    });

    it('should send correct json response', async () => {
      const req: Request = authMockRequest(
        {},
        { password: CORRECT_PASSWORD, confirmPassword: `${CORRECT_PASSWORD}` },
        null,
        { token: "1234", userId: "12123sfsd54dg" }) as Request;
      const res: Response = authMockResponse();
      jest.spyOn(authService, "getAuthUserByPasswordToken").mockResolvedValue(authMock);
      jest.spyOn(emailQueue, "addEmailJob");

      await password.update(req, res);
      expect(emailQueue.addEmailJob).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Password successfully updated."
      })
    });
  });
});
