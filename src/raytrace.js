import { createModelBvh, intersectBvh } from './bvh.js'

const EPS = 1e-5
const ENERGY_EPS = 1e-7
const add = (a, b) => a.map((value, index) => value + b[index])
const scale = (vector, amount) => vector.map(value => value * amount)
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const normalize = vector => {
  const length = Math.hypot(...vector)
  return length > 0 ? vector.map(value => value / length) : [0, 0, 0]
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value))

export function reflectRay(direction, normal) {
  return normalize(add(direction, scale(normal, -2 * dot(direction, normal))))
}

// normal points towards the incident medium, so dot(direction, normal) <= 0.
export function refractRay(direction, normal, n1, n2) {
  const incident = normalize(direction), boundaryNormal = normalize(normal)
  const cosineIncident = clamp(-dot(incident, boundaryNormal), 0, 1)
  const eta = n1 / n2
  const discriminant = 1 - eta * eta * (1 - cosineIncident * cosineIncident)
  if (discriminant < 0) return null
  return normalize(add(scale(incident, eta), scale(boundaryNormal, eta * cosineIncident - Math.sqrt(Math.max(0, discriminant)))))
}

// Exact unpolarized dielectric Fresnel reflectance (mean of s and p polarization).
export function fresnelDielectric(cosineIncident, n1, n2) {
  const ci = clamp(Math.abs(cosineIncident), 0, 1)
  const ratio = n1 / n2
  const sineTransmittedSquared = ratio * ratio * Math.max(0, 1 - ci * ci)
  if (sineTransmittedSquared >= 1) return 1
  const ct = Math.sqrt(Math.max(0, 1 - sineTransmittedSquared))
  const rsDenominator = n1 * ci + n2 * ct
  const rpDenominator = n2 * ci + n1 * ct
  const rs = rsDenominator ? (n1 * ci - n2 * ct) / rsDenominator : 1
  const rp = rpDenominator ? (n2 * ci - n1 * ct) / rpDenominator : 1
  return clamp((rs * rs + rp * rp) / 2, 0, 1)
}

function modelSamplingFrame(model, incoming) {
  const points = model.facets.flatMap(facet => facet.points)
  const minimum = [0, 1, 2].map(axis => Math.min(...points.map(point => point[axis])))
  const maximum = [0, 1, 2].map(axis => Math.max(...points.map(point => point[axis])))
  const center = minimum.map((value, axis) => (value + maximum[axis]) / 2)
  const radius = Math.max(...points.map(point => Math.hypot(...point.map((value, axis) => value - center[axis])))) * 1.08
  const reference = Math.abs(incoming[1]) > .94 ? [0, 0, 1] : [0, 1, 0]
  const right = normalize(cross(reference, incoming))
  const up = normalize(cross(incoming, right))
  return { center, radius, right, up }
}

function directionFromView(tiltDegrees = 0, azimuthDegrees = 0) {
  const tilt = tiltDegrees * Math.PI / 180, azimuth = azimuthDegrees * Math.PI / 180
  return normalize([Math.sin(tilt) * Math.cos(azimuth), -Math.cos(tilt), Math.sin(tilt) * Math.sin(azimuth)])
}

const FRAUNHOFER_WAVELENGTHS_NM = { F: 486.13, d: 589.29, C: 656.27 }

// CIE D65 relative spectral power distribution sampled at the wavelengths used
// by this renderer. Source: CIE standard illuminant D65 data set,
// DOI 10.25039/CIE.DS.hjfjmt59 (normalized to 100 at 560 nm).
export const CIE_D65_SPD = Object.freeze({
  430: 86.6823, 450: 117.008, 460: 117.812, 490: 108.811,
  500: 109.354, 520: 104.790, 550: 104.046, 580: 95.788,
  589.29: 89.054, 600: 90.0062, 610: 89.5991, 640: 83.6992,
  650: 80.0268, 680: 78.2842,
})

export function d65RelativePower(wavelengthNm) {
  const entries = Object.entries(CIE_D65_SPD).map(([wavelength, power]) => [Number(wavelength), power]).sort((a, b) => a[0] - b[0])
  const wavelength = Number(wavelengthNm) || 560
  if (wavelength <= entries[0][0]) return entries[0][1] / 100
  if (wavelength >= entries.at(-1)[0]) return entries.at(-1)[1] / 100
  const upperIndex = entries.findIndex(([sample]) => sample >= wavelength)
  const lower = entries[upperIndex - 1], upper = entries[upperIndex]
  const ratio = (wavelength - lower[0]) / (upper[0] - lower[0])
  return (lower[1] + (upper[1] - lower[1]) * ratio) / 100
}

export function cauchyIorFromDispersion(ior, dispersion = 0, wavelengthNm = FRAUNHOFER_WAVELENGTHS_NM.d) {
  const spread = Math.max(0, Number(dispersion) || 0)
  const wavelength = clamp(Number(wavelengthNm) || FRAUNHOFER_WAVELENGTHS_NM.d, 380, 780)
  if (!spread) return ior
  const inverseF = 1 / FRAUNHOFER_WAVELENGTHS_NM.F ** 2
  const inverseC = 1 / FRAUNHOFER_WAVELENGTHS_NM.C ** 2
  const coefficientB = spread / (inverseF - inverseC)
  const coefficientA = ior - coefficientB / FRAUNHOFER_WAVELENGTHS_NM.d ** 2
  return Math.max(1.001, coefficientA + coefficientB / wavelength ** 2)
}

function spectralChannels(ior, options) {
  const dispersion = Math.max(0, Number(options.dispersion) || 0)
  const samples = Math.max(1, Number(options.spectralSamples) || 3)
  let channels
  if (samples >= 9) channels = [
    [430, .03], [460, .08], [490, .14], [520, .18], [550, .19], [580, .16], [610, .11], [650, .07], [680, .04],
  ].map(([wavelengthNm, weight]) => ({ id: `${wavelengthNm}nm`, wavelengthNm, ior: cauchyIorFromDispersion(ior, dispersion, wavelengthNm), weight }))
  else if (samples >= 5) channels = [
    { id: 'red', wavelengthNm: 650, weight: .12 },
    { id: 'amber', wavelengthNm: 600, weight: .20 },
    { id: 'green', wavelengthNm: 550, weight: .30 },
    { id: 'cyan', wavelengthNm: 500, weight: .24 },
    { id: 'blue', wavelengthNm: 450, weight: .14 },
  ].map(channel => ({ ...channel, ior: cauchyIorFromDispersion(ior, dispersion, channel.wavelengthNm) }))
  else if (samples >= 3) channels = [
    { id: 'red', wavelengthNm: 640, weight: .25 },
    { id: 'green', wavelengthNm: 550, weight: .50 },
    { id: 'blue', wavelengthNm: 460, weight: .25 },
  ].map(channel => ({ ...channel, ior: cauchyIorFromDispersion(ior, dispersion, channel.wavelengthNm) }))
  else channels = [{ id: 'green', wavelengthNm: FRAUNHOFER_WAVELENGTHS_NM.d, ior, weight: 1 }]
  if ((options.illuminant || '').toLowerCase() !== 'd65') return channels
  const weighted = channels.map(channel => ({ ...channel, weight: channel.weight * d65RelativePower(channel.wavelengthNm) }))
  const total = weighted.reduce((sum, channel) => sum + channel.weight, 0) || 1
  return weighted.map(channel => ({ ...channel, weight: channel.weight / total }))
}

function absorptionForChannel(options, channel) {
  const spectrum = options.absorptionSpectrum
  if (typeof spectrum === 'function') return Math.max(0, Number(spectrum(channel.wavelengthNm, channel)) || 0)
  if (spectrum && typeof spectrum === 'object') {
    const exact = spectrum[channel.id] ?? spectrum[channel.wavelengthNm]
    if (Number.isFinite(Number(exact))) return Math.max(0, Number(exact))
  }
  return Math.max(0, Number(options.absorption) || 0)
}

function normalizedChannels(channels) {
  const total = channels.reduce((sum, channel) => sum + channel.weight, 0) || 1
  return channels.map(channel => ({ ...channel, weight: channel.weight / total }))
}

function adaptiveCoarseChannels(channels) {
  const targets = [460, 550, 650]
  const selected = targets.map(target => channels.reduce((best, channel) => (
    Math.abs(channel.wavelengthNm - target) < Math.abs(best.wavelengthNm - target) ? channel : best
  )))
  return normalizedChannels([...new Map(selected.map(channel => [channel.id, channel])).values()])
}

function spectralRouteSignature(traced) {
  const entered = Math.max(ENERGY_EPS, traced.entered)
  const dominant = traced.returned >= Math.max(traced.leaked, traced.absorbed + traced.trapped)
    ? 'return'
    : traced.leaked >= traced.absorbed + traced.trapped ? 'leak' : 'loss'
  return `${dominant}:${traced.tirEvents}:${Math.round(traced.reflections)}:${Math.round(traced.returned / entered * 20)}`
}

function shouldRefineSpectrum(traces, dispersion) {
  if (traces.length < 2 || dispersion <= 0) return false
  const ratios = key => traces.map(({ traced }) => traced[key] / Math.max(ENERGY_EPS, traced.entered))
  const spread = values => Math.max(...values) - Math.min(...values)
  const alignment = traces.map(({ traced }) => traced.alignment / Math.max(ENERGY_EPS, traced.returned))
  const signatures = new Set(traces.map(({ traced }) => spectralRouteSignature(traced)))
  return signatures.size > 1
    || spread(ratios('returned')) > .06
    || spread(ratios('leaked')) > .06
    || spread(ratios('absorbed')) > .08
    || spread(alignment) > .025
}

function emptyEnergy() {
  return { incident: 0, surface: 0, entered: 0, returned: 0, leaked: 0, absorbed: 0, trapped: 0, pathLength: 0, alignment: 0 }
}

function addEnergy(target, source, weight = 1) {
  Object.keys(target).forEach(key => { target[key] += source[key] * weight })
}

// Trace one wavelength after the first facet. Every boundary splits energy by
// Fresnel reflectance. The reflected part continues inside and the transmitted
// part is classified by its direction relative to the source/viewer.
function traceSpectralRay(bvh, originStart, incoming, entry, materialIor, options) {
  const result = emptyEnergy()
  const segments = [], events = []
  result.incident = 1
  const entryNormal = dot(incoming, entry.facet.n) <= 0 ? entry.facet.n : scale(entry.facet.n, -1)
  const entryCosine = clamp(-dot(incoming, entryNormal), 0, 1)
  const entryReflectance = fresnelDielectric(entryCosine, 1, materialIor)
  result.surface = entryReflectance
  result.entered = 1 - entryReflectance
  const entryPoint = add(originStart, scale(incoming, entry.distance))
  const displayLength = Math.max(.2, Number(options.displayLength) || 1)
  if (options.collectPath) {
    segments.push({ from: add(entryPoint, scale(incoming, -displayLength)), to: entryPoint, type: 'incident', energy: 1 })
    segments.push({ from: entryPoint, to: add(entryPoint, scale(reflectRay(incoming, entryNormal), displayLength * .6)), type: 'surface', energy: entryReflectance })
    events.push({ index: 0, type: 'entry', facet: entry.facet.tier?.name || '入射面', facetIndex: entry.facetIndex, reflectance: entryReflectance, transmitted: result.entered, energy: 1 })
  }
  let direction = refractRay(incoming, entryNormal, 1, materialIor)
  if (!direction || result.entered <= ENERGY_EPS) {
    result.trapped = result.entered
    return { ...result, reflections: 0, tirEvents: 0, segments, events }
  }

  const absorption = Math.max(0, Number(options.absorption) || 0)
  const maximumBounces = Math.max(1, options.maxBounces)
  const minimumThroughput = Math.max(ENERGY_EPS, Number(options.minThroughput) || 1e-5)
  const returnCosine = Math.cos(clamp(Number(options.acceptanceDegrees) || 25, .1, 89.9) * Math.PI / 180)
  let visualOrigin = entryPoint
  let origin = add(entryPoint, scale(direction, EPS * 4))
  let excludedFacet = entry.facetIndex
  let throughput = result.entered
  let reflections = 0, tirEvents = 0

  for (let bounce = 0; bounce < maximumBounces && throughput > minimumThroughput; bounce += 1) {
    const hit = intersectBvh(bvh, origin, direction, excludedFacet)
    if (!hit) { result.trapped += throughput; throughput = 0; break }
    result.pathLength += hit.distance * throughput
    if (absorption > 0) {
      const transmittedByBody = Math.exp(-absorption * hit.distance)
      result.absorbed += throughput * (1 - transmittedByBody)
      throughput *= transmittedByBody
    }
    if (throughput <= minimumThroughput) { result.trapped += throughput; throughput = 0; break }

    const boundary = add(origin, scale(direction, hit.distance))
    if (options.collectPath) segments.push({ from: visualOrigin, to: boundary, type: 'internal', energy: throughput })
    const outwardNormal = dot(direction, hit.facet.n) >= 0 ? hit.facet.n : scale(hit.facet.n, -1)
    const cosineIncident = clamp(dot(direction, outwardNormal), 0, 1)
    const exitDirection = refractRay(direction, scale(outwardNormal, -1), materialIor, 1)
    const reflectance = exitDirection ? fresnelDielectric(cosineIncident, materialIor, 1) : 1
    if (!exitDirection) tirEvents += 1

    if (exitDirection) {
      const exitingEnergy = throughput * (1 - reflectance)
      const alignment = dot(exitDirection, scale(incoming, -1))
      const exitType = alignment >= returnCosine ? 'returned' : 'leaked'
      if (options.collectPath && exitingEnergy > minimumThroughput) segments.push({ from: boundary, to: add(boundary, scale(exitDirection, displayLength * .75)), type: exitType, energy: exitingEnergy })
      if (alignment >= returnCosine) {
        result.returned += exitingEnergy
        result.alignment += exitingEnergy * alignment
      } else result.leaked += exitingEnergy
    }

    if (options.collectPath) events.push({
      index: bounce + 1,
      type: exitDirection ? 'fresnel' : 'tir',
      facet: hit.facet.tier?.name || `刻面 ${hit.facetIndex + 1}`,
      facetIndex: hit.facetIndex,
      reflectance,
      transmitted: exitDirection ? 1 - reflectance : 0,
      energy: throughput,
      distance: hit.distance,
    })

    throughput *= reflectance
    if (throughput <= minimumThroughput) { result.trapped += throughput; throughput = 0; break }
    reflections += 1
    direction = reflectRay(direction, outwardNormal)
    visualOrigin = boundary
    origin = add(boundary, scale(direction, EPS * 4))
    excludedFacet = hit.facetIndex
  }
  if (throughput > 0) result.trapped += throughput
  return { ...result, reflections, tirEvents, segments, events }
}

function traceDirection(model, bvh, ior, resolution, maxBounces, tiltDegrees = 0, azimuthDegrees = 0, options = {}) {
  const incoming = directionFromView(tiltDegrees, azimuthDegrees)
  const frame = modelSamplingFrame(model, incoming)
  const counts = { entered: 0, returned: 0, leaked: 0, trapped: 0, reflections: 0, tirEvents: 0, spectralRays: 0, refinedSamples: 0 }
  const energy = emptyEnergy()
  const samples = []
  const adaptiveSampling = options.spectralSampling === 'adaptive'
  const channels = spectralChannels(ior, { ...options, spectralSamples: adaptiveSampling ? 9 : options.spectralSamples })
  const coarseChannels = adaptiveSampling ? adaptiveCoarseChannels(channels) : channels
  const spectral = Object.fromEntries(channels.map(channel => [channel.id, emptyEnergy()]))
  for (let row = 0; row < resolution; row += 1) for (let column = 0; column < resolution; column += 1) {
    const u = ((column + .5) / resolution * 2 - 1) * frame.radius
    const v = ((row + .5) / resolution * 2 - 1) * frame.radius
    const originStart = add(add(add(frame.center, scale(frame.right, u)), scale(frame.up, v)), scale(incoming, -frame.radius * 3))
    const entry = intersectBvh(bvh, originStart, incoming)
    if (!entry || dot(incoming, entry.facet.n) >= 0) { samples.push(0); continue }
    counts.entered += 1
    const tracedById = new Map()
    coarseChannels.forEach(channel => {
      tracedById.set(channel.id, traceSpectralRay(bvh, originStart, incoming, entry, channel.ior, { ...options, maxBounces, absorption: absorptionForChannel(options, channel) }))
    })
    const refine = adaptiveSampling && shouldRefineSpectrum(
      coarseChannels.map(channel => ({ channel, traced: tracedById.get(channel.id) })),
      Math.max(0, Number(options.dispersion) || 0),
    )
    const sampleChannels = refine ? channels : coarseChannels
    if (refine) {
      counts.refinedSamples += 1
      channels.forEach(channel => {
        if (!tracedById.has(channel.id)) tracedById.set(channel.id, traceSpectralRay(bvh, originStart, incoming, entry, channel.ior, { ...options, maxBounces, absorption: absorptionForChannel(options, channel) }))
      })
    }
    counts.spectralRays += sampleChannels.length
    const sampleEnergy = emptyEnergy()
    sampleChannels.forEach(channel => {
      const traced = tracedById.get(channel.id)
      addEnergy(sampleEnergy, traced, channel.weight)
      addEnergy(energy, traced, channel.weight)
      addEnergy(spectral[channel.id], traced)
      counts.reflections += traced.reflections * channel.weight
      counts.tirEvents += traced.tirEvents * channel.weight
    })
    const outcome = sampleEnergy.returned >= Math.max(sampleEnergy.leaked, sampleEnergy.trapped + sampleEnergy.absorbed)
      ? 1
      : sampleEnergy.leaked >= sampleEnergy.trapped + sampleEnergy.absorbed ? 2 : 3
    if (outcome === 1) counts.returned += 1
    else if (outcome === 2) counts.leaked += 1
    else counts.trapped += 1
    samples.push(outcome)
  }
  const enteredEnergy = Math.max(ENERGY_EPS, energy.entered)
  const incidentEnergy = Math.max(ENERGY_EPS, energy.incident)
  const percentOfEntered = value => value / enteredEnergy * 100
  const spectralSummary = Object.fromEntries(channels.map(channel => {
    const value = spectral[channel.id], divisor = Math.max(ENERGY_EPS, value.entered)
    return [channel.id, { wavelengthNm: channel.wavelengthNm, weight: channel.weight, ior: channel.ior, returnPercent: value.returned / divisor * 100, leakagePercent: value.leaked / divisor * 100, absorbedPercent: value.absorbed / divisor * 100 }]
  }))
  return {
    ...counts,
    resolution,
    samples,
    returnPercent: percentOfEntered(energy.returned),
    leakagePercent: percentOfEntered(energy.leaked),
    absorbedPercent: percentOfEntered(energy.absorbed),
    trappedPercent: percentOfEntered(energy.trapped),
    surfaceReflectionPercent: energy.surface / incidentEnergy * 100,
    entryTransmissionPercent: energy.entered / incidentEnergy * 100,
    energyConservationPercent: (energy.surface + energy.returned + energy.leaked + energy.absorbed + energy.trapped) / incidentEnergy * 100,
    averageReflections: counts.reflections / Math.max(1, counts.entered),
    averagePathLength: energy.pathLength / enteredEnergy,
    averageReturnAlignment: energy.alignment / Math.max(ENERGY_EPS, energy.returned),
    acceptanceDegrees: clamp(Number(options.acceptanceDegrees) || 25, .1, 89.9),
    absorptionCoefficient: Math.max(0, Number(options.absorption) || 0),
    spectral: spectralSummary,
    spectralSamples: channels.length,
    spectralSampling: adaptiveSampling ? 'adaptive' : 'fixed',
    averageSpectralSamples: counts.spectralRays / Math.max(1, counts.entered),
    refinedSamplePercent: counts.refinedSamples / Math.max(1, counts.entered) * 100,
    tiltDegrees,
    azimuthDegrees,
    acceleration: 'bvh',
    bvhStats: bvh.stats,
  }
}

export function traceView(model, ior, options = {}) {
  const resolution = options.resolution ?? 21, maxBounces = options.maxBounces ?? 12
  return traceDirection(model, createModelBvh(model), ior, resolution, maxBounces, options.tiltDegrees || 0, options.azimuthDegrees || 0, options)
}

export function traceFaceUp(model, ior, resolution = 21, maxBounces = 12, options = {}) {
  return traceView(model, ior, { ...options, resolution, maxBounces })
}

export function traceDiagnosticRay(model, ior, options = {}) {
  const incoming = directionFromView(options.tiltDegrees || 0, options.azimuthDegrees || 0)
  const frame = modelSamplingFrame(model, incoming)
  const u = clamp(Number(options.u) || 0, -1, 1) * frame.radius
  const v = clamp(Number(options.v) || 0, -1, 1) * frame.radius
  const originStart = add(add(add(frame.center, scale(frame.right, u)), scale(frame.up, v)), scale(incoming, -frame.radius * 3))
  const bvh = createModelBvh(model)
  const entry = intersectBvh(bvh, originStart, incoming)
  if (!entry || dot(incoming, entry.facet.n) >= 0) return { hit: false, segments: [], events: [], reason: '该采样位置未命中宝石' }
  const traced = traceSpectralRay(bvh, originStart, incoming, entry, ior, {
    ...options,
    maxBounces: options.maxBounces ?? 16,
    collectPath: true,
    displayLength: frame.radius * .7,
  })
  const entered = Math.max(ENERGY_EPS, traced.entered)
  return {
    hit: true,
    segments: traced.segments,
    events: traced.events,
    returnPercent: traced.returned / entered * 100,
    leakagePercent: traced.leaked / entered * 100,
    absorbedPercent: traced.absorbed / entered * 100,
    trappedPercent: traced.trapped / entered * 100,
    surfaceReflectionPercent: traced.surface * 100,
    reflections: traced.reflections,
    tirEvents: traced.tirEvents,
    bvhStats: bvh.stats,
  }
}

const DEFAULT_VIEWS = [
  { tiltDegrees: 0, azimuthDegrees: 0, weight: .4 },
  { tiltDegrees: 12, azimuthDegrees: 0, weight: .15 },
  { tiltDegrees: 12, azimuthDegrees: 90, weight: .15 },
  { tiltDegrees: 12, azimuthDegrees: 180, weight: .15 },
  { tiltDegrees: 12, azimuthDegrees: 270, weight: .15 },
]

export const OPTICAL_EVALUATION_PROTOCOL = {
  id: 'GCD-OPTICAL-2',
  name: 'GCD D65 固定多视角对比协议 v2',
  illuminant: 'd65',
  illuminantCctK: 6504,
  resolution: 9,
  maxBounces: 20,
  acceptanceDegrees: 25,
  spectralSamples: 9,
  views: [
    { tiltDegrees: 0, azimuthDegrees: 0, weight: .36 },
    { tiltDegrees: 12, azimuthDegrees: 0, weight: .11 },
    { tiltDegrees: 12, azimuthDegrees: 90, weight: .11 },
    { tiltDegrees: 12, azimuthDegrees: 180, weight: .11 },
    { tiltDegrees: 12, azimuthDegrees: 270, weight: .11 },
    { tiltDegrees: 24, azimuthDegrees: 45, weight: .05 },
    { tiltDegrees: 24, azimuthDegrees: 135, weight: .05 },
    { tiltDegrees: 24, azimuthDegrees: 225, weight: .05 },
    { tiltDegrees: 24, azimuthDegrees: 315, weight: .05 },
  ],
}

export function traceMultiAngle(model, ior, options = {}) {
  const resolution = options.resolution ?? 11, maxBounces = options.maxBounces ?? 12
  const definitions = options.views?.length ? options.views : DEFAULT_VIEWS
  const totalWeight = definitions.reduce((sum, view) => sum + Math.max(0, view.weight ?? 1), 0) || 1
  const bvh = createModelBvh(model)
  const views = definitions.map(view => ({
    ...traceDirection(model, bvh, ior, resolution, maxBounces, view.tiltDegrees || 0, view.azimuthDegrees || 0, options),
    weight: Math.max(0, view.weight ?? 1) / totalWeight,
  }))
  const weighted = key => views.reduce((sum, view) => sum + view[key] * view.weight, 0)
  const spectralIds = [...new Set(views.flatMap(view => Object.keys(view.spectral || {})))]
  const spectral = Object.fromEntries(spectralIds.map(id => [id, {
    wavelengthNm: views.find(view => view.spectral?.[id])?.spectral[id].wavelengthNm,
    weight: views.find(view => view.spectral?.[id])?.spectral[id].weight,
    ior: views.find(view => view.spectral?.[id])?.spectral[id].ior,
    returnPercent: views.reduce((sum, view) => sum + (view.spectral?.[id]?.returnPercent || 0) * view.weight, 0),
    leakagePercent: views.reduce((sum, view) => sum + (view.spectral?.[id]?.leakagePercent || 0) * view.weight, 0),
    absorbedPercent: views.reduce((sum, view) => sum + (view.spectral?.[id]?.absorbedPercent || 0) * view.weight, 0),
  }]))
  return {
    mode: 'multi-angle', views, viewCount: views.length, resolution, spectral,
    returnPercent: weighted('returnPercent'),
    leakagePercent: weighted('leakagePercent'),
    absorbedPercent: weighted('absorbedPercent'),
    trappedPercent: weighted('trappedPercent'),
    surfaceReflectionPercent: weighted('surfaceReflectionPercent'),
    entryTransmissionPercent: weighted('entryTransmissionPercent'),
    energyConservationPercent: weighted('energyConservationPercent'),
    averageReflections: weighted('averageReflections'),
    averagePathLength: weighted('averagePathLength'),
    averageReturnAlignment: weighted('averageReturnAlignment'),
    acceptanceDegrees: views[0]?.acceptanceDegrees ?? 25,
    spectralSamples: views[0]?.spectralSamples ?? 1,
    illuminant: options.illuminant || 'equal-energy',
    acceleration: 'bvh', bvhStats: bvh.stats,
  }
}

export function evaluateOpticalPerformance(model, ior, options = {}) {
  const protocol = { ...OPTICAL_EVALUATION_PROTOCOL, ...(options.protocol || {}) }
  const trace = traceMultiAngle(model, ior, {
    ...options,
    resolution: protocol.resolution,
    maxBounces: protocol.maxBounces,
    acceptanceDegrees: protocol.acceptanceDegrees,
    spectralSamples: protocol.spectralSamples,
    illuminant: protocol.illuminant,
    views: protocol.views,
  })
  const returns = trace.views.map(view => view.returnPercent)
  const meanReturn = returns.reduce((sum, value) => sum + value, 0) / Math.max(1, returns.length)
  const returnStdDev = Math.sqrt(returns.reduce((sum, value) => sum + (value - meanReturn) ** 2, 0) / Math.max(1, returns.length))
  const returnRange = returns.length ? Math.max(...returns) - Math.min(...returns) : 0
  const spectralReturns = Object.values(trace.spectral).map(channel => channel.returnPercent)
  const spectralReturnRange = spectralReturns.length ? Math.max(...spectralReturns) - Math.min(...spectralReturns) : 0
  return {
    protocol: { id: protocol.id, name: protocol.name, resolution: protocol.resolution, maxBounces: protocol.maxBounces, acceptanceDegrees: protocol.acceptanceDegrees, spectralSamples: protocol.spectralSamples, illuminant: protocol.illuminant, illuminantCctK: protocol.illuminantCctK },
    trace,
    whiteLightReturnPercent: trace.returnPercent,
    leakagePercent: trace.leakagePercent,
    absorbedPercent: trace.absorbedPercent,
    surfaceReflectionPercent: trace.surfaceReflectionPercent,
    returnStdDev,
    returnRange,
    viewConsistencyPercent: clamp(100 - returnRange, 0, 100),
    spectralReturnRange,
  }
}
