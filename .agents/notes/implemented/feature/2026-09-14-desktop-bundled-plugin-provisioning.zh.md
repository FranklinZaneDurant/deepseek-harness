# Agent Note: 首次启动发放内置桌面插件

Status: implemented

[English](2026-09-14-desktop-bundled-plugin-provisioning.md) | 中文

## 问题

一个桌面端发布包含一套固定的运行时，以及用户自行安装的插件。希望每份安装都带上某个第三方插件的分发者没有受支持的路径：Desktop Host 从不读取 CLI 的 `web` profile，CLI 拒绝为保留的 `desktop` profile 管理插件，而外壳把内置 pnpm 排除在 `PATH` 之外并独占 profile 的包管理器状态。[内置运行时决策](../architecture/2026-09-08-desktop-bundled-runtime-and-external-plugins.zh.md)把首次启动限定在 profile 元数据和宿主链接，因此也没有任何东西代用户安装插件。

## 决定

[`apps/desktop/src/bundled-plugins.ts`](../../../../apps/desktop/src/bundled-plugins.ts) 列出每个新 profile 都会获得的第三方插件。`DesktopProjectManager.provisionPlugins` 在启动准备槽位中与发布版本协调一起执行，此处后端按构造已停止，并持有包事务锁。

发放通过内置 pnpm 按锁定的精确版本安装每个待发放插件，并禁用 lifecycle script。只有在完整插件依赖图通过验证后，插件才加入 profile 的 bundle 列表；因此打包运行时无法满足的 peer 范围会让 profile 保持不变、插件保持休眠，而不是阻断启动。

## 发放状态

profile 中的 `desktop-provisioned-plugins.json` 记录每个插件在特定运行时标识下的最终结果。当插件没有记录结果、打包版本发生变化，或 profile 是针对另一个运行时准备的时候，该插件处于待发放状态。

已定案的条目不会再次待发放，因此用户通过插件窗口移除插件后，直到打包版本或运行时标识变化前都不会被重新安装。重置 Desktop 会随 profile 一并删除该记录，下次启动时重新发放。

## 失败处理

包管理器失败时，会恢复安装前捕获的清单和锁文件，丢弃待处理包标记，并且不记录结果。因此重试发生在下次启动，而离线首次启动留下的 profile 与之前完全一样可用。

安装成功但未声明 `dsh.bundle.patch` 的插件会从 profile 中移除，并记录为不可用。依赖图验证失败的插件保持已安装且休眠，并记录为不兼容。两种结果都不会阻断后端启动。

## 考虑过的替代方案

**把插件内置进签名运行时。** 这样应用无需访问 registry 即可发放，符合内置运行时决策的离线目标。代价是运行时描述符和插件依赖图校验器要新增"内置插件"类别、运行时 schema 变更，以及随包分发插件字节并承担其许可与声明义务。放弃的原因是应用本就需要网络才能访问模型提供方，而且签名与清单路径会因一个用户可能移除的插件而变复杂。

**从打包应用中执行 `dsh plugin --profile web add <package>`。** 这是外部插件有文档的 CLI 路径。它因三个彼此独立的原因无法到达 Desktop profile：Desktop Host 通过 `loadProfileDirectory` 加载 `$DSH_HOME/profiles/desktop`，而不是走 CLI profile 查找；CLI 以由 Electron 管理为由拒绝 `--profile desktop`；外壳把内置 pnpm 排除在 `PATH` 之外并独占 profile 的包管理器状态。

**随包分发一个预先装好的 profile 目录。** `$DSH_HOME` 解析到操作系统的用户主目录，因此在构建机上准备好的 profile 留在那里，不会随安装包一起分发。

**把发放交给插件窗口。** 这不需要代码，也把控制权留给用户，但分发者就无法承诺接收方一定拥有该插件。

## 后果

新的 Desktop profile 无需用户操作即可获得所列插件，版本由发布锁定。需要发放的首次启动必须能访问 npm registry；无法访问时应用会不带该插件启动，并在下次启动时重试。插件集合是发布输入，因此修改它是随发布一起评审的源码改动。

发放复用了插件窗口所驱动的插件安装机制，没有引入第二条包管理器路径。[`apps/desktop/tests/bundled-plugin-provisioning.spec.ts`](../../../../apps/desktop/tests/bundled-plugin-provisioning.spec.ts) 针对真实 pnpm 与 fixture registry 覆盖了安装、幂等、移除、不兼容 peer、未声明 bundle 以及 registry 不可达。
