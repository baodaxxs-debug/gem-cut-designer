const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

function normalize(vector) {
  const length = Math.hypot(...vector)
  if (length < 1e-8) return null
  return vector.map(value => value / length)
}

function pointKey(point) { return point.map(value => value.toFixed(5)).join(',') }
function edgeKey(a, b) { return [pointKey(a), pointKey(b)].sort().join('|') }

function indexFromNormal(normal, gear, gearDirection) {
  let azimuth = Math.atan2(normal[2], normal[0])
  if (azimuth < 0) azimuth += Math.PI * 2
  let index = azimuth / (Math.PI * 2) * gear / (gearDirection || 1)
  index = ((index % gear) + gear) % gear
  return Number((index || gear).toFixed(6))
}

function angleFromNormal(normal) {
  const tilt = Math.acos(clamp(Math.abs(normal[1]), 0, 1)) * 180 / Math.PI
  return Number((normal[1] < 0 ? -tilt : tilt).toFixed(6))
}

function collectEdges(model) {
  const edges = new Map()
  model.facets.forEach(facet => {
    facet.points.forEach((a, index) => {
      const b = facet.points[(index + 1) % facet.points.length]
      const key = edgeKey(a, b)
      if (!edges.has(key)) edges.set(key, { key, a, b, facets: [] })
      edges.get(key).facets.push(facet)
    })
  })
  return edges
}

// Replace selected sharp edges with actual planar bevel facets.
export function addEdgeBevels(design, model, options = {}) {
  if (!model?.facets?.length || !Number.isFinite(model.scale) || model.scale <= 0) throw new Error('当前宝石模型不可用于棱边切割')
  const tierId = options.tierId
  const facetIndex = Number(options.facetIndex) || 0
  const scope = options.scope === 'tier' ? 'tier' : 'single'
  const selectedEdge = Math.max(0, Math.round(Number(options.edgeIndex) || 0))
  const widthPercent = clamp(Number(options.widthPercent) || .6, .05, 3)
  const groupId = options.groupId || `edge-bevel-${Date.now()}`
  const targetFacets = model.facets.filter(facet => facet.tier.id === tierId && (scope === 'tier' || facet.facetIndex === facetIndex))
  if (!targetFacets.length) throw new Error('请先选择一个当前可见的刻面')

  const edgeMap = collectEdges(model)
  const selectedEdges = new Map()
  targetFacets.forEach(facet => {
    if (!facet.points.length) return
    const localIndex = selectedEdge % facet.points.length
    const a = facet.points[localIndex]
    const b = facet.points[(localIndex + 1) % facet.points.length]
    const edge = edgeMap.get(edgeKey(a, b))
    if (edge?.facets.length === 2) selectedEdges.set(edge.key, { ...edge, targetFacet: facet })
  })
  if (!selectedEdges.size) throw new Error('这条边位于模型边界，找不到可共同倒角的相邻刻面')

  const normalizedWidth = 4.8 * widthPercent / 100
  const directionBias = clamp(Number(options.directionBias) || 0, -1, 1)
  const tiers = []
  for (const edge of selectedEdges.values()) {
    const first = edge.targetFacet
    const second = edge.facets.find(facet => facet !== first)
    const normal = normalize(first.n.map((value, axis) => value * (1 - directionBias) + second.n[axis] * (1 + directionBias)))
    if (!normal) continue
    const distanceScaled = dot(normal, edge.a) - normalizedWidth
    tiers.push({
      id: `${groupId}-${tiers.length + 1}`,
      name: `棱边倒角 ${tiers.length + 1}`,
      rawName: `EB${tiers.length + 1}`,
      code: `EB${tiers.length + 1}`,
      angle: angleFromNormal(normal),
      distance: Number((distanceScaled / model.scale).toFixed(9)),
      indexes: [indexFromNormal(normal, design.gear, design.gearDirection)],
      instructions: `平面倒角 · 宽度约 ${widthPercent.toFixed(2)}% · 方向 ${Math.round(directionBias * 100)} · ${scope === 'tier' ? '整层联动' : '单边'}`,
      edgeBevelGroup: groupId,
      edgeBevelWidth: widthPercent,
      edgeBevelBias: directionBias,
      edgeBevelSource: { tierId, facetIndex, edgeIndex: selectedEdge },
    })
  }
  if (!tiers.length) throw new Error('所选棱边无法生成有效倒角平面')
  return { design: { ...design, tiers: [...design.tiers, ...tiers] }, edits: options.facetEdits || {}, tierIds: tiers.map(tier => tier.id), count: tiers.length, groupId }
}

export function removeEdgeBevelGroup(design, facetEdits = {}, groupId) {
  const removed = design.tiers.filter(tier => tier.edgeBevelGroup === groupId)
  const edits = { ...facetEdits }
  removed.forEach(tier => { delete edits[tier.id] })
  return {
    design: { ...design, tiers: design.tiers.filter(tier => tier.edgeBevelGroup !== groupId) },
    edits,
    removed: removed.map(tier => tier.id),
    source: removed[0]?.edgeBevelSource || null,
  }
}
