import type { VersionInfo } from '@shared/domain/skill'
import type { ResolveContext } from './types'
import type { StrategyRegistry } from './registry'
import { logger } from '../logger'

const UNKNOWN: VersionInfo = {
  installedVersion: null,
  latestVersion: null,
  hasUpdate: false,
  resolvedBy: null,
  unknown: true
}

/**
 * Фасад определения версии: перебирает стратегии по приоритету, использует первую
 * применимую, вернувшую latest. installed и latest берутся из одной стратегии (Q3-01).
 */
export class VersionResolver {
  constructor(private readonly registry: StrategyRegistry) {}

  async resolve(ctx: ResolveContext): Promise<VersionInfo> {
    for (const strategy of this.registry.ordered()) {
      if (!strategy.isApplicable(ctx)) continue
      try {
        const latestVersion = await strategy.resolveLatest(ctx)
        if (latestVersion === null) continue
        const installedVersion = await strategy.resolveInstalled(ctx)
        return {
          installedVersion,
          latestVersion,
          hasUpdate: strategy.compare(installedVersion, latestVersion),
          resolvedBy: strategy.id,
          unknown: false
        }
      } catch (err) {
        logger.warn(`Стратегия версии ${strategy.id} не сработала для ${ctx.skillId}`, err)
      }
    }
    return { ...UNKNOWN }
  }
}
