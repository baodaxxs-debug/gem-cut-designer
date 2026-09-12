const MAX_TRIANGLES = 100000
function finishMesh(name, positions) {
  if (positions.length < 9 || positions.length % 9) throw new Error('原石网格没有有效三角面')
  const triangleCount = positions.length / 9
  if (triangleCount > MAX_TRIANGLES) throw new Error(`原石网格包含 ${triangleCount} 个三角面，当前上限为 ${MAX_TRIANGLES}`)
  const bounds = [0, 1, 2].map(axis => { const values = []; for (let index = axis; index < positions.length; index += 3) values.push(positions[index]); return { min: Math.min(...values), max: Math.max(...values) } })
  const dimensions = { length: bounds[0].max - bounds[0].min, height: bounds[1].max - bounds[1].min, width: bounds[2].max - bounds[2].min }
  if (Object.values(dimensions).some(value => !Number.isFinite(value) || value <= 1e-8)) throw new Error('原石网格尺寸无效或模型是平面')
  const centers = bounds.map(bound => (bound.min + bound.max) / 2), spans = [dimensions.length, dimensions.height, dimensions.width]
  const normalized = positions.map((value, index) => (value - centers[index % 3]) / (spans[index % 3] / 2))
  let signedVolume = 0
  for (let index = 0; index < normalized.length; index += 9) { const [ax, ay, az, bx, by, bz, cx, cy, cz] = normalized.slice(index, index + 9); signedVolume += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx) }
  const volumeFactor = Math.min(1, Math.abs(signedVolume / 6) / 8)
  return { name, positions: normalized, triangleCount, dimensions, volumeFactor, closedEstimate: volumeFactor > .01 }
}
export function parseObjRough(text, name = 'rough.obj') {
  const vertices = [], positions = []
  text.split(/\r?\n/).forEach(raw => { const line = raw.trim(); if (line.startsWith('v ')) { const values = line.split(/\s+/).slice(1, 4).map(Number); if (values.length === 3 && values.every(Number.isFinite)) vertices.push(values) } else if (line.startsWith('f ')) { const refs = line.split(/\s+/).slice(1).map(token => Number(token.split('/')[0])).map(index => index < 0 ? vertices.length + index : index - 1); for (let index = 1; index < refs.length - 1; index += 1) { const triangle = [refs[0], refs[index], refs[index + 1]].map(ref => vertices[ref]); if (triangle.every(Boolean)) positions.push(...triangle.flat()) } } })
  return finishMesh(name, positions)
}
export function parseStlRough(buffer, name = 'rough.stl') {
  const bytes = new Uint8Array(buffer), header = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 256))).trimStart().toLowerCase()
  if (header.startsWith('solid') && header.includes('facet')) { const text = new TextDecoder().decode(bytes); return finishMesh(name, [...text.matchAll(/vertex\s+([-+\deE.]+)\s+([-+\deE.]+)\s+([-+\deE.]+)/gi)].flatMap(match => [Number(match[1]), Number(match[2]), Number(match[3])])) }
  if (bytes.length < 84) throw new Error('STL 文件不完整')
  const view = new DataView(buffer), count = view.getUint32(80, true)
  if (84 + count * 50 > bytes.length) throw new Error('二进制 STL 文件长度无效')
  const positions = []
  for (let facet = 0; facet < count; facet += 1) { const start = 84 + facet * 50 + 12; for (let vertex = 0; vertex < 3; vertex += 1) for (let axis = 0; axis < 3; axis += 1) positions.push(view.getFloat32(start + vertex * 12 + axis * 4, true)) }
  return finishMesh(name, positions)
}
export function parseRoughMesh(name, data) { const lower = name.toLowerCase(); if (lower.endsWith('.obj')) return parseObjRough(typeof data === 'string' ? data : new TextDecoder().decode(data), name); if (lower.endsWith('.stl')) return parseStlRough(data instanceof ArrayBuffer ? data : data.buffer, name); throw new Error('仅支持 STL 或 OBJ 原石网格') }
