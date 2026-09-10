import { PetChatChannel } from '@extension/knowledge-base';
import { cn, SegmentedSwitch } from '@extension/ui';
import ChatSessionPanel from '@src/features/pet-chat/chat-session-panel';
import { useAppHeader } from '@src/layouts';
import { PATHS, isStudyPath, isStudyTab, studyTabFromPath } from '@src/lib/routes';
import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { StudyTab } from '@src/lib/routes';

type StudyPanelProps = {
  isLight: boolean;
  onBack?: () => void;
};

type StudyLocationState = {
  threadId?: string;
};

const TAB_TITLE: Record<StudyTab, string> = {
  organize: '整理',
  exam: '考试',
  review: '复习',
};

const StudyPlaceholder = ({ title, hint }: { title: string; hint: string }) => (
  <div className="study-hub__placeholder">
    <p className="study-hub__placeholder-title">{title}</p>
    <p className="study-hub__placeholder-hint">{hint}</p>
  </div>
);

const StudyPanel = ({ isLight, onBack }: StudyPanelProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const tab = studyTabFromPath(location.pathname);
  const organizeThreadId =
    searchParams.get('threadId') || ((location.state as StudyLocationState | null)?.threadId ?? null);

  useEffect(() => {
    document.title = '学习';
  }, []);

  useEffect(() => {
    if (location.pathname === PATHS.study || location.pathname === `${PATHS.study}/`) {
      navigate(PATHS.studyTab('organize'), { replace: true });
      return;
    }
    const segment = location.pathname.match(/^\/study\/([^/]+)/)?.[1];
    if (segment && !isStudyTab(segment)) {
      navigate(PATHS.studyTab('organize'), { replace: true });
    }
  }, [location.pathname, navigate]);

  const setTab = useCallback(
    (next: StudyTab) => {
      navigate(PATHS.studyTab(next), { replace: true });
    },
    [navigate],
  );

  // 整理会话内由 ChatSessionPanel 托管顶栏（列表 / 会话 / 资料详情）
  useAppHeader(TAB_TITLE[tab], {
    onBack,
    enabled: isStudyPath(location.pathname) && tab !== 'organize',
    syncKey: tab,
  });

  return (
    <div className={cn('sm-shell study-hub', !isLight && 'sm-shell--dark')}>
      <div className="study-hub__shell">
        <div className="study-hub__toolbar study-hub__toolbar--tabs-only">
          <SegmentedSwitch
            className="study-hub__tabs"
            aria-label="学习分区"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'organize', label: '整理' },
              { value: 'exam', label: '考试' },
              { value: 'review', label: '复习' },
            ]}
          />
        </div>

        <div className="study-hub__body">
          <div
            className={cn('study-hub__pane', tab === 'organize' && 'study-hub__pane--active')}
            aria-hidden={tab !== 'organize'}>
            {tab === 'organize' ? (
              <ChatSessionPanel
                isLight={isLight}
                embedded
                channel={PetChatChannel.Organize}
                listTitle="整理"
                allowNewThread={false}
                initialThreadId={organizeThreadId}
                initialThreadNonce={organizeThreadId ? location.key : null}
                onBack={onBack}
              />
            ) : null}
          </div>
          <div
            className={cn('study-hub__pane', tab === 'exam' && 'study-hub__pane--active')}
            aria-hidden={tab !== 'exam'}>
            {tab === 'exam' ? <StudyPlaceholder title="考试" hint="考试功能即将到来，先占个位。" /> : null}
          </div>
          <div
            className={cn('study-hub__pane', tab === 'review' && 'study-hub__pane--active')}
            aria-hidden={tab !== 'review'}>
            {tab === 'review' ? <StudyPlaceholder title="复习" hint="复习功能即将到来，先占个位。" /> : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudyPanel;
export type { StudyTab };
