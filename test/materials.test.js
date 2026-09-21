import test from 'node:test'
import assert from 'node:assert/strict'
import { MATERIALS, MATERIAL_GROUPS, criticalAngle } from '../src/optics.js'

test('扩展材料库具有完整且有限的光学参数', () => {
  assert.ok(Object.keys(MATERIALS).length >= 17)
  Object.entries(MATERIALS).forEach(([key, material]) => {
    assert.ok(MATERIAL_GROUPS.some(group => group.id === material.group), `${key} 缺少有效分组`)
    assert.ok(material.ior > 1 && material.ior <= 3, `${key} 折射率无效`)
    assert.ok(material.dispersion >= 0 && material.dispersion <= .25, `${key} 色散无效`)
    assert.ok(material.birefringence >= 0 && material.birefringence <= .2, `${key} 双折射无效`)
    assert.ok(material.density > 0, `${key} 密度无效`)
    assert.ok(material.colorStrength >= 0 && material.colorStrength <= 1, `${key} 体色浓度无效`)
    assert.match(material.color, /^#[0-9a-f]{6}$/i)
    assert.ok(Number.isFinite(criticalAngle(material.ior)))
  })
})

test('钻石、立方氧化锆和莫桑石保持可区分的色散与密度', () => {
  assert.ok(MATERIALS.moissanite.dispersion > MATERIALS.cubicZirconia.dispersion)
  assert.ok(MATERIALS.cubicZirconia.dispersion > MATERIALS.diamond.dispersion)
  assert.ok(MATERIALS.cubicZirconia.density > MATERIALS.diamond.density)
  assert.ok(MATERIALS.moissanite.birefringence > 0)
  assert.ok(MATERIALS.ruby.colorStrength > MATERIALS.diamond.colorStrength)
})
