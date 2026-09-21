import test from 'node:test'
import assert from 'node:assert/strict'
import { STANDARD_ROUND_BRILLIANT_ASC, buildGemFromDesign, measureGem, parseAsc } from '../src/gemcad.js'
import { evaluateRoughFit, pointInRough } from '../src/rough.js'
import { validateForProduction } from '../src/validation.js'

const baseRough = { visible: true, shape: 'pebble', length: 14, width: 14, height: 10, rotationX: 0, rotationY: 0, rotationZ: 0, offsetX: 0, offsetY: 0, offsetZ: 0 }
test('原石包容检测会识别完全包容和成品穿出', () => { const design = parseAsc(STANDARD_ROUND_BRILLIANT_ASC), model = buildGemFromDesign(design), measures = measureGem(model), modelScale = 10 / measures.width; const fitting = evaluateRoughFit(model, modelScale, baseRough), tooSmall = evaluateRoughFit(model, modelScale, { ...baseRough, length: 7, width: 7, height: 4 }); assert.equal(fitting.fits, true); assert.equal(tooSmall.fits, false); assert.ok(tooSmall.outside > 0); assert.ok(tooSmall.maxOverflowMm > 0) })
test('原石检测计入平移和旋转', () => { assert.equal(pointInRough([0, 0, 0], baseRough).inside, true); assert.equal(pointInRough([8, 0, 0], baseRough).inside, false); const shifted = { ...baseRough, shape: 'tabular', length: 4, width: 2, height: 2, offsetX: 3, rotationY: 90 }; assert.equal(pointInRough([3, 0, 1.8], shifted).inside, true); assert.equal(pointInRough([4.2, 0, 0], shifted).inside, false) })
test('生产检查会报告原石穿出和重复齿位', () => { const design = parseAsc(STANDARD_ROUND_BRILLIANT_ASC); design.tiers[0].indexes.push(design.tiers[0].indexes[0]); const model = buildGemFromDesign(design), measures = measureGem(model), roughFit = evaluateRoughFit(model, 10 / measures.width, { ...baseRough, length: 5, width: 5, height: 3 }), report = validateForProduction(design, model, measures, roughFit); assert.ok(report.errors >= 2); assert.ok(report.checks.some(check => check.id === 'duplicate-indexes')); assert.ok(report.checks.some(check => check.id === 'outside-rough')) })
