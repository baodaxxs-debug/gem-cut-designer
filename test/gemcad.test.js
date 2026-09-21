import test from 'node:test'
import assert from 'node:assert/strict'
import { BUILTIN_DESIGNS, COMPEAR_125_ASC, CUBE_ILLUSION_TRIANGLE_ASC, FIREWORKS_ROUND_ASC, STANDARD_ROUND_BRILLIANT_ASC, buildGemFromDesign, convertDesignGear, distanceThroughPoint, materializeDesign, measureGem, parseAsc, serializeAsc } from '../src/gemcad.js'
import { traceFaceUp } from '../src/raytrace.js'
import { optimizePavilion, shiftPavilion } from '../src/optimizer.js'
import { serializeDxf, uniqueEdges } from '../src/diagram.js'

test('标准圆明亮式可建成封闭的 73 面模型', () => {
  const design = parseAsc(STANDARD_ROUND_BRILLIANT_ASC)
  const model = buildGemFromDesign(design)
  assert.equal(model.facets.length, 73)
  assert.equal(model.vertexCount, 57)
  assert.ok(Math.abs(measureGem(model).lengthToWidth - 1) < 1e-6)
})

test('8 射线烟花切形成可编辑亭部星芒强调面', () => {
  const design = parseAsc(FIREWORKS_ROUND_ASC)
  const model = buildGemFromDesign(design)
  const accent = design.tiers.find(tier => tier.code === 'F')
  assert.equal(model.facets.length, 81)
  assert.equal(accent.indexes.length, 8)
  assert.equal(model.facets.filter(facet => facet.tier.id === accent.id).length, 8)
  assert.ok(model.facets.filter(facet => facet.tier.id === accent.id).every(facet => facet.points.length >= 4))
})

test('ASC 导出再导入保留齿轮、层和刻面', () => {
  const original = parseAsc(STANDARD_ROUND_BRILLIANT_ASC)
  const restored = parseAsc(serializeAsc(original))
  assert.equal(restored.gear, original.gear)
  assert.equal(restored.tiers.length, original.tiers.length)
  assert.deepEqual(restored.tiers.map(tier => tier.indexes), original.tiers.map(tier => tier.indexes))
})

test('自由不对称设计保留独立齿位和无镜像元数据', () => {
  const design = parseAsc(STANDARD_ROUND_BRILLIANT_ASC)
  const tier = design.tiers.find(item => item.code === 'P2')
  const asymmetric = {
    ...design,
    symmetryFolds: 1,
    symmetryMirror: false,
    tiers: design.tiers.map(item => item.id === tier.id
      ? { ...item, indexes: [...item.indexes, 6] }
      : item),
  }
  const model = buildGemFromDesign(asymmetric)
  assert.equal(model.facets.length, 74)
  const restored = parseAsc(serializeAsc(asymmetric))
  assert.equal(restored.symmetryFolds, 1)
  assert.equal(restored.symmetryMirror, false)
  assert.deepEqual(restored.tiers.find(item => item.code === 'P2').indexes, asymmetric.tiers.find(item => item.code === 'P2').indexes)
  assert.equal(buildGemFromDesign(restored).facets.length, 74)
})

test('单刻面修改可物化为 GemCad 切割层', () => {
  const design = parseAsc(STANDARD_ROUND_BRILLIANT_ASC)
  const tier = design.tiers.find(item => item.code === 'P2')
  const baked = materializeDesign(design, { [tier.id]: { 0: { angle: -43 } } })
  assert.equal(baked.tiers.reduce((sum, item) => sum + item.indexes.length, 0), 73)
  assert.ok(baked.tiers.some(item => item.angle === -43 && item.indexes.length === 1))
})

test('改变刻面角度时可反算距离并保持指定相接点', () => {
  const design = parseAsc(STANDARD_ROUND_BRILLIANT_ASC), original = buildGemFromDesign(design), tier = design.tiers.find(item => item.code === 'P2'), facet = original.facets.find(item => item.tier.id === tier.id && item.facetIndex === 0), target = facet.points[0].map(value => value / original.scale), angle = -42, distance = distanceThroughPoint(angle, tier.indexes[0], design.gear, target, design.gearDirection)
  const changed = buildGemFromDesign(design, { [tier.id]: { 0: { angle, distanceDelta: distance - tier.distance } } }), changedFacet = changed.facets.find(item => item.tier.id === tier.id && item.facetIndex === 0), closest = Math.min(...changedFacet.points.map(point => Math.hypot(...point.map((value, axis) => value / changed.scale - target[axis]))))
  assert.ok(closest < 1e-5)
})

test('没有单面修改时物化设计保持层 ID 稳定', () => {
  const design = parseAsc(STANDARD_ROUND_BRILLIANT_ASC)
  assert.deepEqual(materializeDesign(design).tiers.map(tier => tier.id), design.tiers.map(tier => tier.id))
})

test('96 齿换算 80 齿保持方位并报告误差', () => {
  const design = parseAsc(STANDARD_ROUND_BRILLIANT_ASC)
  const result = convertDesignGear(design, 80)
  assert.equal(result.design.gear, 80)
  assert.ok(result.maxErrorDegrees <= 2.250001)
  assert.equal(buildGemFromDesign(result.design).facets.length, 73)
})

test('面朝上光线追踪返回有限结果', () => {
  const model = buildGemFromDesign(parseAsc(STANDARD_ROUND_BRILLIANT_ASC))
  const result = traceFaceUp(model, 1.54, 9, 12)
  assert.ok(result.entered > 0)
  assert.ok(result.returnPercent >= 0 && result.returnPercent <= 100)
  assert.ok(result.leakagePercent >= 0 && result.leakagePercent <= 100)
})

test('梨形示例保持约 1.25 长宽比', () => {
  const model = buildGemFromDesign(parseAsc(COMPEAR_125_ASC))
  assert.equal(model.facets.length, 67)
  assert.ok(Math.abs(measureGem(model).lengthToWidth - 1.25) < .01)
})

test('负齿轮方向的三角形 ASC 可导入、建模和往返', () => {
  const design = parseAsc(CUBE_ILLUSION_TRIANGLE_ASC)
  assert.equal(design.gear, 96)
  assert.equal(design.gearDirection, -1)
  const model = buildGemFromDesign(design)
  assert.equal(model.facets.length, 51)
  assert.equal(model.facets.filter(facet => Math.abs(facet.angle) < 89.95).length, 39)
  assert.equal(parseAsc(serializeAsc(design)).gearDirection, -1)
})

test('四种参数化常见外形均可封闭建模并导出 ASC', () => {
  const starters = BUILTIN_DESIGNS.filter(item => item.id.startsWith('starter-'))
  assert.equal(starters.length, 4)
  starters.forEach(item => {
    const model = buildGemFromDesign(item.design)
    const metrics = measureGem(model)
    assert.ok(model.facets.length >= 25, item.id)
    assert.equal(model.facets.length, item.design.tiers.reduce((sum, tier) => sum + tier.indexes.length, 0), item.id)
    assert.ok(metrics.lengthToWidth > 1.05, item.id)
    const restored = parseAsc(serializeAsc(item.design))
    assert.equal(buildGemFromDesign(restored).facets.length, model.facets.length, item.id)
  })
})

test('亭角优化器比较候选方案且不会降低评分', () => {
  const design = shiftPavilion(parseAsc(STANDARD_ROUND_BRILLIANT_ASC), -4)
  const result = optimizePavilion(design, 1.54, { range: 3, step: 1, resolution: 7 })
  assert.equal(result.tested, 7)
  assert.ok(result.best.score >= result.baseline.score)
  assert.ok(buildGemFromDesign(result.best.design).facets.length > 60)
})

test('DXF 只导出真实刻面边界并包含俯视与侧视图层', () => {
  const model = buildGemFromDesign(parseAsc(STANDARD_ROUND_BRILLIANT_ASC))
  const edgeCount = uniqueEdges(model).length
  const dxf = serializeDxf(model, 4, 'Round Brilliant')
  assert.match(dxf, /CROWN_VIEW/)
  assert.match(dxf, /SIDE_VIEW/)
  assert.match(dxf, /\$INSUNITS\n70\n4/)
  assert.equal((dxf.match(/\nLINE\n/g) || []).length, edgeCount * 2)
})
