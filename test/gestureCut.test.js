import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateGestureCut } from '../src/gestureCut.js'

test('二维滑动同时控制进刀深度和亭角绝对值', () => {
  const result = calculateGestureCut(-41.5, 0, 100, -100)
  assert.ok(result.distanceDelta < 0)
  assert.ok(result.angle < -41.5)
})

test('精调模式降低滑动灵敏度并保留冠亭方向', () => {
  const normal = calculateGestureCut(34, 0, 80, 80)
  const fine = calculateGestureCut(34, 0, 80, 80, { fine: true })
  assert.ok(normal.angle > 0 && fine.angle > 0)
  assert.ok(Math.abs(fine.angle - 34) < Math.abs(normal.angle - 34))
  assert.ok(Math.abs(fine.distanceDelta) < Math.abs(normal.distanceDelta))
})
