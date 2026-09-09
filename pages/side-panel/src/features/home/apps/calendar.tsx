import { PATHS } from '../../../lib/routes';
import { CalendarDays } from 'lucide-react';
import type { DesktopAppDefinition, DesktopAppIconProps } from '../desktop/types';
import type { ReactNode } from 'react';

const renderCalendarIcon = ({ day, weekday }: DesktopAppIconProps): ReactNode => (
  <span className="phone-cal-icon" aria-hidden="true">
    <span className="phone-cal-icon__weekday">{weekday}</span>
    <span className="phone-cal-icon__day">{day}</span>
  </span>
);

const calendarApp: DesktopAppDefinition = {
  id: 'calendar',
  label: '日历',
  tone: 'amber',
  order: 20,
  uninstallable: false,
  surface: 'live-date',
  Icon: CalendarDays,
  renderIcon: renderCalendarIcon,
  openMode: 'page',
  enterEffect: 'circle-expand',
  path: PATHS.calendar,
};

export { calendarApp, renderCalendarIcon };
