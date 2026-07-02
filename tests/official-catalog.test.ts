import { describe, it, expect, vi } from 'vitest'
import { OfficialCatalog } from '../src/main/sources/officialCatalog'

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response
}

describe('OfficialCatalog.search', () => {
  it('короткий запрос (<2) не ходит в сеть', async () => {
    const fetchFn = vi.fn()
    const cat = new OfficialCatalog(() => 'https://skills.sh', fetchFn as never)
    expect(await cat.search('a')).toEqual([])
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('маппит ответ /api/search в OfficialSkill (sourceRef owner/repo@slug)', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({
        skills: [
          {
            name: 'react-best',
            skillId: 'react-best',
            source: 'vercel-labs/agent-skills',
            installs: 5
          }
        ]
      })
    )
    const cat = new OfficialCatalog(() => 'https://skills.sh', fetchFn as never)
    const res = await cat.search('react')
    expect(fetchFn).toHaveBeenCalledOnce()
    expect(res).toEqual([
      {
        name: 'react-best',
        slug: 'react-best',
        source: 'vercel-labs/agent-skills',
        sourceRef: 'vercel-labs/agent-skills@react-best',
        installs: 5
      }
    ])
  })

  it('кэширует повторный запрос', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ skills: [] }))
    const cat = new OfficialCatalog(() => 'https://skills.sh', fetchFn as never)
    await cat.search('react')
    await cat.search('react')
    expect(fetchFn).toHaveBeenCalledOnce()
  })

  it('ошибка сети → пустой список', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('network')
    })
    const cat = new OfficialCatalog(() => 'https://skills.sh', fetchFn as never)
    expect(await cat.search('react')).toEqual([])
  })
})

describe('OfficialCatalog.repoPublished', () => {
  const body = {
    skills: [{ name: 'react-best', skillId: 'react-best', source: 'vercel-labs/agent-skills' }]
  }

  it('true — репозиторий найден в каталоге (сопоставление source)', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(body))
    const cat = new OfficialCatalog(() => 'https://skills.sh', fetchFn as never)
    expect(await cat.repoPublished('vercel-labs/agent-skills', 'react-best')).toBe(true)
  })

  it('false — поиск успешен, но репозиторий не совпал', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(body))
    const cat = new OfficialCatalog(() => 'https://skills.sh', fetchFn as never)
    expect(await cat.repoPublished('eugen1408/analyst', 'analyst')).toBe(false)
  })

  it('null — сеть недоступна (не false, чтобы не свапать по ошибке сети)', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('network')
    })
    const cat = new OfficialCatalog(() => 'https://skills.sh', fetchFn as never)
    expect(await cat.repoPublished('o/r', 'analyst')).toBeNull()
  })

  it('null — HTTP-ошибка', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 500 }) as unknown as Response)
    const cat = new OfficialCatalog(() => 'https://skills.sh', fetchFn as never)
    expect(await cat.repoPublished('o/r', 'analyst')).toBeNull()
  })
})
