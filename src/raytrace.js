import { createModelBvh, intersectBvh } from './bvh.js'

const EPS = 1e-5
const add = (a, b) => a.map((value, i) => value + b[i])
const scale = (v, amount) => v.map(value => value * amount)
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const normalize = v => { const length = Math.hypot(...v); return v.map(value => value / length) }
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

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

function modelSamplingFrame(model, incoming) {
  const points = model.facets.flatMap(facet => facet.points)
  const minimum = [0, 1, 2].map(axis => Math.min(...points.map(point => point[axis])))
  const maximum = [0, 1, 2].map(axis => Math.max(...points.map(point => point[axis])))
  const center = minimum.map((value, axis) => (value + maximum[axis]) / 2)
  const radius = Math.max(...points.map(point => Math.hypot(...point.map((value, axis) => value - center[axis])))) * 1.08
  const reference = Math.abs(incoming[1]) > .94 ? [0, 0, 1] : [0, 1, 0]
  const right = normalize(cross(reference, incoming))
  const up = normalize(cross(incoming, right))
  return { center, radius, right, up }
}

function directionFromView(tiltDegrees = 0, azimuthDegrees = 0) {
  const tilt = tiltDegrees * Math.PI / 180, azimuth = azimuthDegrees * Math.PI / 180
  return normalize([Math.sin(tilt) * Math.cos(azimuth), -Math.cos(tilt), Math.sin(tilt) * Math.sin(azimuth)])
}

function traceDirection(model, bvh, ior, resolution, maxBounces, tiltDegrees = 0, azimuthDegrees = 0) {
  const incoming = directionFromView(tiltDegrees, azimuthDegrees)
  const frame = modelSamplingFrame(model, incoming)
  const counts = { entered: 0, returned: 0, leaked: 0, trapped: 0, reflections: 0 }
  let returnAlignment = 0
  const samples = []
  for (let row = 0; row < resolution; row += 1) for (let column = 0; column < resolution; column += 1) {
    const u = ((column + .5) / resolution * 2 - 1) * frame.radius
    const v = ((row + .5) / resolution * 2 - 1) * frame.radius
    const originStart = add(add(add(frame.center, scale(frame.right, u)), scale(frame.up, v)), scale(incoming, -frame.radius * 3))
    const entry = intersectBvh(bvh, originStart, incoming)
    if (!entry || dot(incoming, entry.facet.n) >= 0) { samples.push(0); continue }
    let direction = enterGem(incoming, entry.facet.n, ior)
    if (!direction) { samples.push(0); continue }
    counts.entered += 1
    let origin = add(originStart, scale(incoming, entry.distance))
    let excluded = entry.facetIndex
    let outcome = 3
    for (let bounce = 0; bounce < maxBounces; bounce += 1) {
      origin = add(origin, scale(direction, EPS * 4))
      const hit = intersectBvh(bvh, origin, direction, excluded)
      if (!hit) { outcome = 2; counts.leaked += 1; break }
      origin = add(origin, scale(direction, hit.distance))
      const outgoing = exitGem(direction, hit.facet.n, ior)
      if (outgoing) {
        const alignment = dot(outgoing, scale(incoming, -1))
        if (alignment > .05) { outcome = 1; counts.returned += 1; returnAlignment += alignment }
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
    averageReturnAlignment: returnAlignment / Math.max(1, counts.returned),
    tiltDegrees,
    azimuthDegrees,
    acceleration: 'bvh',
    bvhStats: bvh.stats,
  }
}

export function traceView(model, ior, options = {}) {
  const resolution = options.resolution ?? 21, maxBounces = options.maxBounces ?? 12
  return traceDirection(model, createModelBvh(model), ior, resolution, maxBounces, options.tiltDegrees || 0, options.azimuthDegrees || 0)
}

export function traceFaceUp(model, ior, resolution = 21, maxBounces = 12) {
  return traceView(model, ior, { resolution, maxBounces })
}

const DEFAULT_VIEWS = [
  { tiltDegrees: 0, azimuthDegrees: 0, weight: .4 },
  { tiltDegrees: 12, azimuthDegrees: 0, weight: .15 },
  { tiltDegrees: 12, azimuthDegrees: 90, weight: .15 },
  { tiltDegrees: 12, azimuthDegrees: 180, weight: .15 },
  { tiltDegrees: 12, azimuthDegrees: 270, weight: .15 },
]

export function traceMultiAngle(model, ior, options = {}) {
  const resolution = options.resolution ?? 11, maxBounces = options.maxBounces ?? 12
  const definitions = options.views?.length ? options.views : DEFAULT_VIEWS
  const totalWeight = definitions.reduce((sum, view) => sum + Math.max(0, view.weight ?? 1), 0) || 1
  const bvh = createModelBvh(model)
  const views = definitions.map(view => ({
    ...traceDirection(model, bvh, ior, resolution, maxBounces, view.tiltDegrees || 0, view.azimuthDegrees || 0),
    weight: Math.max(0, view.weight ?? 1) / totalWeight,
  }))
  const weighted = key => views.reduce((sum, view) => sum + view[key] * view.weight, 0)
  return {
    mode: 'multi-angle', views, viewCount: views.length, resolution,
    returnPercent: weighted('returnPercent'),
    leakagePercent: weighted('leakagePercent'),
    trappedPercent: weighted('trappedPercent'),
    averageReflections: weighted('averageReflections'),
    averageReturnAlignment: weighted('averageReturnAlignment'),
    acceleration: 'bvh', bvhStats: bvh.stats,
  }
}
