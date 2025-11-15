import { authMockRequest, authMockResponse } from "@root/mocks/auth.mock";
import { Request, Response } from "express";
import { signout } from "@auth/controllers/signout";

describe("Signout", () => {
  it("should set session to null", async () => {
    const req: Request = authMockRequest({}, {}) as Request;
    const res: Response = authMockResponse();

    await signout.update(req, res);
    expect(req.session).toBeNull();
  });

  it("should send correct json response", async () => {
    const req: Request = authMockRequest({}, {}) as Request;
    const res: Response = authMockResponse();

    await signout.update(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Logout successfully", user: {}, token: ''
    });
  });
});
