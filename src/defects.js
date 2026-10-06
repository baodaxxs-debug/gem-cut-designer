import { roughLocalToWorld } from './rough.js'
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub = (a, b) => a.map((value, axis) => value - b[axis])
const add = (a, b) => a.map((value, axis) => value + b[axis])
const scale = (vector, amount) => vector.map(value => value * amount)
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const lengthSquared = vector => dot(vector, vector)

function pointTriangleDistance(point, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(point, a)
  const d1 = dot(ab, ap), d2 = dot(ac, ap)
  if (d1 <= 0 && d2 <= 0) return Math.sqrt(lengthSquared(ap))
  const bp = sub(point, b), d3 = dot(ab, bp), d4 = dot(ac, bp)
  if (d3 >= 0 && d4 <= d3) return Math.sqrt(lengthSquared(bp))
  const vc = d1 * d4 - d3 * d2
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return Math.sqrt(lengthSquared(sub(point, add(a, scale(ab, d1 / (d1 - d3))))))
  const cp = sub(point, c), d5 = dot(ab, cp), d6 = dot(ac, cp)
  if (d6 >= 0 && d5 <= d6) return Math.sqrt(lengthSquared(cp))
  const vb = d5 * d2 - d1 * d6
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return Math.sqrt(lengthSquared(sub(point, add(a, scale(ac, d2 / (d2 - d6))))))
  const va = d3 * d6 - d5 * d4
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const edge = sub(c, b), amount = (d4 - d3) / ((d4 - d3) + (d5 - d6))
    return Math.sqrt(lengthSquared(sub(point, add(b, scale(edge, amount)))))
  }
  const normal = cross(ab, ac)
  return Math.abs(dot(ap, normal)) / Math.sqrt(lengthSquared(normal))
}

function rayTriangleDistance(origin, direction, a, b, c) {
  const edge1 = sub(b, a), edge2 = sub(c, a), h = cross(direction, edge2), determinant = dot(edge1, h)
  if (Math.abs(determinant) < 1e-9) return null
  const inverse = 1 / determinant, s = sub(origin, a), u = inverse * dot(s, h)
  if (u < -1e-8 || u > 1 + 1e-8) return null
  const q = cross(s, edge1), v = inverse * dot(direction, q)
  if (v < -1e-8 || u + v > 1 + 1e-8) return null
  const distance = inverse * dot(edge2, q)
  return distance > 1e-8 ? distance : null
}

function concaveDefectResult(model, modelScale, center, radius) {
  const triangles = model.facets.flatMap(facet => {
    const result = []
    for (let index = 1; index < facet.points.length - 1; index += 1) result.push([facet.points[0], facet.points[index], facet.points[index + 1]].map(point => scale(point, modelScale)))
    return result
  })
  const direction = [1, .173205, .09759]
  const hits = triangles.map(([a, b, c]) => rayTriangleDistance(center, direction, a, b, c)).filter(distance => distance !== null)
  const centerInside = new Set(hits.map(distance => distance.toFixed(7))).size % 2 === 1
  const clearance = Math.min(...triangles.map(([a, b, c]) => pointTriangleDistance(center, a, b, c)))
  return { centerInside, conflict: centerInside || clearance <= radius, clearance: centerInside ? 0 : clearance }
}

export function evaluateDefects(model, modelScale, roughSettings, defects = []) {
  if (!model || !defects.length) return { items: [], conflicts: 0 }
  const items = defects.map(defect => {
    const center = roughLocalToWorld([defect.x, defect.y, defect.z], roughSettings)
    if (model.hasConcaveCuts) return { ...defect, center, ...concaveDefectResult(model, modelScale, center, defect.radius) }
    const planeDistances = model.facets.map(facet => dot(facet.n, center) - facet.d * modelScale)
    const limitingDistance = Math.max(...planeDistances), centerInside = limitingDistance <= 1e-6, conflict = limitingDistance <= defect.radius
    return { ...defect, center, centerInside, conflict, clearance: Math.max(0, limitingDistance - defect.radius) }
  })
  return { items, conflicts: items.filter(item => item.conflict).length }
}
