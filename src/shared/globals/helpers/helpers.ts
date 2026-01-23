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
}
