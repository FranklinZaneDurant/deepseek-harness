# 进度日志（PROGRESS.md）

> 每次会话先读本文件，收尾时更新（STA-07..09）。

- 当前已验证状态：工作区未提交。验证门 `desktop-bundled-plugin-provisioning` 已置 passing：
  `pnpm vitest run apps/desktop/tests/{bundled-plugins,bundled-plugin-provisioning,main-startup,project-manager,plugin-pnpm,profile-packages}.spec.ts` → 6 files / 60 tests passed, exit 0；
  `tsc -b tsconfig.host.json` → exit 0；`pnpm run lint:contracts-ready` → 0 warnings / 0 errors（3574 files），exit 0；
  `pnpm run test:docs` → 16 passed / 0 failed，exit 0；`git diff --check` → exit 0。
  换名后复验：`bundled-plugins` + `bundled-plugin-provisioning` + `main-startup` → 3 files / 25 tests passed，`tsc -b tsconfig.host.json` exit 0。
- 已完成：
  - `desktop-bundled-plugin-provisioning`（passing）：Electron 桌面端在启动准备槽位发放内置第三方插件。
    新增 `apps/desktop/src/bundled-plugins.ts`（清单 + `desktop-provisioned-plugins.json` 状态 + 待发放判定）；
    `DesktopProjectManager.provisionPlugins` 与私有 `installBundledPlugins`（apps/desktop/src/project-manager.ts）；
    接入 `apps/desktop/src/main.ts` 的 prepare 回调。
  - 方法论工件冷启动（`agent_discipline_init`）：feature_list.json、PROGRESS.md、session-handoff.md、naming-registry.md、
    clean-state-checklist.md、evaluator-rubric.md。已收敛掉 3 个与仓库既有机制重复或失效的模板文件：
    `scripts/check.sh`（L1 是幽灵门，检查空程序）、`scripts/verify-feature.sh`（与 C-1 冲突，且默认跑全量）、
    `.harness/arch-rules.json`（规则指向方法论工具自身的包布局）。收敛理由见 naming-registry.md「收敛记录」。
    注意：`.harness/features/events.jsonl` 是特性状态机真源，保留。
- 进行中：（无；WIP=1 空闲）
- 阻塞：（无）
- 下一步：
  1. 复核 `apps/desktop/tests/windows-sign.spec.ts` 的 1 项失败——该文件会写出 512 字节合成 PE 桩文件 `uninstaller.exe`，
     曾被本机杀软按启发式误报（详见 session-handoff.md「仍然损坏或未验证的」）。重跑前请先确认杀软排除项。
  2. 插件侧两个阻塞已修复并换名：`@huiliyi37/dsh-office`（他人所有）→ **`@diazefeng1219/dsh-office@0.1.0`**，已发布到 npm。
     修复点：`@deepseek-ai/schemastery` 由 dependencies 移入 peerDependencies；`@deepseek-ai/dsh-tools` 的 peer 范围
     `^0.1.0-rc.5` → `>=0.1.0-rc.5 <0.2.0 || ^0.1.5-0`。发布前门槛为插件仓库的 `scripts/check-desktop-compat.mjs`。
     发布后 packument 曾短暂 404（新包传播延迟），**已恢复**：`npm view` 返回 0.1.0，`npm pack <pkg>@0.1.0` 可按包名下载。
     发布的 integrity `sha512-8sSmWC3ME89+p...Ah0vTD/AWygwg==` 与本地打包一致，fileCount 46。
     待办：`pnpm run package:desktop:dir` → 用真实产物 `desktop-runtime.json` 复跑兼容检查。
  3. 若需要离线首启也能发放，评估升级到「内置进签名运行时」路线（Agent Note 的 Alternatives considered 已记录取舍）。
