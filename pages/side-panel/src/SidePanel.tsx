import '@src/SidePanel.css';
import AdoptionPanel from './AdoptionPanel';
import { getHomeApp } from './appCatalog';
import AppRevealOverlay from './AppRevealOverlay';
import BackIconButton from './BackIconButton';
import BrowserAppPage from './BrowserAppPage';
import BrowserFrame from './BrowserFrame';
import FilesHubPanel from './FilesHubPanel';
import HomeLauncher from './HomeLauncher';
import { generateLearningContent, parseSubtitleFile } from './lib/learning';
import OrganizePanel from './OrganizePanel';
import PetChatPanel from './PetChatPanel';
import SheetFrame from './SheetFrame';
import { t } from '@extension/i18n';
import {
  createEmptySession,
  deleteSession,
  downloadSessionMarkdown,
  listSessions,
  saveSession,
} from '@extension/knowledge-base';
import {
  ExtensionMessageType,
  sendExtensionMessage,
  useStorage,
  withErrorBoundary,
  withSuspense,
} from '@extension/shared';
import {
  exampleThemeStorage,
  learningDraftStorage,
  llmSettingsStorage,
  organizeIntentStorage,
  pomodoroStateStorage,
  normalizeUserProfile,
  sidePanelIntentStorage,
  userProfileStorage,
} from '@extension/storage';
import { Button, cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HomeAppId, HomeAppTone } from './appCatalog';
import type { FilesHubTab } from './FilesHubPanel';
import type { LearningMode, MaterialSource, PracticeItem, QuizItem, StudySession } from '@extension/knowledge-base';
import type { MouseEvent, ReactNode } from 'react';

type TabKey = 'study' | 'library';
type GatePhase = 'adopt' | 'app';
/** 全页路由（浏览器 / 电话 / 商店走浮层，不占 AppView）；ask/calendar 并入 files Hub；organize 独立标签页 */
type AppView = 'home' | 'files' | 'messages' | 'study' | 'organize';

type FloatingOverlay =
  | {
      kind: 'browser';
      appId: 'browser';
      title: string;
      url: string;
      x: number;
      y: number;
    }
  | {
      kind: 'sheet';
      appId: 'phone' | 'store';
      title: string;
      x: number;
      y: number;
    };

const resolveGatePhase = (petAdopted: boolean): GatePhase => (petAdopted ? 'app' : 'adopt');

const resolveFilesHubTab = (): FilesHubTab => {
  try {
    const view = new URLSearchParams(window.location.search).get('view');
    if (view === 'ask') {
      return 'ask';
    }
    if (view === 'calendar' || view === 'browse') {
      return 'focus';
    }
    return 'focus';
  } catch {
    return 'focus';
  }
};

const resolveAppView = (): AppView => {
  try {
    const view = new URLSearchParams(window.location.search).get('view');
    if (view === 'organize') {
      return 'organize';
    }
    if (view === 'browse' || view === 'ask' || view === 'calendar') {
      return 'files';
    }
    if (view === 'chat') {
      return 'messages';
    }
    if (view === 'study') {
      return 'study';
    }
    return 'home';
  } catch {
    return 'home';
  }
};

const clearViewQuery = () => {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('view')) {
      return;
    }
    url.searchParams.delete('view');
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, '', next);
  } catch {
    // ignore
  }
};

const SidePanel = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const profile = normalizeUserProfile(useStorage(userProfileStorage));
  const draft = useStorage(learningDraftStorage);
  const llm = useStorage(llmSettingsStorage);
  const pomodoro = useStorage(pomodoroStateStorage);
  const panelIntent = useStorage(sidePanelIntentStorage);
  const organizeIntent = useStorage(organizeIntentStorage);
  const panelView = resolveAppView();
  const [appView, setAppView] = useState<AppView>(panelView);
  const [filesHubTab, setFilesHubTab] = useState<FilesHubTab>(() => resolveFilesHubTab());
  /** 文件页首次进入后保活，返回桌面只隐藏，避免提问会话反复重建 */
  const [filesHubAlive, setFilesHubAlive] = useState(() => panelView === 'files');
  const lastPanelIntentAtRef = useRef(0);
  const [floating, setFloating] = useState<FloatingOverlay | null>(null);
  const [reveal, setReveal] = useState<{
    x: number;
    y: number;
    tone: HomeAppTone;
    pendingView: AppView;
  } | null>(null);

  const [tab, setTab] = useState<TabKey>('study');
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [material, setMaterial] = useState('');
  const [materialSource, setMaterialSource] = useState<MaterialSource>('page');
  const [mode, setMode] = useState<LearningMode>('note');
  const [noteContent, setNoteContent] = useState('');
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [practices, setPractices] = useState<PracticeItem[]>([]);
  const [remark, setRemark] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [gatePhase, setGatePhase] = useState<GatePhase>(() => resolveGatePhase(profile.petAdopted));

  useEffect(() => {
    setGatePhase(resolveGatePhase(profile.petAdopted));
  }, [profile.petAdopted]);

  useEffect(() => {
    setTitle(draft.title);
    setSourceUrl(draft.sourceUrl);
    setMaterial(draft.material);
    setMaterialSource(draft.materialSource);
    setMode(draft.mode);
    if (draft.sessionId) {
      setCurrentId(draft.sessionId);
    }
    // 仅在草稿时间戳变化时回填（提取/导入等外部更新），避免输入过程中写 storage 回灌打断 IME
  }, [draft.updatedAt, draft.sessionId]);

  const refreshSessions = async () => {
    const list = await listSessions();
    setSessions(list);
  };

  useEffect(() => {
    if (appView !== 'study') {
      return;
    }
    void refreshSessions();
  }, [appView]);

  /** 文件页内容只挂在 keepalive 上；若 alive 未置位会整页空白 */
  useEffect(() => {
    if (appView === 'files') {
      setFilesHubAlive(true);
    }
  }, [appView]);

  /** 外部入口（整理 / 提问等）：保活时也要切到对应 Tab */
  useEffect(() => {
    if (!panelIntent?.at || panelIntent.at <= lastPanelIntentAtRef.current) {
      return;
    }
    if (Date.now() - panelIntent.at > 60_000) {
      void sidePanelIntentStorage.set(null);
      return;
    }
    lastPanelIntentAtRef.current = panelIntent.at;

    if (panelIntent.view === 'ask') {
      setFilesHubTab('ask');
      setFilesHubAlive(true);
      setReveal(null);
      setFloating(null);
      setAppView('files');
    } else if (panelIntent.view === 'browse' || panelIntent.view === 'calendar') {
      setFilesHubTab('focus');
      setFilesHubAlive(true);
      setReveal(null);
      setFloating(null);
      setAppView('files');
    } else if (panelIntent.view === 'chat') {
      setReveal(null);
      setFloating(null);
      setAppView('messages');
    } else if (panelIntent.view === 'study') {
      setReveal(null);
      setFloating(null);
      setAppView('study');
    }

    void sidePanelIntentStorage.set(null);
  }, [panelIntent]);

  const goHome = useCallback(() => {
    clearViewQuery();
    setReveal(null);
    setFloating(null);
    setAppView('home');
  }, []);

  const closeFloating = useCallback(() => {
    setFloating(null);
  }, []);

  const onRevealCovered = useCallback(() => {
    setReveal(current => {
      if (current?.pendingView) {
        if (current.pendingView === 'files') {
          setFilesHubAlive(true);
        }
        setAppView(current.pendingView);
      }
      return current;
    });
  }, []);

  const onRevealDone = useCallback(() => {
    setReveal(null);
  }, []);

  const openApp = (id: HomeAppId, event?: MouseEvent<HTMLButtonElement>) => {
    const app = getHomeApp(id);
    if (!app) {
      return;
    }

    const rect = event?.currentTarget.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

    if (app.openMode === 'external') {
      void chrome.runtime.openOptionsPage();
      return;
    }

    if (app.openMode === 'browser' && id === 'browser') {
      setFloating({
        kind: 'browser',
        appId: 'browser',
        title: app.label,
        url: app.url || '',
        x,
        y,
      });
      return;
    }

    if (app.openMode === 'sheet' && (id === 'phone' || id === 'store')) {
      setFloating({
        kind: 'sheet',
        appId: id,
        title: app.label,
        x,
        y,
      });
      return;
    }

    // page：色圆放大入场（原日历页已并入文件 Hub）
    if (id === 'files') {
      setFloating(null);
      setFilesHubTab('focus');
      setFilesHubAlive(true);
      setReveal({
        x,
        y,
        tone: app.tone,
        pendingView: 'files',
      });
      return;
    }

    if (id === 'messages' || id === 'study') {
      setFloating(null);
      setReveal({
        x,
        y,
        tone: app.tone,
        pendingView: id,
      });
    }
  };

  const pomodoroMinutes = useMemo(
    () => Math.round(pomodoro.accumulatedFocusMs / 60_000) + (pomodoro.phase === 'focus' ? 0 : 0),
    [pomodoro.accumulatedFocusMs, pomodoro.phase],
  );

  const syncDraft = async (next: Partial<typeof draft>) => {
    await learningDraftStorage.set(prev => ({
      ...prev,
      ...next,
      updatedAt: Date.now(),
    }));
  };

  const loadSession = (session: StudySession) => {
    setCurrentId(session.id);
    setTitle(session.title);
    setSourceUrl(session.sourceUrl);
    setMaterial(session.material);
    setMaterialSource(session.materialSource);
    setMode(session.mode);
    setNoteContent(session.noteContent);
    setQuizzes(session.quizzes);
    setPractices(session.practices);
    setRemark(session.remark);
    setTab('study');
  };

  const persistSession = async (overrides?: Partial<StudySession>) => {
    const session = createEmptySession({
      id: currentId ?? undefined,
      title: title || '未命名学习记录',
      sourceUrl,
      material,
      materialSource,
      mode,
      noteContent,
      quizzes,
      practices,
      remark,
      pomodoroMinutes: Math.max(pomodoroMinutes, Math.round(pomodoro.accumulatedFocusMs / 60_000)),
      pomodoroCount: pomodoro.focusCompletedCount,
      ...overrides,
    });

    const saved = await saveSession(session);
    setCurrentId(saved.id);
    await syncDraft({
      sessionId: saved.id,
      title: saved.title,
      sourceUrl: saved.sourceUrl,
      material: saved.material,
      materialSource: saved.materialSource,
      mode: saved.mode,
    });
    await refreshSessions();
    return saved;
  };

  const extractPage = async () => {
    setError('');
    setStatus('正在提取网页正文...');
    const result = await sendExtensionMessage(ExtensionMessageType.EXTRACT_PAGE_CONTENT);
    if (!result.ok) {
      setError(result.error);
      setStatus('');
      return;
    }
    setTitle(result.data.title);
    setSourceUrl(result.data.sourceUrl);
    setMaterial(result.data.material);
    setMaterialSource(result.data.materialSource);
    await syncDraft({
      title: result.data.title,
      sourceUrl: result.data.sourceUrl,
      material: result.data.material,
      materialSource: result.data.materialSource,
    });
    setStatus('网页正文已导入');
  };

  const extractVisibleCaptions = async () => {
    setError('');
    setStatus('正在采集可见字幕...');
    const result = await sendExtensionMessage(ExtensionMessageType.EXTRACT_VISIBLE_CAPTIONS);
    if (!result.ok) {
      setError(result.error);
      setStatus('');
      return;
    }
    setTitle(result.data.title);
    setSourceUrl(result.data.sourceUrl);
    setMaterial(result.data.material);
    setMaterialSource('visible_caption');
    await syncDraft({
      title: result.data.title,
      sourceUrl: result.data.sourceUrl,
      material: result.data.material,
      materialSource: 'visible_caption',
    });
    setStatus('可见字幕已导入');
  };

  const onSubtitleFile = async (file: File | null) => {
    if (!file) {
      return;
    }
    const text = await file.text();
    const parsed = parseSubtitleFile(file.name, text);
    setMaterial(parsed);
    setMaterialSource('subtitle_file');
    setTitle(prev => prev || file.name);
    await syncDraft({
      material: parsed,
      materialSource: 'subtitle_file',
      title: title || file.name,
    });
    setStatus('字幕文件已解析');
  };

  const runGenerate = async () => {
    if (!material.trim()) {
      setError('请先导入或粘贴学习素材');
      return;
    }

    setLoading(true);
    setError('');
    setStatus('AI 生成中...');

    try {
      const generated = await generateLearningContent({
        settings: llm,
        profile,
        mode,
        material,
      });
      setNoteContent(generated.noteContent);
      setQuizzes(generated.quizzes);
      setPractices(generated.practices);
      await persistSession({
        noteContent: generated.noteContent,
        quizzes: generated.quizzes,
        practices: generated.practices,
      });
      setStatus('生成完成，已写入本地知识库');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  if (appView === 'organize') {
    const dateKey = organizeIntent?.dateKey ?? '';
    const siteKeys = organizeIntent?.siteKeys ?? [];
    return (
      <div className={cn('organize-page-root', !isLight && 'sm-shell--dark')}>
        <OrganizePanel
          isLight={isLight}
          pageMode
          dateKey={dateKey}
          siteKeys={siteKeys}
          onBack={() => {
            void organizeIntentStorage.set(null);
            window.close();
          }}
        />
      </div>
    );
  }

  if (gatePhase === 'adopt') {
    return (
      <>
        <HomeLauncher
          isLight={isLight}
          onOpenApp={() => {
            /* 认养完成前停留在浏览器弹窗 */
          }}
        />
        <BrowserFrame
          open
          title="认养伙伴"
          url="https://study.mind/adopt"
          dismissible={false}
          isLight={isLight}
          className="browser-frame--adopt">
          <AdoptionPanel profile={profile} isLight={isLight} embedded onAdopted={() => setGatePhase('app')} />
        </BrowserFrame>
      </>
    );
  }

  const revealLayer = (
    <AppRevealOverlay
      active={Boolean(reveal)}
      originX={reveal?.x ?? 0}
      originY={reveal?.y ?? 0}
      tone={reveal?.tone ?? 'rose'}
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

  let appContent: ReactNode = null;

  if (appView === 'home') {
    appContent = <HomeLauncher isLight={isLight} onOpenApp={openApp} />;
  } else if (appView === 'files') {
    appContent = null;
  } else if (appView === 'messages') {
    appContent = <PetChatPanel isLight={isLight} onBack={goHome} />;
  } else {
    appContent = (
      <div className={cn('side-panel sm-shell', !isLight && 'sm-shell--dark')}>
        <header className="sm-shell__header">
          <div className="flex items-center justify-between gap-2">
            <div className="sm-shell__heading">
              <BackIconButton onClick={goHome} />
              <h1 className="sm-shell__brand">学习</h1>
            </div>
            <Button size="sm" variant="outline" onClick={() => chrome.runtime.openOptionsPage()}>
              {t('openOptions')}
            </Button>
          </div>
          <div className="sm-shell__tabs">
            <button
              type="button"
              className={cn('sm-shell__chip', tab === 'study' && 'sm-shell__chip--active')}
              onClick={() => setTab('study')}>
              陪伴学习
            </button>
            <button
              type="button"
              className={cn('sm-shell__chip', tab === 'library' && 'sm-shell__chip--active')}
              onClick={() => setTab('library')}>
              知识库
            </button>
          </div>
        </header>

        {tab === 'study' ? (
          <main className="sm-shell__main">
            <section className="sm-shell__card">
              <h2 className="sm-shell__card-title">当前内容</h2>
              <div className="sm-shell__actions">
                <Button size="sm" variant="secondary" onClick={() => void extractPage()}>
                  网页正文
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void extractVisibleCaptions()}>
                  可见字幕
                </Button>
                <label className="sm-shell__file">
                  导入 SRT/VTT
                  <input
                    type="file"
                    accept=".srt,.vtt,text/vtt,application/x-subrip"
                    className="hidden"
                    onChange={event => void onSubtitleFile(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <input
                value={title}
                onChange={event => setTitle(event.target.value)}
                onBlur={() => void syncDraft({ title })}
                placeholder="标题"
              />
              <textarea
                className="min-h-32"
                value={material}
                onChange={event => {
                  setMaterial(event.target.value);
                  setMaterialSource('paste');
                }}
                onBlur={() => void syncDraft({ material, materialSource: 'paste' })}
                placeholder="粘贴内容，或通过上方按钮导入"
              />
              <p className="sm-shell__muted">当前来源：{materialSource}</p>
            </section>

            <section className="sm-shell__card">
              <h2 className="sm-shell__card-title">整理方式</h2>
              <div className="sm-shell__actions">
                {(
                  [
                    ['note', t('modeNote')],
                    ['quiz', t('modeQuiz')],
                    ['practice', t('modePractice')],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={cn('sm-shell__chip', mode === value && 'sm-shell__chip--active')}
                    onClick={() => {
                      setMode(value);
                      void syncDraft({ mode: value });
                    }}>
                    {label}
                  </button>
                ))}
              </div>
              <Button className="sm-shell__cta" disabled={loading} onClick={() => void runGenerate()}>
                {loading ? '生成中...' : '让伙伴帮你整理'}
              </Button>
              {status ? <p className="text-xs text-emerald-700">{status}</p> : null}
              {error ? <p className="text-xs text-red-700">{error}</p> : null}
            </section>

            {mode === 'note' || noteContent ? (
              <section className="sm-shell__card">
                <h2 className="sm-shell__card-title">笔记</h2>
                <textarea
                  className="min-h-40"
                  value={noteContent}
                  onChange={event => setNoteContent(event.target.value)}
                />
              </section>
            ) : null}

            {quizzes.length > 0 ? (
              <section className="sm-shell__card">
                <h2 className="sm-shell__card-title">测验（自行校验）</h2>
                {quizzes.map((quiz, index) => (
                  <div key={quiz.id} className="sm-shell__item">
                    <p className="text-sm font-semibold">
                      [{quiz.kind === 'basic' ? '基础' : '拓展'}] {quiz.question}
                    </p>
                    <p className="sm-shell__muted">参考思路：{quiz.answer || '无'}</p>
                    <textarea
                      className="min-h-16"
                      placeholder="写下你的作答"
                      value={quiz.userAnswer}
                      onChange={event => {
                        const value = event.target.value;
                        setQuizzes(prev =>
                          prev.map((item, itemIndex) => (itemIndex === index ? { ...item, userAnswer: value } : item)),
                        );
                      }}
                    />
                  </div>
                ))}
              </section>
            ) : null}

            {practices.length > 0 ? (
              <section className="sm-shell__card">
                <h2 className="sm-shell__card-title">实践</h2>
                {practices.map((practice, index) => (
                  <div key={practice.id} className="sm-shell__item">
                    <p className="text-sm font-semibold">{practice.task}</p>
                    <textarea
                      className="min-h-20"
                      placeholder="回填实践结果"
                      value={practice.userResult}
                      onChange={event => {
                        const value = event.target.value;
                        setPractices(prev =>
                          prev.map((item, itemIndex) => (itemIndex === index ? { ...item, userResult: value } : item)),
                        );
                      }}
                    />
                  </div>
                ))}
              </section>
            ) : null}

            <section className="sm-shell__card pb-6">
              <label className="block text-sm font-bold">
                备注
                <textarea className="mt-2 min-h-16" value={remark} onChange={event => setRemark(event.target.value)} />
              </label>
              <div className="sm-shell__actions">
                <Button
                  className="sm-shell__cta"
                  onClick={() => {
                    void persistSession().then(() => setStatus('已保存到本地知识库'));
                  }}>
                  保存记录
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    void persistSession().then(session => downloadSessionMarkdown(session));
                  }}>
                  导出 Markdown
                </Button>
              </div>
            </section>
          </main>
        ) : (
          <main className="sm-shell__main">
            <div className="flex items-center justify-between">
              <h2 className="sm-shell__card-title">本地知识库</h2>
              <Button size="sm" variant="secondary" onClick={() => void refreshSessions()}>
                刷新
              </Button>
            </div>
            {sessions.length === 0 ? <p className="sm-shell__muted">暂无记录</p> : null}
            {sessions.map(session => (
              <article key={session.id} className="sm-shell__card">
                <h3 className="font-bold">{session.title}</h3>
                <p className="sm-shell__muted">
                  {new Date(session.updatedAt).toLocaleString()} · {session.mode}
                </p>
                <textarea
                  className="min-h-12 text-xs"
                  defaultValue={session.remark}
                  onBlur={event => {
                    const value = event.target.value;
                    void saveSession({
                      ...session,
                      remark: value,
                    }).then(() => refreshSessions());
                  }}
                  placeholder="编辑备注"
                />
                <div className="sm-shell__actions">
                  <Button size="sm" variant="secondary" onClick={() => loadSession(session)}>
                    打开
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => downloadSessionMarkdown(session)}>
                    导出
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      void deleteSession(session.id).then(() => refreshSessions());
                    }}>
                    删除
                  </Button>
                </div>
              </article>
            ))}
          </main>
        )}
      </div>
    );
  }

  return (
    <>
      {appContent}
      {filesHubAlive || appView === 'files' ? (
        <div
          className={cn('files-hub-keepalive', appView !== 'files' && 'files-hub-keepalive--hidden')}
          aria-hidden={appView !== 'files'}>
          <FilesHubPanel isLight={isLight} onBack={goHome} initialTab={filesHubTab} />
        </div>
      ) : null}
      {floatingLayer}
      {revealLayer}
    </>
  );
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);
