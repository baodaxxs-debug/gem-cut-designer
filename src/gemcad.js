const EPSILON = 1e-6

export const STANDARD_ROUND_BRILLIANT_ASC = `GemCad 5.0
g 96 0.0
y 8 y
I 1.54
H Standard Round Brilliant
a -90.000000 1.02653281 93 n G 87 81 75 69 63 57 51 45 39 33 27 21 15 9 3
a -42.500000 0.61819401 93 n 1 87 81 75 69 63 57 51 45 39 33 27 21 15 9 3
a -41.500000 0.61701256 96 n 2 84 72 60 48 36 24 12
a 34.000000 0.68444470 3 n A 9 15 21 27 33 39 45 51 57 63 69 75 81 87 93
a 28.000000 0.60896430 96 n B 12 24 36 48 60 72 84
a 16.000000 0.50613241 6 n C 18 30 42 54 66 78 90
a 0.000000 0.36450932 96 n T`

export const FIREWORKS_ROUND_ASC = `GemCad 5.0
g 96 0.0
y 8 y
I 1.54
H Fireworks Round 8-Ray Prototype
H Pavilion star variation for teaching and editable design
a -90.000000 1.02653281 93 n G 87 81 75 69 63 57 51 45 39 33 27 21 15 9 3
a -42.500000 0.61819401 93 n 1 87 81 75 69 63 57 51 45 39 33 27 21 15 9 3
a -41.500000 0.61701256 96 n 2 84 72 60 48 36 24 12
a -38.000000 0.62073308 6 n F 18 30 42 54 66 78 90 G Cut to pavilion mains; polished dark-star or frosted accent
a 34.000000 0.68444470 3 n A 9 15 21 27 33 39 45 51 57 63 69 75 81 87 93
a 28.000000 0.60896430 96 n B 12 24 36 48 60 72 84
a 16.000000 0.50613241 6 n C 18 30 42 54 66 78 90
a 0.000000 0.36450932 96 n T
F Eight pavilion accent facets form a starburst at the culet.
F Verify angles for the selected material before production.`

export const SMALLEST_SQUARE_ASC = `GemCad 5.0
g 96 0.0
y 4 y
I 1.54
H PC 11.134 SMALLEST SQUARE
H Robert H. Long, 7/27/17
H Assigned to the Public Domain
a 90.000000 1.09380454 96 n g1 24 48 72
a -38.000000 0.87556750 96 n 1 72 48 24
a 20.000000 0.23666377 96 n a 24 48 72
a 10.000000 0.12457376 12 n b 36 60 84
F For Low RI Material`

export const COMPEAR_125_ASC = `GemCad 5.0
g 96 0.0
y 1 y
I 1.54
H 05.101 Compear 1:1.25
H by Robert W. Strickland   4/9/96
H TFG Newsletter, Jan/Apr 96, p32
a -42.400000 0.44666796 93 87 81 75 69 27 n 1 21 n 1 15 n 1 9 n 1 3 n 1 G Meet center point
a -41.500000 0.45301719 67 29 n 2 G Meet center point
a -90.000000 0.72629021 93 87 81 75 69 27 n G1 21 n G1 15 n G1 9 n G1 3 n G1 G Level girdle
a -90.000000 0.76032038 31 n G2 65 G Meet 1-2-G1
a -42.900000 0.47476568 31 n 3 65 G Meet 1-2-G1-G2
a -43.200000 0.52427307 35 n 4 61 G Meet 1-2-3
a -41.500000 0.56843090 39 n 5 57 G Meet 1-2-3
a -90.000000 0.82808781 35 n G3 61 G Level girdle
a -90.000000 0.92385512 39 n G4 57 G Level girdle
a 38.500000 0.52708451 3 n a 9 n a 15 n a 21 n a 75 81 87 93
a 42.300000 0.55971794 69 27 n b
a 41.500000 0.57561568 65 31 n c
a 41.500000 0.62051973 61 35 n d
a 43.700000 0.70759554 57 39 n e
a 32.000000 0.47369202 96 n f 12 n f 24 n f 72 84
a 34.500000 0.53274354 63 33 n g
a 25.300000 0.56149278 48 n h
a 15.900000 0.43739925 57 39 n i
a 20.600000 0.42218591 67 29 n j
a 17.600000 0.39169679 77 19 n k
a 18.800000 0.40172019 90 6 n m
a 0.000000 0.28784314 96 n T
F Dop so the center of the round end is at the center of the dop.`

export const CUBE_ILLUSION_TRIANGLE_ASC = `GemCad 5.0
g -96 48.0
y 3 y
I 1.54
H 13.110 Cube Illusion Triangle
H by Robert W. Strickland 11/12/95
H TFG Newsletter, Oct 95, p24
a -46.000000 0.52522447 -96 64 32 n 1
a -47.000000 0.53087770 94 66 62 34 n 2 30 2
a -45.000000 0.56684500 90 70 58 38 n 3 26 6
a -90.000000 0.79986259 94 66 62 34 n G1 30 2
a -90.000000 0.88150371 90 70 58 38 n G2 26 6
a 41.360000 0.61241081 2 30 34 n A 62 66 94
a 34.040000 0.58604496 6 26 38 n B 58 70 90
a 33.970000 0.54348710 -96 32 n C 64
a 24.160000 0.49882765 5 27 37 n D 59 69 91
a 10.000000 0.43163610 -96 32 n E 64
F Based on an idea by Wilf Ross in his
F Signet, North York Faceting Guild Newsletter, October, 1995`

function supportForOutline(shape, azimuth, lengthToWidth) {
  const a = lengthToWidth
  const b = 1
  const x = Math.cos(azimuth)
  const z = Math.sin(azimuth)
  if (shape === 'oval') return Math.hypot(a * x, b * z)
  if (shape === 'cushion') {
    const q = 4 / 3
    return (Math.abs(a * x) ** q + Math.abs(b * z) ** q) ** (1 / q)
  }
  const samples = []
  if (shape === 'marquise') {
    for (let i = 0; i < 720; i += 1) {
      const t = i / 720 * Math.PI * 2
      samples.push([a * Math.sign(Math.cos(t)) * Math.abs(Math.cos(t)) ** .58, b * Math.sin(t)])
    }
  } else {
    const corner = .28
    samples.push([a, b - corner], [a - corner, b], [-a + corner, b], [-a, b - corner], [-a, -b + corner], [-a + corner, -b], [a - corner, -b], [a, -b + corner])
  }
  return Math.max(...samples.map(point => point[0] * x + point[1] * z))
}

function groupedTiers(records, prefix, startNumber) {
  const groups = new Map()
  records.forEach(record => {
    const key = `${record.angle.toFixed(5)}|${record.distance.toFixed(7)}`
    if (!groups.has(key)) groups.set(key, { ...record, indexes: [] })
    groups.get(key).indexes.push(record.index)
  })
  return [...groups.values()].map((record, index) => ({
    id: `tier-${startNumber + index}`,
    name: groups.size === 1 ? prefix : `${prefix} ${index + 1}`,
    rawName: `${record.code}${index + 1}`,
    code: `${record.code}${index + 1}`,
    angle: Number(record.angle.toFixed(5)),
    distance: Number(record.distance.toFixed(8)),
    indexes: record.indexes,
    instructions: record.instructions || '',
  }))
}

export function createOutlineStarter({ shape, title, lengthToWidth = 1.35, sides = 16, gear = 96 }) {
  if (!['oval', 'marquise', 'cushion', 'emerald'].includes(shape)) throw new Error('不支持的基础外形')
  if (gear % sides !== 0) throw new Error('索引轮齿数必须能被腰围面数整除')
  const girdleHalf = .03
  const pavilionDepth = .92
  const crownTop = .29
  const tableScale = shape === 'emerald' ? .56 : .54
  const directions = Array.from({ length: sides }, (_, position) => {
    const rawIndex = position * gear / sides
    const index = rawIndex === 0 ? gear : rawIndex
    const azimuth = rawIndex / gear * Math.PI * 2
    return { index, support: supportForOutline(shape, azimuth, lengthToWidth) }
  })
  const girdle = directions.map(item => ({ ...item, code: 'G', angle: 90, distance: item.support, instructions: '切平并校正外形' }))
  const pavilion = directions.map(item => {
    const angle = -Math.atan((pavilionDepth - girdleHalf) / item.support) * 180 / Math.PI
    const radians = Math.abs(angle) * Math.PI / 180
    return { ...item, code: 'P', angle, distance: Math.cos(radians) * pavilionDepth, instructions: '切至亭尖共点' }
  })
  const crown = directions.map(item => {
    const angle = Math.atan((crownTop - girdleHalf) / ((1 - tableScale) * item.support)) * 180 / Math.PI
    const radians = angle * Math.PI / 180
    return { ...item, code: 'C', angle, distance: Math.sin(radians) * item.support + Math.cos(radians) * girdleHalf, instructions: '切至腰围并形成台面边界' }
  })
  const girdleTiers = groupedTiers(girdle, '腰围', 1)
  const pavilionTiers = groupedTiers(pavilion, '亭部主刻面', girdleTiers.length + 1)
  const crownTiers = groupedTiers(crown, '冠部主刻面', girdleTiers.length + pavilionTiers.length + 1)
  const table = { id: `tier-${girdleTiers.length + pavilionTiers.length + crownTiers.length + 1}`, name: '台面', rawName: 'T', code: 'T', angle: 0, distance: crownTop, indexes: [gear], instructions: '切至冠部主面相接' }
  return {
    gear, gearDirection: 1, offset: 0, ior: 1.54, title,
    symmetryFolds: shape === 'emerald' || shape === 'cushion' ? 4 : 2,
    symmetryMirror: true,
    footnotes: ['Gem Cut Designer 参数化基础型；正式切磨前请按材料和毛坯优化角度与比例。'],
    tiers: [...girdleTiers, ...pavilionTiers, ...crownTiers, table],
  }
}

const STARTER_OVAL = createOutlineStarter({ shape: 'oval', title: '参数化椭圆基础型 1:1.35', lengthToWidth: 1.35 })
const STARTER_MARQUISE = createOutlineStarter({ shape: 'marquise', title: '参数化榄尖基础型 1:1.80', lengthToWidth: 1.8 })
const STARTER_CUSHION = createOutlineStarter({ shape: 'cushion', title: '参数化垫形基础型 1:1.10', lengthToWidth: 1.1 })
const STARTER_EMERALD = createOutlineStarter({ shape: 'emerald', title: '参数化祖母绿八角基础型 1:1.35', lengthToWidth: 1.35, sides: 8 })

export const BUILTIN_DESIGNS = [
  { id: 'standard-round', name: '标准圆明亮式', shape: '圆形', asc: STANDARD_ROUND_BRILLIANT_ASC },
  { id: 'fireworks-round-8', name: '烟花切 · 8 射线亭部星芒', shape: '圆形', asc: FIREWORKS_ROUND_ASC, appearance: { tierFinishes: { 'tier-4': 'frosted' } } },
  { id: 'smallest-square', name: '最简方形（公版）', shape: '方形', asc: SMALLEST_SQUARE_ASC },
  { id: 'compear-125', name: 'Compear 1:1.25（MIT 示例）', shape: '梨形', asc: COMPEAR_125_ASC },
  { id: 'cube-illusion-triangle', name: 'Cube Illusion（MIT 示例）', shape: '三角形', asc: CUBE_ILLUSION_TRIANGLE_ASC },
  { id: 'starter-oval', name: '参数化基础型 1:1.35', shape: '椭圆形', design: STARTER_OVAL },
  { id: 'starter-marquise', name: '参数化基础型 1:1.80', shape: '榄尖形', design: STARTER_MARQUISE },
  { id: 'starter-cushion', name: '参数化基础型 1:1.10', shape: '垫形', design: STARTER_CUSHION },
  { id: 'starter-emerald', name: '参数化八角基础型 1:1.35', shape: '祖母绿形', design: STARTER_EMERALD },
]

const TIER_NAMES = {
  G: '腰围', P1: '下腰小面', P2: '亭部主刻面',
  F: '烟花星芒强调面', A: '上腰小面', B: '冠部主刻面', C: '星小面', T: '台面',
}

function normalizeTierCode(rawName, angle, count) {
  if (rawName === '1') return 'P1'
  if (rawName === '2') return 'P2'
  if (rawName) return rawName.toUpperCase()
  if (Math.abs(angle) === 90) return 'G'
  if (angle === 0) return 'T'
  return `${angle < 0 ? 'P' : 'C'}-${count}`
}

function parseTier(line) {
  const tokens = line.split(/\s+/)
  const angle = Number(tokens[1]), distance = Number(tokens[2])
  const indexes = []
  let rawName = ''
  let instructionIndex = -1
  for (let i = 3; i < tokens.length; i += 1) {
    if (tokens[i] === 'n') {
      rawName ||= tokens[i + 1] || ''
      i += 1
      continue
    }
    if (tokens[i] === 'G') { instructionIndex = i; break }
    if (/^-?\d+(?:\.\d+)?$/.test(tokens[i])) indexes.push(Number(tokens[i]))
  }
  const code = normalizeTierCode(rawName, angle, indexes.length)
  return { name: TIER_NAMES[code] || rawName || `刻面层 ${code}`, rawName, code, angle, distance, indexes, instructions: instructionIndex >= 0 ? tokens.slice(instructionIndex + 1).join(' ') : '' }
}

export function parseAsc(text) {
  const sourceLines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const lines = []
  for (const line of sourceLines) {
    const command = line.split(/\s+/, 1)[0]
    const previous = lines.at(-1)
    const isFacetContinuation = previous?.startsWith('a ') && (/^-?\d/.test(line) || command === 'n' || command === 'G')
    if (isFacetContinuation) lines[lines.length - 1] += ` ${line}`
    else lines.push(line)
  }
  if (lines[0] !== 'GemCad 5.0') throw new Error('不支持的 ASC 文件：缺少 GemCad 5.0 文件头')
  const gearLine = lines.find(line => line.startsWith('g '))?.split(/\s+/)
  const iorLine = lines.find(line => line.startsWith('I '))?.split(/\s+/)
  const symmetryLine = lines.find(line => line.startsWith('y '))?.split(/\s+/)
  const tiers = lines.filter(line => line.startsWith('a ')).map(parseTier).map((tier, index) => ({ ...tier, id: `tier-${index + 1}` }))
  const rawGear = Number(gearLine?.[1] || 96)
  const gear = Math.abs(rawGear)
  const ior = Number(iorLine?.[1] || 1.54)
  if (!Number.isFinite(gear) || gear < 3 || gear > 360) throw new Error('ASC 索引轮齿数无效（应为 3–360）')
  if (!Number.isFinite(ior) || ior <= 1 || ior > 4) throw new Error('ASC 折射率无效（应大于 1）')
  if (!tiers.length) throw new Error('ASC 文件没有切割层')
  if (tiers.some(tier => !Number.isFinite(tier.angle) || !Number.isFinite(tier.distance) || !tier.indexes.length || tier.indexes.some(index => !Number.isFinite(index)))) throw new Error('ASC 文件含有无效的角度、中心距或齿号')
  return {
    gear,
    gearDirection: rawGear < 0 ? -1 : 1,
    offset: Number(gearLine?.[2] || 0),
    ior,
    title: lines.filter(line => line.startsWith('H ')).map(line => line.slice(2)).join(' · '),
    symmetryFolds: Number(symmetryLine?.[1] || 1),
    symmetryMirror: (symmetryLine?.[2] || 'n').toLowerCase() === 'y',
    footnotes: lines.filter(line => line.startsWith('F ')).map(line => line.slice(2)),
    tiers,
  }
}

export function facetNormal(angle, index, gear, gearDirection = 1) {
  const tilt = Math.abs(angle) * Math.PI / 180
  const azimuth = (index / gear) * Math.PI * 2 * gearDirection
  const vertical = angle < 0 ? -Math.cos(tilt) : Math.cos(tilt)
  return [Math.sin(tilt) * Math.cos(azimuth), vertical, Math.sin(tilt) * Math.sin(azimuth)]
}
export function distanceThroughPoint(angle, index, gear, point, gearDirection = 1) {
  const normal = facetNormal(angle, index, gear, gearDirection)
  return normal[0] * point[0] + normal[1] * point[1] + normal[2] * point[2]
}
function planeFromFacet(angle, index, gear, distance, tier, facetIndex, gearDirection = 1) {
  return {
    n: facetNormal(angle, index, gear, gearDirection),
    d: distance,
    tier,
    facetIndex,
    index,
    angle,
  }
}

function intersection(a, b, c) {
  const [a1,a2,a3] = a.n, [b1,b2,b3] = b.n, [c1,c2,c3] = c.n
  const det = a1*(b2*c3-b3*c2)-a2*(b1*c3-b3*c1)+a3*(b1*c2-b2*c1)
  if (Math.abs(det) < EPSILON) return null
  const dx = a.d*(b2*c3-b3*c2)-a2*(b.d*c3-b3*c.d)+a3*(b.d*c2-b2*c.d)
  const dy = a1*(b.d*c3-b3*c.d)-a.d*(b1*c3-b3*c1)+a3*(b1*c.d-b.d*c1)
  const dz = a1*(b2*c.d-b.d*c2)-a2*(b1*c.d-b.d*c1)+a.d*(b1*c2-b2*c1)
  return [dx/det, dy/det, dz/det]
}

const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2]
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
const normalize = v => { const length = Math.hypot(...v); return v.map(value => value / length) }

function orderOnPlane(points, normal) {
  const center = points.reduce((sum, p) => sum.map((v, i) => v + p[i]), [0,0,0]).map(v => v / points.length)
  const reference = Math.abs(normal[1]) < .9 ? [0,1,0] : [1,0,0]
  const u = normalize(cross(reference, normal)), v = cross(normal, u)
  return [...points].sort((p, q) => {
    const dp = p.map((value, i) => value - center[i]), dq = q.map((value, i) => value - center[i])
    return Math.atan2(dot(dp, v), dot(dp, u)) - Math.atan2(dot(dq, v), dot(dq, u))
  })
}

export function buildGemFromDesign(design, edits = {}) {
  const planes = design.tiers.flatMap(tier => tier.indexes.map((index, facetIndex) => {
    const edit = (edits[tier.id] || edits[tier.code])?.[facetIndex]
    return planeFromFacet(edit?.angle ?? tier.angle, index, design.gear, tier.distance + (edit?.distanceDelta ?? 0), tier, facetIndex, design.gearDirection)
  }))
  const vertices = []
  for (let i = 0; i < planes.length - 2; i++) for (let j = i + 1; j < planes.length - 1; j++) for (let k = j + 1; k < planes.length; k++) {
    const point = intersection(planes[i], planes[j], planes[k])
    if (!point || planes.some(plane => dot(plane.n, point) > plane.d + 2e-5)) continue
    if (!vertices.some(existing => Math.hypot(...existing.map((v, axis) => v - point[axis])) < 2e-5)) vertices.push(point)
  }
  const facets = planes.map(plane => {
    const points = vertices.filter(point => Math.abs(dot(plane.n, point) - plane.d) < 5e-5)
    return points.length >= 3 ? { ...plane, points: orderOnPlane(points, plane.n) } : null
  }).filter(Boolean)
  if (!vertices.length || !facets.length) throw new Error('当前角度或层位没有形成封闭宝石，请恢复该层参数')
  const maxRadius = Math.max(...vertices.map(([x,,z]) => Math.hypot(x,z)))
  if (!Number.isFinite(maxRadius) || maxRadius < EPSILON) throw new Error('当前设计的宽度无效')
  const scale = 2.4 / maxRadius
  facets.forEach(facet => {
    facet.points = facet.points.map(point => point.map(value => value * scale))
    facet.d *= scale
  })
  return { design, facets, vertexCount: vertices.length, scale }
}

export function buildGemFromAsc(text, edits = {}) {
  return buildGemFromDesign(parseAsc(text), edits)
}

export function serializeAsc(design, ior = design.ior) {
  const lines = [
    'GemCad 5.0',
    `g ${(design.gearDirection || 1) < 0 ? '-' : ''}${Math.abs(design.gear || 96)} ${Number(design.offset || 0).toFixed(1)}`,
    `y ${Math.max(1, design.symmetryFolds || 1)} ${design.symmetryMirror ? 'y' : 'n'}`,
    `I ${Number(ior || 1.54).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`,
    ...String(design.title || 'Untitled design').split(' · ').slice(0, 4).map(line => `H ${line}`),
  ]
  design.tiers.forEach((tier, tierIndex) => {
    const indexes = tier.indexes.map(value => Number(value).toFixed(4).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1'))
    const rawName = tier.rawName || tier.code || String(tierIndex + 1)
    const namedIndexes = indexes.map((index, indexPosition) => indexPosition === 0 ? `${index} n ${rawName}` : index).join(' ')
    lines.push(`a ${Number(tier.angle).toFixed(6)} ${Number(tier.distance).toFixed(8)} ${namedIndexes}${tier.instructions ? ` G ${tier.instructions}` : ''}`)
  })
  ;(design.footnotes || []).slice(0, 4).forEach(line => lines.push(`F ${line}`))
  return `${lines.join('\n')}\n`
}

export function materializeDesign(design, edits = {}) {
  const tiers = []
  design.tiers.forEach(tier => {
    const groups = new Map()
    tier.indexes.forEach((index, facetIndex) => {
      const edit = (edits[tier.id] || edits[tier.code])?.[facetIndex]
      const angle = edit?.angle ?? tier.angle
      const distance = tier.distance + (edit?.distanceDelta ?? 0)
      const key = `${angle.toFixed(8)}|${distance.toFixed(10)}`
      if (!groups.has(key)) groups.set(key, { angle, distance, indexes: [] })
      groups.get(key).indexes.push(index)
    })
    ;[...groups.values()].forEach((group, groupIndex) => tiers.push({
      ...tier,
      id: groups.size > 1 ? `${tier.id || tier.code}-${groupIndex + 1}` : tier.id,
      rawName: groups.size > 1 ? `${tier.rawName || tier.code}-${groupIndex + 1}` : tier.rawName,
      angle: group.angle,
      distance: group.distance,
      indexes: group.indexes,
    }))
  })
  return { ...design, tiers }
}

export function convertDesignGear(design, targetGear) {
  const oldGear = Number(design.gear)
  const newGear = Math.round(Number(targetGear))
  if (!Number.isFinite(oldGear) || oldGear < 3) throw new Error('当前索引轮齿数无效')
  if (!Number.isFinite(newGear) || newGear < 3 || newGear > 360) throw new Error('目标索引轮应为 3–360 齿')
  let maxErrorDegrees = 0
  let convertedIndexes = 0
  const tiers = design.tiers.map(tier => {
    const indexes = tier.indexes.map(index => {
      const exact = Number(index) * newGear / oldGear
      const converted = Math.round(exact)
      const circularError = Math.abs(converted / newGear - Number(index) / oldGear)
      maxErrorDegrees = Math.max(maxErrorDegrees, Math.min(circularError, Math.abs(1 - circularError)) * 360)
      if (Math.abs(converted - Number(index)) > EPSILON) convertedIndexes += 1
      return converted
    })
    const positions = indexes.map(index => ((index % newGear) + newGear) % newGear)
    if (new Set(positions).size !== positions.length) throw new Error(`${tier.name} 换算后出现重叠齿位，请使用更多齿的索引轮`)
    return { ...tier, indexes }
  })
  return { design: { ...design, gear: newGear, tiers }, maxErrorDegrees, convertedIndexes }
}

function triangleArea(a, b, c) {
  const ab = b.map((value, i) => value - a[i])
  const ac = c.map((value, i) => value - a[i])
  return Math.hypot(...cross(ab, ac)) / 2
}

export function measureGem(model) {
  const points = model.facets.flatMap(facet => facet.points)
  if (!points.length) throw new Error('模型没有可测量的顶点')
  const bounds = [0, 1, 2].map(axis => ({
    min: Math.min(...points.map(point => point[axis])),
    max: Math.max(...points.map(point => point[axis])),
  }))
  const spanX = bounds[0].max - bounds[0].min
  const spanY = bounds[1].max - bounds[1].min
  const spanZ = bounds[2].max - bounds[2].min
  const length = Math.max(spanX, spanZ)
  const width = Math.min(spanX, spanZ)
  const girdlePoints = model.facets.filter(facet => Math.abs(facet.angle) > 89.95).flatMap(facet => facet.points)
  const girdleTop = girdlePoints.length ? Math.max(...girdlePoints.map(point => point[1])) : 0
  const girdleBottom = girdlePoints.length ? Math.min(...girdlePoints.map(point => point[1])) : 0
  const crown = Math.max(0, bounds[1].max - girdleTop)
  const pavilion = Math.max(0, girdleBottom - bounds[1].min)
  const girdle = Math.max(0, girdleTop - girdleBottom)
  const volume = model.facets.reduce((sum, facet) => {
    let area = 0
    for (let i = 1; i < facet.points.length - 1; i += 1) area += triangleArea(facet.points[0], facet.points[i], facet.points[i + 1])
    return sum + area * Math.abs(facet.d) / 3
  }, 0)
  return {
    length, width, depth: spanY, crown, pavilion, girdle, girdleTop, girdleBottom, volume,
    lengthToWidth: length / width,
    depthToWidth: spanY / width,
    crownToWidth: crown / width,
    pavilionToWidth: pavilion / width,
    girdleToWidth: girdle / width,
    volumeToWidthCubed: volume / width ** 3,
  }
}

class GemReader {
  constructor(buffer) {
    this.view = new DataView(buffer)
    this.offset = 0
    this.decoder = new TextDecoder('windows-1252')
  }
  get length() { return this.view.byteLength }
  int32() { const value = this.view.getInt32(this.offset, true); this.offset += 4; return value }
  float64() { const value = this.view.getFloat64(this.offset, true); this.offset += 8; return value }
  byte() { const value = this.view.getUint8(this.offset); this.offset += 1; return value }
  bytes(count) { const value = new Uint8Array(this.view.buffer, this.offset, count); this.offset += count; return value }
  point() { return [this.float64(), this.float64(), this.float64()] }
  ansi(checkMarker = true) {
    const count = this.byte()
    const value = count ? this.decoder.decode(this.bytes(count)) : ''
    if (checkMarker) this.int32()
    else if (!value.trim() && this.offset < this.length && this.byte() > 0) this.offset -= 1
    return value
  }
}

const wrapIndex = (value, gear) => ((value % gear) + gear) % gear

function tierCodeFromBinary(name, angle, tierNumber) {
  const raw = String(name || '').trim()
  if (Math.abs(angle) > 89.99) return `G${tierNumber}`
  if (Math.abs(angle) < .01) return angle < 0 ? 'CULET' : 'T'
  return `${angle < 0 ? 'P' : 'C'}${tierNumber}${raw ? `-${raw}` : ''}`
}

// GemCad's .GEM format is proprietary binary. This reader is a browser port of
// the record layout documented by the MIT-licensed gemcad-file-reader project.
export function parseGem(buffer) {
  const reader = new GemReader(buffer)
  const records = []
  const metadata = { gear: 96, ior: 1.54, symmetryFolds: 1, symmetryMirror: false, offset: 0, headers: [], footnotes: [] }
  while (reader.offset < reader.length - 3) {
    const start = reader.offset
    if (reader.length - start >= 16) {
      const unknown1 = reader.int32()
      const unknown2 = reader.bytes(4)
      const folds = reader.int32()
      const mirror = reader.int32()
      const isTrailer = unknown1 === 0 && [...unknown2].some(Boolean) && folds > 0 && (mirror === 0 || mirror === 1)
      if (isTrailer) {
        metadata.symmetryFolds = folds
        metadata.symmetryMirror = Boolean(mirror)
        metadata.gear = reader.int32()
        metadata.ior = reader.float64()
        reader.bytes(4)
        metadata.offset = reader.float64()
        let target = metadata.headers
        while (reader.offset < reader.length - 3) {
          const line = reader.ansi(false)
          if (!line.trim()) target = metadata.footnotes
          else if (line.trim().toLowerCase() === 'preform') break
          else target.push(line)
        }
        break
      }
    }
    reader.offset = start
    const normal = reader.point()
    const tierNumber = reader.int32()
    const fields = reader.ansi(true).split('\t')
    const points = []
    let marker = tierNumber
    while (marker > 0) {
      points.push(reader.point())
      marker = reader.int32()
    }
    if (points.length >= 3) records.push({ normal, tierNumber, name: fields[0]?.trim() || '', instructions: fields.slice(1).join('\t'), points })
  }
  if (!records.length) throw new Error('无法读取此 GEM 文件：没有找到有效刻面记录')
  metadata.gear = Math.abs(metadata.gear) || 96
  const scaleLength = Math.max(...records.flatMap(record => record.points.map(([x,y]) => Math.hypot(x,y))))
  const scale = scaleLength > EPSILON ? 2.4 / scaleLength : 1
  const tierMap = new Map()
  records.forEach((record, facetIndex) => {
    const length = Math.hypot(...record.normal)
    const normal = record.normal.map(value => value / length)
    const signedAngle = Math.acos(Math.min(1, Math.abs(normal[2]))) * 180 / Math.PI * (normal[2] < 0 ? -1 : 1)
    const angle = Math.abs(signedAngle) < .005 ? 0 : Number(signedAngle.toFixed(2))
    const azimuthDegrees = Math.atan2(normal[1], normal[0]) * 180 / Math.PI
    const index = Math.round(wrapIndex((90 - azimuthDegrees) / (360 / metadata.gear) - metadata.offset, metadata.gear))
    const distance = Math.abs(dot(normal, record.points[0]))
    const key = record.tierNumber
    if (!tierMap.has(key)) tierMap.set(key, { id: `tier-${key}`, number: key, name: record.name || `刻面层 ${key}`, rawName: record.name, code: tierCodeFromBinary(record.name, angle, key), angle, distance, indexes: [], instructions: record.instructions })
    const tier = tierMap.get(key)
    const localFacetIndex = tier.indexes.length
    tier.indexes.push(index)
    record.facetIndex = localFacetIndex
    record.tier = tier
    record.normal = normal
  })
  const facets = records.map(record => ({
    n: [record.normal[0], record.normal[2], record.normal[1]],
    d: Math.abs(dot(record.normal, record.points[0])) * scale,
    tier: record.tier,
    facetIndex: record.facetIndex,
    index: record.tier.indexes[record.facetIndex],
    angle: record.tier.angle,
    points: record.points.map(([x,y,z]) => [x * scale, z * scale, y * scale]),
  }))
  const uniqueVertices = []
  facets.flatMap(facet => facet.points).forEach(point => {
    if (!uniqueVertices.some(existing => Math.hypot(...existing.map((v, axis) => v - point[axis])) < 2e-5)) uniqueVertices.push(point)
  })
  tierMap.forEach(tier => {
    tier.code = normalizeTierCode(tier.rawName, tier.angle, tier.indexes.length)
    tier.name = TIER_NAMES[tier.code] || tier.rawName || `刻面层 ${tier.number}`
  })
  return {
    design: {
      gear: metadata.gear,
      offset: metadata.offset,
      ior: metadata.ior,
      title: metadata.headers.filter(Boolean).join(' · ') || '未命名 GemCad 设计',
      tiers: [...tierMap.values()],
      symmetryFolds: metadata.symmetryFolds,
      symmetryMirror: metadata.symmetryMirror,
      footnotes: metadata.footnotes,
    },
    facets,
    vertexCount: uniqueVertices.length,
  }
}
