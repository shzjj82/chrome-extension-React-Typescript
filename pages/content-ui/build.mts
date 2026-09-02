import { resolve } from 'node:path';
import { makeEntryPointPlugin } from '@extension/hmr';
import { getContentScriptEntries, withPageConfig } from '@extension/vite-config';
import { IS_DEV } from '@extension/env';
import { build } from 'vite';
import { build as buildTW } from 'tailwindcss/lib/cli/build';

const rootDir = resolve(import.meta.dirname);
const srcDir = resolve(rootDir, 'src');
const matchesDir = resolve(srcDir, 'matches');

const configs = Object.entries(getContentScriptEntries(matchesDir)).map(([name, entry]) => ({
  name,
  config: withPageConfig({
    mode: IS_DEV ? 'development' : undefined,
    resolve: {
      alias: {
        '@src': srcDir,
      },
    },
    publicDir: resolve(rootDir, 'public'),
    plugins: [IS_DEV && makeEntryPointPlugin()],
    build: {
      lib: {
        name: name,
        formats: ['iife'],
        entry,
        fileName: name,
      },
      outDir: resolve(rootDir, '..', '..', 'dist', 'content-ui'),
    },
  }),
}));

const builds = configs.map(({ name, config }) => ({
  name,
  config,
  cssInput: resolve(matchesDir, name, 'index.css'),
  cssOutput: resolve(rootDir, 'dist', name, 'index.css'),
}));

for (const { cssInput, cssOutput } of builds) {
  await buildTW({
    ['--input']: cssInput,
    ['--output']: cssOutput,
    ['--config']: resolve(rootDir, 'tailwind.config.ts'),
  });
}

await Promise.all(
  builds.map(async ({ config }) => {
    //@ts-expect-error This is hidden property into vite's resolveConfig()
    config.configFile = false;
    await build(config);
  }),
);
