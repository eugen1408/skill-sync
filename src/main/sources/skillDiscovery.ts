import { readdir, readFile } from 'node:fs/promises'
import { join, relative, dirname, sep, basename } from 'node:path'
import type { RawSkill } from '@shared/domain/source'

const SKIP_DIRS = new Set(['.git', 'node_modules', '.svn', '.hg'])
const MAX_DEPTH = 8

/**
 * Обнаруживает файлы SKILL.md в дереве каталога и парсит из frontmatter
 * name/description. Возвращает по одному RawSkill на найденный SKILL.md.
 * `sourceRef` — относительный (POSIX) путь папки skill внутри `rootDir`.
 */
export async function discoverSkills(rootDir: string): Promise<RawSkill[]> {
  const files: string[] = []
  await walk(rootDir, files, 0)
  const skills: RawSkill[] = []
  for (const file of files) {
    const content = await readFile(file, 'utf8').catch(() => '')
    const meta = parseFrontmatter(content)
    const skillDir = dirname(file)
    const relDir = relative(rootDir, skillDir).split(sep).join('/')
    skills.push({
      name: meta.name ?? basename(skillDir),
      description: meta.description ?? null,
      sourceRef: relDir === '' ? '.' : relDir,
      ref: null
    })
  }
  return skills
}

async function walk(dir: string, out: string[], depth: number): Promise<void> {
  if (depth > MAX_DEPTH) return
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => null)
  if (!entries) return
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      await walk(join(dir, entry.name), out, depth + 1)
    } else if (entry.isFile() && entry.name.toUpperCase() === 'SKILL.MD') {
      out.push(join(dir, entry.name))
    }
  }
}

interface SkillMeta {
  name: string | null
  description: string | null
}

/** Извлекает name/description из YAML-frontmatter SKILL.md (минимальный разбор). */
export function parseFrontmatter(content: string): SkillMeta {
  const meta: SkillMeta = { name: null, description: null }
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---/.exec(content)
  if (!match) return meta

  const lines = match[1].split(/\r?\n/)
  let currentKey: string | null = null
  let multilineValue: string[] = []
  let joinChar = '\n'

  const flush = () => {
    if (currentKey) {
      const val = multilineValue.join(joinChar).trim()
      if (currentKey === 'name') meta.name = stripQuotes(val) || null
      else if (currentKey === 'description') meta.description = stripQuotes(val) || null
    }
  }

  for (const line of lines) {
    if (currentKey && (line.startsWith(' ') || line.startsWith('\t') || line.trim() === '')) {
      if (line.trim() !== '') {
        multilineValue.push(line.trim())
      }
      continue
    }

    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line)
    if (kv) {
      flush()
      currentKey = kv[1].toLowerCase()
      const val = kv[2].trim()
      if (val.startsWith('>')) {
        joinChar = ' '
        multilineValue = []
      } else if (val.startsWith('|')) {
        joinChar = '\n'
        multilineValue = []
      } else {
        joinChar = '\n'
        multilineValue = [val]
      }
    } else {
      flush()
      currentKey = null
    }
  }
  flush()
  return meta
}

function stripQuotes(v: string): string {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1)
  }
  return v
}
