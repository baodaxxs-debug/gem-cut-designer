export function findGirdleTiers(design) {
  const girdle = design.tiers.find(tier => tier.code === 'G' || Math.abs(Math.abs(tier.angle) - 90) < .05)
  const upper = design.tiers.find(tier => tier.code === 'A') || design.tiers.filter(tier => tier.angle > .01 && tier.angle < 89.9).sort((a, b) => b.angle - a.angle)[0]
  const lower = design.tiers.find(tier => tier.code === 'P1') || design.tiers.filter(tier => tier.angle < -.01 && tier.angle > -89.9).sort((a, b) => a.angle - b.angle)[0]
  return { girdle, upper, lower }
}

export function setGirdleThickness(design, currentThicknessMm, targetThicknessMm, rawToMm) {
  const { upper, lower } = findGirdleTiers(design)
  if (!upper || !lower || !Number.isFinite(rawToMm) || rawToMm <= 0) throw new Error('当前设计没有可调节的上下腰相接层')
  const halfDeltaRaw = (targetThicknessMm - currentThicknessMm) / (2 * rawToMm)
  return {
    ...design,
    tiers: design.tiers.map(tier => {
      if (tier.id !== upper.id && tier.id !== lower.id) return tier
      const verticalComponent = Math.cos(Math.abs(tier.angle) * Math.PI / 180)
      return { ...tier, distance: tier.distance + verticalComponent * halfDeltaRaw }
    }),
  }
}

export function evenlySpacedIndexes(gear, count) {
  if (!Number.isInteger(count) || count < 3 || gear % count !== 0) throw new Error('腰围面数必须能整除当前索引轮齿数')
  const step = gear / count
  return Array.from({ length: count }, (_, index) => index === 0 ? gear : gear - index * step)
}
