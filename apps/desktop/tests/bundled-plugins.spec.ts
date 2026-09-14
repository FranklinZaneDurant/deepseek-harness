import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BUNDLED_PLUGINS,
  DESKTOP_PROVISIONED_FILE,
  assertBundledPlugins,
  pendingBundledPlugins,
  readProvisionedPlugins,
  writeProvisionedPlugins,
  type DesktopProvisionedState,
} from '../src/bundled-plugins.ts'

const roots: string[] = []

function profileDirectory(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'desktop-bundled-plugins-')))
  roots.push(root)
  return root
}

function state(entry: { readonly version: string; readonly runtimeId: string }): DesktopProvisionedState {
  return {
    schemaVersion: 1,
    plugins: [{ name: 'bundled-fixture', version: entry.version, runtimeId: entry.runtimeId, outcome: 'installed' }],
  }
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('assertBundledPlugins', () => {
  it('accepts the packaged list', () => {
    expect(() => { assertBundledPlugins(BUNDLED_PLUGINS) }).not.toThrow()
  })

  it('rejects a non-package name, a range instead of an exact version, and a duplicate', () => {
    expect(() => { assertBundledPlugins([{ name: 'Not A Name', version: '1.0.0' }]) }).toThrow(/invalid package name/u)
    expect(() => { assertBundledPlugins([{ name: 'fixture', version: '^1.0.0' }]) }).toThrow(/must pin an exact version/u)
    expect(() => { assertBundledPlugins([{ name: 'fixture', version: '1.0.0' }, { name: 'fixture', version: '1.0.0' }]) })
      .toThrow(/duplicate package/u)
  })
})

describe('provisioning record', () => {
  it('reads empty state for a profile with no record and round-trips settled outcomes', () => {
    const profile = profileDirectory()
    expect(readProvisionedPlugins(profile)).toEqual({ schemaVersion: 1, plugins: [] })
    writeProvisionedPlugins(profile, state({ version: '1.0.0', runtimeId: 'a'.repeat(64) }))
    expect(readProvisionedPlugins(profile).plugins).toHaveLength(1)
    expect(JSON.parse(readFileSync(join(profile, DESKTOP_PROVISIONED_FILE), 'utf8'))).toMatchObject({ schemaVersion: 1 })
  })

  it('fails loud on malformed state instead of reprovisioning every start', () => {
    const profile = profileDirectory()
    writeFileSync(join(profile, DESKTOP_PROVISIONED_FILE), '{"schemaVersion":2,"plugins":[]}\n')
    expect(() => readProvisionedPlugins(profile)).toThrow(/invalid provisioning record/u)
    writeFileSync(join(profile, DESKTOP_PROVISIONED_FILE), JSON.stringify({
      schemaVersion: 1, plugins: [{ name: 'fixture', version: '1.0.0', runtimeId: 'x', outcome: 'pending' }],
    }))
    expect(() => readProvisionedPlugins(profile)).toThrow(/invalid provisioning record entry/u)
    writeFileSync(join(profile, DESKTOP_PROVISIONED_FILE), JSON.stringify({
      schemaVersion: 1,
      plugins: [
        { name: 'fixture', version: '1.0.0', runtimeId: 'x', outcome: 'installed' },
        { name: 'fixture', version: '1.0.0', runtimeId: 'x', outcome: 'installed' },
      ],
    }))
    expect(() => readProvisionedPlugins(profile)).toThrow(/duplicate provisioning record/u)
  })
})

describe('pendingBundledPlugins', () => {
  const bundled = [{ name: 'bundled-fixture', version: '1.0.0' }] as const

  it('treats a plugin with no record as pending', () => {
    expect(pendingBundledPlugins({ schemaVersion: 1, plugins: [] }, 'a'.repeat(64), bundled)).toEqual(bundled)
  })

  it('skips a plugin whose settled outcome matches this version and runtime', () => {
    expect(pendingBundledPlugins(state({ version: '1.0.0', runtimeId: 'a'.repeat(64) }), 'a'.repeat(64), bundled)).toEqual([])
  })

  it('retries when the packaged version or the runtime identity changes', () => {
    expect(pendingBundledPlugins(state({ version: '0.9.0', runtimeId: 'a'.repeat(64) }), 'a'.repeat(64), bundled)).toEqual(bundled)
    expect(pendingBundledPlugins(state({ version: '1.0.0', runtimeId: 'b'.repeat(64) }), 'a'.repeat(64), bundled)).toEqual(bundled)
  })

  it('never revives a plugin the user settled and then removed', () => {
    const removed = state({ version: '1.0.0', runtimeId: 'a'.repeat(64) })
    expect(pendingBundledPlugins(removed, 'a'.repeat(64), bundled)).toEqual([])
  })
})
