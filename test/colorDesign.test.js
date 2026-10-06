import test from 'node:test'
import assert from 'node:assert/strict'
import { STANDARD_ROUND_BRILLIANT_ASC, parseAsc } from '../src/gemcad.js'
import { createTierPalette, tuneGemColor } from '../src/colorDesign.js'

test('宝石体色可独立调整饱和度和明暗', () => {
  assert.equal(tuneGemColor('#ff0000', 0, 1), '#363636')
  assert.equal(tuneGemColor('#808080', 1.4, 1), '#808080')
  assert.equal(tuneGemColor('#804020', 1, .5), '#402010')
})

test('教学配色会区分普通层、台面、腰围与特殊工序', () => {
  const design = parseAsc(STANDARD_ROUND_BRILLIANT_ASC)
  design.tiers.push({ id: 'pattern', angle: -30, patternGroup: 'p' }, { id: 'bevel', angle: 20, edgeBevelGroup: 'b' })
  const colors = createTierPalette(design, 'contrast')
  assert.equal(colors[design.tiers.find(tier => tier.code === 'T').id], '#d7c27a')
  assert.equal(colors.pattern, '#9d79bd')
  assert.equal(colors.bevel, '#d487b5')
})
