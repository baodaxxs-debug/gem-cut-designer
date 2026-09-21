import * as THREE from 'three'

export const RENDER_PROFILES = {
  mobile: { label: '手机端', bounces: 3, environmentSize: 128, dpr: [1, 1.25], dispersionScale: .65 },
  desktop: { label: '电脑端', bounces: 6, environmentSize: 256, dpr: [1, 2], dispersionScale: 1 },
}

export function resolveRenderDevice(choice = 'auto', capabilities) {
  if (choice === 'mobile' || choice === 'desktop') return choice
  const detected = capabilities || (typeof window !== 'undefined' ? {
    width: window.innerWidth,
    memory: navigator.deviceMemory,
    cores: navigator.hardwareConcurrency,
    coarse: window.matchMedia?.('(pointer: coarse)').matches,
  } : {})
  if (detected.coarse || Number(detected.width) < 850 || (detected.memory && detected.memory <= 4) || (detected.cores && detected.cores <= 4)) return 'mobile'
  return 'desktop'
}

const colorForFacet = (facet, options) => {
  const { gemColor, bodyColorStrength, showAppearance, tierColors, facetColors, tierFinishes, facetFinishes } = options
  const finish = facetFinishes[facet.tier.id]?.[facet.facetIndex] || tierFinishes[facet.tier.id] || 'polished'
  const annotationColor = facetColors[facet.tier.id]?.[facet.facetIndex] || tierColors[facet.tier.id]
  const source = showAppearance && annotationColor ? annotationColor : gemColor
  const color = new THREE.Color(source)
  if (!showAppearance || !annotationColor) {
    color.convertLinearToSRGB()
    color.lerp(new THREE.Color(1, 1, 1), 1 - bodyColorStrength)
    color.convertSRGBToLinear()
  }
  if (finish === 'frosted') color.multiplyScalar(.58)
  return color
}

export function buildClosedGemGeometry(model, options = {}) {
  const settings = {
    gemColor: '#e8fbff', bodyColorStrength: .55, showAppearance: false, tierColors: {}, facetColors: {}, tierFinishes: {}, facetFinishes: {}, ...options,
  }
  const positions = []
  const colors = []
  const facetIds = []

  model.facets.forEach((facet, globalFacetIndex) => {
    const color = colorForFacet(facet, settings)
    const outward = new THREE.Vector3(...facet.n).normalize()
    for (let index = 1; index < facet.points.length - 1; index += 1) {
      const triangle = [facet.points[0], facet.points[index], facet.points[index + 1]]
      const a = new THREE.Vector3(...triangle[0])
      const b = new THREE.Vector3(...triangle[1])
      const c = new THREE.Vector3(...triangle[2])
      const winding = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a))
      if (winding.dot(outward) < 0) [triangle[1], triangle[2]] = [triangle[2], triangle[1]]
      triangle.forEach(point => {
        positions.push(...point)
        colors.push(color.r, color.g, color.b)
        facetIds.push(globalFacetIndex)
      })
    }
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('facetId', new THREE.Float32BufferAttribute(facetIds, 1))
  geometry.setIndex(Array.from({ length: positions.length / 3 }, (_, index) => index))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function paintStudioFace(canvas, face) {
  const context = canvas.getContext('2d')
  const size = canvas.width
  const background = context.createLinearGradient(0, 0, size, size)
  background.addColorStop(0, face === 2 ? '#eeeeee' : '#111111')
  background.addColorStop(.48, face === 3 ? '#050505' : '#292929')
  background.addColorStop(1, '#020202')
  context.fillStyle = background
  context.fillRect(0, 0, size, size)
  const panels = face === 2
    ? [[.15, .12, .7, .3, '#ffffff'], [.06, .62, .88, .13, '#bdbdbd']]
    : face === 3
      ? [[.18, .75, .64, .07, '#505050']]
      : [[face % 2 ? .72 : .08, .08, .16, .84, '#ffffff'], [.18, .72, .62, .1, '#9a9a9a']]
  context.save()
  context.filter = `blur(${Math.round(size * .028)}px)`
  panels.forEach(([x, y, width, height, color]) => {
    context.fillStyle = color
    context.fillRect(x * size, y * size, width * size, height * size)
  })
  context.restore()
}

export function createStudioCubeTexture(size = 256) {
  if (typeof document === 'undefined') return null
  const faces = Array.from({ length: 6 }, (_, face) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    paintStudioFace(canvas, face)
    return canvas
  })
  const texture = new THREE.CubeTexture(faces)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.mapping = THREE.CubeReflectionMapping
  texture.needsUpdate = true
  return texture
}
