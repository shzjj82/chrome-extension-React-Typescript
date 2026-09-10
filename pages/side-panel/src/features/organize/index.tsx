import OrganizeEditor from './organize-editor';
import OrganizeReadonly from './organize-readonly';
import type { OrganizeCardPayload } from './organize-card';

type OrganizePayload = {
  dateKey: string;
  siteKeys: string[];
};

type OrganizePanelProps = {
  isLight: boolean;
  onBack: () => void;
  /** 选择模式：从专注页带入 */
  dateKey?: string;
  siteKeys?: string[];
  /** 独立浏览器标签全页（类似设置） */
  pageMode?: boolean;
  /** 发送到短信成功后（侧栏内跳转） */
  onSentToMessages?: () => void;
  /** 整理会话写入成功后回调（带 threadId） */
  onOrganizeSent?: (threadId: string) => void;
  /** 只读查看：短信卡片打开 */
  readOnly?: boolean;
  card?: OrganizeCardPayload | null;
  /** 已由壳层顶栏托管时隐藏本页 status+header */
  hideChrome?: boolean;
};

const OrganizePanel = ({
  isLight,
  dateKey = '',
  siteKeys = [],
  onBack,
  pageMode = false,
  onSentToMessages,
  onOrganizeSent,
  readOnly = false,
  card = null,
  hideChrome = false,
}: OrganizePanelProps) => {
  if (readOnly && card) {
    return (
      <OrganizeReadonly isLight={isLight} onBack={onBack} card={card} pageMode={pageMode} hideChrome={hideChrome} />
    );
  }

  return (
    <OrganizeEditor
      isLight={isLight}
      dateKey={dateKey}
      siteKeys={siteKeys}
      onBack={onBack}
      pageMode={pageMode}
      onSentToMessages={onSentToMessages}
      onOrganizeSent={onOrganizeSent}
      hideChrome={hideChrome}
    />
  );
};

export default OrganizePanel;
export type { OrganizePayload, OrganizePanelProps };
export type {
  OrganizeCardBrowseItem,
  OrganizeCardFavoriteItem,
  OrganizeCardPayload,
  OrganizeCardSiteInput,
} from './organize-card';
export {
  ORGANIZE_CARD_KIND,
  buildOrganizeCardFromSite,
  encodeOrganizeCard,
  organizeCardCountLabel,
  organizeCardPreview,
  parseOrganizeCard,
} from './organize-card';
export { organizeCardLlmText } from '@src/lib/prompts/organize';
