import test from 'node:test'
import assert from 'node:assert/strict'
import { BUILTIN_DESIGNS, buildGemFromDesign, parseAsc } from '../src/gemcad.js'
import { addPatternTiers, removePatternGroup } from '../src/pattern.js'

function load(item) {
  return item.asc ? parseAsc(item.asc) : structuredClone(item.design)
}

test('纹路设计器可在不同外形生成真实亭部刻面', () => {
  for (const id of ['standard-round', 'smallest-square', 'starter-oval', 'starter-marquise']) {
    const source = load(BUILTIN_DESIGNS.find(item => item.id === id))
    const result = addPatternTiers(source, {}, { type: 'star', side: 'pavilion', rays: 7, strength: 1.5, groupId: `test-${id}` })
    const model = buildGemFromDesign(result.design, result.edits)
    assert.equal(result.tierIds.length, 1, id)
    assert.ok(model.facets.some(facet => facet.tier.id === result.tierIds[0]), id)
  }
})

test('蛛网与花瓣模式可生成多层并可整体移除', () => {
  const source = parseAsc(BUILTIN_DESIGNS[0].asc)
  for (const type of ['web', 'petal']) {
    const result = addPatternTiers(source, {}, { type, side: 'pavilion', rays: type === 'petal' ? 5 : 8, rings: 3, strength: 1.8, groupId: `test-${type}` })
    const model = buildGemFromDesign(result.design, result.edits)
    assert.equal(result.tierIds.length, 3)
    result.tierIds.forEach(id => assert.ok(model.facets.some(facet => facet.tier.id === id), `${type}:${id}`))
    const removed = removePatternGroup(result.design, result.edits, result.groupId)
    assert.equal(removed.removed.length, 3)
    assert.equal(removed.design.tiers.length, source.tiers.length)
  }
})
