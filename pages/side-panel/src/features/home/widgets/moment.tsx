import type { DesktopRenderContext, DesktopWidgetDefinition } from '../desktop/types';
import type { ReactNode } from 'react';

const formatClock = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

const renderMomentWidget = (ctx: DesktopRenderContext): ReactNode => (
  <button
    type="button"
    className="phone-widget phone-widget--moment"
    aria-label={`打开日历，${ctx.year}年 ${ctx.weekday} ${formatClock(ctx.now)}，农历${ctx.lunarLabel}`}
    onClick={event => ctx.openApp('calendar', event)}>
    <div className="phone-widget__meta">
      <p className="phone-widget__eyebrow">农历{ctx.lunarLabel}</p>
      <p className="phone-widget__year">{ctx.year}年</p>
    </div>
    <p className="phone-widget__clock">{formatClock(ctx.now)}</p>
    <p className="phone-widget__sub">{ctx.solarLabel}</p>
  </button>
);

const momentWidget: DesktopWidgetDefinition = {
  id: 'moment',
  order: 10,
  uninstallable: false,
  render: renderMomentWidget,
};

export { momentWidget, renderMomentWidget };
