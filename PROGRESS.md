# 进度日志（PROGRESS.md）

> 每次会话先读本文件，收尾时更新（STA-07..09）。
> **覆盖写，不追加**：本文件是状态快照，不是日记——只描述当前状态，不留历史版本。
> 预算 ≤ 6144 B、单行 ≤ 512 字符（§10-35）；超限即已漂移，`agent_discipline_audit` 会报 R26。

- 当前已验证状态：验证门 `desktop-bundled-plugin-provisioning` = passing，证据由 `verify_feature` 生成并落盘（见 `feature_list.json`）：`vitest run apps/desktop/tests/*.spec.ts` 6 文件 / 60 测试、`tsc -b tsconfig.host.json`、`pnpm run lint:contracts-ready`（0 warnings / 0 errors，3574 文件）、`pnpm run test:docs`（16 passed / 0 failed，含 809 对双语配对）、`git diff --check` —— 全部 exit 0。特性状态以 `feature_list.json`（真源 `.harness/features/events.jsonl`）为准，本文件不重复枚举（§10-38）。
- 已完成：桌面端首启发放内置插件（新增 `apps/desktop/src/bundled-plugins.ts`，`DesktopProjectManager.provisionPlugins` 接入 `main.ts` 的 prepare 槽位；Agent Note 已入库）；内置插件由 `@huiliyi37/dsh-office`（他人所有）换名为 `@diazefeng1219/dsh-office@0.1.0` 并发布到 npm；方法论工件冷启动，并收敛掉 3 个与仓库既有机制重复或失效的模板文件（理由见 `naming-registry.md`「收敛记录」）。
- 进行中：无（WIP=1 空闲）。
- 阻塞：无。
- 下一步：① 用 `pnpm run package:desktop:dir` 造真实产物 → 以产物 `desktop-runtime.json` 复跑插件仓库的 `check-desktop-compat.mjs`，把「工作区依赖图推断」换成事实 → ② 处置 `apps/desktop/tests/windows-sign.spec.ts` 的杀软误报（详见 session-handoff.md）→ ③ 若需离线首启也能发放，评估「内置进签名运行时」路线（Agent Note 的 Alternatives considered 已记录取舍）。
