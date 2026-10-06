import test from 'node:test'
import assert from 'node:assert/strict'
import { BUILTIN_DESIGNS, buildGemFromDesign, parseAsc } from '../src/gemcad.js'
import { addPatternTiers } from '../src/pattern.js'

const load = item => item.asc ? parseAsc(item.asc) : structuredClone(item.design)

test('全部内置琢型优先使用增量多面体裁切器', () => {
  BUILTIN_DESIGNS.forEach(item => {
    const model = buildGemFromDesign(load(item))
    assert.equal(model.solver, 'incremental-clipping', item.id)
    assert.equal(model.solverFallback, undefined, item.id)
  })
})

test('复杂纹路和大尺度坐标仍使用增量裁切器', () => {
  const source = parseAsc(BUILTIN_DESIGNS[0].asc)
  const patterned = addPatternTiers(source, {}, { type: 'web', side: 'pavilion', rays: 12, rings: 4, strength: 1.4, groupId: 'solver-stress' })
  const model = buildGemFromDesign(patterned.design, patterned.edits)
  assert.equal(model.solver, 'incremental-clipping')
  assert.ok(model.facets.length > 73)
  const scaled = { ...source, tiers: source.tiers.map(tier => ({ ...tier, distance: tier.distance * 100 })) }
  const scaledModel = buildGemFromDesign(scaled)
  assert.equal(scaledModel.solver, 'incremental-clipping')
  assert.equal(scaledModel.facets.length, 73)
})
