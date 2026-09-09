declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar;
    getLunar(): Lunar;
  }

  export class Lunar {
    getJieQi(): string;
    getJie(): string;
    getQi(): string;
    getFestivals(): string[];
    getOtherFestivals(): string[];
    getMonthInChinese(): string;
    getDayInChinese(): string;
    toString(): string;
  }

  export class Holiday {
    getName(): string;
    isWork(): boolean;
    getDay(): string;
    getTarget(): string;
  }

  export class HolidayUtil {
    static getHoliday(year: number, month: number, day: number): Holiday | null;
  }
}
