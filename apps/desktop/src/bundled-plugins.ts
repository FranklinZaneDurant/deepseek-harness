/** Packaged third-party plugins the Desktop shell installs into its reserved profile. */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** One plugin the packaged application provisions into the reserved Desktop profile. */
export interface BundledPlugin {
  readonly name: string
  readonly version: string
}

/** Profile-relative file recording settled provisioning outcomes. */
export const DESKTOP_PROVISIONED_FILE = 'desktop-provisioned-plugins.json'

/**
 * Plugins every fresh Desktop profile receives.
 *
 * This list is a release input: an entry reaches fresh profiles and every
 * profile whose recorded runtime identity changes. Deleting an entry never
 * uninstalls the package from an existing profile.
 */
export const BUNDLED_PLUGINS: readonly BundledPlugin[] = [
  { name: '@huiliyi37/dsh-office', version: '0.2.2' },
]

/**
 * Settled result of one provisioning attempt.
 *
 * `installed` activated the plugin in the profile. `unusable` means the
 * installed bytes cannot serve as a profile plugin: no manifest, a version
 * mismatch, or no `dsh.bundle.patch` declaration. `incompatible` means the
 * installed package declares a bundle but the profile plugin graph rejects it,
 * which includes a peer range the packaged runtime does not satisfy.
 */
export type DesktopProvisionOutcome = 'installed' | 'unusable' | 'incompatible'

/** Durable outcome of one bundled plugin against one runtime identity. */
export interface DesktopProvisionRecord {
  readonly name: string
  readonly version: string
  readonly runtimeId: string
  readonly outcome: DesktopProvisionOutcome
  readonly detail?: string
}

/** Durable provisioning state of one Desktop profile. */
export interface DesktopProvisionedState {
  readonly schemaVersion: 1
  readonly plugins: readonly DesktopProvisionRecord[]
}

/** Outcome returned for an attempt that installed nothing because the package manager failed. */
export interface DesktopProvisionUnavailable {
  readonly name: string
  readonly version: string
  readonly outcome: 'unavailable'
  readonly detail: string
}

/** One returned provisioning result; only settled results are persisted. */
export type DesktopProvisionResult = DesktopProvisionRecord | DesktopProvisionUnavailable

const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._~-]*\/[a-z0-9][a-z0-9._~-]*|[a-z0-9][a-z0-9._~-]*)$/u
const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.+_-]*$/u
const OUTCOMES: readonly string[] = ['installed', 'unusable', 'incompatible']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertBundledPlugin(plugin: BundledPlugin): void {
  if (!PACKAGE_NAME_PATTERN.test(plugin.name)) {
    throw new Error(`desktop bundled plugins: invalid package name ${JSON.stringify(plugin.name)}`)
  }
  if (!VERSION_PATTERN.test(plugin.version)) {
    throw new Error(`desktop bundled plugins: ${plugin.name} must pin an exact version, got ${JSON.stringify(plugin.version)}`)
  }
}

/**
 * Reject a malformed bundled-plugin list before it reaches a release.
 * @param bundled - Candidate list.
 * @throws When a name is not a package name or a version is not exact.
 */
export function assertBundledPlugins(bundled: readonly BundledPlugin[]): void {
  const names = new Set<string>()
  for (const plugin of bundled) {
    assertBundledPlugin(plugin)
    if (names.has(plugin.name)) throw new Error(`desktop bundled plugins: duplicate package ${plugin.name}`)
    names.add(plugin.name)
  }
}

/**
 * Read settled provisioning outcomes. Malformed state fails loud rather than
 * silently reprovisioning every plugin on every start.
 * @param profile - Desktop profile directory.
 * @returns Validated state, or empty state for a profile with no record.
 */
export function readProvisionedPlugins(profile: string): DesktopProvisionedState {
  const path = join(profile, DESKTOP_PROVISIONED_FILE)
  if (!existsSync(path)) return { schemaVersion: 1, plugins: [] }
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.plugins)) {
    throw new Error(`desktop profile: invalid provisioning record ${path}`)
  }
  const plugins = value.plugins.map((entry: unknown): DesktopProvisionRecord => {
    if (!isRecord(entry) || typeof entry.name !== 'string' || !PACKAGE_NAME_PATTERN.test(entry.name)
      || typeof entry.version !== 'string' || typeof entry.runtimeId !== 'string'
      || typeof entry.outcome !== 'string' || !OUTCOMES.includes(entry.outcome)
      || (entry.detail !== undefined && typeof entry.detail !== 'string')) {
      throw new Error(`desktop profile: invalid provisioning record entry in ${path}`)
    }
    return {
      name: entry.name,
      version: entry.version,
      runtimeId: entry.runtimeId,
      outcome: entry.outcome as DesktopProvisionOutcome,
      ...(entry.detail === undefined ? {} : { detail: entry.detail }),
    }
  })
  if (new Set(plugins.map(plugin => plugin.name)).size !== plugins.length) {
    throw new Error(`desktop profile: duplicate provisioning record in ${path}`)
  }
  return { schemaVersion: 1, plugins }
}

/**
 * Replace the settled provisioning outcomes of one profile.
 * @param profile - Desktop profile directory.
 * @param state - Complete replacement state.
 */
export function writeProvisionedPlugins(profile: string, state: DesktopProvisionedState): void {
  writeFileSync(join(profile, DESKTOP_PROVISIONED_FILE), `${JSON.stringify(state, undefined, 2)}\n`, { mode: 0o600 })
}

/**
 * Select the bundled plugins this profile still has to settle.
 *
 * A plugin is pending when it has no recorded outcome, when the packaged
 * version changed, or when the profile was prepared against another runtime.
 * A settled entry is never pending again, so a plugin the user removed through
 * the plugin window stays removed until the release changes it.
 * @param state - Settled provisioning state of the profile.
 * @param runtimeId - Current runtime identity.
 * @param bundled - Packaged plugin list.
 * @returns Pending plugins in list order.
 */
export function pendingBundledPlugins(
  state: DesktopProvisionedState,
  runtimeId: string,
  bundled: readonly BundledPlugin[] = BUNDLED_PLUGINS,
): readonly BundledPlugin[] {
  return bundled.filter((plugin) => {
    const settled = state.plugins.find(entry => entry.name === plugin.name)
    return settled === undefined || settled.version !== plugin.version || settled.runtimeId !== runtimeId
  })
}
