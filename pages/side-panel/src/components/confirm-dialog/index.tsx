import { cn } from '@extension/ui';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';

type ConfirmTone = 'danger' | 'default';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

type ConfirmRequest = {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

type ConfirmProviderProps = {
  isLight: boolean;
  children: ReactNode;
};

const ConfirmProvider = ({ isLight, children }: ConfirmProviderProps) => {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const pendingRef = useRef<ConfirmRequest | null>(null);
  const openedAtRef = useRef(0);
  const closingRef = useRef(false);

  const finish = useCallback((value: boolean, event?: SyntheticEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (closingRef.current) {
      return;
    }
    const pending = pendingRef.current;
    if (!pending) {
      return;
    }
    closingRef.current = true;
    pendingRef.current = null;
    // 先同步 resolve，再关弹层，避免点击穿透把结果冲成 false
    pending.resolve(value);
    setRequest(null);
    window.setTimeout(() => {
      closingRef.current = false;
    }, 320);
  }, []);

  const confirm = useCallback<ConfirmFn>(options => {
    if (pendingRef.current) {
      pendingRef.current.resolve(false);
      pendingRef.current = null;
    }
    closingRef.current = false;
    openedAtRef.current = Date.now();
    return new Promise<boolean>(resolve => {
      const next = { options, resolve };
      pendingRef.current = next;
      setRequest(next);
    });
  }, []);

  const value = useMemo(() => confirm, [confirm]);
  const opts = request?.options;
  const tone = opts?.tone ?? 'danger';

  const onBackdropClick = (event: SyntheticEvent) => {
    if (Date.now() - openedAtRef.current < 300) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    finish(false, event);
  };

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {request && opts ? (
        <div className={cn('confirm-layer', !isLight && 'confirm-layer--dark')} role="presentation">
          <button type="button" className="confirm-layer__backdrop" aria-label="关闭" onClick={onBackdropClick} />
          <div
            className="confirm-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby={opts.message ? 'confirm-dialog-desc' : undefined}>
            <h2 id="confirm-dialog-title" className="confirm-card__title">
              {opts.title}
            </h2>
            {opts.message ? (
              <p id="confirm-dialog-desc" className="confirm-card__message">
                {opts.message}
              </p>
            ) : null}
            <div className="confirm-card__actions">
              <button
                type="button"
                className="confirm-card__btn confirm-card__btn--cancel"
                onClick={event => finish(false, event)}>
                {opts.cancelLabel ?? '取消'}
              </button>
              <button
                type="button"
                className={cn(
                  'confirm-card__btn',
                  'confirm-card__btn--confirm',
                  tone === 'danger' && 'confirm-card__btn--danger',
                )}
                onClick={event => finish(true, event)}>
                {opts.confirmLabel ?? (tone === 'danger' ? '删除' : '确定')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
};

const useConfirm = (): ConfirmFn => {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error('useConfirm 必须在 ConfirmProvider 内使用');
  }
  return confirm;
};

export { ConfirmProvider, useConfirm };
export type { ConfirmOptions, ConfirmTone, ConfirmFn };
