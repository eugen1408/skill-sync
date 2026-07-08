import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { lstat, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildOfficialInvocation,
  assertSafeToken,
  detectAlreadyInstalled,
  PINNED_SKILLS_VERSION
} from '../src/main/installer/exec'
import { InstallerRegistry } from '../src/main/installer/registry'
import { InstallerService } from '../src/main/installer/InstallerService'
import { OfficialProvider } from '../src/main/installer/providers/official'
import { GitProvider } from '../src/main/installer/providers/git'
import { LocalFolderProvider } from '../src/main/installer/providers/local'
import { reconcileAgents } from '../src/main/installer/agentReconciler'
import { installFromFolder } from '../src/main/installer/fileInstall'
import type { PathContext } from '../src/main/installer/paths'
import type { ResolvedInstall } from '../src/main/installer/types'
import type { JobContext } from '../src/main/jobs/JobRunner'
import { getAgent } from '../src/shared/domain/agent'
import type { Source, SourceType } from '../src/shared/domain/source'

const CLAUDE = getAgent('claude-code')!
const CURSOR = getAgent('cursor')!

function jobCtx(): JobContext {
  return {
    jobId: 'test',
    signal: new AbortController().signal,
    progress() {},
    log() {},
    throwIfCancelled() {}
  }
}

describe('exec helpers', () => {
  it('строит npx-инвокацию с pinned-версией и флагами агентов', () => {
    const { command, args } = buildOfficialInvocation({
      sourceRef: 'owner/repo@skill',
      agents: ['claude-code', 'cursor'],
      scope: 'global',
      force: true,
      cliPath: null
    })
    expect(command).toMatch(/npx/)
    expect(args).toContain(`skills@${PINNED_SKILLS_VERSION}`)
    expect(args.slice(args.indexOf('add'))).toEqual([
      'add',
      'owner/repo@skill',
      '-g',
      '-y',
      '--force',
      '-a',
      'claude-code',
      '-a',
      'cursor'
    ])
  })

  it('использует явный путь к CLI вместо npx', () => {
    const { command, args } = buildOfficialInvocation({
      sourceRef: 'o/r',
      agents: ['claude-code'],
      scope: 'project',
      force: false,
      cliPath: '/usr/local/bin/skills'
    })
    expect(command).toBe('/usr/local/bin/skills')
    expect(args[0]).toBe('add')
    // project — дефолт CLI: флага `-p` у `add` нет, `-g` тоже не передаём.
    expect(args).not.toContain('-p')
    expect(args).not.toContain('-g')
  })

  it('cliFlag агентов совпадает с ключами CLI (gemini-cli / github-copilot)', () => {
    expect(getAgent('gemini')?.cliFlag).toBe('gemini-cli')
    expect(getAgent('copilot')?.cliFlag).toBe('github-copilot')
    expect(getAgent('claude-code')?.cliFlag).toBe('claude-code')
  })

  it('отклоняет небезопасные токены', () => {
    expect(() => assertSafeToken('owner/repo@skill')).not.toThrow()
    expect(() => assertSafeToken('foo; rm -rf /')).toThrow()
  })

  it('детектирует «already installed»', () => {
    expect(detectAlreadyInstalled('Skill already installed, skipping')).toBe(true)
    expect(detectAlreadyInstalled('Installing…')).toBe(false)
  })
})

describe('InstallerRegistry', () => {
  it('выбирает провайдера по типу источника', () => {
    const reg = new InstallerRegistry()
      .register(new OfficialProvider())
      .register(new GitProvider({} as never))
      .register(new LocalFolderProvider())
    expect(reg.resolve('official').id).toBe('official')
    expect(reg.resolve('git').id).toBe('git')
    expect(reg.resolve('local').id).toBe('local')
    expect(() => reg.resolve('s3' as SourceType)).toThrow()
  })
})

describe('InstallerService.previewReconcile', () => {
  function service(installedNames: string[]): InstallerService {
    const items = installedNames.map((name) => ({
      name,
      installations: [{ agent: 'claude-code', installPath: `/x/${name}` }]
    }))
    return new InstallerService({
      jobRunner: {} as never,
      sourceManager: {} as never,
      skillRegistry: { query: () => ({ items, total: items.length }) } as never,
      configStore: { get: () => ({ install: {} }) } as never,
      registry: {} as never,
      onResult: () => {}
    })
  }

  it('строит операции link/unlink для добавленных/снятых агентов', () => {
    const preview = service(['a', 'b']).previewReconcile({
      previousAgents: ['claude-code'],
      nextAgents: ['claude-code', 'cursor'],
      scope: 'global'
    })
    expect(preview.addedAgents).toEqual(['cursor'])
    expect(preview.removedAgents).toEqual([])
    expect(preview.skillCount).toBe(2)
    expect(preview.ops).toHaveLength(2)
    expect(preview.ops.every((o) => o.action === 'link' && o.agent === 'cursor')).toBe(true)
  })

  it('без изменений агентов операций нет', () => {
    const preview = service(['a']).previewReconcile({
      previousAgents: ['claude-code'],
      nextAgents: ['claude-code'],
      scope: 'global'
    })
    expect(preview.ops).toHaveLength(0)
  })
})

describe('InstallerService.previewInstall', () => {
  let base: string
  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'skillsync-prev-'))
  })
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  function service(): InstallerService {
    return new InstallerService({
      jobRunner: {} as never,
      sourceManager: { get: () => ({ id: 's', type: 'local' }) } as never,
      skillRegistry: { get: () => ({ name: 'foo' }) } as never,
      configStore: { get: () => ({ install: { installDir: base } }) } as never,
      registry: {} as never,
      onResult: () => {}
    })
  }

  const req = {
    skillId: 's:foo',
    sourceId: 's',
    sourceRef: '.',
    targetAgents: ['claude-code'],
    scope: 'global' as const,
    force: true
  }

  it('помечает replace-folder, если на месте агента реальная папка', async () => {
    mkdirSync(join(base, '.claude', 'skills', 'foo'), { recursive: true })
    const preview = await service().previewInstall(req)
    expect(preview.replacesRealFolders).toBe(true)
    expect(preview.ops.find((o) => o.agent === 'claude-code')?.action).toBe('replace-folder')
  })

  it('для отсутствующего пути агента — create-symlink без замены реальной папки', async () => {
    const preview = await service().previewInstall(req)
    expect(preview.replacesRealFolders).toBe(false)
    expect(preview.ops.find((o) => o.agent === 'claude-code')?.action).toBe('create-symlink')
  })

  it('official-источник не даёт файловых операций (ФС управляет CLI)', async () => {
    const svc = new InstallerService({
      jobRunner: {} as never,
      sourceManager: { get: () => ({ id: 'official', type: 'official' }) } as never,
      skillRegistry: { get: () => ({ name: 'foo' }) } as never,
      configStore: { get: () => ({ install: { installDir: base } }) } as never,
      registry: {} as never,
      onResult: () => {}
    })
    const preview = await svc.previewInstall({ ...req, sourceId: 'official' })
    expect(preview.ops).toHaveLength(0)
    expect(preview.replacesRealFolders).toBe(false)
  })
})

describe('файловая установка и реконсиляция', () => {
  let base: string
  let pathCtx: PathContext
  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'skillsync-inst-'))
    pathCtx = { scope: 'global', home: base, cwd: base }
  })
  afterEach(() => rmSync(base, { recursive: true, force: true }))

  function resolved(skillFolder: string, force = false): ResolvedInstall {
    return {
      request: {
        skillId: 's:foo',
        sourceId: 's',
        sourceRef: '.',
        targetAgents: ['claude-code'],
        scope: 'global',
        force
      },
      source: { config: { localPath: skillFolder } } as unknown as Source,
      skillName: 'foo',
      sourceRef: '.',
      agents: [CLAUDE],
      pathCtx,
      cliPath: null,
      npmRegistry: null
    }
  }

  it('installFromFolder копирует в канон и линкует агента; повтор → skipped', async () => {
    const src = join(base, 'src-foo')
    mkdirSync(src, { recursive: true })
    writeFileSync(join(src, 'SKILL.md'), '---\nname: foo\n---\n')

    const r1 = await installFromFolder(src, resolved(src), jobCtx())
    expect(r1.status).toBe('ok')
    const canonical = join(base, '.agents', 'skills', 'foo')
    const agentLink = join(base, '.claude', 'skills', 'foo')
    expect((await lstat(canonical)).isDirectory()).toBe(true)
    expect(await readFile(join(agentLink, 'SKILL.md'), 'utf8')).toContain('name: foo')

    const r2 = await installFromFolder(src, resolved(src, false), jobCtx())
    expect(r2.status).toBe('skipped')
  })

  it('reconcileAgents линкует добавленных агентов и снимает удалённых (идемпотентно)', async () => {
    // Готовим канон.
    const canonicalParent = join(base, '.agents', 'skills')
    mkdirSync(join(canonicalParent, 'foo'), { recursive: true })
    writeFileSync(join(canonicalParent, 'foo', 'SKILL.md'), 'x')

    const skills = [{ name: 'foo', installPaths: [] }]

    // Добавляем cursor.
    const s1 = await reconcileAgents(skills, [CURSOR], [], pathCtx)
    expect(s1.linked).toBe(1)
    const cursorLink = join(base, CURSOR.globalDir, 'foo')
    expect(await readFile(join(cursorLink, 'SKILL.md'), 'utf8')).toBe('x')

    // Идемпотентность.
    const s2 = await reconcileAgents(skills, [CURSOR], [], pathCtx)
    expect(s2.linked).toBe(1)

    // Снимаем cursor.
    const s3 = await reconcileAgents(skills, [], [CURSOR], pathCtx)
    expect(s3.unlinked).toBe(1)
    await expect(lstat(cursorLink)).rejects.toThrow()
    // Канон не тронут.
    expect((await lstat(join(canonicalParent, 'foo'))).isDirectory()).toBe(true)
  })
})
