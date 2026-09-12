import { roughLocalToWorld } from './rough.js'
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export function evaluateDefects(model, modelScale, roughSettings, defects = []) {
  if (!model || !defects.length) return { items: [], conflicts: 0 }
  const items = defects.map(defect => { const center = roughLocalToWorld([defect.x, defect.y, defect.z], roughSettings); const planeDistances = model.facets.map(facet => dot(facet.n, center) - facet.d * modelScale); const limitingDistance = Math.max(...planeDistances); const centerInside = limitingDistance <= 1e-6; const conflict = limitingDistance <= defect.radius; return { ...defect, center, centerInside, conflict, clearance: Math.max(0, limitingDistance - defect.radius) } })
  return { items, conflicts: items.filter(item => item.conflict).length }
}
