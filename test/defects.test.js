import test from 'node:test'
import assert from 'node:assert/strict'
import { STANDARD_ROUND_BRILLIANT_ASC, buildGemFromDesign, measureGem, parseAsc } from '../src/gemcad.js'
import { evaluateDefects } from '../src/defects.js'
const rough = { offsetX: 0, offsetY: 0, offsetZ: 0, rotationX: 0, rotationY: 0, rotationZ: 0 }
test('缺陷检查区分侵入成品和远离成品的包体', () => { const model = buildGemFromDesign(parseAsc(STANDARD_ROUND_BRILLIANT_ASC)), scale = 10 / measureGem(model).width; const result = evaluateDefects(model, scale, rough, [{ id: 'inside', type: 'inclusion', x: 0, y: 0, z: 0, radius: .5 }, { id: 'outside', type: 'inclusion', x: 20, y: 0, z: 0, radius: .5 }]); assert.equal(result.conflicts, 1); assert.equal(result.items[0].centerInside, true); assert.equal(result.items[1].conflict, false) })
test('缺陷位置跟随原石旋转和平移', () => { const model = buildGemFromDesign(parseAsc(STANDARD_ROUND_BRILLIANT_ASC)), scale = 10 / measureGem(model).width; const result = evaluateDefects(model, scale, { ...rough, offsetX: 20, rotationY: 90 }, [{ id: 'moved', type: 'void', x: 0, y: 0, z: 0, radius: 1 }]); assert.equal(result.conflicts, 0); assert.ok(Math.abs(result.items[0].center[0] - 20) < 1e-9) })
