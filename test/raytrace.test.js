import test from 'node:test'
import assert from 'node:assert/strict'
import { STANDARD_ROUND_BRILLIANT_ASC, buildGemFromDesign, parseAsc } from '../src/gemcad.js'
import { OPTICAL_EVALUATION_PROTOCOL, cauchyIorFromDispersion, d65RelativePower, evaluateOpticalPerformance, fresnelDielectric, refractRay, traceDiagnosticRay, traceFaceUp } from '../src/raytrace.js'

test('垂直入射菲涅尔反射率符合介质界面解析值', () => {
  const ior = 2.417
  const expected = ((ior - 1) / (ior + 1)) ** 2
  assert.ok(Math.abs(fresnelDielectric(1, 1, ior) - expected) < 1e-12)
})

test('斯涅尔折射在垂直入射时保持传播方向', () => {
  const direction = refractRay([0, -1, 0], [0, 1, 0], 1, 1.54)
  assert.deepEqual(direction, [0, -1, 0])
})

test('超过临界角时折射为空并触发全反射条件', () => {
  const angle = 60 * Math.PI / 180
  const direction = [Math.sin(angle), Math.cos(angle), 0]
  assert.equal(refractRay(direction, [0, -1, 0], 1.54, 1), null)
  assert.equal(fresnelDielectric(Math.cos(angle), 1.54, 1), 1)
})

test('能量光线追踪满足守恒且输出有限指标', () => {
  const model = buildGemFromDesign(parseAsc(STANDARD_ROUND_BRILLIANT_ASC))
  const result = traceFaceUp(model, 2.417, 11, 16, { dispersion: .044, spectralSamples: 3, absorption: .015 })
  assert.ok(Math.abs(result.energyConservationPercent - 100) < 1e-8)
  assert.ok(result.returnPercent >= 0 && result.returnPercent <= 100)
  assert.ok(result.leakagePercent >= 0 && result.leakagePercent <= 100)
  assert.ok(result.absorbedPercent > 0 && result.absorbedPercent < 100)
  assert.equal(result.spectralSamples, 3)
  assert.ok(result.spectral.red.ior < result.spectral.green.ior)
  assert.ok(result.spectral.blue.ior > result.spectral.green.ior)
})

test('提高吸收系数会提高体色吸收并降低出射能量', () => {
  const model = buildGemFromDesign(parseAsc(STANDARD_ROUND_BRILLIANT_ASC))
  const clear = traceFaceUp(model, 1.765, 9, 16, { absorption: 0 })
  const colored = traceFaceUp(model, 1.765, 9, 16, { absorption: .08 })
  assert.ok(colored.absorbedPercent > clear.absorbedPercent)
  assert.ok(colored.returnPercent + colored.leakagePercent < clear.returnPercent + clear.leakagePercent)
})

test('代表光线返回可视化线段与逐次界面事件', () => {
  const model = buildGemFromDesign(parseAsc(STANDARD_ROUND_BRILLIANT_ASC))
  const result = traceDiagnosticRay(model, 1.54, { u: .18, v: 0, maxBounces: 12 })
  assert.equal(result.hit, true)
  assert.ok(result.segments.some(segment => segment.type === 'incident'))
  assert.ok(result.segments.some(segment => segment.type === 'internal'))
  assert.equal(result.events[0].type, 'entry')
  assert.ok(result.events.length > 1)
  assert.ok(result.events.every(event => event.reflectance >= 0 && event.reflectance <= 1))
})

test('固定光学评价协议输出可重复的多视角与光谱指标', () => {
  const model = buildGemFromDesign(parseAsc(STANDARD_ROUND_BRILLIANT_ASC))
  const options = { dispersion: .044, absorption: .01, protocol: { ...OPTICAL_EVALUATION_PROTOCOL, resolution: 7, maxBounces: 12 } }
  const first = evaluateOpticalPerformance(model, 2.417, options)
  const second = evaluateOpticalPerformance(model, 2.417, options)
  assert.equal(first.protocol.id, 'GCD-OPTICAL-2')
  assert.equal(first.protocol.illuminant, 'd65')
  assert.equal(first.protocol.illuminantCctK, 6504)
  assert.equal(first.trace.viewCount, 9)
  assert.equal(first.trace.spectralSamples, 9)
  assert.ok(first.whiteLightReturnPercent >= 0 && first.whiteLightReturnPercent <= 100)
  assert.ok(first.viewConsistencyPercent >= 0 && first.viewConsistencyPercent <= 100)
  assert.ok(first.spectralReturnRange >= 0)
  assert.deepEqual(first, second)
})

test('D65 光谱权重使蓝波相对功率高于红波', () => {
  assert.ok(d65RelativePower(460) > d65RelativePower(640))
  const model = buildGemFromDesign(parseAsc(STANDARD_ROUND_BRILLIANT_ASC))
  const result = traceFaceUp(model, 2.417, 7, 10, { dispersion: .044, spectralSamples: 3, illuminant: 'd65' })
  assert.equal(result.spectralSamples, 3)
  assert.ok(result.spectral.blue.weight > result.spectral.red.weight)
})

test('交互预览会在三至九波段之间自适应加密', () => {
  const model = buildGemFromDesign(parseAsc(STANDARD_ROUND_BRILLIANT_ASC))
  const result = traceFaceUp(model, 2.417, 9, 12, { dispersion: .044, spectralSamples: 9, spectralSampling: 'adaptive', illuminant: 'd65' })
  assert.equal(result.spectralSampling, 'adaptive')
  assert.equal(result.spectralSamples, 9)
  assert.ok(result.averageSpectralSamples >= 3 && result.averageSpectralSamples <= 9)
  assert.ok(result.refinedSamplePercent >= 0 && result.refinedSamplePercent <= 100)
  assert.ok(Math.abs(result.energyConservationPercent - 100) < 1e-8)
})

test('Cauchy色散拟合保持d线折射率和F-C色散差', () => {
  const ior = 1.765, dispersion = .018
  assert.ok(Math.abs(cauchyIorFromDispersion(ior, dispersion, 589.29) - ior) < 1e-12)
  const blue = cauchyIorFromDispersion(ior, dispersion, 486.13)
  const red = cauchyIorFromDispersion(ior, dispersion, 656.27)
  assert.ok(Math.abs((blue - red) - dispersion) < 1e-12)
  assert.ok(blue > ior && red < ior)
})
