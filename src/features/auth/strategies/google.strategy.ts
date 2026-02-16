import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from '@root/config';
import { authService } from '@service/db/auth.service';
import { IAuthDocument } from '@auth/interfaces/auth.interface';
import { Helpers } from '@global/helpers/helpers';
import { ObjectId } from 'mongodb';
import { AuthHelper } from '@global/helpers/auth.helpers';
import { IUserDocument } from '@user/interfaces/user.interface';
import { userService } from '@service/db/user.service';

export class SocialStrategy {
  public google(): void {
    passport.use(
      new GoogleStrategy(
        {
          clientID: config.GOOGLE_CONSOLE_CLOUD_CLIENT_ID!,
          clientSecret: config.GOOGLE_CONSOLE_CLOUD_CLIENT_SECRET!,
          callbackURL: config.GOOGLE_CONSOLE_CLOUD_CALLBACK_URL,
          passReqToCallback: true,
          scope: ['profile', 'email']
        },
        async (req: any, accessToken: string, refreshToken: string, profile: any, done: any) => {
          try {
            // Case 1: Existing Google User
            const existingUser = await authService.getAuthUserByGoogleId(profile.id);
            if (existingUser) {
              const user: IUserDocument = await userService.getUserByAuthId(`${existingUser._id}`);
              return done(null, user);
            }

            // Case 2: Link Account (Email exists)
            const email = profile.emails![0].value;
            const existingEmailUser = await authService.getAuthUserByEmail(email);

            if (existingEmailUser) {
              if (existingEmailUser.emailVerified === false) {
                existingEmailUser.emailVerified = true;
                existingEmailUser.tokenVersion = (existingEmailUser.tokenVersion || 0) + 1;
                existingEmailUser.password = Helpers.generateStrongPassword(20);
              }

              existingEmailUser.googleId = profile.id;
              await existingEmailUser.save();

              const user: IUserDocument = await userService.getUserByAuthId(`${existingEmailUser._id}`);
              return done(null, user);
            }

            // Case 3: New User
            const newAuthUser: IUserDocument = await this.socialSignup(profile);
            return done(null, newAuthUser);
          } catch (error) {
            return done(error, null);
          }
        }
      )
    );

    // Serialization (Required by Passport)
    passport.serializeUser((user: any, done: any) => done(null, user));
    passport.deserializeUser((user: any, done: any) => done(null, user));
  }

  private async socialSignup(profile: any): Promise<IUserDocument> {
    const { id, displayName, emails, photos } = profile;

    const authObjectId: ObjectId = new ObjectId();
    const userObjectId: ObjectId = new ObjectId();
    const uId = `${Helpers.generateRandomIntegers(12)}`;
    const password = Helpers.generateStrongPassword(20);

    // 1. 🔥 Upload Google Image
    const photoUrl = await AuthHelper.uploadUserProfileImage(photos ? photos[0].value : '', userObjectId);

    // 2. Prepare Auth Data
    const authData: IAuthDocument = {
      _id: authObjectId,
      uId,
      username: Helpers.firstLetterUppercase(displayName || Helpers.generateRandomUsername(20)),
      email: Helpers.lowerCase(emails![0].value),
      password,
      avatarColor: Helpers.getRandomAvatarColor(),
      createdAt: new Date(),
      tokenVersion: 0,
      emailVerified: true,
      googleId: id
    } as IAuthDocument;

    // 3. Save User
    const userData = await AuthHelper.createAndSaveUser(authData, userObjectId, photoUrl);

    return userData;
  }
}
