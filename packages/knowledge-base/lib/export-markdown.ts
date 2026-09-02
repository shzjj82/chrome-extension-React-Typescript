import type { StudySession } from './types.js';

const sessionToMarkdown = (session: StudySession): string => {
  const lines = [
    `# ${session.title || '未命名学习记录'}`,
    '',
    `- 来源: ${session.sourceUrl || '无'}`,
    `- 模式: ${session.mode}`,
    `- 素材来源: ${session.materialSource}`,
    `- 番茄: ${session.pomodoroCount} 个 / ${session.pomodoroMinutes} 分钟`,
    `- 更新时间: ${new Date(session.updatedAt).toLocaleString()}`,
    '',
  ];

  if (session.remark) {
    lines.push('## 备注', '', session.remark, '');
  }

  lines.push('## 学习素材', '', session.material || '_空_', '');

  if (session.mode === 'note' || session.noteContent) {
    lines.push('## AI 笔记', '', session.noteContent || '_空_', '');
  }

  if (session.quizzes.length > 0) {
    lines.push('## 测验', '');
    session.quizzes.forEach((quiz, index) => {
      lines.push(`### ${index + 1}. [${quiz.kind}] ${quiz.question}`, '');
      lines.push(`参考思路: ${quiz.answer || '_无_'}`, '');
      lines.push(`我的作答: ${quiz.userAnswer || '_未作答_'}`, '');
    });
  }

  if (session.practices.length > 0) {
    lines.push('## 实践任务', '');
    session.practices.forEach((practice, index) => {
      lines.push(`### ${index + 1}. ${practice.task}`, '');
      lines.push(`实践结果: ${practice.userResult || '_未填写_'}`, '');
    });
  }

  return lines.join('\n');
};

const downloadSessionMarkdown = (session: StudySession): void => {
  const markdown = sessionToMarkdown(session);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeTitle = (session.title || 'study-session').replace(/[\\/:*?"<>|]/g, '_');

  anchor.href = url;
  anchor.download = `${safeTitle}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export { sessionToMarkdown, downloadSessionMarkdown };
