import test from 'node:test'
import assert from 'node:assert/strict'
import { BUILTIN_DESIGNS, buildGemFromDesign, measureGem, parseAsc } from '../src/gemcad.js'
import { evenlySpacedIndexes, setGirdleThickness } from '../src/girdle.js'

test('腰围厚度调整保持中心并接近目标毫米值', () => {
  const design = parseAsc(BUILTIN_DESIGNS[0].asc)
  const model = buildGemFromDesign(design)
  const measures = measureGem(model)
  const finishedWidth = 10
  const modelScale = finishedWidth / measures.width
  const beforeCenter = (measures.girdleTop + measures.girdleBottom) / 2
  const target = measures.girdle * modelScale + .25
  const adjusted = setGirdleThickness(design, measures.girdle * modelScale, target, model.scale * modelScale)
  const nextMeasures = measureGem(buildGemFromDesign(adjusted))
  const nextScale = finishedWidth / nextMeasures.width
  assert.ok(Math.abs(nextMeasures.girdle * nextScale - target) < .015)
  assert.ok(Math.abs((nextMeasures.girdleTop + nextMeasures.girdleBottom) / 2 - beforeCenter) < .002)
})

test('腰围面数生成等距齿位并要求整除索引轮', () => {
  assert.deepEqual(evenlySpacedIndexes(96, 8), [96, 84, 72, 60, 48, 36, 24, 12])
  assert.throws(() => evenlySpacedIndexes(96, 10), /整除/)
})
