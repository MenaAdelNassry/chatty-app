import crypto from 'crypto';

export class Helpers {
  static firstLetterUppercase(str: string): string {
    const valueString = str.toLowerCase();
    return valueString
      .split(' ')
      .map((value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`)
      .join(' ');
  }

  static lowerCase(str: string) {
    return str.toLowerCase();
  }

  static generateRandomIntegers(integerLength: number): number {
    const characters = '0123456789';
    let result = '';

    for (let i = 0; i < integerLength; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return parseInt(result, 10);
  }

  static parseJson(prop: string): any {
    try {
      return JSON.parse(prop);
    } catch (err) {
      return prop;
    }
  }

  static isBase64(value: string): boolean {
    return value.startsWith('data:image');
  }

  static shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[j], shuffled[i]] = [shuffled[i], shuffled[j]];
    }

    return shuffled;
  }

  static escapeRegex(text: string): string {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }

  static checkImageSize(image: string, limitMB: number = 10): boolean {
    // (data:image/png;base64,)
    const base64Length = image.length - (image.indexOf(',') + 1);

    const padding = image.charAt(image.length - 1) === '=' ? 1 : 0;
    const padding2 = image.charAt(image.length - 2) === '=' ? 1 : 0;

    const fileSizeInBytes = base64Length * 0.75 - (padding + padding2);
    const fileSizeInMB = fileSizeInBytes / 1000000;

    return fileSizeInMB <= limitMB;
  }

  static getRandomOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  static secondsToMinutesString(seconds: number): string {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes}m`;
  }

  // 🔐 Strong password generator
  static generateStrongPassword(length: number = 16): string {
    if (length < 8) {
      throw new Error('Password length must be at least 8 characters');
    }

    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const allChars = lowercase + uppercase + numbers + symbols;

    const password: string[] = [
      lowercase[this.randomIndex(lowercase.length)],
      uppercase[this.randomIndex(uppercase.length)],
      numbers[this.randomIndex(numbers.length)],
      symbols[this.randomIndex(symbols.length)]
    ];

    const remainingLength = length - password.length;
    const randomBytes = crypto.randomBytes(remainingLength);

    for (let i = 0; i < remainingLength; i++) {
      password.push(allChars[randomBytes[i] % allChars.length]);
    }

    return this.shuffleArray(password).join('');
  }

  public static generateRandomUsername(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  static getRandomAvatarColor(): string {
    const colors = [
      '#F44336', // red
      '#E91E63', // pink
      '#9C27B0', // purple
      '#673AB7', // deep purple
      '#3F51B5', // indigo
      '#2196F3', // blue
      '#03A9F4', // light blue
      '#00BCD4', // cyan
      '#009688', // teal
      '#4CAF50', // green
      '#8BC34A', // light green
      '#FF9800', // orange
      '#FF5722', // deep orange
      '#795548', // brown
      '#607D8B' // blue grey
    ];

    return colors[crypto.randomInt(0, colors.length)];
  }

  private static randomIndex(max: number): number {
    return crypto.randomInt(0, max);
  }

  private static shuffleArray(array: string[]): string[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
