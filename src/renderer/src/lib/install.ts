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

    await api.install.run({
      skillId: entry.id,
      sourceId: entry.sourceId,
      sourceRef: entry.sourceRef,
      targetAgents: [...targetAgents],
      scope: cfg.install.scope,
      force
    })
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
