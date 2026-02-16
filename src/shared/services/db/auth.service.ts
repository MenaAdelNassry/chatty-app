import { IAuthDocument } from "@auth/interfaces/auth.interface";
import { AuthModel } from "@auth/models/auth.schema";
import { Helpers } from "@global/helpers/helpers";

class AuthService {
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

  public async getAuthUserByGoogleId(googleId: string): Promise<IAuthDocument | null> {
    const user: IAuthDocument | null = await AuthModel.findOne({ googleId }).exec();
    return user;
  }
}

export const authService: AuthService = new AuthService();
