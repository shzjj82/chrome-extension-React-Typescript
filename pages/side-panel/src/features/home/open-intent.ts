import { desktopRegistry, getHomeApp, resolveOpenIntent } from './desktop/registry';
import type { DesktopAppDefinition, HomeAppId, OpenIntent } from './desktop/types';

/** @deprecated 路由已写入各 App 的 path，保留空映射仅兼容旧导入 */
const PAGE_ROUTE_BY_ID: Partial<Record<HomeAppId, string>> = {};

/** @deprecated 请优先 desktopRegistry.openApp / resolveOpenIntent */
const resolveOpenIntentLegacy = (app: DesktopAppDefinition): OpenIntent | null => resolveOpenIntent(app);

export type { OpenIntent };
export { resolveOpenIntentLegacy as resolveOpenIntent, PAGE_ROUTE_BY_ID, getHomeApp, desktopRegistry };
