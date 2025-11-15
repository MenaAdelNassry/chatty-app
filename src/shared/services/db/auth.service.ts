import { IAuthDocument } from "@auth/interfaces/auth.interface";
import { AuthModel } from "@auth/models/auth.schema";
import { Helpers } from "@global/helpers/helpers";
import crypto from "node:crypto";

class AuthService {
  public async updatePasswordToken(authId: string, token: string, tokenExpiration: number): Promise<void> {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    await AuthModel.updateOne({ _id: authId }, {
      passwordResetToken: hashedToken,
      passwordResetExpires: tokenExpiration
    });
  }

  public async addAuthUserToDB(data: IAuthDocument): Promise<void> {
    await AuthModel.create(data);
  }

  public async getUserByUsernameOrEmail(username: string, email: string): Promise<IAuthDocument | null> {
    const query = {
      $or: [
        { username: Helpers.firstLetterUppercase(username) },
        { email: Helpers.lowerCase(email) }
      ]
    }
    const user: IAuthDocument | null = await AuthModel.findOne(query).exec();
    return user;
  }

  public async getAuthUserByUsername(username: string): Promise<IAuthDocument> {
    const user = await AuthModel.findOne({ username: Helpers.firstLetterUppercase(username) }).exec() as IAuthDocument;
    return user;
  }

  public async getAuthUserByEmail(email: string): Promise<IAuthDocument> {
    const user = await AuthModel.findOne({ email: Helpers.lowerCase(email) }).exec() as IAuthDocument;
    return user;
  }

  public async getAuthUserByPasswordToken(token: string, authId: string): Promise<IAuthDocument> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await AuthModel.findOne({
      _id: authId,
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).exec() as IAuthDocument ;

    return user;
  }
}

export const authService: AuthService = new AuthService();
