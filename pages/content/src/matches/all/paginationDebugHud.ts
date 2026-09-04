import type { PaginationEvent } from './paginationDetector';

const HUD_ID = 'sm-pagination-debug-hud';

const ensureHud = () => {
  let el = document.getElementById(HUD_ID);
  if (el) {
    return el;
  }

  el = document.createElement('div');
  el.id = HUD_ID;
  el.setAttribute('data-sm-pagination-debug', '1');
  Object.assign(el.style, {
    position: 'fixed',
    right: '12px',
    bottom: '12px',
    zIndex: '2147483646',
    width: '320px',
    maxHeight: '42vh',
    overflow: 'auto',
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'rgba(20, 16, 12, 0.92)',
    color: '#fff8ef',
    font: '12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace',
    boxShadow: '0 8px 24px rgba(0,0,0,.35)',
    pointerEvents: 'auto',
  });

  const title = document.createElement('div');
  title.textContent = 'Study Mind · 分页判定调试';
  Object.assign(title.style, { fontWeight: '700', marginBottom: '6px', color: '#fdba74' });

  const status = document.createElement('div');
  status.id = `${HUD_ID}-status`;
  status.textContent = '监听中… 翻页后这里会跳出事件';
  Object.assign(status.style, { opacity: '0.85', marginBottom: '8px' });

  const list = document.createElement('div');
  list.id = `${HUD_ID}-list`;

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '关闭';
  Object.assign(close.style, {
    position: 'absolute',
    top: '8px',
    right: '8px',
    border: '0',
    borderRadius: '4px',
    padding: '2px 6px',
    background: 'rgba(255,255,255,.12)',
    color: '#fff8ef',
    cursor: 'pointer',
    fontSize: '11px',
  });
  close.addEventListener('click', () => el?.remove());

  el.append(title, status, list, close);
  document.documentElement.appendChild(el);
  return el;
};

const triggerLabel = (trigger: PaginationEvent['trigger']) => {
  if (trigger === 'route') {
    return '路由变化';
  }
  if (trigger === 'pager-click') {
    return '疑似分页点击';
  }
  return '内容变化';
};

const pushPaginationDebugEvent = (event: PaginationEvent) => {
  ensureHud();
  const status = document.getElementById(`${HUD_ID}-status`);
  const list = document.getElementById(`${HUD_ID}-list`);
  if (!status || !list) {
    return;
  }

  const time = new Date(event.at).toLocaleTimeString();
  status.textContent = `最近：${time} · ${triggerLabel(event.trigger)} · 相似度 ${event.similarity}`;

  const item = document.createElement('div');
  Object.assign(item.style, {
    borderTop: '1px solid rgba(255,255,255,.12)',
    paddingTop: '6px',
    marginTop: '6px',
  });
  item.innerHTML = [
    `<div><b>${triggerLabel(event.trigger)}</b> · ${time}</div>`,
    `<div style="opacity:.8;word-break:break-all">${event.url}</div>`,
    `<div style="opacity:.75">sim=${event.similarity} fp=${event.fingerprint}</div>`,
    `<div style="opacity:.7">${event.note}</div>`,
  ].join('');

  list.prepend(item);
  while (list.childElementCount > 12) {
    list.lastElementChild?.remove();
  }
};

const removeHud = () => {
  document.getElementById(HUD_ID)?.remove();
};

export { ensureHud, removeHud, pushPaginationDebugEvent };
