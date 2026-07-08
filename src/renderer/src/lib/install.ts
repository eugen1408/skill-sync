import type { CatalogEntry } from '@shared/domain/skill'
import type { AppConfig } from '@shared/domain/config'
import { isRiskyAudit } from '@shared/domain/audit'
import { api } from './api'
import { toasts } from './stores/toasts.svelte'
import { riskLabel, auditProviderLabel } from './labels'
import { t } from './i18n.svelte'

/**
 * Установка skill с проверкой аудита безопасности (skills.sh): при риске medium и выше
 * запрашивает нативное подтверждение с перечнем провайдеров и рисков.
 */
export async function installWithAuditGuard(
  entry: CatalogEntry,
  cfg: AppConfig,
  force = false
): Promise<void> {
  await toasts.guard(async () => {
    const audit = await api.catalog.audit(entry.id)
    if (isRiskyAudit(audit) && audit) {
      const detail = audit.providers
        .map((p) => `${auditProviderLabel(p.provider)}: ${riskLabel(p.risk)}`)
        .join('\n')
      const ok = await api.dialog.confirm({
        message: t('install.auditWarning', { name: entry.name, risk: riskLabel(audit.worstRisk) }),
        detail: t('install.auditDetail', { detail }),
        confirmLabel: t('install.installConfirm')
      })
      if (!ok) return
    }

    let targetAgents = cfg.install.targetAgents
    if (force && entry.installations.length > 0) {
      targetAgents = entry.installations.map((i) => i.agent)
    }

    const request = {
      skillId: entry.id,
      sourceId: entry.sourceId,
      sourceRef: entry.sourceRef,
      targetAgents: [...targetAgents],
      scope: cfg.install.scope,
      force
    }

    // Предпросмотр изменений структуры файлов: подтверждаем, если реальная папка
    // (напр. в ~/.codex/skills) будет заменена симлинком на канон (follow-up B1).
    if (entry.sourceType !== 'official') {
      const preview = await api.install.previewInstall(request)
      if (preview.replacesRealFolders) {
        const lines = preview.ops
          .filter((o) => o.replacesRealFolder)
          .map((o) => t('install.structureReplaceLine', { path: o.path }))
        const detail =
          t('install.structureCanonical', { path: preview.canonicalPath }) +
          '\n\n' +
          t('install.structureReplaceHeader') +
          '\n' +
          lines.join('\n')
        const ok = await api.dialog.confirm({
          message: t('install.structureWarning', { name: preview.skillName }),
          detail,
          confirmLabel: t('install.structureConfirm')
        })
        if (!ok) return
      }
    }

    await api.install.run(request)
  }, t('error.installStart'))
}

/** Удаление skill из всех агентов с нативным подтверждением. */
export async function uninstallWithConfirm(entry: CatalogEntry): Promise<void> {
  await toasts.guard(async () => {
    const agents = entry.installations.map((i) => i.agent).join(', ')
    const ok = await api.dialog.confirm({
      message: t('uninstall.confirmMessage', { name: entry.name }),
      detail: agents
        ? t('uninstall.confirmDetailAgents', { agents })
        : t('uninstall.confirmDetailAll'),
      confirmLabel: t('uninstall.confirmButton')
    })
    if (!ok) return
    await api.install.uninstall(entry.id)
  }, t('error.uninstallStart'))
}
