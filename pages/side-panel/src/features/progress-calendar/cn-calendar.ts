import { HolidayUtil, Solar } from 'lunar-javascript';

type CnDayMark = {
  /** 二十四节气，无则空 */
  solarTerm: string;
  /** 法定节假日名称（含调休关联节日），无则空 */
  holidayName: string;
  /** 法定休假日（放假） */
  isHolidayOff: boolean;
  /** 调休上班日 */
  isHolidayWork: boolean;
  /** 周六/日且非调休上班：按休息日标红 */
  isWeekendRest: boolean;
  /** 格子内短标注：假日名 / 班 / 节气 */
  badge: string;
};

const shortenHolidayName = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.endsWith('节') && trimmed.length > 2) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
};

const getCnDayMark = (year: number, month: number, day: number): CnDayMark => {
  const lunar = Solar.fromYmd(year, month + 1, day).getLunar();
  const solarTerm = lunar.getJieQi() || '';
  const holiday = HolidayUtil.getHoliday(year, month + 1, day);
  const holidayName = holiday?.getName()?.trim() || '';
  const isHolidayWork = Boolean(holiday?.isWork());
  const isHolidayOff = Boolean(holiday && !holiday.isWork());
  const weekday = new Date(year, month, day).getDay();
  const isWeekendRest = (weekday === 0 || weekday === 6) && !isHolidayWork;

  let badge = '';
  if (isHolidayWork) {
    badge = '班';
  } else if (isHolidayOff) {
    badge = shortenHolidayName(holidayName) || '休';
  } else if (solarTerm) {
    badge = solarTerm;
  }

  return {
    solarTerm,
    holidayName,
    isHolidayOff,
    isHolidayWork,
    isWeekendRest,
    badge,
  };
};

const getCnDayMarkByKey = (dateKey: string): CnDayMark => {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) {
    return {
      solarTerm: '',
      holidayName: '',
      isHolidayOff: false,
      isHolidayWork: false,
      isWeekendRest: false,
      badge: '',
    };
  }
  return getCnDayMark(y, m - 1, d);
};

export type { CnDayMark };
export { getCnDayMark, getCnDayMarkByKey, shortenHolidayName };
