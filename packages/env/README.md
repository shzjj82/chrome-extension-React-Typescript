# Environment Package

This package contains code which creates env values.
To use the code in the package, you need to follow those steps:

1. Add a new record to `.env` (NEED TO CONTAIN `CEB_` PREFIX),

    - If you want via cli:
    - Add it as argument like: `pnpm set-global-env CLI_CEB_NEXT_VALUE=new_data ...` (NEED TO CONTAIN `CLI_CEB_` PREFIX)

   > [!IMPORTANT]
   > `CLI_CEB_DEV` and `CLI_CEB_FIREFOX` are `false` by default \
   > All CLI values are overwriting in each call, that's mean you'll have access to values from current script run only.

    - If you want dynamic variables go to `lib/index.ts` and edit `dynamicEnvValues` object.

2. Use it, for example:
    ```ts
    console.log(process.env['CEB_EXAMPLE']);
    ```
   or
   ```ts
   console.log(process.env.CEB_EXAMPLE);
   ```
   but with first solution, autofill should work for IDE:
   ![img.png](use-env-example.png)
3. You are also able to import const like `IS_DEV` from `@extension/env` like:
   ```ts
    import { IS_DEV } from '@extension/env';
    ```
   For more look [ENV CONST](lib/const.ts)

### Pet needs (`CEB_PET_*`)

| Variable | Meaning | Default |
|----------|---------|---------|
| `CEB_PET_HUNGER_LOSS_PER_MIN` | 饥饿每分钟折损 | `0.048611`（≈70/天） |
| `CEB_PET_MOOD_LOSS_PER_MIN` | 心情每分钟折损 | `0.025`（≈36/天） |
| `CEB_PET_GROWTH_DAILY_CARRY_RATIO` | 成长跨日继承比例 | `0.3` |
| `CEB_PET_MEAL_RESTORE` | 正餐回复饥饿 | `40` |
| `CEB_PET_SNACK_RESTORE` | 零食回复（预留） | `12` |
| `CEB_PET_THIRD_MEAL_MOOD_BONUS` | 三餐齐全心情加成 | `4` |

Edit root `.env`, then restart / rebuild so Vite reinjects `process.env`.