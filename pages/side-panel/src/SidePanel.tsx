import '@src/SidePanel.css';
import { AppRevealOverlay, BrowserAppPage, BrowserFrame, ConfirmProvider, SheetFrame } from './components';
import AdoptionPanel from './features/adopt';
import FilesHubPanel from './features/files-hub';
import HomeLauncher, { desktopRegistry } from './features/home';
import OrganizePanel from './features/organize';
import PetChatPanel from './features/pet-chat';
import ProgressCalendarPanel from './features/progress-calendar';
import StudyPanel from './features/study';
import { PhoneChrome, PhoneChromeLayout } from './layouts';
import { bootstrapInitialEntry, clearViewQuery, isFilesPath, PATHS, pathFromLegacyView } from './lib/routes';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import {
  exampleThemeStorage,
  organizeIntentStorage,
  normalizeUserProfile,
  sidePanelIntentStorage,
  userProfileStorage,
} from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { DesktopAppId, HomeAppTone } from './features/home';
import type { MouseEvent } from 'react';

type GatePhase = 'adopt' | 'app';

type FloatingOverlay =
  | {
      kind: 'browser';
      appId: DesktopAppId;
      title: string;
      url: string;
      x: number;
      y: number;
    }
  | {
      kind: 'sheet';
      appId: DesktopAppId;
      title: string;
      x: number;
      y: number;
    };

const resolveGatePhase = (petAdopted: boolean): GatePhase => (petAdopted ? 'app' : 'adopt');

/** /files/* 由 keepalive 渲染，路由节点仅占位 */
const FilesRouteSlot = () => null;

const SidePanel = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const profile = normalizeUserProfile(useStorage(userProfileStorage));
  const panelIntent = useStorage(sidePanelIntentStorage);
  const organizeIntent = useStorage(organizeIntentStorage);
  const navigate = useNavigate();
  const location = useLocation();
  const onFiles = isFilesPath(location.pathname);

  const [filesHubAlive, setFilesHubAlive] = useState(() => isFilesPath(bootstrapInitialEntry()));
  const lastPanelIntentAtRef = useRef(0);
  const [floating, setFloating] = useState<FloatingOverlay | null>(null);
  const [reveal, setReveal] = useState<{
    x: number;
    y: number;
    tone: HomeAppTone;
    fill?: string;
    pendingPath: string;
  } | null>(null);
  const [gatePhase, setGatePhase] = useState<GatePhase>(() => resolveGatePhase(profile.petAdopted));

  useEffect(() => {
    setGatePhase(resolveGatePhase(profile.petAdopted));
  }, [profile.petAdopted]);

  useEffect(() => {
    if (onFiles) {
      setFilesHubAlive(true);
    }
  }, [onFiles]);

  /** 外部入口（宠物 / popup 等）→ navigate */
  useEffect(() => {
    if (!panelIntent?.at || panelIntent.at <= lastPanelIntentAtRef.current) {
      return;
    }
    if (Date.now() - panelIntent.at > 60_000) {
      void sidePanelIntentStorage.set(null);
      return;
    }
    lastPanelIntentAtRef.current = panelIntent.at;

    const path = pathFromLegacyView(panelIntent.view);
    if (isFilesPath(path)) {
      setFilesHubAlive(true);
    }
    setReveal(null);
    setFloating(null);
    navigate(path, { replace: true });
    void sidePanelIntentStorage.set(null);
  }, [panelIntent, navigate]);

  const goHome = useCallback(() => {
    clearViewQuery();
    setReveal(null);
    setFloating(null);
    navigate(PATHS.home);
  }, [navigate]);

  const openOrganize = useCallback(
    (payload: { dateKey: string; siteKeys: string[] }) => {
      void organizeIntentStorage.set({
        dateKey: payload.dateKey,
        siteKeys: payload.siteKeys,
        at: Date.now(),
      });
      setFilesHubAlive(true);
      setReveal(null);
      setFloating(null);
      navigate(PATHS.organize);
    },
    [navigate],
  );

  const backFromOrganize = useCallback(() => {
    void organizeIntentStorage.set(null);
    clearViewQuery();
    navigate(PATHS.filesTab('focus'));
  }, [navigate]);

  const closeFloating = useCallback(() => {
    setFloating(null);
  }, []);

  const onRevealCovered = useCallback(() => {
    setReveal(current => {
      if (current?.pendingPath) {
        if (isFilesPath(current.pendingPath)) {
          setFilesHubAlive(true);
        }
        navigate(current.pendingPath);
      }
      return current;
    });
  }, [navigate]);

  const onRevealDone = useCallback(() => {
    setReveal(null);
  }, []);

  const openApp = useCallback((id: DesktopAppId, event?: MouseEvent<HTMLButtonElement>) => {
    const intent = desktopRegistry.openApp(id);
    if (!intent) {
      return;
    }

    const rect = event?.currentTarget.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

    switch (intent.kind) {
      case 'external':
        void chrome.runtime.openOptionsPage();
        return;
      case 'browser':
        setFloating({
          kind: 'browser',
          appId: intent.appId,
          title: intent.title,
          url: intent.url,
          x,
          y,
        });
        return;
      case 'sheet':
        setFloating({
          kind: 'sheet',
          appId: intent.appId,
          title: intent.title,
          x,
          y,
        });
        return;
      case 'reveal':
        setFloating(null);
        if (intent.keepFilesAlive) {
          setFilesHubAlive(true);
        }
        setReveal({
          x,
          y,
          tone: intent.tone,
          fill: intent.fill,
          pendingPath: intent.path,
        });
        return;
      default:
        return;
    }
  }, []);

  const filesSlot =
    filesHubAlive || onFiles ? (
      <div className={cn('files-hub-keepalive', !onFiles && 'files-hub-keepalive--hidden')} aria-hidden={!onFiles}>
        <FilesHubPanel isLight={isLight} onBack={goHome} onOrganizeRequest={openOrganize} />
      </div>
    ) : null;

  const revealLayer = (
    <AppRevealOverlay
      active={Boolean(reveal)}
      originX={reveal?.x ?? 0}
      originY={reveal?.y ?? 0}
      tone={reveal?.tone ?? 'rose'}
      fill={reveal?.fill}
      onCovered={onRevealCovered}
      onDone={onRevealDone}
    />
  );

  const floatingLayer =
    floating?.kind === 'browser' ? (
      <BrowserFrame
        open
        title={floating.title}
        url={floating.url}
        originX={floating.x}
        originY={floating.y}
        isLight={isLight}
        onClose={closeFloating}>
        <BrowserAppPage appId={floating.appId} url={floating.url} />
      </BrowserFrame>
    ) : floating?.kind === 'sheet' ? (
      <SheetFrame
        open
        title={floating.title}
        originX={floating.x}
        originY={floating.y}
        isLight={isLight}
        onClose={closeFloating}>
        <BrowserAppPage appId={floating.appId} />
      </SheetFrame>
    ) : null;

  if (gatePhase === 'adopt') {
    return (
      <ConfirmProvider isLight={isLight}>
        <PhoneChrome isLight={isLight} forceHome>
          <HomeLauncher
            isLight={isLight}
            onOpenApp={() => {
              /* 认养完成前停留在浏览器弹窗 */
            }}
          />
        </PhoneChrome>
        <BrowserFrame
          open
          title="认养伙伴"
          url="https://study.mind/adopt"
          dismissible={false}
          isLight={isLight}
          className="browser-frame--adopt">
          <AdoptionPanel profile={profile} isLight={isLight} embedded onAdopted={() => setGatePhase('app')} />
        </BrowserFrame>
      </ConfirmProvider>
    );
  }

  return (
    <ConfirmProvider isLight={isLight}>
      <Routes>
        <Route element={<PhoneChromeLayout isLight={isLight} onBack={goHome} filesSlot={filesSlot} />}>
          <Route path={PATHS.home} element={<HomeLauncher isLight={isLight} onOpenApp={openApp} />} />
          <Route path={PATHS.files} element={<Navigate to={PATHS.filesTab('focus')} replace />} />
          <Route path={`${PATHS.files}/:tab`} element={<FilesRouteSlot />} />
          <Route
            path={PATHS.messages}
            handle={{ title: '短信' }}
            element={<PetChatPanel isLight={isLight} onBack={goHome} />}
          />
          <Route
            path={PATHS.calendar}
            handle={{ title: '日历' }}
            element={<ProgressCalendarPanel isLight={isLight} onBack={goHome} />}
          />
          <Route
            path={PATHS.organize}
            handle={{ title: '开始整理' }}
            element={
              <OrganizePanel
                isLight={isLight}
                dateKey={organizeIntent?.dateKey ?? ''}
                siteKeys={organizeIntent?.siteKeys ?? []}
                onBack={backFromOrganize}
                onSentToMessages={() => {
                  void organizeIntentStorage.set(null);
                  clearViewQuery();
                  navigate(PATHS.messages);
                }}
              />
            }
          />
          <Route
            path={PATHS.study}
            handle={{ title: '学习' }}
            element={<StudyPanel isLight={isLight} onBack={goHome} />}
          />
          <Route path="*" element={<Navigate to={PATHS.home} replace />} />
        </Route>
      </Routes>

      {floatingLayer}
      {revealLayer}
    </ConfirmProvider>
  );
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);
