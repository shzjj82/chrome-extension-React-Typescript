import type { dynamicEnvValues } from './index.js';

interface ICebEnv {
  readonly CEB_EXAMPLE: string;
  readonly CEB_DEV_LOCALE: string;
  /** 饥饿每分钟折损（默认约 70/天 ≈ 0.0486） */
  readonly CEB_PET_HUNGER_LOSS_PER_MIN: string;
  /** 心情每分钟折损（默认约 36/天 = 0.025） */
  readonly CEB_PET_MOOD_LOSS_PER_MIN: string;
  /** 成长跨日继承比例 0–1（默认 0.3） */
  readonly CEB_PET_GROWTH_DAILY_CARRY_RATIO: string;
  /** 正餐回复饥饿量 */
  readonly CEB_PET_MEAL_RESTORE: string;
  /** 零食回复饥饿量（预留） */
  readonly CEB_PET_SNACK_RESTORE: string;
  /** 当日吃满三餐的心情加成 */
  readonly CEB_PET_THIRD_MEAL_MOOD_BONUS: string;
}

interface ICebCliEnv {
  readonly CLI_CEB_DEV: string;
  readonly CLI_CEB_FIREFOX: string;
}

export type EnvType = ICebEnv & ICebCliEnv & typeof dynamicEnvValues;
