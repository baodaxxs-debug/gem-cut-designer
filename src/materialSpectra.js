const SAMPLE_WAVELENGTHS = Object.freeze([460, 500, 550, 600, 650])

// Normalized absorption shapes. These are deliberately labelled as engineering
// presets: they reproduce the broad visible-light behaviour of each colour
// family, but are not substitutes for a measured spectrum of an individual gem.
const MATERIAL_ABSORPTION_PRESETS = Object.freeze({
  diamond: [0.02, 0.015, 0.01, 0.01, 0.015],
  ruby: [0.92, 0.96, 0.83, 0.42, 0.06],
  sapphire: [0.08, 0.18, 0.58, 0.88, 0.94],
  emerald: [0.82, 0.30, 0.06, 0.48, 0.90],
  aquamarine: [0.18, 0.05, 0.10, 0.42, 0.82],
  spinel: [0.70, 0.88, 0.78, 0.34, 0.08],
  garnet: [0.90, 0.96, 0.86, 0.40, 0.08],
  quartz: [0.18, 0.52, 0.70, 0.28, 0.14],
  tourmaline: [0.66, 0.78, 0.58, 0.25, 0.12],
  topaz: [0.12, 0.05, 0.12, 0.42, 0.72],
  peridot: [0.84, 0.26, 0.04, 0.18, 0.70],
  tanzanite: [0.10, 0.42, 0.72, 0.70, 0.48],
  zircon: [0.05, 0.025, 0.02, 0.025, 0.04],
  alexandrite: [0.48, 0.16, 0.08, 0.36, 0.68],
  cubicZirconia: [0.015, 0.01, 0.01, 0.01, 0.015],
  moissanite: [0.025, 0.02, 0.015, 0.02, 0.025],
})

const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value))

function linearRgb(hex) {
  const safe = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '#ffffff'
  return [1, 3, 5].map(index => {
    const channel = parseInt(safe.slice(index, index + 2), 16) / 255
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
  })
}

function genericColorShape(hex) {
  const [red, green, blue] = linearRgb(hex)
  const transmissions = [blue, blue * .42 + green * .58, green, green * .32 + red * .68, red]
  return transmissions.map(value => clamp(-Math.log(Math.max(.035, .10 + value * .90)) / 2.8))
}

function interpolateSamples(samples, wavelengthNm) {
  const wavelength = clamp(Number(wavelengthNm) || 550, SAMPLE_WAVELENGTHS[0], SAMPLE_WAVELENGTHS.at(-1))
  const upperIndex = SAMPLE_WAVELENGTHS.findIndex(sample => sample >= wavelength)
  if (upperIndex <= 0) return samples[0]
  const lowerIndex = upperIndex - 1
  const ratio = (wavelength - SAMPLE_WAVELENGTHS[lowerIndex]) / (SAMPLE_WAVELENGTHS[upperIndex] - SAMPLE_WAVELENGTHS[lowerIndex])
  return samples[lowerIndex] + (samples[upperIndex] - samples[lowerIndex]) * ratio
}

export function materialAbsorptionSamples(materialId, color, strength = 0) {
  const concentration = clamp(Number(strength) || 0)
  const generic = genericColorShape(color)
  const preset = MATERIAL_ABSORPTION_PRESETS[materialId]
  const presetWeight = materialId === 'custom' || materialId === 'corundum' ? 0 : materialId === 'tourmaline' ? .35 : preset ? .72 : 0
  return SAMPLE_WAVELENGTHS.map((_, index) => {
    const shape = preset ? preset[index] * presetWeight + generic[index] * (1 - presetWeight) : generic[index]
    return .002 + concentration * .42 * shape
  })
}

export function createMaterialAbsorptionSpectrum(materialId, color, strength = 0) {
  const samples = materialAbsorptionSamples(materialId, color, strength)
  return wavelengthNm => interpolateSamples(samples, wavelengthNm)
}

export { SAMPLE_WAVELENGTHS }
