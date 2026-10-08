export const PROJECT_FORMAT = 'GemCutDesignerProject'
export const PROJECT_VERSION = 1

function clone(value) { return JSON.parse(JSON.stringify(value)) }

export function serializeProject(workspace) {
  if (!workspace?.design?.tiers?.length) throw new Error('项目缺少可保存的宝石设计')
  return JSON.stringify({
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    appVersion: '6.16',
    savedAt: new Date().toISOString(),
    workspace: clone(workspace),
  }, null, 2)
}

export function parseProject(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('项目文件为空')
  let payload
  try { payload = JSON.parse(text) }
  catch { throw new Error('项目文件不是有效的 JSON') }
  if (payload?.format !== PROJECT_FORMAT) throw new Error('不是 Gem Cut Designer 项目文件')
  if (payload.version !== PROJECT_VERSION) throw new Error(`不支持的项目版本：${payload.version ?? '未知'}`)
  const workspace = payload.workspace
  if (!workspace?.design?.tiers?.length || !Number.isFinite(workspace.design.gear)) throw new Error('项目中的琢型数据不完整')
  if (workspace.roughMesh) {
    const positions = workspace.roughMesh.positions
    if (!Array.isArray(positions) || positions.length < 9 || positions.length % 9 || positions.length > 900000 || positions.some(value => !Number.isFinite(value))) throw new Error('项目中的原石网格数据无效')
  }
  return { ...payload, workspace: clone(workspace) }
}
