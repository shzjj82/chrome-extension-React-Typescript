import { ORGANIZE_EXTENSION_KINDS, ORGANIZE_NOTE_KIND } from './organize-note';
import { depthLabel, goalLabel } from './profile';
import { parseOrganizeCard } from '../../features/organize/organize-card';
import type { ChatTurn } from './memory';
import type { OrganizeCardPayload } from '../../features/organize/organize-card';
import type { UserProfileType } from '@extension/storage';

/** 提高预算：详记笔记需要足够正文，不能只喂标题级摘要 */
const ORGANIZE_CONTEXT_BUDGET = 22_000;
const PER_BROWSE_BUDGET = 4_800;
const PER_FAVORITE_BUDGET = 2_400;

const clip = (text: string, max: number) => {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) {
    return '';
  }
  return t.length <= max ? t : `${t.slice(0, Math.max(0, max - 1))}…`;
};

/**
 * 整理卡 → 模型可读上下文（必须带材料正文，不能只写「N 份文件」）。
 * 在总预算内按条目截断，保证模型能真正写详记笔记。
 */
const buildOrganizeCardContext = (card: OrganizeCardPayload) => {
  const lines: string[] = [
    '【整理材料包】',
    `日期：${card.dayLabel}（${card.dateKey}）`,
    `浏览快照：${card.browse.length} 份；提问收藏：${card.favorites.length} 条`,
    '',
  ];

  let used = lines.join('\n').length;

  if (card.browse.length > 0) {
    lines.push('## 浏览快照');
    used += 10;
    card.browse.forEach((item, index) => {
      if (used >= ORGANIZE_CONTEXT_BUDGET) {
        return;
      }
      const remain = ORGANIZE_CONTEXT_BUDGET - used;
      const bodyBudget = Math.min(PER_BROWSE_BUDGET, Math.max(400, remain - 120));
      const material = clip(item.material || '', bodyBudget);
      const block = [
        `### ${index + 1}. ${clip(item.title || '未命名页面', 80)}`,
        item.url ? `链接：${item.url}` : '',
        item.siteLabel ? `来源：${item.siteLabel}` : '',
        material ? `正文摘录：\n${material}` : '正文摘录：（空）',
        '',
      ]
        .filter(Boolean)
        .join('\n');
      lines.push(block);
      used += block.length;
    });
  }

  if (card.favorites.length > 0 && used < ORGANIZE_CONTEXT_BUDGET) {
    lines.push('## 提问收藏');
    used += 10;
    card.favorites.forEach((item, index) => {
      if (used >= ORGANIZE_CONTEXT_BUDGET) {
        return;
      }
      const remain = ORGANIZE_CONTEXT_BUDGET - used;
      const bodyBudget = Math.min(PER_FAVORITE_BUDGET, Math.max(240, remain - 120));
      const selection = clip(item.text || '', Math.floor(bodyBudget * 0.45));
      const dialogue = (item.messages ?? [])
        .slice(-6)
        .map(msg => `${msg.role === 'user' ? '用户' : '助手'}：${clip(msg.content, 280)}`)
        .join('\n');
      const dialogueClipped = clip(dialogue, Math.floor(bodyBudget * 0.55));
      const block = [
        `### ${index + 1}. ${clip(item.pageTitle || item.siteLabel || '收藏问答', 80)}`,
        item.sourceUrl ? `链接：${item.sourceUrl}` : '',
        selection ? `划选：\n${selection}` : '',
        dialogueClipped ? `对话摘录：\n${dialogueClipped}` : '',
        '',
      ]
        .filter(Boolean)
        .join('\n');
      lines.push(block);
      used += block.length;
    });
  }

  if (used >= ORGANIZE_CONTEXT_BUDGET) {
    lines.push('（部分材料未完整；请基于已给内容尽量写细，不要在输出里解释截断原因。）');
  }

  return lines.join('\n').trim();
};

/** 兼容旧名：发给模型的整理卡文本 */
const organizeCardLlmText = (card: OrganizeCardPayload) => buildOrganizeCardContext(card);

/**
 * 整理通道：LLM 上下文只保留「最近一张整理卡」及其之后的追问/回复。
 */
const sliceOrganizeHistoryToCurrentBatch = (turns: ChatTurn[]): ChatTurn[] => {
  let start = -1;
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (turn?.role === 'user' && parseOrganizeCard(turn.content)) {
      start = i;
      break;
    }
  }
  if (start < 0) {
    return turns.slice(-8);
  }
  return turns.slice(start);
};

/**
 * 整理会话 system prompt：强制输出可渲染的 organize-note JSON。
 */
const buildOrganizeSystemPrompt = (profile: UserProfileType, options?: { memoryBlock?: string }) => {
  const occupation = profile.occupation.trim() || '学习者';
  const goal = goalLabel(profile.goal);
  const depth = depthLabel(profile.depth);
  const memory = options?.memoryBlock?.trim();

  const extensionVolume =
    profile.depth === 'shallow'
      ? '每节至少 1 条 extensions；全文至少 2 条。'
      : profile.depth === 'deep'
        ? '每节通常 2–4 条 extensions；重要概念尽量覆盖多种 kind。'
        : '每节至少 1–2 条 extensions；重要概念优先 contrast + pitfall。';

  return [
    '你是 Study Mind 的学习笔记整理器。根据当前材料产出结构化笔记。',
    '',
    '【输出格式（极重要）】',
    '- 只输出一个 JSON 对象，不要 Markdown 正文包裹，不要 ``` 代码围栏，不要前后解释。',
    `- 根对象必须满足：{ "v": 1, "kind": "${ORGANIZE_NOTE_KIND}", ... }`,
    '- 字段 schema：',
    '  {',
    `    "v": 1,`,
    `    "kind": "${ORGANIZE_NOTE_KIND}",`,
    '    "title": "可选总标题",',
    '    "lead": "可选导读，≤5 句，只谈知识",',
    '    "sections": [',
    '      {',
    '        "title": "主题名",',
    '        "points": ["L1 材料要点", "..."],',
    '        "usage": "可选用法说明，可用少量 Markdown",',
    '        "codeLines": ["代码逐行数组，推荐；避免整段 code 内出现未转义双引号"],',
    '        "code": "可选；若使用必须对内部双引号写成 \\" ，HTML 属性优先用单引号 class=\'static\'",',
    '        "extensions": [',
    '          { "kind": "contrast|pitfall|variant|choose|adjacent", "title": "可选", "body": "必填", "codeLines": ["可选"] }',
    '        ]',
    '      }',
    '    ],',
    '    "concepts": [{ "term": "概念", "summary": "一句话" }],',
    '    "crossExtensions": [{ "kind": "...", "body": "跨节延展" }],',
    '    "memoryFacts": ["后台记忆一句话", "..."]',
    '  }',
    `- extensions.kind 只能是：${ORGANIZE_EXTENSION_KINDS.join(' | ')}`,
    '- sections 至少 1 个；每个重要主题都要有 extensions（禁止整篇零延展）。',
    '- memoryFacts：3–8 条可长期记住的事实；前端不会展示该字段。',
    '- **JSON 合法性**：必须可被 JSON.parse；字符串内换行用 \\n；双引号必须转义或改用 codeLines / HTML 单引号属性。',
    '- 禁止输出 Markdown 围栏或 JSON 以外的文字。',
    '',
    '【一句话目标】',
    '材料事实准 + 主题结构清楚 + 有依据的延展；笔记要比原文更好复习。',
    '',
    '【语气】',
    '- 客观书面；禁止称呼姓名/昵称；禁止寒暄、鼓励、投递建议。',
    '',
    '【上下文边界】',
    '- 只依据当前材料与针对它的追问；更早整理与本次无关。',
    `- 档案仅影响详略：目标「${goal}」、背景「${occupation}」、深度「${depth}」——不要写进 JSON 正文字段当自我介绍。`,
    '',
    '【三层逻辑（写入对应字段）】',
    'L1 → sections[].points（材料定义/API/约束）',
    'L2 → sections[].usage / code（重组后的用法）',
    'L3 → sections[].extensions 与 crossExtensions（延展）',
    `- 延展量级：${extensionVolume}`,
    '',
    '【延展 kind 含义】',
    '- contrast：对照（选项式 vs 组合式、易混 API）',
    '- pitfall：易错/边界',
    '- variant：用法变体/最小可运行',
    '- choose：选型判据',
    '- adjacent：相邻概念（点到为止）',
    '',
    '【延展边界】',
    '- 须与当前材料相关；公开可核对；推断写明「推断」或「常见实践」。',
    '- 不要假装延展出自材料原文。',
    '',
    '【硬禁止】',
    '- 禁止输出 JSON 以外的可见文字。',
    '- 禁止字段或文案出现：自测、期望要点、待补与下一步、可执行动作、材料截断、轮次、重复投递。',
    '- 禁止薄摘要：不可只有 concepts 没有 sections 详记。',
    '',
    memory ? `【零散长期事实（仅供参考；禁止写入可见文案）】\n${memory}` : '',
  ]
    .filter(Boolean)
    .join('\n');
};

/** 自动整理时拼在 system 末尾 */
const ORGANIZE_AUTO_START_HINT = [
  '根据当前材料立刻输出 organize-note JSON（v=1）。',
  '不要 Markdown 全文，不要代码围栏，不要寒暄；sections + extensions 必须充实。',
].join('');

export {
  buildOrganizeCardContext,
  organizeCardLlmText,
  sliceOrganizeHistoryToCurrentBatch,
  buildOrganizeSystemPrompt,
  ORGANIZE_AUTO_START_HINT,
};
