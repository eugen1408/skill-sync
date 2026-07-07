import { KNOWN_AGENTS } from './src/shared/domain/agent'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

export function getInstalledAgentIds(): string[] {
  const installed: string[] = []
  const homedir = os.homedir()
  for (const agent of KNOWN_AGENTS) {
    if (!agent.globalDir) continue
    const agentConfigDir = path.join(homedir, path.dirname(agent.globalDir))
    if (fs.existsSync(agentConfigDir)) {
      installed.push(agent.id)
    }
  }
  return installed
}
console.log(getInstalledAgentIds())
