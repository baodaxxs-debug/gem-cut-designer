import { evaluateRoughFit } from './rough.js'
import { evaluateDefects } from './defects.js'
function candidateScore(fit, defects, settings) { const overflow = fit.maxOverflowMm ?? (fit.fits ? 0 : 10); return fit.outside * 1e6 + defects.conflicts * 2e5 + overflow * 1000 + Math.hypot(settings.offsetX, settings.offsetY, settings.offsetZ) }
export function optimizeRoughPlacement(model, modelScale, settings, defects = [], customMesh) {
  if (!model) throw new Error('当前没有可用于套料的成品模型')
  if (settings.shape === 'scan' && customMesh?.triangleCount > 3000) throw new Error('扫描网格超过 3000 面，请先简化网格再使用自动套料')
  let tested = 0; const seen = new Set()
  const evaluate = candidate => { const normalized = { ...candidate, visible: true }; const key = ['rotationX','rotationY','rotationZ','offsetX','offsetY','offsetZ'].map(field => Number(normalized[field]).toFixed(4)).join('|'); if (seen.has(key)) return null; seen.add(key); tested += 1; const fit = evaluateRoughFit(model, modelScale, normalized, customMesh), defectReport = evaluateDefects(model, modelScale, normalized, defects); return { settings: normalized, fit, defectReport, score: candidateScore(fit, defectReport, normalized) } }
  const baseline = evaluate(settings); let best = baseline
  const consider = candidate => { const result = evaluate(candidate); if (result && result.score < best.score) best = result }
  const tilts = settings.shape === 'scan' ? [0] : [-20, 0, 20], yawStep = settings.shape === 'scan' ? 30 : 15
  for (const x of tilts) for (let y = 0; y < 180; y += yawStep) for (const z of tilts) consider({ ...settings, rotationX: x, rotationY: y, rotationZ: z })
  const axes = [['offsetX', settings.length], ['offsetY', settings.height], ['offsetZ', settings.width]]
  axes.forEach(([field, dimension]) => { const center = best.settings[field]; for (let step = -4; step <= 4; step += 1) consider({ ...best.settings, [field]: center + step * dimension * .1 }) })
  const rotationCenter = best.settings
  for (const dx of [-5, 0, 5]) for (const dy of [-5, 0, 5]) for (const dz of [-5, 0, 5]) consider({ ...rotationCenter, rotationX: rotationCenter.rotationX + dx, rotationY: rotationCenter.rotationY + dy, rotationZ: rotationCenter.rotationZ + dz })
  axes.forEach(([field, dimension]) => { const center = best.settings[field]; for (const step of [-1, 0, 1]) consider({ ...best.settings, [field]: center + step * dimension * .025 }) })
  return { baseline, best, tested, improved: best.score + 1e-8 < baseline.score }
}
