import test from 'node:test'
import assert from 'node:assert/strict'
import { buildClosedGemGeometry, resolveRenderDevice } from '../src/rendering.js'
import { BUILTIN_DESIGNS, buildGemFromDesign, parseAsc } from '../src/gemcad.js'

test('真实渲染网格把全部刻面合并为带颜色和朝外法线的封闭表面', () => {
  const source = BUILTIN_DESIGNS.find(item => item.id === 'standard-round')
  const model = buildGemFromDesign(parseAsc(source.asc))
  const geometry = buildClosedGemGeometry(model, { gemColor: '#ffffff' })
  const positions = geometry.getAttribute('position')
  const colors = geometry.getAttribute('color')
  const facetIds = geometry.getAttribute('facetId')
  assert.ok(positions.count > model.facets.length * 3)
  assert.equal(colors.count, positions.count)
  assert.equal(facetIds.count, positions.count)
  assert.ok(geometry.boundingBox)
  assert.ok(geometry.boundingSphere)
  geometry.dispose()
})

test('真实渲染网格保留逐面配色信息', () => {
  const source = BUILTIN_DESIGNS.find(item => item.id === 'smallest-square')
  const model = buildGemFromDesign(parseAsc(source.asc))
  const target = model.facets[0]
  const geometry = buildClosedGemGeometry(model, {
    gemColor: '#ffffff', showAppearance: true,
    facetColors: { [target.tier.id]: { [target.facetIndex]: '#ff0000' } },
  })
  const colors = geometry.getAttribute('color')
  assert.equal(colors.getX(0), 1)
  assert.equal(colors.getY(0), 0)
  assert.equal(colors.getZ(0), 0)
  geometry.dispose()
})

test('GPU渲染档位支持自动检测和手动覆盖', () => {
  assert.equal(resolveRenderDevice('auto', { width: 390, cores: 8, memory: 8, coarse: true }), 'mobile')
  assert.equal(resolveRenderDevice('auto', { width: 1440, cores: 10, memory: 16, coarse: false }), 'desktop')
  assert.equal(resolveRenderDevice('desktop', { width: 390, cores: 2, memory: 2, coarse: true }), 'desktop')
  assert.equal(resolveRenderDevice('mobile', { width: 1440, cores: 10, memory: 16, coarse: false }), 'mobile')
})

test('真实体色浓度会中和饱和颜色，而教学刻面颜色保持明确', () => {
  const source = BUILTIN_DESIGNS.find(item => item.id === 'smallest-square')
  const model = buildGemFromDesign(parseAsc(source.asc))
  const body = buildClosedGemGeometry(model, { gemColor: '#ff0000', bodyColorStrength: .5 })
  assert.ok(body.getAttribute('color').getY(0) > 0)
  assert.ok(body.getAttribute('color').getX(0) > body.getAttribute('color').getY(0))
  const target = model.facets[0]
  const annotated = buildClosedGemGeometry(model, { gemColor: '#ffffff', bodyColorStrength: .1, showAppearance: true, facetColors: { [target.tier.id]: { [target.facetIndex]: '#ff0000' } } })
  assert.equal(annotated.getAttribute('color').getY(0), 0)
  body.dispose()
  annotated.dispose()
})
