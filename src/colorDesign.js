const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value))

export const GEM_COLOR_PRESETS = [
  { id: 'colorless', name: '无色', color: '#f7fbff', strength: .05 },
  { id: 'ruby', name: '鸽血红', color: '#b90f35', strength: .78 },
  { id: 'sapphire', name: '皇家蓝', color: '#1747a6', strength: .72 },
  { id: 'emerald', name: '祖母绿', color: '#08704c', strength: .7 },
  { id: 'amethyst', name: '紫晶', color: '#8058a8', strength: .48 },
  { id: 'citrine', name: '黄晶', color: '#d79122', strength: .42 },
  { id: 'aquamarine', name: '海蓝', color: '#73c9d8', strength: .34 },
  { id: 'pink', name: '粉色', color: '#d76488', strength: .46 },
]

export const FACET_PALETTES = {
  studio: { name: '珠宝工作室', colors: ['#4d7ea8', '#68a7c5', '#8cc6cf', '#d2b36c', '#b8799e', '#6b8b87'] },
  contrast: { name: '高对比教学', colors: ['#2f80ed', '#27ae60', '#f2c94c', '#eb5757', '#9b51e0', '#56ccf2'] },
  blueprint: { name: '工程蓝图', colors: ['#345b7e', '#47799a', '#5f96ae', '#79b2c2', '#99cbd2', '#bedfe0'] },
  warm: { name: '暖色分层', colors: ['#8d4b55', '#b05d55', '#ce7c59', '#dda86b', '#c69b78', '#9f7184'] },
}

export function tuneGemColor(hex, saturation = 1, brightness = 1) {
  const clean = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : 'ffffff'
  const rgb = [0, 2, 4].map(index => parseInt(clean.slice(index, index + 2), 16) / 255)
  const luminance = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
  const tuned = rgb.map(channel => clamp((luminance + (channel - luminance) * clamp(Number(saturation) || 0, 0, 1.5)) * clamp(Number(brightness) || 0, .35, 1.5)))
  return `#${tuned.map(channel => Math.round(channel * 255).toString(16).padStart(2, '0')).join('')}`
}

export function createTierPalette(design, paletteId = 'studio') {
  const palette = FACET_PALETTES[paletteId] || FACET_PALETTES.studio
  const colors = {}
  design.tiers.forEach((tier, index) => {
    if (tier.edgeBevelGroup) colors[tier.id] = '#d487b5'
    else if (tier.patternGroup) colors[tier.id] = '#9d79bd'
    else if (Math.abs(tier.angle) < .01) colors[tier.id] = '#d7c27a'
    else if (Math.abs(tier.angle) > 89.9) colors[tier.id] = '#6f8796'
    else colors[tier.id] = palette.colors[index % palette.colors.length]
  })
  return colors
}
