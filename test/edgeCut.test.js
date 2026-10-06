import test from 'node:test'
import assert from 'node:assert/strict'
import { BUILTIN_DESIGNS, buildGemFromDesign, parseAsc } from '../src/gemcad.js'
import { addEdgeBevels, removeEdgeBevelGroup } from '../src/edgeCut.js'

function standard() {
  const design = parseAsc(BUILTIN_DESIGNS[0].asc)
  return { design, model: buildGemFromDesign(design) }
}

test('单条棱边倒角会生成真实可见的新刻面', () => {
  const { design, model } = standard()
  const source = model.facets.find(facet => facet.tier.code === 'P2')
  const result = addEdgeBevels(design, model, { tierId: source.tier.id, facetIndex: source.facetIndex, edgeIndex: 0, widthPercent: .6, groupId: 'test-edge' })
  const beveled = buildGemFromDesign(result.design)
  assert.equal(result.count, 1)
  assert.ok(beveled.facets.some(facet => facet.tier.id === result.tierIds[0]))
  assert.equal(result.design.tiers.at(-1).edgeBevelGroup, 'test-edge')
})

test('整层模式会联动每个对称面的同一边位', () => {
  const { design, model } = standard()
  const source = model.facets.find(facet => facet.tier.code === 'P2')
  const result = addEdgeBevels(design, model, { tierId: source.tier.id, facetIndex: 0, edgeIndex: 0, scope: 'tier', widthPercent: .35, groupId: 'test-ring' })
  const beveled = buildGemFromDesign(result.design)
  assert.ok(result.count > 1)
  assert.equal(result.count, new Set(result.tierIds).size)
  result.tierIds.forEach(id => assert.ok(beveled.facets.some(facet => facet.tier.id === id), id))
})

test('倒角方向可偏向邻面并能整组移除', () => {
  const { design, model } = standard()
  const source = model.facets.find(facet => facet.tier.code === 'P2')
  const centered = addEdgeBevels(design, model, { tierId: source.tier.id, facetIndex: 0, edgeIndex: 0, directionBias: 0, groupId: 'centered' })
  const biased = addEdgeBevels(design, model, { tierId: source.tier.id, facetIndex: 0, edgeIndex: 0, directionBias: .55, groupId: 'biased' })
  assert.notEqual(centered.design.tiers.at(-1).angle, biased.design.tiers.at(-1).angle)
  assert.equal(biased.design.tiers.at(-1).edgeBevelBias, .55)
  const removed = removeEdgeBevelGroup(biased.design, {}, 'biased')
  assert.deepEqual(removed.design.tiers, design.tiers)
  assert.equal(removed.source.tierId, source.tier.id)
})
