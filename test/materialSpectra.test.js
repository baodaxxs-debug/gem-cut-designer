import test from 'node:test'
import assert from 'node:assert/strict'
import { createMaterialAbsorptionSpectrum, materialAbsorptionSamples } from '../src/materialSpectra.js'

test('材料光谱吸收系数有限、非负并随浓度增强', () => {
  const pale = materialAbsorptionSamples('ruby', '#e11445', .2)
  const strong = materialAbsorptionSamples('ruby', '#e11445', .9)
  assert.equal(strong.length, 5)
  strong.forEach((value, index) => {
    assert.ok(Number.isFinite(value) && value >= 0)
    assert.ok(value > pale[index])
  })
})

test('红宝石与蓝宝石具有相反的长短波吸收趋势', () => {
  const ruby = materialAbsorptionSamples('ruby', '#e11445', .8)
  const sapphire = materialAbsorptionSamples('sapphire', '#245bd7', .8)
  assert.ok(ruby[0] > ruby[4])
  assert.ok(sapphire[0] < sapphire[4])
})

test('连续光谱在五个采样点之间插值', () => {
  const samples = materialAbsorptionSamples('emerald', '#078a58', .75)
  const spectrum = createMaterialAbsorptionSpectrum('emerald', '#078a58', .75)
  assert.equal(spectrum(550), samples[2])
  const halfway = spectrum(575)
  assert.ok(halfway > Math.min(samples[2], samples[3]) && halfway < Math.max(samples[2], samples[3]))
})
