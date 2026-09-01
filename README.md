# Study Mind AI Extension

Chrome / Firefox 浏览器扩展脚手架，基于 React + TypeScript + Vite + Turborepo，已接入 Tailwind CSS 与 shadcn/ui。

技术栈来自 [chrome-extension-boilerplate-react-vite](https://github.com/Jonghakseo/chrome-extension-boilerplate-react-vite)，并按本项目需求做了本地化与 UI 组件接入。

## 技术栈

- React 19 + TypeScript
- Vite 6 + Turborepo + pnpm
- Tailwind CSS 3
- shadcn/ui（组件放在 `packages/ui`）
- Chrome Extension Manifest V3

## 环境要求

- Node.js `>= 22.15.1`
- pnpm `10.11.0`（见根目录 `packageManager`）

## 快速开始

```bash
pnpm install
pnpm dev
```

### 在 Chrome 中加载

1. 打开 `chrome://extensions`
2. 开启「开发者模式」
3. 「加载已解压的扩展程序」
4. 选择本仓库的 `dist` 目录

生产构建：

```bash
pnpm build
```

打包 zip：

```bash
pnpm zip
```

## 项目结构

```text
chrome-extension/   # background、manifest
pages/              # popup、options、side-panel、content 等页面
packages/           # 共享包（ui、storage、i18n、vite-config 等）
```

常用页面：

| 目录 | 说明 |
| --- | --- |
| `pages/popup` | 工具栏弹窗 |
| `pages/options` | 选项页 |
| `pages/side-panel` | 侧边栏 |
| `pages/content` / `content-ui` | 内容脚本 |
| `chrome-extension/src/background` | Service Worker |

启用 / 禁用模块：

```bash
pnpm module-manager
```

## shadcn/ui

组件安装到 UI 包（不要在根目录跑会升级到 Tailwind v4 的 `shadcn init`）：

```bash
pnpm dlx shadcn@latest add button -c ./packages/ui
```

安装后在 `packages/ui/index.ts` 中导出，再在页面中使用：

```tsx
import { Button } from '@extension/ui';
```

更多说明见 [`packages/ui/README.md`](packages/ui/README.md)。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | Chrome 开发模式（HMR） |
| `pnpm build` | 生产构建 |
| `pnpm zip` | 构建并打包 zip |
| `pnpm lint` / `pnpm format` | 代码检查与格式化 |
| `pnpm update-version <version>` | 同步各 package 版本号 |

## 本地化

扩展名称与描述在：

- `packages/i18n/locales/en/messages.json`
- `packages/i18n/locales/ko/messages.json`

仓库地址常量（各页面 Logo 跳转）在：

- `packages/shared/const.ts`
