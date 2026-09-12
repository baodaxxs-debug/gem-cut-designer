const pointKey = point => point.map(value => Number(value).toFixed(5)).join(',')

function uniqueEdges(model) {
  const edges = new Map()
  model.facets.forEach(facet => facet.points.forEach((point, index) => {
    const next = facet.points[(index + 1) % facet.points.length]
    const a = pointKey(point), b = pointKey(next)
    const key = a < b ? `${a}|${b}` : `${b}|${a}`
    if (!edges.has(key)) edges.set(key, [point, next])
  }))
  return [...edges.values()]
}

const dxfLine = (a, b, layer) => [
  '0', 'LINE', '8', layer,
  '10', a[0].toFixed(5), '20', a[1].toFixed(5), '30', '0',
  '11', b[0].toFixed(5), '21', b[1].toFixed(5), '31', '0',
]

const dxfText = (text, point, height, layer) => [
  '0', 'TEXT', '8', layer, '10', point[0].toFixed(5), '20', point[1].toFixed(5), '30', '0',
  '40', height.toFixed(5), '1', String(text).replace(/[^\x20-\x7E]/g, ''),
]

export function serializeDxf(model, millimetersPerUnit = 1, title = 'Gem Design') {
  const scale = Number(millimetersPerUnit)
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('DXF 比例无效')
  const edges = uniqueEdges(model)
  const allPoints = model.facets.flatMap(facet => facet.points)
  const minX = Math.min(...allPoints.map(point => point[0])) * scale
  const maxX = Math.max(...allPoints.map(point => point[0])) * scale
  const minZ = Math.min(...allPoints.map(point => point[2])) * scale
  const maxZ = Math.max(...allPoints.map(point => point[2])) * scale
  const width = maxX - minX
  const sideOffset = maxX + width * .55
  const entities = []
  edges.forEach(([a, b]) => {
    entities.push(...dxfLine([a[0] * scale, a[2] * scale], [b[0] * scale, b[2] * scale], 'CROWN_VIEW'))
    entities.push(...dxfLine([a[0] * scale + sideOffset, a[1] * scale], [b[0] * scale + sideOffset, b[1] * scale], 'SIDE_VIEW'))
  })
  const labelHeight = Math.max(1, width * .04)
  entities.push(...dxfText(`${title} - Crown view`, [minX, minZ - labelHeight * 2], labelHeight, 'LABELS'))
  entities.push(...dxfText('Side view', [sideOffset + minX, minZ - labelHeight * 2], labelHeight, 'LABELS'))
  return ['0','SECTION','2','HEADER','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES',...entities,'0','ENDSEC','0','EOF'].join('\n') + '\n'
}

export { uniqueEdges }
