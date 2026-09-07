import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type PhoneStatusBarProps = {
  className?: string;
  /** 左侧操作（如返回），与时间 / 电量同一行 */
  leading?: ReactNode;
  /** 时间靠左（短信等）；默认时间跟电量在右侧 */
  clockLeft?: boolean;
};

type BatteryInfo = {
  level: number;
  charging: boolean;
};

type BatteryLike = {
  level: number;
  charging: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

const formatClock = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

const PhoneStatusBar = ({ className, leading, clockLeft = false }: PhoneStatusBarProps) => {
  const [now, setNow] = useState(() => new Date());
  const [battery, setBattery] = useState<BatteryInfo>({ level: 1, charging: false });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let batteryRef: BatteryLike | null = null;
    let onLevelChange: (() => void) | null = null;
    let onChargingChange: (() => void) | null = null;

    const getBattery = (navigator as Navigator & { getBattery?: () => Promise<BatteryLike> }).getBattery;
    if (typeof getBattery !== 'function') {
      return;
    }

    void getBattery.call(navigator).then(manager => {
      if (cancelled) {
        return;
      }
      batteryRef = manager;
      const sync = () => {
        if (cancelled) {
          return;
        }
        setBattery({
          level: Math.max(0, Math.min(1, manager.level)),
          charging: manager.charging,
        });
      };
      onLevelChange = sync;
      onChargingChange = sync;
      sync();
      manager.addEventListener('levelchange', sync);
      manager.addEventListener('chargingchange', sync);
    });

    return () => {
      cancelled = true;
      if (batteryRef && onLevelChange && onChargingChange) {
        batteryRef.removeEventListener('levelchange', onLevelChange);
        batteryRef.removeEventListener('chargingchange', onChargingChange);
      }
    };
  }, []);

  const percent = Math.round(battery.level * 100);
  const batteryBlock = (
    <>
      <span
        className={battery.charging ? 'phone-status__battery phone-status__battery--charging' : 'phone-status__battery'}
        title={battery.charging ? `充电中 ${percent}%` : `电量 ${percent}%`}>
        <span className="phone-status__battery-level" style={{ width: `${Math.max(8, percent)}%` }} />
        <span className="phone-status__battery-cap" />
      </span>
      <span className="phone-status__percent">{percent}%</span>
    </>
  );

  return (
    <header
      className={['phone-status', clockLeft ? 'phone-status--clock-left' : '', className ?? '']
        .filter(Boolean)
        .join(' ')}>
      {clockLeft ? (
        <>
          <div className="phone-status__left" aria-hidden="true">
            <span className="phone-status__time">{formatClock(now)}</span>
          </div>
          <div className="phone-status__right" aria-hidden="true">
            {batteryBlock}
          </div>
        </>
      ) : (
        <>
          <div className="phone-status__left">
            {leading ? <div className="phone-status__leading">{leading}</div> : null}
          </div>
          <div className="phone-status__right" aria-hidden="true">
            <span className="phone-status__time">{formatClock(now)}</span>
            {batteryBlock}
          </div>
        </>
      )}
    </header>
  );
};

export default PhoneStatusBar;
