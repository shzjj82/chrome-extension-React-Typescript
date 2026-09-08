/**
 * Study Mind 默认状态台词注册（可按产品改文案；也可在别处再 register）。
 */
import { registerPetStatusLines } from '@extension/storage';

let registered = false;

const registerDefaultStudyMindStatusLines = () => {
  if (registered) {
    return;
  }
  registered = true;

  registerPetStatusLines(
    [
      {
        id: 'hunger-starving',
        stat: 'hunger',
        when: { lte: 20 },
        priority: 30,
        cooldownMs: 20 * 60_000,
        group: 'study-mind-default',
        lines: ['肚子咕咕叫…', '好饿，想吃饭饭'],
      },
      {
        id: 'hunger-low',
        stat: 'hunger',
        when: { gt: 20, lte: 40 },
        priority: 20,
        cooldownMs: 30 * 60_000,
        group: 'study-mind-default',
        lines: ['有点饿了', '该找点吃的了吧'],
      },
      {
        id: 'mood-low',
        stat: 'mood',
        when: { lte: 30 },
        priority: 25,
        cooldownMs: 25 * 60_000,
        group: 'study-mind-default',
        lines: ['心情有点低落…', '陪我待会儿好不好'],
      },
      {
        id: 'growth-warming',
        stat: 'growth',
        when: { gte: 70 },
        priority: 10,
        cooldownMs: 60 * 60_000,
        group: 'study-mind-default',
        lines: ['今天成长不少呢', '感觉又厉害了一点点'],
      },
    ],
    { overwrite: true },
  );
};

export { registerDefaultStudyMindStatusLines };
