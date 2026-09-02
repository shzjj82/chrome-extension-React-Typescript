import '@src/SidePanel.css';
import { generateLearningContent, parseSubtitleFile } from './lib/learning';
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
  pomodoroStateStorage,
  userProfileStorage,
} from '@extension/storage';
import { Button, cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useEffect, useMemo, useState } from 'react';
import type { LearningMode, MaterialSource, PracticeItem, QuizItem, StudySession } from '@extension/knowledge-base';

type TabKey = 'study' | 'library';

const formatRemain = (endsAt: number | null) => {
  if (!endsAt) {
    return '--:--';
  }
  const remain = Math.max(0, endsAt - Date.now());
  const minutes = Math.floor(remain / 60_000);
  const seconds = Math.floor((remain % 60_000) / 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const SidePanel = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const profile = useStorage(userProfileStorage);
  const draft = useStorage(learningDraftStorage);
  const llm = useStorage(llmSettingsStorage);
  const pomodoro = useStorage(pomodoroStateStorage);

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
  const [now, setNow] = useState(Date.now());
  const [showOnboarding, setShowOnboarding] = useState(!profile.onboardingCompleted);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setShowOnboarding(!profile.onboardingCompleted);
  }, [profile.onboardingCompleted]);

  useEffect(() => {
    setTitle(draft.title);
    setSourceUrl(draft.sourceUrl);
    setMaterial(draft.material);
    setMaterialSource(draft.materialSource);
    setMode(draft.mode);
    if (draft.sessionId) {
      setCurrentId(draft.sessionId);
    }
  }, [draft]);

  const refreshSessions = async () => {
    const list = await listSessions();
    setSessions(list);
  };

  useEffect(() => {
    void refreshSessions();
  }, []);

  const pomodoroMinutes = useMemo(
    () => Math.round(pomodoro.accumulatedFocusMs / 60_000) + (pomodoro.phase === 'focus' ? 0 : 0),
    [pomodoro.accumulatedFocusMs, pomodoro.phase],
  );

  void now;

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

  return (
    <div className={cn('side-panel', isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100')}>
      <header className="space-y-2 border-b border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base font-semibold">Study Mind AI</h1>
          <Button size="sm" variant="outline" onClick={() => chrome.runtime.openOptionsPage()}>
            {t('openOptions')}
          </Button>
        </div>
        <p className="text-xs leading-5 opacity-80">{t('complianceBanner')}</p>
        <div className="flex gap-2 text-xs">
          <Button size="sm" variant={tab === 'study' ? 'default' : 'secondary'} onClick={() => setTab('study')}>
            学习
          </Button>
          <Button size="sm" variant={tab === 'library' ? 'default' : 'secondary'} onClick={() => setTab('library')}>
            知识库
          </Button>
        </div>
        <div className="rounded-md bg-slate-200/70 px-2 py-1 text-xs dark:bg-slate-800">
          番茄钟：{pomodoro.phase === 'idle' ? '未开始' : pomodoro.phase === 'focus' ? '专注' : '休息'}{' '}
          {formatRemain(pomodoro.endsAt)} · 完成 {pomodoro.focusCompletedCount} 个
          <div className="mt-1 flex gap-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void sendExtensionMessage(ExtensionMessageType.POMODORO_START, { sessionId: currentId })}>
              开始
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void sendExtensionMessage(ExtensionMessageType.POMODORO_PAUSE)}>
              暂停
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void sendExtensionMessage(ExtensionMessageType.POMODORO_STOP)}>
              停止
            </Button>
          </div>
        </div>
      </header>

      {showOnboarding ? (
        <section className="space-y-3 p-3">
          <h2 className="text-sm font-medium">{t('profileTitle')}</h2>
          <p className="text-xs opacity-80">填写后 AI 输出会更贴合你的学习习惯，可随时跳过。</p>
          <input
            className="w-full rounded border px-2 py-1 text-sm"
            placeholder={t('profileOccupation')}
            value={profile.occupation}
            onChange={event => void userProfileStorage.set(prev => ({ ...prev, occupation: event.target.value }))}
          />
          <input
            className="w-full rounded border px-2 py-1 text-sm"
            placeholder={t('profileDomains')}
            value={profile.domains}
            onChange={event => void userProfileStorage.set(prev => ({ ...prev, domains: event.target.value }))}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                void userProfileStorage.set(prev => ({
                  ...prev,
                  onboardingCompleted: true,
                  petAdopted: prev.occupation.trim().length > 0 && prev.domains.trim().length > 0,
                }));
                setShowOnboarding(false);
              }}>
              {t('profileSave')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void userProfileStorage.set(prev => ({ ...prev, onboardingCompleted: true }));
                setShowOnboarding(false);
              }}>
              {t('profileSkip')}
            </Button>
          </div>
        </section>
      ) : null}

      <div className="space-y-2 border-b border-slate-200 p-3 text-xs dark:border-slate-800">
        <p>{t('riskPrivacy')}</p>
        <p>{t('riskCopyright')}</p>
        <p>{t('riskAi')}</p>
      </div>

      {tab === 'study' ? (
        <main className="space-y-3 p-3">
          <section className="space-y-2">
            <h2 className="text-sm font-medium">学习素材</h2>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="secondary" onClick={() => void extractPage()}>
                网页正文
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void extractVisibleCaptions()}>
                可见字幕
              </Button>
              <label className="bg-secondary inline-flex cursor-pointer items-center rounded-md px-3 text-xs">
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
              className="w-full rounded border px-2 py-1 text-sm"
              value={title}
              onChange={event => {
                setTitle(event.target.value);
                void syncDraft({ title: event.target.value });
              }}
              placeholder="标题"
            />
            <textarea
              className="min-h-32 w-full rounded border px-2 py-1 text-sm"
              value={material}
              onChange={event => {
                setMaterial(event.target.value);
                setMaterialSource('paste');
                void syncDraft({ material: event.target.value, materialSource: 'paste' });
              }}
              placeholder="粘贴讲义文本，或通过上方按钮导入素材"
            />
            <p className="text-[11px] opacity-70">当前来源：{materialSource}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium">学习模式</h2>
            <div className="flex gap-1">
              {(
                [
                  ['note', t('modeNote')],
                  ['quiz', t('modeQuiz')],
                  ['practice', t('modePractice')],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={mode === value ? 'default' : 'secondary'}
                  onClick={() => {
                    setMode(value);
                    void syncDraft({ mode: value });
                  }}>
                  {label}
                </Button>
              ))}
            </div>
            <Button disabled={loading} onClick={() => void runGenerate()}>
              {loading ? '生成中...' : 'AI 个性化生成'}
            </Button>
            {status ? <p className="text-xs text-emerald-600">{status}</p> : null}
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </section>

          {mode === 'note' || noteContent ? (
            <section className="space-y-2">
              <h2 className="text-sm font-medium">AI 笔记</h2>
              <textarea
                className="min-h-40 w-full rounded border px-2 py-1 text-sm"
                value={noteContent}
                onChange={event => setNoteContent(event.target.value)}
              />
            </section>
          ) : null}

          {quizzes.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-medium">测验（自行校验，不自动判题）</h2>
              {quizzes.map((quiz, index) => (
                <div key={quiz.id} className="space-y-1 rounded border p-2">
                  <p className="text-sm font-medium">
                    [{quiz.kind === 'basic' ? '基础' : '拓展'}] {quiz.question}
                  </p>
                  <p className="text-xs opacity-70">参考思路：{quiz.answer || '无'}</p>
                  <textarea
                    className="min-h-16 w-full rounded border px-2 py-1 text-sm"
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
            <section className="space-y-3">
              <h2 className="text-sm font-medium">实践任务</h2>
              {practices.map((practice, index) => (
                <div key={practice.id} className="space-y-1 rounded border p-2">
                  <p className="text-sm font-medium">{practice.task}</p>
                  <textarea
                    className="min-h-20 w-full rounded border px-2 py-1 text-sm"
                    placeholder="回填代码或实践结果"
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

          <section className="space-y-2 pb-6">
            <label className="block text-sm">
              备注
              <textarea
                className="mt-1 min-h-16 w-full rounded border px-2 py-1 text-sm"
                value={remark}
                onChange={event => setRemark(event.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
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
        <main className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">本地知识库</h2>
            <Button size="sm" variant="secondary" onClick={() => void refreshSessions()}>
              刷新
            </Button>
          </div>
          {sessions.length === 0 ? <p className="text-xs opacity-70">暂无学习记录</p> : null}
          {sessions.map(session => (
            <article key={session.id} className="space-y-2 rounded border p-2 text-sm">
              <h3 className="font-medium">{session.title}</h3>
              <p className="text-xs opacity-70">
                {new Date(session.updatedAt).toLocaleString()} · {session.mode} · 番茄 {session.pomodoroCount}
              </p>
              <textarea
                className="min-h-12 w-full rounded border px-2 py-1 text-xs"
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
              <div className="flex flex-wrap gap-1">
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
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);
