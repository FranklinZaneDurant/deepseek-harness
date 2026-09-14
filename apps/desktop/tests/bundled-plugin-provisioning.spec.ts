import { createHash } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { c } from 'tar'
import { afterEach, expect, it } from 'vitest'
import { DesktopProjectManager, type DesktopProjectHooks } from '../src/project-manager.ts'
import { readProvisionedPlugins } from '../src/bundled-plugins.ts'
import { resolveDesktopPaths } from '../src/paths.ts'
import { runtimeFixture, writePackage } from './runtime-fixture.ts'

/** Manifest fields a fixture package can declare beyond its name and version. */
interface FixturePackage {
  readonly peerDependencies?: Record<string, string>
  readonly dsh?: Record<string, unknown>
}

interface Fixture {
  readonly root: string
  readonly server: Server
  readonly manager: DesktopProjectManager
  readonly registry: string
}

const fixtures: Fixture[] = []

const hooks: DesktopProjectHooks = { beforeChange: async () => {}, afterChange: async () => {} }

/**
 * Start a fixture registry and a Desktop manager whose bundled list is `bundled`.
 * @param packages - Package name to served manifest fields.
 * @param bundled - Plugin list this installation provisions.
 * @param version - dsh, shell, and shared-package version.
 * @returns Fixture handles, torn down by the suite.
 */
async function fixture(
  packages: Readonly<Record<string, FixturePackage>>,
  bundled: readonly { readonly name: string; readonly version: string }[],
  version = '1.0.0',
): Promise<Fixture> {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'desktop-provisioning-')))
  const archives = new Map<string, Buffer>()
  for (const [name, fields] of Object.entries(packages)) {
    const path = writePackage(join(root, 'packages'), name, { ...fields, version })
    writeFileSync(join(path, 'bundle.yml'), '[]\n')
    const tarball = join(root, `${name}.tgz`)
    await c({ file: tarball, cwd: join(path, '..'), gzip: true }, [name])
    archives.set(name, readFileSync(tarball))
  }
  const server = createServer()
  await new Promise<void>((settle, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', settle) })
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('fixture registry has no TCP address')
  const registry = `http://127.0.0.1:${address.port}`
  server.on('request', (request, response) => {
    const name = request.url?.slice(1).replace(/\.tgz$/u, '') ?? ''
    const archive = archives.get(name)
    if (archive === undefined) { response.writeHead(404); response.end(); return }
    if (request.url?.endsWith('.tgz')) { response.end(archive); return }
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({
      name,
      'dist-tags': { latest: version },
      versions: {
        [version]: {
          name,
          version,
          dist: { tarball: `${registry}/${name}.tgz`, integrity: `sha512-${createHash('sha512').update(archive).digest('base64')}` },
          ...packages[name],
        },
      },
      time: { [version]: '2020-01-01T00:00:00.000Z' },
    }))
  })
  const dsh = join(root, 'dsh')
  runtimeFixture(dsh, version)
  const pnpm = join(root, 'pnpm.mjs')
  const realPnpm = join(import.meta.dirname, '../node_modules/pnpm/bin/pnpm.mjs')
  writeFileSync(pnpm, `process.argv = process.argv.map(arg => arg === '--config.registry=https://registry.npmjs.org/' ? ${JSON.stringify(`--config.registry=${registry}`)} : arg); await import(${JSON.stringify(pathToFileURL(realPnpm).href)})`)
  const manager = new DesktopProjectManager(
    resolveDesktopPaths(join(root, '.dsh')), { node: process.execPath, pnpm, dsh }, bundled,
  )
  const created = { root, server, manager, registry }
  fixtures.push(created)
  return created
}

afterEach(async () => {
  for (const created of fixtures.splice(0)) {
    created.server.closeAllConnections()
    if (created.server.listening) {
      await new Promise<void>((settle, reject) => {
        created.server.close((error) => { if (error === undefined) settle(); else reject(error) })
      })
    }
    rmSync(created.root, { recursive: true, force: true })
  }
})

it('installs a bundled plugin into a fresh profile once and never revives a removal', async () => {
  const bundled = [{ name: 'bundled-fixture', version: '1.0.0' }]
  const created = await fixture({ 'bundled-fixture': { peerDependencies: { '@deepseek-ai/cordis': '^1.0.0' }, dsh: { bundle: { patch: 'bundle.yml' } } } }, bundled)
  await created.manager.applyRelease()
  const results = await created.manager.provisionPlugins()
  expect(results).toHaveLength(1)
  expect(results[0]).toMatchObject({ name: 'bundled-fixture', version: '1.0.0', outcome: 'installed' })
  const settled = readProvisionedPlugins(created.manager.paths.profile).plugins
  expect(settled).toHaveLength(1)
  expect(settled[0]?.runtimeId).toMatch(/^[a-f0-9]{64}$/u)
  expect(created.manager.listPlugins()).toEqual([{ name: 'bundled-fixture', version: '1.0.0', enabled: true }])
  expect(readFileSync(join(created.manager.paths.profile, 'package.json'), 'utf8')).toContain('"bundled-fixture": "1.0.0"')

  expect(await created.manager.provisionPlugins()).toEqual([])

  await created.manager.mutate({ type: 'plugin-remove', name: 'bundled-fixture' }, hooks)
  expect(created.manager.listPlugins()).toEqual([])
  expect(await created.manager.provisionPlugins()).toEqual([])
  expect(created.manager.listPlugins()).toEqual([])
}, 120_000)

it('leaves a usable profile and retries later when the package manager cannot install', async () => {
  const created = await fixture({}, [{ name: 'missing-fixture', version: '1.0.0' }])
  await created.manager.applyRelease()
  const manifest = readFileSync(join(created.manager.paths.profile, 'package.json'), 'utf8')
  const results = await created.manager.provisionPlugins()
  expect(results).toHaveLength(1)
  expect(results[0]).toMatchObject({ name: 'missing-fixture', outcome: 'unavailable' })
  expect(readFileSync(join(created.manager.paths.profile, 'package.json'), 'utf8')).toBe(manifest)
  expect(existsSync(join(created.manager.paths.profile, 'desktop-provisioned-plugins.json'))).toBe(false)
  expect(existsSync(join(created.manager.paths.profile, 'desktop-packages-pending'))).toBe(false)
  expect(await created.manager.applyRelease()).toBe(false)
  expect(created.manager.listPlugins()).toEqual([])
}, 120_000)

it('records an incompatible peer without activating the plugin or breaking startup', async () => {
  const bundled = [{ name: 'peer-fixture', version: '1.0.0' }]
  const created = await fixture({ 'peer-fixture': { peerDependencies: { '@deepseek-ai/cordis': '^9.0.0' }, dsh: { bundle: { patch: 'bundle.yml' } } } }, bundled)
  await created.manager.applyRelease()
  const results = await created.manager.provisionPlugins()
  expect(results).toHaveLength(1)
  expect(results[0]).toMatchObject({ name: 'peer-fixture', outcome: 'incompatible' })
  expect(created.manager.listPlugins()).toEqual([{ name: 'peer-fixture', version: '1.0.0', enabled: false }])
  expect(readFileSync(join(created.manager.paths.profile, 'desktop-provisioned-plugins.json'), 'utf8')).toContain('"incompatible"')
  expect(await created.manager.applyRelease()).toBe(false)
  expect(await created.manager.provisionPlugins()).toEqual([])
}, 120_000)

it('records a package that declares no bundle patch as unusable and removes it from the profile', async () => {
  const bundled = [{ name: 'plain-fixture', version: '1.0.0' }]
  const created = await fixture({ 'plain-fixture': {} }, bundled)
  await created.manager.applyRelease()
  const results = await created.manager.provisionPlugins()
  expect(results).toHaveLength(1)
  expect(results[0]).toMatchObject({ name: 'plain-fixture', outcome: 'unusable' })
  expect(created.manager.listPlugins()).toEqual([])
  expect(readFileSync(join(created.manager.paths.profile, 'package.json'), 'utf8')).not.toContain('plain-fixture')
}, 120_000)
