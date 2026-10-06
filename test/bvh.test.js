import test from 'node:test'
import assert from 'node:assert/strict'
import { STANDARD_ROUND_BRILLIANT_ASC, buildGemFromDesign, parseAsc } from '../src/gemcad.js'
import { createModelBvh, intersectBvh } from '../src/bvh.js'
import { traceFaceUp } from '../src/raytrace.js'

test('BVH 可命中标准圆明亮式台面并生成层级统计', () => {
  const model = buildGemFromDesign(parseAsc(STANDARD_ROUND_BRILLIANT_ASC))
  const bvh = createModelBvh(model)
  const hit = intersectBvh(bvh, [0, 5, 0], [0, -1, 0])
  assert.equal(hit.facet.tier.code, 'T')
  assert.ok(bvh.stats.nodes > bvh.stats.leaves)
  assert.ok(bvh.stats.triangles > model.facets.length)
})

test('面朝上光线追踪使用 BVH 加速结构', () => {
  const model = buildGemFromDesign(parseAsc(STANDARD_ROUND_BRILLIANT_ASC))
  const result = traceFaceUp(model, 1.54, 9, 8)
  assert.equal(result.acceleration, 'bvh')
  assert.ok(result.bvhStats.triangles > 0)
})
