import type { CatalogEntry } from '@shared/domain/skill'
import type { AppConfig } from '@shared/domain/config'
import { isRiskyAudit } from '@shared/domain/audit'
import { api } from './api'
import { toasts } from './stores/toasts.svelte'
import { riskLabel, auditProviderLabel } from './labels'

/**
 * Установка skill с проверкой аудита безопасности (skills.sh): при риске medium и выше
 * запрашивает нативное подтверждение с перечнем провайдеров и рисков.
 */
export async function installWithAuditGuard(entry: CatalogEntry, cfg: AppConfig): Promise<void> {
  await toasts.guard(async () => {
    const audit = await api.catalog.audit(entry.id)
    if (isRiskyAudit(audit) && audit) {
      const detail = audit.providers
        .map((p) => `${auditProviderLabel(p.provider)}: ${riskLabel(p.risk)}`)
        .join('\n')
      const ok = await api.dialog.confirm({
        message: `«${entry.name}»: предупреждения безопасности (${riskLabel(audit.worstRisk)}).`,
        detail: `${detail}\n\nВсё равно установить?`,
        confirmLabel: 'Установить'
      })
      if (!ok) return
    }
    await api.install.run({
      skillId: entry.id,
      sourceId: entry.sourceId,
      sourceRef: entry.sourceRef,
      targetAgents: cfg.install.targetAgents,
      scope: cfg.install.scope,
      force: false
    })
  }, 'Не удалось запустить установку')
}
