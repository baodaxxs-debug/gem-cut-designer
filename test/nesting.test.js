import test from 'node:test'
import assert from 'node:assert/strict'
import { STANDARD_ROUND_BRILLIANT_ASC, buildGemFromDesign, measureGem, parseAsc } from '../src/gemcad.js'
import { optimizeRoughPlacement } from '../src/nesting.js'
test('自动套料可改善偏移原石的包容结果', () => { const model = buildGemFromDesign(parseAsc(STANDARD_ROUND_BRILLIANT_ASC)), scale = 10 / measureGem(model).width; const rough = { visible: true, shape: 'tabular', length: 12, width: 12, height: 8, opacity: .2, color: '#fff', rotationX: 0, rotationY: 0, rotationZ: 0, offsetX: 5, offsetY: 0, offsetZ: 0 }; const result = optimizeRoughPlacement(model, scale, rough); assert.ok(result.tested > 100); assert.equal(result.improved, true); assert.ok(result.best.fit.outside < result.baseline.fit.outside); assert.equal(result.best.fit.fits, true) })
