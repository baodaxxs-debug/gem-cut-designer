import { buildGemFromDesign, facetNormal } from './gemcad.js'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

function uniqueRawPoints(model) {
  const points = []
  model.facets.forEach(facet => facet.points.forEach(point => {
    const raw = point.map(value => value / model.scale)
    if (!points.some(existing => Math.hypot(...existing.map((value, axis) => value - raw[axis])) < 1e-5)) points.push(raw)
  }))
  return points
}

function referenceAngle(design, side) {
  const angles = design.tiers
    .filter(tier => side === 'pavilion' ? tier.angle < -1 && tier.angle > -89 : tier.angle > 1 && tier.angle < 89)
    .map(tier => Math.abs(tier.angle))
    .sort((a, b) => a - b)
  return angles.length ? angles[Math.floor(angles.length / 2)] : side === 'pavilion' ? 41 : 30
}

function indexesFor(gear, rays, rotation, doubled, staggered) {
  const count = doubled ? rays * 2 : rays
  const step = gear / count
  const offset = rotation + (staggered ? step / 2 : 0)
  return Array.from({ length: count }, (_, index) => {
    const value = ((offset + index * step) % gear + gear) % gear
    return Number((value || gear).toFixed(4))
  })
}

function tierName(type, ring, total) {
  const base = type === 'web' ? '蛛网连接层' : type === 'petal' ? '花瓣纹路层' : '放射星芒层'
  return total > 1 ? `${base} ${ring + 1}` : base
}

export function addPatternTiers(design, facetEdits = {}, options = {}) {
  const type = ['star', 'web', 'petal'].includes(options.type) ? options.type : 'star'
  const side = options.side === 'crown' ? 'crown' : 'pavilion'
  const rays = clamp(Math.round(Number(options.rays) || 8), 3, 24)
  const requestedRings = clamp(Math.round(Number(options.rings) || 1), 1, 4)
  const rings = type === 'star' ? 1 : type === 'petal' ? Math.max(2, requestedRings) : requestedRings
  const rotation = Number(options.rotation) || 0
  const strength = clamp(Number(options.strength) || 1.2, .15, 6)
  const groupId = options.groupId || `pattern-${Date.now()}`
  const baseAngle = referenceAngle(design, side)
  let nextDesign = { ...design, tiers: [...design.tiers] }
  let nextEdits = structuredClone(facetEdits || {})
  const tierIds = []

  for (let ring = 0; ring < rings; ring += 1) {
    const model = buildGemFromDesign(nextDesign, nextEdits)
    const points = uniqueRawPoints(model)
    const maxRadius = Math.max(...points.map(([x,,z]) => Math.hypot(x, z)))
    const doubled = type === 'web' || (type === 'petal' && ring > 0)
    const indexes = indexesFor(nextDesign.gear, rays, rotation, doubled, ring % 2 === 1)
    const angleShift = type === 'web' ? 1.6 : type === 'petal' ? 2.4 : 2.8
    const absoluteAngle = clamp(baseAngle - angleShift * (ring + 1), 5, 85)
    const angle = side === 'pavilion' ? -absoluteAngle : absoluteAngle
    const tierId = `${groupId}-${ring + 1}`
    const cut = maxRadius * (strength / 100) * (1 + ring * .35)
    const supports = indexes.map(index => {
      const normal = facetNormal(angle, index, nextDesign.gear, nextDesign.gearDirection)
      return Math.max(...points.map(point => dot(normal, point))) - cut
    })
    const distance = supports.reduce((sum, value) => sum + value, 0) / supports.length
    const tier = {
      id: tierId,
      name: tierName(type, ring, rings),
      rawName: `PX${ring + 1}`,
      code: `PX${ring + 1}`,
      angle,
      distance,
      indexes,
      instructions: `${rays} 射线 · ${side === 'pavilion' ? '亭部' : '冠部'} · 纹路生成器`,
      patternGroup: groupId,
      patternType: type,
    }
    const boundaryIndex = side === 'pavilion'
      ? nextDesign.tiers.findIndex(item => item.angle >= 0)
      : nextDesign.tiers.findIndex(item => item.angle === 0)
    const insertion = boundaryIndex >= 0 ? boundaryIndex : nextDesign.tiers.length
    nextDesign = { ...nextDesign, symmetryFolds: rays, tiers: [...nextDesign.tiers.slice(0, insertion), tier, ...nextDesign.tiers.slice(insertion)] }
    nextEdits = {
      ...nextEdits,
      [tierId]: Object.fromEntries(supports.map((support, facetIndex) => [facetIndex, { distanceDelta: support - distance }])),
    }
    const checked = buildGemFromDesign(nextDesign, nextEdits)
    const visible = checked.facets.filter(facet => facet.tier.id === tierId).length
    if (!visible) throw new Error(`第 ${ring + 1} 层切入过浅，请提高切入强度`)
    tierIds.push(tierId)
  }

  return { design: nextDesign, edits: nextEdits, tierIds, groupId }
}

export function removePatternGroup(design, facetEdits = {}, groupId) {
  const removed = design.tiers.filter(tier => tier.patternGroup === groupId).map(tier => tier.id)
  const edits = { ...facetEdits }
  removed.forEach(id => { delete edits[id] })
  return { design: { ...design, tiers: design.tiers.filter(tier => tier.patternGroup !== groupId) }, edits, removed }
}
