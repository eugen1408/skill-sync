import type { IpcApi, CatalogPage, CatalogEntry } from '@shared/ipc/contract'
import type { Source, RawSkill } from '@shared/domain/source'
import { getSourceDomain } from '@shared/domain/source'

const FAKE_SKILL_NAMES = [
  'React Code Mod',
  'Python Formatter',
  'K8s Deployment Tool',
  'Docker Image Builder',
  'GraphQL Generator',
  'SQL Migrator',
  'MongoDB Connector',
  'Redis Cache Manager',
  'Tailwind UI Components',
  'Svelte Store Syncer',
  'Next.js Route Builder',
  'Jest Test Runner',
  'Cypress E2E',
  'Webpack Optimizer',
  'Vite Scaffolder',
  'Bash Script Helper',
  'Nginx Configurator',
  'AWS S3 Uploader',
  'GCP Cloud Run Deployer',
  'Terraform State Manager',
  'Git Commit Linter',
  'CI/CD Pipeline Builder',
  'ESLint Custom Rules',
  'Rust Analyzer',
  'Go Linter',
  'Spring Boot Init',
  'Django ORM Helper',
  'Flutter Widget Gen'
]

const FAKE_REPO_URLS = [
  'git@github.com:dev-team/internal-scripts.git',
  'https://gitlab.com/company/ci-cd-templates',
  'git@github.com:open-source/awesome-tools.git',
  'https://github.com/my-org/backend-services'
]

const fakeNameMap = new Map<string, string>()
const fakeDescMap = new Map<string, string>()
const fakeRepoMap = new Map<string, string>()

let nameIndex = 0
let repoIndex = 0

const KNOWN_FRAMEWORKS = new Set([
  'react', 'vue', 'python', 'java', 'nodejs', 'svelte', 'docker', 'kubernetes', 'bash', 
  'jest', 'swift', 'android', 'apple', 'typescript', 'javascript', 'go', 'golang', 'rust'
])

function getFakeName(realName: string, sourceId: string): string {
  if (sourceId === 'official') return realName // Usually skills.sh source ID is "official"
  if (KNOWN_FRAMEWORKS.has(realName.toLowerCase())) return realName
  if (fakeNameMap.has(realName)) return fakeNameMap.get(realName)!
  const fakeName = FAKE_SKILL_NAMES[nameIndex % FAKE_SKILL_NAMES.length]
  nameIndex++
  fakeNameMap.set(realName, fakeName)
  return fakeName
}

const fakeIdMap = new Map<string, string>()
const realIdMap = new Map<string, string>()

function maskSkillId(realId: string, fakeName: string): string {
  if (fakeIdMap.has(realId)) return fakeIdMap.get(realId)!
  const parts = realId.split(':')
  if (parts.length < 2 || parts[0] === 'official') {
    return realId // Do not mask official ones or malformed ones
  }
  const fakeSlug = fakeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const fakeId = `${parts[0]}:${fakeSlug}`
  fakeIdMap.set(realId, fakeId)
  realIdMap.set(fakeId, realId)
  return fakeId
}

function unmaskSkillId(fakeId: string): string {
  return realIdMap.get(fakeId) || fakeId
}

function getFakeDesc(realName: string, sourceId: string): string {
  if (sourceId === 'official:skills.sh') return '' // Preserve official desc or fake it? User says "не должно остаться какой-то инфы", official skills are public, so keeping them is fine.
  if (fakeDescMap.has(realName)) return fakeDescMap.get(realName)!
  const fakeDesc = `Automated tool for ${getFakeName(realName, sourceId).toLowerCase()} operations and workflow enhancements.`
  fakeDescMap.set(realName, fakeDesc)
  return fakeDesc
}

function getFakeRepo(realUrl: string): string {
  if (fakeRepoMap.has(realUrl)) return fakeRepoMap.get(realUrl)!
  const fakeUrl = FAKE_REPO_URLS[repoIndex % FAKE_REPO_URLS.length]
  repoIndex++
  fakeRepoMap.set(realUrl, fakeUrl)
  return fakeUrl
}

function maskCatalogEntry(entry: CatalogEntry): CatalogEntry {
  if (entry.sourceId === 'official') return entry // keep official ones real
  const fakeName = getFakeName(entry.name, entry.sourceId)
  return {
    ...entry,
    id: maskSkillId(entry.id, fakeName),
    name: fakeName,
    description: getFakeDesc(entry.name, entry.sourceId)
  }
}

function maskSource(source: Source): Source {
  if (source.id === 'official' || source.id === 'official:skills.sh') return source
  
  const maskedConfig = { ...source.config }
  let fakeSourceName = ''

  if (maskedConfig.url) {
    maskedConfig.url = getFakeRepo(maskedConfig.url)
    fakeSourceName = maskedConfig.url.split('/').pop()?.replace('.git', '') || 'Git Repo'
  }
  if (maskedConfig.localPath) {
    const fakeDir = getFakeName(source.id, '').replace(/\s+/g, '-').toLowerCase()
    maskedConfig.localPath = `/Users/demo/workspace/${fakeDir}`
    fakeSourceName = fakeDir
  }

  return {
    ...source,
    name: fakeSourceName || getFakeName(source.name, source.id),
    config: maskedConfig
  }
}

function maskRawSkill(skill: RawSkill, sourceId: string): RawSkill {
  return {
    ...skill,
    name: getFakeName(skill.name, sourceId),
    description: getFakeDesc(skill.name, sourceId)
  }
}

const domainSourceLimits = new Map<string, number>()
const domainSkillLimits = new Map<string, number>()

function getLimitForDomainSource(domain: string): number {
  if (domain === 'skills.sh' || domain === 'official' || domain === 'official:skills.sh') return 9999
  if (!domainSourceLimits.has(domain)) {
    domainSourceLimits.set(domain, Math.floor(Math.random() * 2) + 2) // 2-3
  }
  return domainSourceLimits.get(domain)!
}

function getLimitForDomainSkill(domain: string): number {
  if (domain === 'skills.sh' || domain === 'official' || domain === 'official:skills.sh') return 9999
  if (!domainSkillLimits.has(domain)) {
    domainSkillLimits.set(domain, Math.floor(Math.random() * 2) + 2) // 2-3
  }
  return domainSkillLimits.get(domain)!
}

export function wrapApiForDemo(realApi: IpcApi): IpcApi {
  console.warn('--- RUNNING IN DEMO MODE ---')
  return {
    ...realApi,
    catalog: {
      ...realApi.catalog,
      query: async (query) => {
        const sources = await realApi.source.list()
        const sourceDomainMap = new Map<string, string>()
        sources.forEach(s => sourceDomainMap.set(s.id, getSourceDomain(s)))

        const page = await realApi.catalog.query(query)
        const domainCounts = new Map<string, number>()
        
        const filteredItems = page.items.filter(entry => {
          const domain = sourceDomainMap.get(entry.sourceId) || 'unknown'
          const limit = getLimitForDomainSkill(domain)
          const count = domainCounts.get(domain) || 0
          if (count >= limit) return false
          domainCounts.set(domain, count + 1)
          return true
        })

        return {
          ...page,
          items: filteredItems.map(maskCatalogEntry),
          total: filteredItems.length
        }
      },
      get: async (id) => {
        const entry = await realApi.catalog.get(unmaskSkillId(id))
        if (!entry) return entry
        return maskCatalogEntry(entry)
      },
      audit: async (id) => realApi.catalog.audit(unmaskSkillId(id)),
      officialUrl: async (id) => realApi.catalog.officialUrl(unmaskSkillId(id)),
      readme: async (id) => realApi.catalog.readme(unmaskSkillId(id)),
      canonicalPath: async (id) => realApi.catalog.canonicalPath(unmaskSkillId(id)),
      repoUrl: async (id) => realApi.catalog.repoUrl(unmaskSkillId(id))
    },
    install: {
      ...realApi.install,
      run: async (req) => realApi.install.run({ ...req, skillId: unmaskSkillId(req.skillId) }),
      uninstall: async (id) => realApi.install.uninstall(unmaskSkillId(id)),
    },
    update: {
      ...realApi.update,
      checkOne: async (id) => realApi.update.checkOne(unmaskSkillId(id)),
      runOne: async (id) => realApi.update.runOne(unmaskSkillId(id)),
    },
    source: {
      ...realApi.source,
      list: async () => {
        const sources = await realApi.source.list()
        const domainCounts = new Map<string, number>()
        const filteredSources = sources.filter(s => {
          if (s.id === 'official' || s.id === 'official:skills.sh') return true
          const domain = getSourceDomain(s)
          const limit = getLimitForDomainSource(domain)
          const count = domainCounts.get(domain) || 0
          if (count >= limit) return false
          domainCounts.set(domain, count + 1)
          return true
        })
        return filteredSources.map(maskSource)
      },
      listSkills: async (id) => {
        if (id === 'official' || id === 'official:skills.sh') return realApi.source.listSkills(id)
        const skills = await realApi.source.listSkills(id)
        return skills.slice(0, Math.floor(Math.random() * 2) + 2).map(s => maskRawSkill(s, id))
      }
    }
  }
}
