import { facetNormal } from './gemcad.js'

function triangleArea(a, b, c) {
  const ab = b.map((value, axis) => value - a[axis]), ac = c.map((value, axis) => value - a[axis])
  const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]
  return Math.hypot(...cross) / 2
}
function facetArea(facet) { let area = 0; for (let index = 1; index < facet.points.length - 1; index += 1) area += triangleArea(facet.points[0], facet.points[index], facet.points[index + 1]); return area }
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const targetFor = facet => facet ? { tierId: facet.tier.id, facetIndex: facet.facetIndex } : null

function edgeRecords(model) {
  return model.facets.flatMap(facet => facet.points.map((point, index) => {
    const next = facet.points[(index + 1) % facet.points.length]
    return { facet, edgeIndex: index, length: Math.hypot(...point.map((value, axis) => value - next[axis])) }
  }))
}

function nearDuplicateFacets(model, width) {
  for (let first = 0; first < model.facets.length - 1; first += 1) {
    for (let second = first + 1; second < model.facets.length; second += 1) {
      const a = model.facets[first], b = model.facets[second]
      if (a.tier.id === b.tier.id && a.facetIndex === b.facetIndex) continue
      if (a.vGroove?.id && a.vGroove.id === b.vGroove?.id) continue
      if (dot(a.n, b.n) > Math.cos(.08 * Math.PI / 180) && Math.abs(a.d - b.d) / width < 2e-5) return [a, b]
    }
  }
  return null
}

function nearDuplicateDesignPlanes(design) {
  const planes = design.tiers.flatMap(tier => tier.indexes.map((index, facetIndex) => ({
    tier, facetIndex, n: facetNormal(tier.angle, index, design.gear, design.gearDirection), d: tier.distance,
  })))
  const distanceScale = Math.max(1, ...planes.map(plane => Math.abs(plane.d)))
  for (let first = 0; first < planes.length - 1; first += 1) {
    for (let second = first + 1; second < planes.length; second += 1) {
      const a = planes[first], b = planes[second]
      if (dot(a.n, b.n) > Math.cos(.08 * Math.PI / 180) && Math.abs(a.d - b.d) / distanceScale < 2e-5) return [a, b]
    }
  }
  return null
}

export function validateForProduction(design, model, measures, roughFit, defectReport, options = {}) {
  const checks = []
  const add = (id, level, label, detail, target = null) => checks.push({ id, level, label, detail, target })
  const intendedFacets = design.tiers.reduce((sum, tier) => sum + tier.indexes.length, 0)
  const missing = intendedFacets - model.facets.length
  if (missing > 0) {
    const missingTarget = design.tiers.flatMap(tier => tier.indexes.map((_, facetIndex) => ({ tierId: tier.id, facetIndex }))).find(target => !model.facets.some(facet => facet.tier.id === target.tierId && facet.facetIndex === target.facetIndex))
    add('missing-facets', 'error', '存在消失刻面', `${missing} 个切割平面没有形成可见刻面，请检查角度与中心距。`, missingTarget)
  }
  const duplicateTiers = design.tiers.filter(tier => { const indexes = tier.indexes.map(index => ((index % design.gear) + design.gear) % design.gear); return new Set(indexes.map(index => index.toFixed(6))).size !== indexes.length })
  if (duplicateTiers.length) add('duplicate-indexes', 'error', '存在重复齿位', `${duplicateTiers.map(tier => tier.name).join('、')} 包含重叠方向。`, { tierId: duplicateTiers[0].id, facetIndex: 0 })

  const areaReference = measures.width ** 2
  const areaRecords = model.facets.map(facet => ({ facet, area: facetArea(facet) })).sort((a, b) => a.area - b.area)
  const tiny = areaRecords.filter(item => item.area / areaReference < 1e-5)
  const verySmall = areaRecords.filter(item => item.area / areaReference >= 1e-5 && item.area / areaReference < 8e-5)
  const areaScale = Number(options.modelScale) || 0
  const minimumAreaText = areaScale ? `，最小约 ${(areaRecords[0].area * areaScale ** 2).toFixed(4)} mm²` : ''
  if (tiny.length) add('tiny-facets', 'error', '存在极小碎面', `${tiny.length} 个刻面面积过小${minimumAreaText}，实际切磨时可能无法稳定形成。`, targetFor(tiny[0].facet))
  else if (verySmall.length) add('small-facets', 'warning', '刻面尺寸偏小', `${verySmall.length} 个刻面接近最小面积阈值${minimumAreaText}，建议放大检查。`, targetFor(verySmall[0].facet))

  const edges = edgeRecords(model).sort((a, b) => a.length - b.length)
  const short = edges.filter(edge => edge.length / measures.width < .006)
  const narrow = edges.filter(edge => edge.length / measures.width >= .006 && edge.length / measures.width < .014)
  const minEdgeText = areaScale ? `${(edges[0].length * areaScale).toFixed(3)} mm` : `${(edges[0].length / measures.width * 100).toFixed(2)}% 宽度`
  if (short.length) add('short-edges', 'error', '存在过短棱边', `检测到 ${short.length} 条极短边，最短 ${minEdgeText}；可能形成崩口、碎面或无法稳定抛光。`, targetFor(short[0].facet))
  else if (narrow.length) add('narrow-edges', 'warning', '棱边加工余量偏小', `检测到 ${narrow.length} 条较短边，最短 ${minEdgeText}；请结合设备精度复核。`, targetFor(narrow[0].facet))

  const duplicateDesignPlanes = nearDuplicateDesignPlanes(design)
  const duplicatePlanes = duplicateDesignPlanes || nearDuplicateFacets(model, measures.width)
  if (duplicatePlanes) {
    const first = duplicatePlanes[0], second = duplicatePlanes[1]
    const secondTarget = second.facet ? targetFor(second) : { tierId: second.tier.id, facetIndex: second.facetIndex }
    add('near-duplicate-planes', 'error', '存在近重合切面', `${first.tier.name} 与 ${second.tier.name} 的方向和层位几乎相同，可能产生零宽碎面。`, secondTarget)
  }

  const extreme = model.facets.find(facet => Math.abs(facet.angle) > .01 && Math.abs(facet.angle) < 1)
  if (extreme) add('extreme-angle', 'warning', '存在极浅切割角', `${extreme.tier.name} No.${extreme.facetIndex + 1} 的角度为 ${extreme.angle.toFixed(3)}°，夹持与抛光控制要求较高。`, targetFor(extreme))

  const bevelTiers = design.tiers.filter(tier => tier.edgeBevelGroup)
  const vGrooves = design.vGrooves || []
  if (bevelTiers.length && options.finishedWidth) {
    const minBevelMm = Math.min(...bevelTiers.map(tier => tier.edgeBevelWidth * options.finishedWidth / 100))
    if (minBevelMm < .015) add('bevel-too-fine', 'error', '倒角小于常规加工分辨率', `最小倒角法向进刀约 ${minBevelMm.toFixed(3)} mm，容易在抛光时消失。`, { tierId: bevelTiers[0].id, facetIndex: 0 })
    else if (minBevelMm < .04) add('bevel-fine', 'warning', '倒角尺寸较精细', `最小倒角法向进刀约 ${minBevelMm.toFixed(3)} mm，请确认设备跳动和抛光余量。`, { tierId: bevelTiers[0].id, facetIndex: 0 })
  }
  if (measures.girdleToWidth < .005) add('thin-girdle', 'error', '腰围过薄', `腰围约为宽度的 ${(measures.girdleToWidth * 100).toFixed(2)}%，存在崩口风险。`)
  else if (measures.girdleToWidth < .015) add('thin-girdle', 'warning', '腰围偏薄', `腰围约为宽度的 ${(measures.girdleToWidth * 100).toFixed(2)}%，建议结合材料韧性复核。`)
  if (roughFit?.active && !roughFit.fits) add('outside-rough', 'error', '成品穿出原石', `${roughFit.outside}/${roughFit.total} 个成品顶点位于原石外${roughFit.maxOverflowMm == null ? '。' : `，最大近似超出 ${roughFit.maxOverflowMm.toFixed(2)} mm。`}`)
  if (defectReport?.conflicts) add('defect-conflicts', 'error', '成品与原石缺陷冲突', `${defectReport.conflicts} 个包体、裂隙或禁切区侵入当前成品范围，请移动、旋转或缩小成品。`)
  if (!checks.length) add('ready', 'ok', '生产几何检查通过', '未发现穿出、消失刻面、重复齿位、碎面、短棱边、近重合切面或过薄腰围。')
  return {
    checks,
    errors: checks.filter(check => check.level === 'error').length,
    warnings: checks.filter(check => check.level === 'warning').length,
    metrics: {
      minEdgeMm: areaScale ? edges[0].length * areaScale : null,
      minFacetAreaMm2: areaScale ? areaRecords[0].area * areaScale ** 2 : null,
      bevelOperations: new Set(bevelTiers.map(tier => tier.edgeBevelGroup)).size,
      vGrooveOperations: new Set(vGrooves.map(operation => operation.groupId)).size,
    },
  }
}
