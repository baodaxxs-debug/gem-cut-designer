import { buildGemFromDesign } from './gemcad.js'
import { traceFaceUp } from './raytrace.js'

const isPavilionTier = tier => tier.angle < -1 && tier.angle > -89.9

export function shiftPavilion(design, deltaDegrees) {
  return {
    ...design,
    tiers: design.tiers.map(tier => {
      if (!isPavilionTier(tier)) return { ...tier }
      const oldTilt = Math.abs(tier.angle) * Math.PI / 180
      const nextAngle = Math.max(5, Math.min(85, Math.abs(tier.angle) + deltaDegrees))
      const nextTilt = nextAngle * Math.PI / 180
      const radialMeet = tier.distance / Math.max(1e-6, Math.sin(oldTilt))
      return { ...tier, angle: -nextAngle, distance: radialMeet * Math.sin(nextTilt) }
    }),
  }
}

function opticalScore(trace) {
  return trace.returnPercent - trace.leakagePercent * 1.15 - trace.trappedPercent * .45
}

export function optimizePavilion(design, ior, options = {}) {
  const range = options.range ?? 4
  const step = options.step ?? .5
  const resolution = options.resolution ?? 11
  if (!design.tiers.some(isPavilionTier)) throw new Error('当前设计没有可优化的亭部刻面层')
  const candidates = []
  for (let delta = -range; delta <= range + 1e-8; delta += step) {
    try {
      const candidateDesign = shiftPavilion(design, Number(delta.toFixed(4)))
      const trace = traceFaceUp(buildGemFromDesign(candidateDesign), ior, resolution, 16)
      candidates.push({ delta: Number(delta.toFixed(4)), design: candidateDesign, trace, score: opticalScore(trace) })
    } catch { /* invalid candidate geometry is skipped */ }
  }
  if (!candidates.length) throw new Error('当前几何无法生成有效的亭角优化方案')
  const baseline = candidates.find(candidate => Math.abs(candidate.delta) < 1e-8) || candidates[0]
  const best = [...candidates].sort((a, b) => b.score - a.score || Math.abs(a.delta) - Math.abs(b.delta))[0]
  return {
    baseline,
    best,
    tested: candidates.length,
    returnImprovement: best.trace.returnPercent - baseline.trace.returnPercent,
    leakageReduction: baseline.trace.leakagePercent - best.trace.leakagePercent,
  }
}
