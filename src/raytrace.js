import { createModelBvh, intersectBvh } from './bvh.js'

const EPS = 1e-5
const add = (a, b) => a.map((value, i) => value + b[i])
const scale = (v, amount) => v.map(value => value * amount)
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const normalize = v => { const length = Math.hypot(...v); return v.map(value => value / length) }

function enterGem(direction, outwardNormal, ior) {
  const cosine = Math.max(0, -dot(direction, outwardNormal))
  const eta = 1 / ior
  const k = 1 - eta * eta * (1 - cosine * cosine)
  if (k < 0) return null
  return normalize(add(scale(direction, eta), scale(outwardNormal, eta * cosine - Math.sqrt(k))))
}

function reflect(direction, normal) {
  return normalize(add(direction, scale(normal, -2 * dot(direction, normal))))
}

function exitGem(direction, outwardNormal, ior) {
  const cosine = Math.max(0, dot(direction, outwardNormal))
  const eta = ior
  const k = 1 - eta * eta * (1 - cosine * cosine)
  if (k < 0) return null
  return normalize(add(scale(direction, eta), scale(outwardNormal, Math.sqrt(k) - eta * cosine)))
}

export function traceFaceUp(model, ior, resolution = 21, maxBounces = 12) {
  const bvh = createModelBvh(model)
  const points = model.facets.flatMap(facet => facet.points)
  const minX = Math.min(...points.map(point => point[0])), maxX = Math.max(...points.map(point => point[0]))
  const minZ = Math.min(...points.map(point => point[2])), maxZ = Math.max(...points.map(point => point[2]))
  const top = Math.max(...points.map(point => point[1])) + 1
  const incoming = [0, -1, 0]
  const counts = { entered: 0, returned: 0, leaked: 0, trapped: 0, reflections: 0 }
  const samples = []
  for (let row = 0; row < resolution; row += 1) for (let column = 0; column < resolution; column += 1) {
    const x = minX + (maxX - minX) * (column + .5) / resolution
    const z = minZ + (maxZ - minZ) * (row + .5) / resolution
    const entry = intersectBvh(bvh, [x, top, z], incoming)
    if (!entry || entry.facet.n[1] <= 0) { samples.push(0); continue }
    let direction = enterGem(incoming, entry.facet.n, ior)
    if (!direction) { samples.push(0); continue }
    counts.entered += 1
    let origin = add([x, top, z], scale(incoming, entry.distance))
    let excluded = entry.facetIndex
    let outcome = 3
    for (let bounce = 0; bounce < maxBounces; bounce += 1) {
      origin = add(origin, scale(direction, EPS * 4))
      const hit = intersectBvh(bvh, origin, direction, excluded)
      if (!hit) { outcome = 2; counts.leaked += 1; break }
      origin = add(origin, scale(direction, hit.distance))
      const outgoing = exitGem(direction, hit.facet.n, ior)
      if (outgoing) {
        if (outgoing[1] > .05) { outcome = 1; counts.returned += 1 }
        else { outcome = 2; counts.leaked += 1 }
        break
      }
      counts.reflections += 1
      direction = reflect(direction, hit.facet.n)
      excluded = hit.facetIndex
      if (bounce === maxBounces - 1) counts.trapped += 1
    }
    samples.push(outcome)
  }
  const divisor = Math.max(1, counts.entered)
  return {
    ...counts,
    resolution,
    samples,
    returnPercent: counts.returned / divisor * 100,
    leakagePercent: counts.leaked / divisor * 100,
    trappedPercent: counts.trapped / divisor * 100,
    averageReflections: counts.reflections / divisor,
    acceleration: 'bvh',
    bvhStats: bvh.stats,
  }
}
