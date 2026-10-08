import test from 'node:test'
import assert from 'node:assert/strict'
import { packOpticalTriangles } from '../src/gpuOptics.js'

const squareModel = {
  facets: [{
    n: [0, 1, 0],
    tier: { id: 'crown' },
    facetIndex: 0,
    points: [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1]],
  }],
}

test('GPU 光学数据把多边形刻面三角化并保留外法线', () => {
  const result = packOpticalTriangles(squareModel)
  assert.equal(result.count, 2)
  assert.equal(result.width, 5)
  assert.equal(result.height, 2)
  assert.deepEqual(Array.from(result.packed.slice(12, 15)), [0, 1, 0])
})

test('GPU 光学数据包含逐面颜色与磨砂粗糙度', () => {
  const result = packOpticalTriangles(squareModel, {
    gemColor: '#ffffff',
    showAppearance: true,
    facetColors: { crown: { 0: '#ff0000' } },
    facetFinishes: { crown: { 0: 'frosted' } },
  })
  assert.ok(Math.abs(result.packed[15] - .72) < 1e-6)
  assert.deepEqual(Array.from(result.packed.slice(16, 19)), [1, 0, 0])
})

test('GPU 光学三角面超过设备预算时明确回退', () => {
  assert.throws(() => packOpticalTriangles(squareModel, {}, 1), /最多支持 1 个三角面/)
})
