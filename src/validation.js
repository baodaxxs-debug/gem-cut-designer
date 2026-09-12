function triangleArea(a, b, c) {
  const ab = b.map((value, axis) => value - a[axis]), ac = c.map((value, axis) => value - a[axis])
  const cross = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]
  return Math.hypot(...cross) / 2
}
function facetArea(facet) { let area = 0; for (let index = 1; index < facet.points.length - 1; index += 1) area += triangleArea(facet.points[0], facet.points[index], facet.points[index + 1]); return area }

export function validateForProduction(design, model, measures, roughFit, defectReport) {
  const checks = []
  const add = (id, level, label, detail) => checks.push({ id, level, label, detail })
  const intendedFacets = design.tiers.reduce((sum, tier) => sum + tier.indexes.length, 0)
  const missing = intendedFacets - model.facets.length
  if (missing > 0) add('missing-facets', 'error', '存在消失刻面', `${missing} 个切割平面没有形成可见刻面，请检查角度与中心距。`)
  const duplicateTiers = design.tiers.filter(tier => { const indexes = tier.indexes.map(index => ((index % design.gear) + design.gear) % design.gear); return new Set(indexes.map(index => index.toFixed(6))).size !== indexes.length })
  if (duplicateTiers.length) add('duplicate-indexes', 'error', '存在重复齿位', `${duplicateTiers.map(tier => tier.name).join('、')} 包含重叠方向。`)
  const areas = model.facets.map(facetArea), areaReference = measures.width ** 2
  const tiny = areas.filter(area => area / areaReference < 1e-5).length
  const verySmall = areas.filter(area => area / areaReference >= 1e-5 && area / areaReference < 8e-5).length
  if (tiny) add('tiny-facets', 'error', '存在极小刻面', `${tiny} 个刻面面积过小，实际切磨时可能无法稳定形成。`)
  else if (verySmall) add('small-facets', 'warning', '刻面尺寸偏小', `${verySmall} 个刻面接近最小面积阈值，建议放大检查。`)
  if (measures.girdleToWidth < .005) add('thin-girdle', 'error', '腰围过薄', `腰围约为宽度的 ${(measures.girdleToWidth * 100).toFixed(2)}%，存在崩口风险。`)
  else if (measures.girdleToWidth < .015) add('thin-girdle', 'warning', '腰围偏薄', `腰围约为宽度的 ${(measures.girdleToWidth * 100).toFixed(2)}%，建议结合材料韧性复核。`)
  if (roughFit?.active && !roughFit.fits) add('outside-rough', 'error', '成品穿出原石', `${roughFit.outside}/${roughFit.total} 个成品顶点位于原石外${roughFit.maxOverflowMm == null ? '。' : `，最大近似超出 ${roughFit.maxOverflowMm.toFixed(2)} mm。`}`)
  if (defectReport?.conflicts) add('defect-conflicts', 'error', '成品与原石缺陷冲突', `${defectReport.conflicts} 个包体、裂隙或禁切区侵入当前成品范围，请移动、旋转或缩小成品。`)
  if (!checks.length) add('ready', 'ok', '基础几何检查通过', '未发现穿出、消失刻面、重复齿位、极小刻面或过薄腰围。')
  return { checks, errors: checks.filter(check => check.level === 'error').length, warnings: checks.filter(check => check.level === 'warning').length }
}
