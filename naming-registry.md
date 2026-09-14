# 命名注册表（§14.1 命名单点注册）

> 全仓库工件文件名与状态词汇的单点定义。新增命名先改本表，再使用。
> 代码面唯一出处：src/constants.ts；本文件是仓库工件清单的注册视图。

## 状态词表（§3.3）
| 状态 | 语义 | 禁止别名 |
|---|---|---|
| not_started | 未开始 | 如 pass/done/complete 等（AP-07） |
| in_progress | 进行中（全局最多一个，WIP=1） | 如 pass/done/complete 等（AP-07） |
| blocked | 阻塞（必须附 blocked_reason 与解除条件） | 如 pass/done/complete 等（AP-07） |
| passing | 仅由验证门置位（验证通过 + 证据落盘） | 如 pass/done/complete 等（AP-07） |

## 工件规范名（§8）
| 工件 | 规范名 | 允许别名 |
|---|---|---|
| 入口指令文件 | AGENTS.md | CLAUDE.md / agents.md |
| 特性清单 | feature_list.json（投影；真源 `.harness/features/events.jsonl`） | feature-list.json / features.json |
| 进度日志 | PROGRESS.md | progress.md / claude-progress.md |
| 决策日志 | 不另设；由 `.agents/notes/` 承担 | DECISIONS.md / docs/decisions/ |
| 交接文档 | session-handoff.md | — |
| 验证入口 | 仓库既有门：`pnpm run lint` / `test` / `test:docs` / `doc-sync` / `typecheck`（runner `scripts/run-gates.ts`） | 不另设 scripts/check.sh |
| 清洁清单 | clean-state-checklist.md | clean-state-check |
| 评估准则 | evaluator-rubric.md | — |
| 架构规则 | 不另设；由 `AGENTS.md`「Conventions」与 `docs/architecture.md` 承担 | 不另设 .harness/arch-rules.json |
| 命名注册表 | naming-registry.md | — |

## 收敛记录（禁止重新引入）
本表登记"这个工件在本仓库由谁承担"。标为「不另设」的条目不得新建平行文件——一个事实只有一个家（one home per fact）：
- **决策日志**：`.agents/notes/` 已是决策档案，且由 `verify-agent-note-format`、`verify-agent-note-classification`、`verify-archived-agent-notes`、`verify-translation-pairing` 四个真实门强制；平铺的 `DECISIONS.md` 会与之重复且无门禁。
- **验证入口**：方法论模板的 `scripts/check.sh` 跑 `npx tsc -p tsconfig.json --noEmit`，而根 `tsconfig.json` 是 `files: []` 的 solution 文件，该命令检查的是空程序、秒退 0（AP-14 幽灵门）；它还会跑全量 `npm test`，与仓库 AGENTS.md 的「不要默认跑全量」冲突。真实门以 `pnpm run test:docs` / `doc-sync` / `lint:contracts-ready` 为准。
- **架构规则**：`.harness/arch-rules.json` 模板中的规则指向方法论工具自身的包布局（`src/audit`、`src/init/templates`、`src/constants.ts`），对本仓库是死条文；改写成 grep 命令只会再造一个幽灵门。本仓库的架构约束由 `AGENTS.md` 与 `docs/architecture.md` 拥有。
- **特性状态**：状态只能经 `verify_feature` 置位，`feature_list.json` 是投影，手改会被 `.harness/features/events.jsonl` 覆盖。

## 项目专有命名（本仓库既有代码面，非本方法论引入）
| 概念 | 规范名 | 唯一出处 | 禁止别名 |
|---|---|---|---|
| 桌面端内置插件清单 | `BUNDLED_PLUGINS` | `apps/desktop/src/bundled-plugins.ts` | 预装插件 / 默认插件 / defaultPlugins |
| 桌面端发放状态文件 | `desktop-provisioned-plugins.json` | 同上 | provisioned.json / bundled-plugins.json |
| 发放动作 | provision（发放） | `DesktopProjectManager.provisionPlugins` | install / bootstrap / seed |

## 发放结果词表（`DesktopProvisionOutcome`，单点定义于 `apps/desktop/src/bundled-plugins.ts`）
| 结果 | 语义 | 是否持久化 |
|---|---|---|
| installed | 已安装并在 profile 中激活 | 是 |
| unusable | 已安装字节无法作为 profile 插件（无清单 / 版本不符 / 未声明 `dsh.bundle.patch`） | 是 |
| incompatible | 已声明 bundle，但插件依赖图校验拒绝（含运行时无法满足的 peer 范围） | 是 |
| unavailable | 包管理器未能安装（网络 / registry / pnpm 失败） | 否（故下次启动重试） |
