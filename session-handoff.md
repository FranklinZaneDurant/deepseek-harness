# 会话交接（session-handoff.md）

> 长会话/多活动区域场景使用（STA-12）。新会话先读本文件再开工。

## 本会话已验证了什么
- 特性 `desktop-bundled-plugin-provisioning`（状态 passing，证据由 `verify_feature` 门卫生成）：
  - `pnpm vitest run apps/desktop/tests/{bundled-plugins,bundled-plugin-provisioning,main-startup,project-manager,plugin-pnpm,profile-packages}.spec.ts`
    → Test Files 6 passed (6)，Tests 60 passed (60)，exit 0。
  - `node ./node_modules/typescript/bin/tsc -b tsconfig.host.json` → exit 0（覆盖 apps/desktop/src 与 apps/desktop/tests）。
  - `pnpm run lint:contracts-ready` → Found 0 warnings and 0 errors（3574 files），exit 0。
  - `pnpm run test:docs` → 16 passed, 0 failed，exit 0（含 translation pairing 809 对全通过）。
  - `git diff --check` → exit 0。
- 新行为验证点（fixture registry + 真实 pnpm，见 `apps/desktop/tests/bundled-plugin-provisioning.spec.ts`）：
  安装并激活；重复调用为空操作；用户 `plugin-remove` 后不复活；registry 不可达时恢复 `package.json` 与 `pnpm-lock.yaml`、
  清理 `desktop-packages-pending`、不写状态且后续 `applyRelease()` 仍返回 false；peer 不兼容时保持未启用且不阻断启动；
  未声明 `dsh.bundle.patch` 时从 profile 移除依赖并记为 unusable。

## 本会话改了什么
- 新增：`apps/desktop/src/bundled-plugins.ts`、`apps/desktop/tests/bundled-plugins.spec.ts`、`apps/desktop/tests/bundled-plugin-provisioning.spec.ts`。
- 修改：`apps/desktop/src/project-manager.ts`（构造函数新增 `bundled` 参数、`provisionPlugins`、`installBundledPlugins`、`discardPendingPackages`）、
  `apps/desktop/src/main.ts`（prepare 回调内调用并记录非 installed 结果）、`apps/desktop/tests/main-startup.spec.ts`（mock 增补 `provisionPlugins` 与顺序断言）。
- 文档：`apps/desktop/README.md` / `README.zh.md`（新增「Bundled plugins / 内置插件」小节 + 已知限制各 +9 行，sidecar 已重录）。
- Agent Note：新增 `implemented/feature/2026-09-14-desktop-bundled-plugin-provisioning.md` / `.zh.md` / `.i18n.yaml`；
  更新 `implemented/architecture/2026-09-08-desktop-bundled-runtime-and-external-plugins.md` / `.zh.md`（首次启动不再是无条件「不运行 pnpm」）并重录 sidecar。
- 方法论工件：`agent_discipline_init` 生成的 9 个文件（见 PROGRESS.md）。

## 仍然损坏或未验证的
- `apps/desktop/tests/windows-sign.spec.ts` 在整目录跑时出现 1 项失败，**未复现、未定位**。最可能原因：该文件的
  「clears a certificate table inherited beyond the generated uninstaller」用例会在 `%TEMP%\dsh-windows-sign-*` 写出
  512 字节的合成 PE 桩文件 `uninstaller.exe`（`Buffer.alloc(512)` + 手写 PE 头 + 悬空证书表），本机杀软把它按启发式
  误报为 `Cryp Xin1` 并尝试隔离，导致该用例失败。**未再复跑**（避免再次触发杀软）。临时目录 `dsh-windows-sign-UIPnR5`
  已确认内容为空并删除。处置前请先加杀软排除项或在工作区内的 `TEMP` 下运行。
- 未执行：`pnpm run test`（全量单测）、`pnpm run test:coverage`、真实打包（`package:desktop:dir`）与
  Windows 原生清理资格检查。本次改动未在这些层面取得证据。
- 未验证的产品事实：在**稳定版** 0.1.x 桌面包上 `@huiliyi37/dsh-office` 的发放结果。本仓库当前为 `0.1.5-rc.2`，
  其实测 `satisfies('0.1.5-rc.2', '^0.1.0-rc.5') === false`，因此用本仓库构建的 rc 版桌面包会把该插件记为 `incompatible`。

## 下一步最佳动作
1. 处置 `windows-sign.spec.ts` 的杀软误报（加排除项或改 `TMP`），再确认该文件 7 项全绿。
2. 用 `pnpm run package:desktop:dir` 造一个真实产物，走插件窗口与该插件做一次端到端确认。
3. 决定 `@huiliyi37/dsh-office` 的 pin 版本策略；若坚持在 rc 版发布，需要插件作者放宽 `@deepseek-ai/dsh-tools` 的 peer 范围。
4. 若要离线首启也具备该插件，按 Agent Note 的 Alternatives considered 评估「内置进签名运行时」路线。

## 常用命令
- 全量验证：`pnpm run lint:contracts-ready && pnpm run test && pnpm run test:docs`
- 文档门：`pnpm run test:docs`（快）／`pnpm run doc-sync`（全）
- 本特性聚焦验证：`pnpm vitest run apps/desktop/tests/bundled-plugin-provisioning.spec.ts`
- 特性状态：经 `verify_feature` 置位；`feature_list.json` 只是投影，手改会被 `.harness/features/events.jsonl` 覆盖
