import test from 'node:test'
import assert from 'node:assert/strict'
import { BUILTIN_DESIGNS, buildGemFromDesign, measureGem, parseAsc } from '../src/gemcad.js'
import { addPathGroove, addVGrooves, mapPathToFacet, removeVGrooveGroup } from '../src/vGroove.js'
import { evaluateDefects } from '../src/defects.js'

test('V 槽使用布尔减法生成真实凹入内壁并可整组移除', () => {
  const design = parseAsc(BUILTIN_DESIGNS[0].asc)
  const model = buildGemFromDesign(design)
  const table = model.facets.find(facet => facet.tier.code === 'T')
  assert.ok(table)
  const result = addVGrooves(design, model, { tierId: table.tier.id, facetIndex: table.facetIndex, edgeIndex: 0, widthPercent: 2, includedAngle: 80 })
  const cut = buildGemFromDesign(result.design)
  assert.equal(cut.solver, 'bsp-csg-v-groove')
  assert.ok(cut.hasConcaveCuts)
  assert.ok(cut.facets.some(facet => facet.vGroove?.groupId === result.groupId))
  assert.ok(cut.vertexCount > model.vertexCount)
  assert.ok(measureGem(cut).volume < measureGem(model).volume)
  const removed = removeVGrooveGroup(result.design, result.groupId)
  assert.equal(removed.removed.length, 1)
  assert.equal(buildGemFromDesign(removed.design).solver, 'incremental-clipping')
})

test('V 槽整层模式为同层刻面建立成组工序', () => {
  const design = parseAsc(BUILTIN_DESIGNS[0].asc)
  const model = buildGemFromDesign(design)
  const crown = model.facets.find(facet => facet.tier.code === 'B')
  const result = addVGrooves(design, model, { tierId: crown.tier.id, facetIndex: crown.facetIndex, edgeIndex: 0, scope: 'tier', widthPercent: 1.2, includedAngle: 100 })
  assert.equal(result.count, crown.tier.indexes.length)
  assert.equal(new Set(result.operations.map(operation => operation.groupId)).size, 1)
  assert.doesNotThrow(() => buildGemFromDesign(result.design))
})

test('凹切后缺陷检测使用真实网格而不是凸包半空间', () => {
  const design = parseAsc(BUILTIN_DESIGNS[0].asc)
  const model = buildGemFromDesign(design)
  const table = model.facets.find(facet => facet.tier.code === 'T')
  const result = addVGrooves(design, model, { tierId: table.tier.id, facetIndex: table.facetIndex, edgeIndex: 0, widthPercent: 4, includedAngle: 70 })
  const cut = buildGemFromDesign(result.design), operation = result.operations[0]
  const midpoint = operation.a.map((value, axis) => (value + operation.b[axis]) / 2 - operation.n[axis] * operation.depth * .35)
  const defect = { id: 'in-groove', type: 'inclusion', x: midpoint[0], y: midpoint[1], z: midpoint[2], radius: .001 }
  const rough = { rotationX: 0, rotationY: 0, rotationZ: 0, offsetX: 0, offsetY: 0, offsetZ: 0 }
  assert.equal(evaluateDefects(model, 1, rough, [defect]).items[0].centerInside, true)
  assert.equal(evaluateDefects(cut, 1, rough, [defect]).items[0].centerInside, false)
})

test('圆头刀沿棱边生成圆弧凹槽并保留刀具参数', () => {
  const design = parseAsc(BUILTIN_DESIGNS[0].asc)
  const model = buildGemFromDesign(design)
  const crown = model.facets.find(facet => facet.tier.code === 'B')
  const result = addVGrooves(design, model, { tierId: crown.tier.id, facetIndex: crown.facetIndex, edgeIndex: 0, toolType: 'round', widthPercent: 3, depthPercent: 45 })
  const cut = buildGemFromDesign(result.design)
  assert.equal(result.operations[0].toolType, 'round')
  assert.equal(result.operations[0].depthPercent, 45)
  assert.ok(cut.facets.filter(facet => facet.vGroove?.toolType === 'round').length >= 5)
  assert.ok(measureGem(cut).volume < measureGem(model).volume)
})

test('二维自由路径映射到所选刻面并生成连续凹槽段', () => {
  const design = parseAsc(BUILTIN_DESIGNS[0].asc)
  const model = buildGemFromDesign(design)
  const table = model.facets.find(facet => facet.tier.code === 'T')
  const path = [[-.75, -.2], [-.2, .35], [.3, -.15], [.75, .25]]
  const mapped = mapPathToFacet(table, path)
  mapped.forEach(point => assert.ok(Math.abs(point.reduce((sum, value, axis) => sum + value * table.n[axis], 0) - table.d) < 1e-5))
  const result = addPathGroove(design, model, { tierId: table.tier.id, facetIndex: table.facetIndex, path, toolType: 'round', widthPercent: 1.5, depthPercent: 35 })
  assert.equal(result.count, path.length - 1)
  assert.ok(result.operations.every((operation, index) => operation.scope === 'path' && operation.pathOrder === index))
  const cut = buildGemFromDesign(result.design)
  assert.ok(cut.facets.some(facet => facet.vGroove?.groupId === result.groupId))
  assert.ok(measureGem(cut).volume < measureGem(model).volume)
})
