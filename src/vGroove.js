const EPSILON = 1e-5
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const add = (a, b) => a.map((value, axis) => value + b[axis])
const sub = (a, b) => a.map((value, axis) => value - b[axis])
const scale = (vector, amount) => vector.map(value => value * amount)
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const length = vector => Math.hypot(...vector)
const normalize = vector => { const size = length(vector); return size > EPSILON ? scale(vector, 1 / size) : null }

class Vertex {
  constructor(position) { this.position = [...position] }
  clone() { return new Vertex(this.position) }
  interpolate(other, amount) { return new Vertex(this.position.map((value, axis) => value + (other.position[axis] - value) * amount)) }
}

class Plane {
  constructor(normal, w) { this.normal = [...normal]; this.w = w }
  clone() { return new Plane(this.normal, this.w) }
  flip() { this.normal = scale(this.normal, -1); this.w = -this.w }
  splitPolygon(polygon, coplanarFront, coplanarBack, front, back) {
    const COPLANAR = 0, FRONT = 1, BACK = 2, SPANNING = 3
    let polygonType = 0
    const types = polygon.vertices.map(vertex => {
      const value = dot(this.normal, vertex.position) - this.w
      const type = value < -EPSILON ? BACK : value > EPSILON ? FRONT : COPLANAR
      polygonType |= type
      return type
    })
    if (polygonType === COPLANAR) (dot(this.normal, polygon.plane.normal) > 0 ? coplanarFront : coplanarBack).push(polygon)
    else if (polygonType === FRONT) front.push(polygon)
    else if (polygonType === BACK) back.push(polygon)
    else {
      const frontVertices = [], backVertices = []
      for (let index = 0; index < polygon.vertices.length; index += 1) {
        const next = (index + 1) % polygon.vertices.length
        const type = types[index], nextType = types[next]
        const vertex = polygon.vertices[index], nextVertex = polygon.vertices[next]
        if (type !== BACK) frontVertices.push(vertex)
        if (type !== FRONT) backVertices.push(type !== BACK ? vertex.clone() : vertex)
        if ((type | nextType) === SPANNING) {
          const direction = sub(nextVertex.position, vertex.position)
          const amount = (this.w - dot(this.normal, vertex.position)) / dot(this.normal, direction)
          const splitVertex = vertex.interpolate(nextVertex, amount)
          frontVertices.push(splitVertex)
          backVertices.push(splitVertex.clone())
        }
      }
      const frontPolygon = cleanPolygon(frontVertices, polygon.shared)
      const backPolygon = cleanPolygon(backVertices, polygon.shared)
      if (frontPolygon) front.push(frontPolygon)
      if (backPolygon) back.push(backPolygon)
    }
  }
  static fromPoints(a, b, c) {
    const normal = normalize(cross(sub(b, a), sub(c, a)))
    if (!normal) throw new Error('布尔切割遇到退化三角面')
    return new Plane(normal, dot(normal, a))
  }
}

class Polygon {
  constructor(vertices, shared = {}) {
    this.vertices = vertices
    this.shared = shared
    this.plane = Plane.fromPoints(vertices[0].position, vertices[1].position, vertices[2].position)
  }
  clone() { return new Polygon(this.vertices.map(vertex => vertex.clone()), this.shared) }
  flip() { this.vertices.reverse(); this.plane.flip() }
}

function cleanPolygon(vertices, shared) {
  let cleaned = vertices.filter((vertex, index) => index === 0 || length(sub(vertex.position, vertices[index - 1].position)) > EPSILON)
  if (cleaned.length > 2 && length(sub(cleaned[0].position, cleaned.at(-1).position)) <= EPSILON) cleaned = cleaned.slice(0, -1)
  let changed = true
  while (cleaned.length >= 3 && changed) {
    changed = false
    for (let index = 0; index < cleaned.length; index += 1) {
      const previous = cleaned[(index - 1 + cleaned.length) % cleaned.length].position
      const current = cleaned[index].position
      const next = cleaned[(index + 1) % cleaned.length].position
      const first = sub(current, previous), second = sub(next, current)
      if (length(cross(first, second)) <= EPSILON * Math.max(1, length(first), length(second))) {
        cleaned.splice(index, 1)
        changed = true
        break
      }
    }
  }
  if (cleaned.length < 3) return null
  try { return new Polygon(cleaned, shared) }
  catch { return null }
}

class Node {
  constructor(polygons = []) { this.plane = null; this.front = null; this.back = null; this.polygons = []; if (polygons.length) this.build(polygons) }
  clone() { const node = new Node(); node.plane = this.plane?.clone() || null; node.front = this.front?.clone() || null; node.back = this.back?.clone() || null; node.polygons = this.polygons.map(polygon => polygon.clone()); return node }
  invert() { this.polygons.forEach(polygon => polygon.flip()); this.plane?.flip(); this.front?.invert(); this.back?.invert(); [this.front, this.back] = [this.back, this.front] }
  clipPolygons(polygons) {
    if (!this.plane) return polygons.slice()
    let front = [], back = []
    polygons.forEach(polygon => this.plane.splitPolygon(polygon, front, back, front, back))
    if (this.front) front = this.front.clipPolygons(front)
    if (this.back) back = this.back.clipPolygons(back)
    else back = []
    return front.concat(back)
  }
  clipTo(node) { this.polygons = node.clipPolygons(this.polygons); this.front?.clipTo(node); this.back?.clipTo(node) }
  allPolygons() { return this.polygons.concat(this.front?.allPolygons() || [], this.back?.allPolygons() || []) }
  build(polygons) {
    if (!polygons.length) return
    this.plane ||= polygons[0].plane.clone()
    const front = [], back = []
    polygons.forEach(polygon => this.plane.splitPolygon(polygon, this.polygons, this.polygons, front, back))
    if (front.length) { this.front ||= new Node(); this.front.build(front) }
    if (back.length) { this.back ||= new Node(); this.back.build(back) }
  }
}

function subtractPolygons(source, cutter) {
  const a = new Node(source.map(polygon => polygon.clone()))
  const b = new Node(cutter.map(polygon => polygon.clone()))
  a.invert(); a.clipTo(b); b.clipTo(a); b.invert(); b.clipTo(a); b.invert(); a.build(b.allPolygons()); a.invert()
  return a.allPolygons()
}

function orientedPolygon(points, outward, shared) {
  const polygon = new Polygon(points.map(point => new Vertex(point)), shared)
  if (dot(polygon.plane.normal, outward) < 0) polygon.flip()
  return polygon
}

function modelPolygons(model) {
  return model.facets.flatMap(facet => {
    const polygons = []
    for (let index = 1; index < facet.points.length - 1; index += 1) {
      polygons.push(orientedPolygon([facet.points[0], facet.points[index], facet.points[index + 1]], facet.n, { facet }))
    }
    return polygons
  })
}

function roundCutterPolygons(operation, tangent, normal, lateral) {
  const radius = operation.width / 2
  const padding = Math.max(radius, operation.depth * .25)
  const centerShift = radius - operation.depth
  const startCenter = add(sub(operation.a, scale(tangent, padding)), scale(normal, centerShift))
  const endCenter = add(add(operation.b, scale(tangent, padding)), scale(normal, centerShift))
  const segments = 16
  const vertices = []
  for (let end = 0; end < 2; end += 1) {
    const center = end ? endCenter : startCenter
    for (let index = 0; index < segments; index += 1) {
      const angle = index / segments * Math.PI * 2
      vertices.push(add(center, add(scale(lateral, Math.cos(angle) * radius), scale(normal, Math.sin(angle) * radius))))
    }
  }
  const faces = [
    [...Array(segments).keys()].reverse(),
    [...Array(segments).keys()].map(index => index + segments),
    ...Array.from({ length: segments }, (_, index) => [index, (index + 1) % segments, (index + 1) % segments + segments, index + segments]),
  ]
  const center = scale(add(startCenter, endCenter), .5)
  return faces.map(indices => {
    const points = indices.map(index => vertices[index])
    let polygon = new Polygon(points.map(point => new Vertex(point)), { groove: operation })
    const faceCenter = points.reduce((sum, point) => add(sum, scale(point, 1 / points.length)), [0, 0, 0])
    if (dot(polygon.plane.normal, sub(faceCenter, center)) < 0) polygon.flip()
    return polygon
  })
}

function cutterPolygons(operation) {
  const tangent = normalize(sub(operation.b, operation.a))
  const normal = normalize(operation.n)
  const lateral = tangent && normal ? normalize(cross(normal, tangent)) : null
  if (!tangent || !normal || !lateral) throw new Error('凹槽方向无效')
  if (operation.toolType === 'round') return roundCutterPolygons(operation, tangent, normal, lateral)
  const halfWidth = operation.width / 2
  const depth = operation.depth
  const padding = Math.max(halfWidth, depth * .2)
  const start = sub(operation.a, scale(tangent, padding)), end = add(operation.b, scale(tangent, padding))
  const lift = Math.max(EPSILON * 20, halfWidth * .25)
  const vertices = [
    add(add(start, scale(lateral, halfWidth)), scale(normal, lift)),
    add(sub(start, scale(lateral, halfWidth)), scale(normal, lift)),
    sub(start, scale(normal, depth)),
    add(add(end, scale(lateral, halfWidth)), scale(normal, lift)),
    add(sub(end, scale(lateral, halfWidth)), scale(normal, lift)),
    sub(end, scale(normal, depth)),
  ]
  const center = vertices.reduce((sum, point) => add(sum, scale(point, 1 / vertices.length)), [0, 0, 0])
  const faces = [[0, 2, 1], [3, 4, 5], [0, 3, 5, 2], [1, 2, 5, 4], [0, 1, 4, 3]]
  return faces.map(indices => {
    const points = indices.map(index => vertices[index])
    let polygon = new Polygon(points.map(point => new Vertex(point)), { groove: operation })
    const faceCenter = points.reduce((sum, point) => add(sum, scale(point, 1 / points.length)), [0, 0, 0])
    if (dot(polygon.plane.normal, sub(faceCenter, center)) < 0) polygon.flip()
    return polygon
  })
}

function modelFromPolygons(model, polygons, operations) {
  const facets = polygons.filter(polygon => polygon.vertices.length >= 3).map((polygon, index) => {
    const source = polygon.shared.facet
    const groove = polygon.shared.groove
    const tier = source?.tier || {
      id: `vgroove-${groove.groupId}`,
      name: groove.toolType === 'round' ? '圆弧槽内壁' : 'V 槽内壁', rawName: groove.toolType === 'round' ? 'RG' : 'VG', code: groove.toolType === 'round' ? 'RG' : 'VG', angle: 0, distance: 0, indexes: [0],
      vGrooveGroup: groove.groupId,
    }
    return {
      n: [...polygon.plane.normal], d: polygon.plane.w,
      points: polygon.vertices.map(vertex => [...vertex.position]),
      tier, facetIndex: source?.facetIndex ?? index,
      angle: source?.angle ?? 0, index: source?.index ?? 0,
      vGroove: groove || null,
    }
  })
  const unique = new Set(facets.flatMap(facet => facet.points.map(point => point.map(value => value.toFixed(6)).join(','))))
  return { ...model, facets, vertexCount: unique.size, solver: 'bsp-csg-v-groove', baseSolver: model.solver, vGrooves: operations, hasConcaveCuts: true }
}

export function applyVGrooves(model, operations = []) {
  if (!operations.length) return model
  let polygons = modelPolygons(model)
  operations.forEach(operation => { polygons = subtractPolygons(polygons, cutterPolygons(operation)) })
  if (!polygons.length) throw new Error('凹槽切割移除了整个模型，请减小槽宽')
  return modelFromPolygons(model, polygons, operations)
}

export function addVGrooves(design, model, options = {}) {
  if (!model?.facets?.length) throw new Error('当前模型不可用于凹槽切割')
  const tierId = options.tierId
  const facetIndex = Math.max(0, Number(options.facetIndex) || 0)
  const edgeIndex = Math.max(0, Math.round(Number(options.edgeIndex) || 0))
  const scope = options.scope === 'tier' ? 'tier' : 'single'
  const widthPercent = clamp(Number(options.widthPercent) || 2, .25, 8)
  const includedAngle = clamp(Number(options.includedAngle) || 90, 30, 140)
  const toolType = options.toolType === 'round' ? 'round' : 'v'
  const depthPercent = clamp(Number(options.depthPercent) || 50, 10, 100)
  const groupId = options.groupId || `v-groove-${Date.now()}`
  const candidates = model.facets.filter(facet => facet.tier.id === tierId && (scope === 'tier' || facet.facetIndex === facetIndex))
  const targets = [...new Map(candidates.map(facet => [facet.facetIndex, facet])).values()]
  if (!targets.length) throw new Error('请先选择一个可见刻面')
  const width = 4.8 * widthPercent / 100
  const depth = toolType === 'round'
    ? width * depthPercent / 100
    : clamp((width / 2) / Math.tan(includedAngle * Math.PI / 360), width * .15, width * 1.9)
  const operations = targets.map((facet, operationIndex) => {
    const localEdge = edgeIndex % facet.points.length
    return {
      id: `${groupId}-${operationIndex + 1}`, groupId,
      a: [...facet.points[localEdge]], b: [...facet.points[(localEdge + 1) % facet.points.length]], n: [...facet.n],
      width, depth, widthPercent, includedAngle, toolType, depthPercent,
      source: { tierId, facetIndex: facet.facetIndex, edgeIndex: localEdge }, scope,
    }
  }).filter(operation => length(sub(operation.b, operation.a)) > EPSILON)
  if (!operations.length) throw new Error('所选棱边长度不足，无法生成凹槽')
  const nextDesign = { ...design, vGrooves: [...(design.vGrooves || []), ...operations] }
  applyVGrooves(model, operations)
  return { design: nextDesign, operations, count: operations.length, groupId }
}

function rayBoundaryDistance(point, polygon) {
  const size = Math.hypot(...point)
  if (size < EPSILON) return 0
  const direction = point.map(value => value / size)
  let nearest = Infinity
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index], b = polygon[(index + 1) % polygon.length]
    const edge = [b[0] - a[0], b[1] - a[1]]
    const denominator = direction[0] * edge[1] - direction[1] * edge[0]
    if (Math.abs(denominator) < EPSILON) continue
    const alongRay = (a[0] * edge[1] - a[1] * edge[0]) / denominator
    const alongEdge = (a[0] * direction[1] - a[1] * direction[0]) / denominator
    if (alongRay >= 0 && alongEdge >= -EPSILON && alongEdge <= 1 + EPSILON) nearest = Math.min(nearest, alongRay)
  }
  return Number.isFinite(nearest) ? nearest : 0
}

export function mapPathToFacet(facet, normalizedPath, margin = .82) {
  if (!facet?.points?.length || normalizedPath.length < 2) throw new Error('自由路径至少需要两个点')
  const normal = normalize(facet.n)
  const tangent = normalize(sub(facet.points[1], facet.points[0]))
  const bitangent = normal && tangent ? normalize(cross(normal, tangent)) : null
  if (!normal || !tangent || !bitangent) throw new Error('当前刻面无法建立绘制坐标')
  const center = facet.points.reduce((sum, point) => add(sum, scale(point, 1 / facet.points.length)), [0, 0, 0])
  const polygon = facet.points.map(point => { const relative = sub(point, center); return [dot(relative, tangent), dot(relative, bitangent)] })
  return normalizedPath.map(point => {
    const radius = Math.min(1, Math.hypot(point[0], point[1]))
    if (radius < EPSILON) return [...center]
    const direction = [point[0] / Math.hypot(point[0], point[1]), point[1] / Math.hypot(point[0], point[1])]
    const boundary = rayBoundaryDistance(direction, polygon) * radius * clamp(margin, .2, .96)
    return add(center, add(scale(tangent, direction[0] * boundary), scale(bitangent, direction[1] * boundary)))
  })
}

export function addPathGroove(design, model, options = {}) {
  if (!model?.facets?.length) throw new Error('当前模型不可用于自由路径凹切')
  const path = Array.isArray(options.path) ? options.path.filter(point => Array.isArray(point) && point.length >= 2 && point.every(Number.isFinite)) : []
  if (path.length < 2) throw new Error('请先在绘制板上画出一条路径')
  const facet = model.facets.find(item => item.tier.id === options.tierId && item.facetIndex === (Number(options.facetIndex) || 0))
  if (!facet) throw new Error('请先选择一个可见刻面')
  const points = mapPathToFacet(facet, path)
  const widthPercent = clamp(Number(options.widthPercent) || 2, .25, 8)
  const includedAngle = clamp(Number(options.includedAngle) || 90, 30, 140)
  const toolType = options.toolType === 'round' ? 'round' : 'v'
  const depthPercent = clamp(Number(options.depthPercent) || 50, 10, 100)
  const width = 4.8 * widthPercent / 100
  const depth = toolType === 'round' ? width * depthPercent / 100 : clamp((width / 2) / Math.tan(includedAngle * Math.PI / 360), width * .15, width * 1.9)
  const groupId = options.groupId || `path-groove-${Date.now()}`
  const operations = []
  for (let index = 0; index < points.length - 1; index += 1) {
    if (length(sub(points[index + 1], points[index])) <= Math.max(EPSILON, width * .08)) continue
    operations.push({
      id: `${groupId}-${operations.length + 1}`, groupId,
      a: points[index], b: points[index + 1], n: [...facet.n], width, depth, widthPercent, includedAngle, toolType, depthPercent,
      pathOrder: operations.length, pathPoints: path, source: { tierId: options.tierId, facetIndex: facet.facetIndex, edgeIndex: 0 }, scope: 'path',
    })
  }
  if (!operations.length) throw new Error('绘制路径过短，请画得更长一些')
  const nextDesign = { ...design, vGrooves: [...(design.vGrooves || []), ...operations] }
  applyVGrooves(model, operations)
  return { design: nextDesign, operations, count: operations.length, groupId, points }
}

export function removeVGrooveGroup(design, groupId) {
  const removed = (design.vGrooves || []).filter(operation => operation.groupId === groupId)
  return { design: { ...design, vGrooves: (design.vGrooves || []).filter(operation => operation.groupId !== groupId) }, removed, source: removed[0]?.source || null }
}
