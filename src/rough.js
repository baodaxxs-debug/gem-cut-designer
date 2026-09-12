const radians = degrees => degrees * Math.PI / 180

function rotateX([x, y, z], angle) { const c = Math.cos(angle), s = Math.sin(angle); return [x, y * c - z * s, y * s + z * c] }
function rotateY([x, y, z], angle) { const c = Math.cos(angle), s = Math.sin(angle); return [x * c + z * s, y, -x * s + z * c] }
function rotateZ([x, y, z], angle) { const c = Math.cos(angle), s = Math.sin(angle); return [x * c - y * s, x * s + y * c, z] }

export function roughLocalToWorld(point, settings) { let world = rotateX(point, radians(settings.rotationX)); world = rotateY(world, radians(settings.rotationY)); world = rotateZ(world, radians(settings.rotationZ)); return [world[0] + settings.offsetX, world[1] + settings.offsetY, world[2] + settings.offsetZ] }

function pointInMesh(point, mesh) {
  if (!mesh?.positions?.length) return false
  const direction = [1, .173205, .09759], hits = [], positions = mesh.positions
  for (let index = 0; index < positions.length; index += 9) {
    const a = positions.slice(index, index + 3), b = positions.slice(index + 3, index + 6), c = positions.slice(index + 6, index + 9)
    const edge1 = b.map((value, axis) => value - a[axis]), edge2 = c.map((value, axis) => value - a[axis])
    const h = [direction[1] * edge2[2] - direction[2] * edge2[1], direction[2] * edge2[0] - direction[0] * edge2[2], direction[0] * edge2[1] - direction[1] * edge2[0]]
    const determinant = edge1[0] * h[0] + edge1[1] * h[1] + edge1[2] * h[2]
    if (Math.abs(determinant) < 1e-9) continue
    const inverse = 1 / determinant, s = point.map((value, axis) => value - a[axis])
    const u = inverse * (s[0] * h[0] + s[1] * h[1] + s[2] * h[2])
    if (u < -1e-8 || u > 1 + 1e-8) continue
    const q = [s[1] * edge1[2] - s[2] * edge1[1], s[2] * edge1[0] - s[0] * edge1[2], s[0] * edge1[1] - s[1] * edge1[0]]
    const v = inverse * (direction[0] * q[0] + direction[1] * q[1] + direction[2] * q[2])
    if (v < -1e-8 || u + v > 1 + 1e-8) continue
    const distance = inverse * (edge2[0] * q[0] + edge2[1] * q[1] + edge2[2] * q[2])
    if (distance > 1e-8) hits.push(distance)
  }
  return new Set(hits.map(hit => hit.toFixed(7))).size % 2 === 1
}

export function pointInRough(point, settings, customMesh) {
  const translated = [point[0] - settings.offsetX, point[1] - settings.offsetY, point[2] - settings.offsetZ]
  let local = rotateZ(translated, -radians(settings.rotationZ))
  local = rotateY(local, -radians(settings.rotationY))
  local = rotateX(local, -radians(settings.rotationX))
  const halfLength = Math.max(.0001, settings.length / 2), halfHeight = Math.max(.0001, settings.height / 2), halfWidth = Math.max(.0001, settings.width / 2)
  const q = [local[0] / halfLength, local[1] / halfHeight, local[2] / halfWidth]
  let metric
  if (settings.shape === 'scan') { const inside = pointInMesh(q, customMesh); return { inside, metric: inside ? 0 : 2, local } }
  if (settings.shape === 'crystal') metric = Math.abs(q[0]) + Math.abs(q[1]) + Math.abs(q[2])
  else if (settings.shape === 'tabular') metric = Math.max(Math.abs(q[0]), Math.abs(q[1]), Math.abs(q[2]))
  else if (settings.shape === 'pebble') metric = Math.hypot(...q)
  else {
    const radius = Math.hypot(...q)
    if (radius < 1e-9) metric = 0
    else {
      const base = q.map(value => value / radius * 2.4)
      const boundary = 1 + .1 * Math.sin(base[0] * 2.7 + base[2] * 1.3) + .06 * Math.cos(base[1] * 3.1 - base[0])
      metric = radius / boundary
    }
  }
  return { inside: metric <= 1 + 1e-6, metric, local }
}

export function evaluateRoughFit(model, modelScale, settings, customMesh) {
  if (!model || !settings.visible) return { active: false, fits: true, total: 0, outside: 0, outsidePercent: 0, maxOverflowMm: 0 }
  const unique = new Map()
  model.facets.flatMap(facet => facet.points).forEach(point => unique.set(point.map(value => value.toFixed(6)).join('|'), point))
  const results = [...unique.values()].map(point => pointInRough(point.map(value => value * modelScale), settings, customMesh))
  const outside = results.filter(result => !result.inside)
  const smallestRadius = Math.min(settings.length, settings.width, settings.height) / 2
  const maxMetric = Math.max(1, ...results.map(result => result.metric))
  return { active: true, fits: outside.length === 0, total: results.length, outside: outside.length, outsidePercent: results.length ? outside.length / results.length * 100 : 0, maxOverflowMm: settings.shape === 'scan' ? null : (maxMetric - 1) * smallestRadius }
}
