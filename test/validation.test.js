import test from 'node:test'
import assert from 'node:assert/strict'
import { STANDARD_ROUND_BRILLIANT_ASC, buildGemFromDesign, measureGem, parseAsc } from '../src/gemcad.js'
import { validateForProduction } from '../src/validation.js'

test('生产检查返回毫米级最小棱边与刻面指标', () => {
  const design = parseAsc(STANDARD_ROUND_BRILLIANT_ASC)
  const model = buildGemFromDesign(design)
  const measures = measureGem(model)
  const finishedWidth = 10
  const report = validateForProduction(design, model, measures, null, null, { modelScale: finishedWidth / measures.width, finishedWidth })
  assert.ok(report.metrics.minEdgeMm > 0)
  assert.ok(report.metrics.minFacetAreaMm2 > 0)
  assert.equal(report.metrics.bevelOperations, 0)
})

test('生产检查识别跨图层近重合切面并提供定位目标', () => {
  const design = parseAsc(STANDARD_ROUND_BRILLIANT_ASC)
  const table = design.tiers.find(tier => tier.code === 'T')
  design.tiers.push({ ...table, id: 'duplicate-table', name: '重复台面', code: 'DT' })
  const model = buildGemFromDesign(design)
  const measures = measureGem(model)
  const report = validateForProduction(design, model, measures)
  const issue = report.checks.find(check => check.id === 'near-duplicate-planes')
  assert.equal(issue.level, 'error')
  assert.equal(issue.target.tierId, 'duplicate-table')
})
