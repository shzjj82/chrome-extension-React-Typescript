# Study Mind AI

本地私有化 AI 学习助手 Chrome 扩展（Manifest V3）。帮助你在阅读文档、看教程时完成「输入 → 总结 → 自测 → 实践 → 计时存档」闭环。

## 核心能力（MVP）

- 学习档案：按职业 / 领域 / 目标个性化 AI 输出
- 悬浮球一键开始学习，唤起侧栏并启动番茄钟
- 素材导入：网页正文、公开明文字幕、可见字幕采集、手动粘贴、本地 SRT/VTT
- 三种模式：笔记 / 测验 / 实践（测验不自动判题）
- BYOK：DeepSeek / 通义 / OpenAI 兼容接口，密钥仅存本地
- IndexedDB 本地知识库：查看、备注、删除、导出 Markdown

## 合规边界

本工具仅辅助个人合法学习，依托用户自有课程观看权限采集**可视**学习内容：

- 不破解、不解密、不拦截 DRM
- 不抓取平台私有字幕/视频接口
- 不上传学习数据与 API Key

## 快速开始

```bash
pnpm install
pnpm dev
```

Chrome 加载：

1. 打开 `chrome://extensions`
2. 开启开发者模式
3. 加载已解压的扩展程序 → 选择仓库 `dist` 目录

生产构建：

```bash
pnpm build
```

## 使用流程

1. 打开扩展设置，填写学习档案与 LLM API Key（可跳过档案）
2. 浏览学习网页 / 视频
3. 点击右下角悬浮球「开始学习」
4. 在侧栏确认素材、选择模式并生成
5. 作答 / 回填实践结果，保存到本地知识库

## 项目结构

```text
chrome-extension/     # background、manifest
pages/side-panel/     # 学习主界面
pages/options/        # 档案 / BYOK / 番茄钟 / 浮球开关
pages/popup/          # 快捷入口
pages/content/        # 正文与字幕提取
pages/content-ui/     # 悬浮球
packages/storage/     # chrome.storage 配置
packages/knowledge-base/ # IndexedDB 知识库
packages/shared/      # messaging 等共享工具
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 开发模式（HMR） |
| `pnpm build` | 生产构建 |
| `pnpm zip` | 打包 zip |
| `pnpm lint` / `pnpm format` | 检查与格式化 |
