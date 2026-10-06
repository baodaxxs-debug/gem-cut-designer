import test from 'node:test'
import assert from 'node:assert/strict'
import { STANDARD_ROUND_BRILLIANT_ASC, parseAsc } from '../src/gemcad.js'
import { parseProject, serializeProject } from '../src/project.js'

test('完整项目文件往返保留几何、材料、配色和倒角元数据', () => {
  const design = parseAsc(STANDARD_ROUND_BRILLIANT_ASC)
  design.tiers.push({ id: 'bevel-1', name: '倒角', code: 'EB1', angle: 25, distance: .4, indexes: [12], edgeBevelGroup: 'group-1', edgeBevelWidth: .6 })
  const source = { design, facetEdits: { 'tier-2': { 0: { angle: -42 } } }, material: 'ruby', ior: 1.77, tierColors: { 'tier-2': '#ff0000' }, rough: { shape: 'irregular' }, defects: [{ id: 'd1', type: 'inclusion' }] }
  const restored = parseProject(serializeProject(source)).workspace
  assert.deepEqual(restored, source)
  assert.equal(restored.design.tiers.at(-1).edgeBevelGroup, 'group-1')
})

test('项目导入拒绝普通 JSON 和损坏原石网格', () => {
  assert.throws(() => parseProject('{}'), /不是 Gem Cut Designer/)
  const design = parseAsc(STANDARD_ROUND_BRILLIANT_ASC)
  const text = serializeProject({ design, roughMesh: { positions: [1, 2, 3] } })
  assert.throws(() => parseProject(text), /原石网格数据无效/)
})
