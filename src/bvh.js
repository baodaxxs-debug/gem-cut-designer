const EPS = 1e-8
const sub = (a, b) => a.map((value, axis) => value - b[axis])
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

export function rayTriangleDistance(origin, direction, triangle) {
  const edge1 = sub(triangle.b, triangle.a), edge2 = sub(triangle.c, triangle.a)
  const h = cross(direction, edge2), determinant = dot(edge1, h)
  if (Math.abs(determinant) < EPS) return null
  const inverse = 1 / determinant, s = sub(origin, triangle.a), u = inverse * dot(s, h)
  if (u < -EPS || u > 1 + EPS) return null
  const q = cross(s, edge1), v = inverse * dot(direction, q)
  if (v < -EPS || u + v > 1 + EPS) return null
  const distance = inverse * dot(edge2, q)
  return distance > EPS ? distance : null
}

function triangleBounds(triangle) {
  return {
    min: [0, 1, 2].map(axis => Math.min(triangle.a[axis], triangle.b[axis], triangle.c[axis])),
    max: [0, 1, 2].map(axis => Math.max(triangle.a[axis], triangle.b[axis], triangle.c[axis])),
    center: [0, 1, 2].map(axis => (triangle.a[axis] + triangle.b[axis] + triangle.c[axis]) / 3),
  }
}

function nodeBounds(items) {
  return {
    min: [0, 1, 2].map(axis => Math.min(...items.map(item => item.bounds.min[axis]))),
    max: [0, 1, 2].map(axis => Math.max(...items.map(item => item.bounds.max[axis]))),
  }
}

function buildNode(items, leafSize, stats) {
  stats.nodes += 1
  const bounds = nodeBounds(items)
  if (items.length <= leafSize) { stats.leaves += 1; return { ...bounds, items } }
  const spans = bounds.max.map((value, axis) => value - bounds.min[axis])
  const axis = spans.indexOf(Math.max(...spans))
  items.sort((a, b) => a.bounds.center[axis] - b.bounds.center[axis])
  const middle = Math.floor(items.length / 2)
  return { ...bounds, left: buildNode(items.slice(0, middle), leafSize, stats), right: buildNode(items.slice(middle), leafSize, stats) }
}

export function createTriangleBvh(triangles, leafSize = 8) {
  if (!triangles.length) throw new Error('BVH 没有可索引的三角面')
  const items = triangles.map(triangle => ({ ...triangle, bounds: triangleBounds(triangle) }))
  const stats = { nodes: 0, leaves: 0, triangles: items.length }
  return { root: buildNode(items, leafSize, stats), stats }
}

export function createModelBvh(model, leafSize = 8) {
  const triangles = []
  model.facets.forEach((facet, facetIndex) => {
    for (let index = 1; index < facet.points.length - 1; index += 1) triangles.push({ a: facet.points[0], b: facet.points[index], c: facet.points[index + 1], facet, facetIndex })
  })
  return createTriangleBvh(triangles, leafSize)
}

function rayBox(origin, direction, node, maximum) {
  let near = 0, far = maximum
  for (let axis = 0; axis < 3; axis += 1) {
    if (Math.abs(direction[axis]) < EPS) {
      if (origin[axis] < node.min[axis] || origin[axis] > node.max[axis]) return false
      continue
    }
    let first = (node.min[axis] - origin[axis]) / direction[axis]
    let second = (node.max[axis] - origin[axis]) / direction[axis]
    if (first > second) [first, second] = [second, first]
    near = Math.max(near, first); far = Math.min(far, second)
    if (near > far) return false
  }
  return far > EPS
}

export function intersectBvh(bvh, origin, direction, excludedFacet = -1) {
  let nearest = null
  const stack = [bvh.root]
  while (stack.length) {
    const node = stack.pop()
    if (!rayBox(origin, direction, node, nearest?.distance ?? Infinity)) continue
    if (node.items) {
      for (const triangle of node.items) {
        if (triangle.facetIndex === excludedFacet) continue
        const distance = rayTriangleDistance(origin, direction, triangle)
        if (distance !== null && (!nearest || distance < nearest.distance)) nearest = { distance, facet: triangle.facet, facetIndex: triangle.facetIndex }
      }
    } else { stack.push(node.left, node.right) }
  }
  return nearest
}
