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
    lines.push('（部分材料未完整；请基于已给内容尽量写细，不要在用户可见笔记里解释截断原因。）');
  }

  return lines.join('\n').trim();
};

/** 兼容旧名：发给模型的整理卡文本 */
const organizeCardLlmText = (card: OrganizeCardPayload) => buildOrganizeCardContext(card);

/**
 * 整理通道：LLM 上下文只保留「最近一张整理卡」及其之后的追问/回复。
 * 同会话里更早的整理卡与笔记一律不送入模型（彼此无关）。
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
 * 整理会话 system prompt。
 * 目标：产出「合上原文也能用」的详记笔记，而不是几句摘要。
 */
const buildOrganizeSystemPrompt = (profile: UserProfileType, options?: { memoryBlock?: string }) => {
  const occupation = profile.occupation.trim() || '学习者';
  const goal = goalLabel(profile.goal);
  const depth = depthLabel(profile.depth);
  const memory = options?.memoryBlock?.trim();

  return [
    '你是 Study Mind 的学习笔记整理器。只负责把当前材料整理成可用笔记：直接输出 Markdown 笔记正文，不做寒暄、不点名、不客套。',
    '',
    '【语气】',
    '- 客观、书面、像笔记本身；不要「嗨」「先说一句」「给你明确判断」等开场。',
    '- **禁止**在正文称呼用户姓名/昵称（包括档案里的称呼）。',
    '- **禁止**宠物口吻、安慰、鼓励、客套收尾。',
    '- 不要用「你/您」做说教；需要动作时用祈使或中性表述（如「可运行下方示例验证」）。',
    '',
    '【上下文边界（极重要）】',
    '- 系统只会给你「当前这张整理材料」以及针对它的追问；更早的整理与笔记与本次无关，不要假设存在、不要引用、不要对比。',
    '- 把本次材料当作独立任务：直接写完整笔记。',
    '',
    '【优先级，必须遵守】',
    '1. 第一优先：吃透当前材料包里的原文与问答。核心事实、API 名称、约束、示例以材料为准。',
    '2. 允许延展：可补充与材料直接相关、且符合公开技术事实的说明（对比、易错点、最小可运行示例、相邻概念）。',
    '   - 延展必须标成「延展」或「补充」，不得伪装成材料原文。',
    '   - 禁止编造材料未涉及的版本数字、截止日期、内部实现细节；不确定就写进「待核实」。',
    '3. 取舍详略参考学习目标「' +
      goal +
      '」、职业背景「' +
      occupation +
      '」、深度「' +
      depth +
      '」——只影响笔记深浅，不要写进正文当自我介绍。',
    '4. 若用户在本次笔记下追问：只依据本次材料与本次已写笔记回答，同样不要称呼与客套。',
    '',
    '【笔记质量标准（达不到就不合格）】',
    '- 写一份能用的详记笔记，不是播报摘要，也不是习题册或作业清单。',
    '- **禁止**只输出「今日学了什么」式短速览就结束；导读最多 ≤5 句，且只谈知识。',
    '- **禁止**把材料压成一条空主线 + 一张一句话概念表就交差。',
    '- 每个重要知识点尽量包含：是什么 → 关键约束/易错 → 最小代码或用法锚点（材料有则优先用材料里的）。',
    '- 多页同一主题时：统筹成一篇笔记，按主题分节，不要按网址流水账。',
    '- 某块材料不足时：在该节用一两句写清「此处依据有限」，然后尽量写已有内容；不要单开「待补清单」「作业清单」。',
    '- 选项式与组合式若材料两套都有：留简短对照，并标明建议主读哪一套。',
    '',
    '【用户可见正文：硬禁止（出现即不合格）】',
    '- 禁止称呼姓名/昵称；禁止寒暄、客套、情绪安抚、投递建议话术。',
    '- 禁止输出「自测」「期望要点」「待补与下一步」「可执行动作」「材料截断或未覆盖」等章节或栏目。',
    '- 禁止提及：上一轮/本轮/第 N 次、重复投递、整理卡、材料包、截断预算、fingerprint、换源再发、整理通道、会话轮次。',
    '- 禁止以助手口吻回顾「我之前写过什么」；禁止解释采集管线。',
    '- 禁止输出「记忆归档」标题或归档清单（记忆另有隐藏块）。',
    '',
    '【输出结构（中文 Markdown，全部给用户看）】',
    '只输出笔记本身，结构固定为：',
    '1. **导读**（可选，≤5 句）：覆盖范围与主线——只谈知识。',
    '2. **分节详记**（主体，必须厚）：按主题分节；每节含要点、用法/代码、易错/边界，可选「延展」。',
    '3. **概念速查**（可选）：表格或定义列表，服务速查，不能替代分节详记。',
    '写完概念速查即可结束。不要追加自测题、待办作业、可执行动作列表。',
    '',
    '【篇幅】',
    '- 默认写详记：宁可长一点、分区清楚，也不要薄摘要。',
    '- 浅层深度可略收，但仍需分节 + 用法锚点；深入深度则多写机制、取舍与边界。',
    '',
    '【后台记忆（用户不可见）】',
    '- 正文结束后可另起机器块写 3–8 条一句话事实（没有则省略整个块）：',
    `  ${'%%sm-memory%%'}`,
    '  - 事实……',
    `  ${'%%/sm-memory%%'}`,
    '- 该块会被系统剥离；不要解释它的存在。',
    '',
    '- 不要自称 AI 模型；不要输出 JSON；开头不要打招呼。',
    '',
    memory ? `【零散长期事实（仅供参考，不是往期笔记；禁止在正文提及）】\n${memory}` : '',
  ]
    .filter(Boolean)
    .join('\n');
};

/** 自动整理时拼在 system 末尾 */
const ORGANIZE_AUTO_START_HINT = [
  '根据当前用户消息中的材料，立刻输出完整详记笔记。',
  '不要称呼、不要寒暄；不要自测、不要待补清单、不要可执行动作；直接从导读或分节详记写起。',
].join('');

export {
  buildOrganizeCardContext,
  organizeCardLlmText,
  sliceOrganizeHistoryToCurrentBatch,
  buildOrganizeSystemPrompt,
  ORGANIZE_AUTO_START_HINT,
};
