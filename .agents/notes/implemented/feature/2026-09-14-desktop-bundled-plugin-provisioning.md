# Agent Note: Provision bundled Desktop plugins at first launch

Status: implemented

English | [中文](2026-09-14-desktop-bundled-plugin-provisioning.zh.md)

## Problem

A Desktop release ships one fixed runtime plus the plugins its users install themselves. A distributor who wants every installation to carry a given third-party plugin has no supported path: the Desktop Host never reads the CLI `web` profile, the CLI rejects plugin management for the reserved `desktop` profile, and the shell keeps its bundled pnpm off `PATH` while owning the profile package-manager state. The [bundled-runtime decision](../architecture/2026-09-08-desktop-bundled-runtime-and-external-plugins.md) fixed first launch at profile metadata and host links, so nothing installed a plugin on the user's behalf either.

## Decision

[`apps/desktop/src/bundled-plugins.ts`](../../../../apps/desktop/src/bundled-plugins.ts) names the third-party plugins every fresh profile receives. `DesktopProjectManager.provisionPlugins` runs in the startup preparation slot, beside release reconciliation, where the backend is stopped by construction and the package transaction lock is held.

Provisioning installs each pending plugin at its pinned exact version through the bundled pnpm, with lifecycle scripts disabled. The plugin joins the profile bundle list only after the complete plugin graph validates, so a peer range the packaged runtime does not satisfy leaves the profile unchanged and the plugin dormant instead of blocking startup.

## Provisioning state

`desktop-provisioned-plugins.json` in the profile records the settled outcome for each plugin and runtime identity. A plugin is pending when it has no recorded outcome, when the packaged version changed, or when the profile was prepared against another runtime.

A settled entry is never pending again, so removing a plugin through the plugin window keeps it removed until the packaged version or the runtime identity changes. Resetting Desktop deletes the record with the rest of the profile, and the next start provisions again.

## Failure handling

A package-manager failure restores the manifest and lockfile captured before the install, discards the pending-package marker, and records no outcome. The retry therefore happens at the next start, and an offline first launch leaves a profile exactly as usable as it was before.

A plugin that installs but declares no `dsh.bundle.patch` is removed from the profile and recorded as unusable. A plugin whose graph validation fails stays installed and dormant, and is recorded as incompatible. Neither outcome blocks the backend from starting.

## Alternatives considered

**Vendor the plugin into the signed runtime.** The application would provision with no registry access, matching the offline goal of the bundled-runtime decision. It requires a bundled-plugin category in the runtime descriptor and the plugin-graph validator, a runtime schema change, and redistributing the plugin's bytes with its license and notice obligations. Lost because the application already needs network access to reach a model provider, and because the signing and inventory path would grow for a plugin the user may remove.

**Run `dsh plugin --profile web add <package>` from the packaged application.** This is the documented CLI path for external plugins. It cannot reach the Desktop profile on three independent counts: the Desktop Host loads `$DSH_HOME/profiles/desktop` through `loadProfileDirectory` rather than CLI profile lookup, the CLI rejects `--profile desktop` as Electron-managed, and the shell keeps its bundled pnpm off `PATH` while owning the profile package-manager state.

**Ship a pre-populated profile directory.** `$DSH_HOME` resolves to the operating-system user home, so a profile prepared on a build machine stays there and does not travel inside an installer.

**Leave provisioning to the plugin window.** This needs no code and keeps the user in control, but a distributor cannot then promise that a recipient has the plugin.

## Consequences

A fresh Desktop profile receives the listed plugins without user action, at versions the release pins. The first launch that has to provision needs access to the npm registry; without it the application starts without that plugin and retries at the next start. The plugin set is a release input, so changing it is a source change reviewed with the release.

Provisioning reuses the plugin-install machinery that the plugin window drives and adds no second package-manager path. [`apps/desktop/tests/bundled-plugin-provisioning.spec.ts`](../../../../apps/desktop/tests/bundled-plugin-provisioning.spec.ts) covers installation, idempotence, removal, an incompatible peer, an undeclared bundle, and an unreachable registry against a real pnpm and a fixture registry.
