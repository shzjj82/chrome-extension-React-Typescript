import { cn } from '@extension/ui';
import { Globe, Phone, Store } from 'lucide-react';
import type { HomeAppId } from '../../features/home/app-catalog';
import type { LucideIcon } from 'lucide-react';

type BrowserPageProps = {
  appId: Extract<HomeAppId, 'browser' | 'store' | 'phone'>;
  url?: string;
};

const META: Record<BrowserPageProps['appId'], { title: string; hint: string; Icon: LucideIcon; badge?: string }> = {
  browser: {
    title: 'Study Mind 浏览器',
    hint: '学习相关页面会在这里以窗口形式打开。',
    Icon: Globe,
  },
  store: {
    title: 'Study Mind 商店',
    hint: '主题、表情与学习扩展会放在这里。',
    Icon: Store,
    badge: '即将上架',
  },
  phone: {
    title: '电话',
    hint: '稍后可在这里联系学习伙伴。',
    Icon: Phone,
    badge: '即将开通',
  },
};

const BrowserAppPage = ({ appId }: BrowserPageProps) => {
  const meta = META[appId];
  const Icon = meta.Icon;

  return (
    <div className="browser-page">
      <span className={cn('browser-page__icon', `browser-page__icon--${appId}`)} aria-hidden="true">
        <Icon size={28} strokeWidth={2} />
      </span>
      <h2 className="browser-page__title">{meta.title}</h2>
      <p className="browser-page__hint">{meta.hint}</p>
      {meta.badge ? <p className="browser-page__badge">{meta.badge}</p> : null}
    </div>
  );
};

export default BrowserAppPage;
