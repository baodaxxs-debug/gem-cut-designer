import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { MATERIALS, criticalAngle, leakageAssessment } from './optics.js'
import { BUILTIN_DESIGNS, buildGemFromDesign, convertDesignGear, distanceThroughPoint, materializeDesign, measureGem, parseAsc, parseGem, serializeAsc } from './gemcad.js'
import { traceFaceUp } from './raytrace.js'
import { optimizePavilion } from './optimizer.js'
import { serializeDxf } from './diagram.js'
import { evaluateRoughFit } from './rough.js'
import { validateForProduction } from './validation.js'
import { parseRoughMesh } from './roughMesh.js'
import { evaluateDefects } from './defects.js'
import { optimizeRoughPlacement } from './nesting.js'
import { evenlySpacedIndexes, findGirdleTiers, setGirdleThickness } from './girdle.js'
import './App.css'

const clone = value => JSON.parse(JSON.stringify(value))
const DEFAULT_ROUGH = { visible: false, shape: 'irregular', length: 13, width: 12, height: 8.5, opacity: .2, color: '#b9c9c1', rotationX: 0, rotationY: 0, rotationZ: 0, offsetX: 0, offsetY: 0, offsetZ: 0 }
const ROUGH_SHAPES = {
  crystal: { name: '晶形 / 八面体', volumeFactor: 1 / 6 },
  pebble: { name: '卵石 / 椭球体', volumeFactor: Math.PI / 6 },
  tabular: { name: '扁片 / 块体', volumeFactor: 1 },
  irregular: { name: '不规则原石', volumeFactor: .43 },
  scan: { name: '扫描原石网格', volumeFactor: .5 },
}
const DEFECT_TYPES = { inclusion: { name: '包体', color: '#ff9f43' }, crack: { name: '裂隙', color: '#ff5b6e' }, void: { name: '禁切区', color: '#b984ff' } }
const CUT_TOOLS = {
  rough: { name: '粗磨盘', sensitivity: 1 },
  fine: { name: '精磨盘', sensitivity: .45 },
  polish: { name: '抛光盘', sensitivity: .18 },
}
const readSavedDesigns = () => {
  try { return JSON.parse(localStorage.getItem('gem-cut-designer-library') || '[]') }
  catch { return [] }
}
const readWorkspace = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('gem-cut-designer-workspace') || 'null')
    if (!saved?.design?.tiers?.length) return null
    buildGemFromDesign(saved.design, saved.facetEdits || {})
    return saved
  } catch { return null }
}
const inferShape = design => {
  const title = (design.title || '').toLowerCase()
  const rules = [
    [/heart|心形/, '心形'], [/oval|椭圆/, '椭圆形'], [/pear|compear|梨形/, '梨形'],
    [/marquise|navette|榄尖|马眼/, '榄尖形'], [/cushion|垫形/, '垫形'],
    [/asscher|阿斯切/, '阿斯切'], [/radiant|雷迪恩/, '雷迪恩'],
    [/emerald|baguette|祖母绿/, '祖母绿/长方形'], [/princess|square|方形/, '方形'],
    [/trillion|trilliant|triangle|三角/, '三角形'], [/octagon|八角/, '八角形'], [/round|圆形/, '圆形'],
  ]
  return rules.find(([pattern]) => pattern.test(title))?.[1] || '未分类'
}

function materializeAppearance(design, edits, tierColors, facetColors, tierFinishes = {}, facetFinishes = {}) {
  const nextTierColors = {}
  const nextFacetColors = {}
  const nextTierFinishes = {}
  const nextFacetFinishes = {}
  design.tiers.forEach(tier => {
    const groups = new Map()
    tier.indexes.forEach((index, facetIndex) => {
      const edit = (edits[tier.id] || edits[tier.code])?.[facetIndex]
      const angle = edit?.angle ?? tier.angle
      const distance = tier.distance + (edit?.distanceDelta ?? 0)
      const key = `${angle.toFixed(8)}|${distance.toFixed(10)}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(facetIndex)
    })
    ;[...groups.values()].forEach((sourceFacets, groupIndex) => {
      const id = groups.size > 1 ? `${tier.id || tier.code}-${groupIndex + 1}` : tier.id
      if (tierColors[tier.id]) nextTierColors[id] = tierColors[tier.id]
      if (tierFinishes[tier.id]) nextTierFinishes[id] = tierFinishes[tier.id]
      sourceFacets.forEach((sourceFacet, targetFacet) => {
        const color = facetColors[tier.id]?.[sourceFacet]
        if (color) {
          nextFacetColors[id] ||= {}
          nextFacetColors[id][targetFacet] = color
        }
        const finish = facetFinishes[tier.id]?.[sourceFacet]
        if (finish) {
          nextFacetFinishes[id] ||= {}
          nextFacetFinishes[id][targetFacet] = finish
        }
      })
    })
  })
  return { tierColors: nextTierColors, facetColors: nextFacetColors, tierFinishes: nextTierFinishes, facetFinishes: nextFacetFinishes }
}

function Facet({ facet, ior, gemColor, selected, affected, editColor, finish = 'polished', preview = false, wireframe = false, onSelect }) {
  const geometry = useMemo(() => {
    const vertices = []
    for (let i = 1; i < facet.points.length - 1; i += 1) vertices.push(...facet.points[0], ...facet.points[i], ...facet.points[i + 1])
    const result = new THREE.BufferGeometry()
    result.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    result.computeVertexNormals()
    return result
  }, [facet.points])
  const outlineGeometry = useMemo(() => {
    const result = new THREE.BufferGeometry()
    result.setFromPoints(facet.points.map(point => new THREE.Vector3(...point)))
    return result
  }, [facet.points])
  const color = editColor || (selected ? '#ffd56a' : affected ? '#bde7ff' : gemColor)
  const frosted = finish === 'frosted'
  return <group><mesh geometry={geometry} onClick={preview || !onSelect ? undefined : event => { event.stopPropagation(); onSelect(facet) }}>
    <meshPhysicalMaterial color={color} roughness={frosted ? .62 : preview ? 0.025 : 0.07} transmission={wireframe ? .12 : frosted ? .28 : preview ? 0.9 : selected ? 0.35 : 0.72}
      thickness={preview ? 2.6 : 1.8} ior={ior} transparent opacity={wireframe ? .1 : frosted ? .9 : preview ? 0.98 : 0.96} flatShading depthWrite={!wireframe} side={THREE.DoubleSide}
      emissive={!preview && selected ? '#b06d00' : '#000000'} emissiveIntensity={!preview && selected ? 0.28 : 0} />
  </mesh>{wireframe && <lineLoop geometry={outlineGeometry} renderOrder={4}><lineBasicMaterial color={selected ? '#ffd56a' : '#8bcfff'} transparent opacity={selected ? 1 : .82} depthTest/></lineLoop>}</group>
}

function GemModel({ model, selectedTierId, selectedFacet, ior, gemColor, tierColors = {}, facetColors = {}, tierFinishes = {}, facetFinishes = {}, hiddenTiers = {}, preview = false, showAppearance = false, wireframe = false, onSelect }) {
  const tierCount = model.design.tiers.find(tier => tier.id === selectedTierId)?.indexes.length || 1
  const left = (selectedFacet - 1 + tierCount) % tierCount
  const right = (selectedFacet + 1) % tierCount
  return <group>{model.facets.map((facet, i) => {
    if (!preview && hiddenTiers[facet.tier.id]) return null
    const sameTier = facet.tier.id === selectedTierId
    const isGirdle = Math.abs(facet.angle) > 89.95
    return <Facet key={`${facet.tier.id}-${facet.facetIndex}-${i}`} facet={facet} ior={ior}
      gemColor={isGirdle && !preview ? '#6fa3bd' : gemColor}
      editColor={preview && !showAppearance ? '' : facetColors[facet.tier.id]?.[facet.facetIndex] || tierColors[facet.tier.id]}
      finish={facetFinishes[facet.tier.id]?.[facet.facetIndex] || tierFinishes[facet.tier.id] || 'polished'}
      selected={!preview && sameTier && facet.facetIndex === selectedFacet}
      affected={!preview && sameTier && (facet.facetIndex === left || facet.facetIndex === right)}
      preview={preview} wireframe={wireframe} onSelect={onSelect} />
  })}</group>
}

function RoughStone({ settings, modelScale, customMesh }) {
  const geometry = useMemo(() => {
    let result
    if (settings.shape === 'scan' && customMesh) {
      result = new THREE.BufferGeometry()
      result.setAttribute('position', new THREE.Float32BufferAttribute(customMesh.positions.map(value => value * 2.4), 3))
    } else if (settings.shape === 'crystal') result = new THREE.OctahedronGeometry(2.4, 0)
    else if (settings.shape === 'tabular') result = new THREE.BoxGeometry(4.8, 4.8, 4.8, 2, 2, 2)
    else if (settings.shape === 'pebble') result = new THREE.SphereGeometry(2.4, 28, 18)
    else {
      result = new THREE.IcosahedronGeometry(2.4, 2)
      const positions = result.attributes.position
      for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index), y = positions.getY(index), z = positions.getZ(index)
        const variation = 1 + .1 * Math.sin(x * 2.7 + z * 1.3) + .06 * Math.cos(y * 3.1 - x)
        positions.setXYZ(index, x * variation, y * variation, z * variation)
      }
      positions.needsUpdate = true
    }
    result.computeVertexNormals()
    return result
  }, [settings.shape, customMesh])
  if (!settings.visible) return null
  const safeScale = Math.max(.0001, modelScale)
  const unit = 1 / (4.8 * safeScale)
  const radians = Math.PI / 180
  return <group position={[settings.offsetX / safeScale, settings.offsetY / safeScale, settings.offsetZ / safeScale]} rotation={[settings.rotationX * radians, settings.rotationY * radians, settings.rotationZ * radians]} scale={[settings.length * unit, settings.height * unit, settings.width * unit]}>
    <mesh geometry={geometry} renderOrder={-1}><meshPhysicalMaterial color={settings.color} transparent opacity={settings.opacity} roughness={.5} transmission={.08} depthWrite={false} side={THREE.DoubleSide}/></mesh>
    <lineSegments renderOrder={3}><edgesGeometry args={[geometry, 18]}/><lineBasicMaterial color={settings.color} transparent opacity={Math.min(.8, settings.opacity + .28)} depthWrite={false}/></lineSegments>
  </group>
}

function DefectMarkers({ settings, modelScale, defects = [], defectReport }) {
  if (!defects.length) return null
  const safeScale = Math.max(.0001, modelScale), radians = Math.PI / 180
  return <group position={[settings.offsetX / safeScale, settings.offsetY / safeScale, settings.offsetZ / safeScale]} rotation={[settings.rotationX * radians, settings.rotationY * radians, settings.rotationZ * radians]}>{defects.map(defect => { const conflict = defectReport?.items.find(item => item.id === defect.id)?.conflict; const radius = defect.radius / safeScale; const shapeScale = defect.type === 'crack' ? [radius, radius * .18, radius] : [radius, radius, radius]; return <mesh key={defect.id} position={[defect.x / safeScale, defect.y / safeScale, defect.z / safeScale]} scale={shapeScale} renderOrder={5}><sphereGeometry args={[1, 18, 12]}/><meshBasicMaterial color={conflict ? '#ff304d' : DEFECT_TYPES[defect.type].color} transparent opacity={conflict ? .72 : .48} depthWrite={false} wireframe={defect.type === 'void'}/></mesh> })}</group>
}

function RenderSync({ revision }) {
  const invalidate = useThree(state => state.invalidate)
  useEffect(() => {
    let frame = 0
    let stopped = false
    const refresh = () => {
      if (stopped) return
      invalidate()
      frame += 1
      if (frame < 4) window.requestAnimationFrame(refresh)
    }
    refresh()
    const lateRefresh = window.setTimeout(invalidate, 120)
    return () => {
      stopped = true
      window.clearTimeout(lateRefresh)
    }
  }, [invalidate, revision])
  return null
}

function CuttingFeedback({ event }) {
  const group = useRef(), chip = useRef(), plane = useRef(), startedAt = useRef(0)
  const invalidate = useThree(state => state.invalidate)
  const transform = useMemo(() => {
    if (!event) return null
    const normal = new THREE.Vector3(...event.n).normalize()
    return { position: normal.clone().multiplyScalar(event.d), quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal) }
  }, [event])
  useEffect(() => { startedAt.current = performance.now(); if (group.current) group.current.visible = Boolean(event); invalidate() }, [event, invalidate])
  useFrame(() => {
    if (!event || !group.current) return
    const progress = Math.min(1, (performance.now() - startedAt.current) / 1250), eased = progress * progress * (3 - 2 * progress)
    chip.current.position.z = .05 + eased * .42
    chip.current.scale.setScalar(.88 + eased * .12)
    chip.current.material.opacity = .26 * Math.sin(Math.PI * progress)
    plane.current.material.opacity = .3 * Math.sin(Math.PI * progress)
    group.current.visible = progress < 1
    if (progress < 1) invalidate()
  })
  if (!event || !transform) return null
  return <group ref={group} position={transform.position} quaternion={transform.quaternion} renderOrder={8}>
    <mesh ref={plane}><circleGeometry args={[2.65, 64]}/><meshBasicMaterial color="#55d9ff" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide}/></mesh>
    <mesh ref={chip} position={[0, 0, .05]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.95, .82, .1, 16]}/><meshPhysicalMaterial color="#89e7ff" transparent opacity={0} roughness={.25} transmission={.18} depthWrite={false}/></mesh>
    <mesh position={[0, 0, .004]}><ringGeometry args={[2.61, 2.65, 64]}/><meshBasicMaterial color="#d5f7ff" transparent opacity={.55} depthWrite={false} side={THREE.DoubleSide}/></mesh>
  </group>
}

function DirectCutPlane({ control }) {
  const drag = useRef(null)
  const finishTimer = useRef(null)
  const { camera, size, invalidate } = useThree()
  const transform = useMemo(() => {
    if (!control?.event) return null
    const normal = new THREE.Vector3(...control.event.n).normalize()
    return { position: normal.clone().multiplyScalar(control.event.d), quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal) }
  }, [control?.event])
  useEffect(() => { if (control?.enabled) invalidate() }, [control?.enabled, control?.event, invalidate])
  if (!control?.enabled || !transform) return null
  const toolColor = control.tool === 'rough' ? '#ff9f43' : control.tool === 'polish' ? '#c58cff' : '#35d7ff'
  const pointerPosition = event => ({ x: event.clientX ?? event.nativeEvent?.clientX ?? 0, y: event.clientY ?? event.nativeEvent?.clientY ?? 0 })
  const finish = () => { if (!drag.current) return; window.clearTimeout(finishTimer.current); drag.current = null; control.onEnd?.(); document.body.classList.remove('dragging-cut-plane') }
  const start = event => { event.stopPropagation(); const pointer = pointerPosition(event), normal = new THREE.Vector3(...control.event.n).normalize(), origin = normal.clone().multiplyScalar(control.event.d), projectedOrigin = origin.clone().project(camera), projectedTip = origin.clone().add(normal).project(camera), axisX = (projectedTip.x - projectedOrigin.x) * size.width / 2, axisY = -(projectedTip.y - projectedOrigin.y) * size.height / 2, pixelsPerUnit = Math.max(12, Math.hypot(axisX, axisY)); drag.current = { pointerId: event.pointerId, ...pointer, axisX: axisX / pixelsPerUnit, axisY: axisY / pixelsPerUnit, pixelsPerUnit }; event.target.setPointerCapture?.(event.pointerId); control.onStart?.(); document.body.classList.add('dragging-cut-plane'); window.addEventListener('pointerup', finish, { once: true }) }
  const move = event => { if (!drag.current) return; event.stopPropagation(); const pointer = pointerPosition(event), alongAxis = (pointer.x - drag.current.x) * drag.current.axisX + (pointer.y - drag.current.y) * drag.current.axisY, precision = event.shiftKey ? .2 : 1; control.onMove?.(alongAxis / drag.current.pixelsPerUnit * precision); window.clearTimeout(finishTimer.current); finishTimer.current = window.setTimeout(finish, 180); invalidate() }
  const end = event => { if (!drag.current) return; event.stopPropagation(); event.target.releasePointerCapture?.(drag.current.pointerId); finish() }
  return <group position={transform.position} quaternion={transform.quaternion} renderOrder={12}>
    <mesh onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}><circleGeometry args={[1.75, 64]}/><meshBasicMaterial color={toolColor} transparent opacity={.2} depthWrite={false} side={THREE.DoubleSide}/></mesh>
    <mesh position={[0, 0, .012]}><ringGeometry args={[1.64, 1.75, 64]}/><meshBasicMaterial color="#d8f9ff" transparent opacity={.92} depthWrite={false} side={THREE.DoubleSide}/></mesh>
    <mesh position={[0, 0, .12]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.22, .22, .24, 24]}/><meshBasicMaterial color={toolColor} transparent opacity={.9} depthWrite={false}/></mesh>
    <mesh position={[0, 0, .48]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[.16, .36, 20]}/><meshBasicMaterial color="#ffe17a" depthWrite={false}/></mesh>
    <mesh position={[0, 0, -.48]} rotation={[-Math.PI / 2, 0, 0]}><coneGeometry args={[.16, .36, 20]}/><meshBasicMaterial color="#ffe17a" depthWrite={false}/></mesh>
  </group>
}

function ModelViewport({ camera, label, model, modelProps, roughProps }) {
  return <div className="model-viewport">{label && <span className="viewport-label">{label}</span>}<Canvas camera={camera} frameloop="demand"><RenderSync revision={{ model, modelProps, roughProps }}/><ambientLight intensity={1.35}/><hemisphereLight args={['#d9efff','#15283c',1.4]}/><directionalLight position={[5,8,6]} intensity={3}/><directionalLight position={[-5,2,-5]} intensity={1.4}/>{roughProps && <><RoughStone {...roughProps}/><DefectMarkers {...roughProps}/>{roughProps.cutFeedbackEnabled && <CuttingFeedback event={roughProps.cutFeedback}/>}<DirectCutPlane control={roughProps.directCut}/></>} {model && <GemModel model={model} {...modelProps} onSelect={roughProps?.activeTool === 'select' ? modelProps.onSelect : undefined}/>}<OrbitControls enableDamping enabled={roughProps?.activeTool === 'orbit' && !roughProps?.cutDragging}/></Canvas></div>
}

function chooseInitialTier(design) {
  if (/fireworks|烟花/i.test(design.title || '')) return design.tiers.find(tier => tier.code === 'F')?.id || design.tiers[0]?.id
  return design.tiers.find(tier => tier.code === 'B')?.id || design.tiers.find(tier => Math.abs(tier.angle) < 89.9 && tier.angle !== 0)?.id || design.tiers[0]?.id
}

function RayMap({ result }) {
  return <><div className="ray-map" style={{ gridTemplateColumns: `repeat(${result.resolution},1fr)` }}>{result.samples.map((sample, index) => <i key={index} className={`ray-${sample}`}/>)}</div><div className="ray-legend"><span><i className="ray-1"/>返回</span><span><i className="ray-2"/>漏光</span><span><i className="ray-3"/>多次反射</span></div></>
}

function App() {
  const startup = useMemo(() => {
    const fallback = parseAsc(BUILTIN_DESIGNS[0].asc)
    return readWorkspace() || { design: fallback }
  }, [])
  const initial = startup.design
  const [design, setDesign] = useState(initial)
  const [originalDesign, setOriginalDesign] = useState(clone(initial))
  const [sourceFormat, setSourceFormat] = useState(startup.sourceFormat || 'ASC')
  const [currentLibraryId, setCurrentLibraryId] = useState(startup.currentLibraryId || BUILTIN_DESIGNS[0].id)
  const [savedDesigns, setSavedDesigns] = useState(readSavedDesigns)
  const [importStatus, setImportStatus] = useState(startup.savedAt ? '已恢复上次自动保存的工作区' : '内置 GemCad 标准圆明亮式')
  const [facetEdits, setFacetEdits] = useState(startup.facetEdits || {})
  const [selectedTierId, setSelectedTierId] = useState(startup.selectedTierId || chooseInitialTier(initial))
  const [selectedFacet, setSelectedFacet] = useState(startup.selectedFacet || 0)
  const [material, setMaterial] = useState(MATERIALS[startup.material] ? startup.material : 'custom')
  const [ior, setIor] = useState(startup.ior || initial.ior)
  const [gemColor, setGemColor] = useState(startup.gemColor || MATERIALS.custom.color)
  const [finishedWidth, setFinishedWidth] = useState(startup.finishedWidth || 10)
  const [density, setDensity] = useState(startup.density || MATERIALS.custom.density)
  const [rough, setRough] = useState(() => { const saved = { ...DEFAULT_ROUGH, ...(startup.rough || {}) }; return saved.shape === 'scan' ? { ...saved, shape: 'irregular' } : saved })
  const [roughMesh, setRoughMesh] = useState(null)
  const [defects, setDefects] = useState(startup.defects || [])
  const [selectedDefectId, setSelectedDefectId] = useState(startup.defects?.[0]?.id || '')
  const [nesting, setNesting] = useState(null)
  const [nestingBusy, setNestingBusy] = useState(false)
  const [meetVertex, setMeetVertex] = useState(0)
  const [meetLock, setMeetLock] = useState(null)
  const [gearTarget, setGearTarget] = useState(initial.gear)
  const [indexDraft, setIndexDraft] = useState('')
  const [tierColors, setTierColors] = useState(startup.tierColors || {})
  const [facetColors, setFacetColors] = useState(startup.facetColors || {})
  const [tierFinishes, setTierFinishes] = useState(startup.tierFinishes || {})
  const [facetFinishes, setFacetFinishes] = useState(startup.facetFinishes || {})
  const [hiddenTiers, setHiddenTiers] = useState({})
  const [originalAppearance, setOriginalAppearance] = useState({ tierColors: clone(startup.tierColors || {}), facetColors: clone(startup.facetColors || {}), tierFinishes: clone(startup.tierFinishes || {}), facetFinishes: clone(startup.facetFinishes || {}) })
  const [previewColors, setPreviewColors] = useState(true)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [inspectorTab, setInspectorTab] = useState('facet')
  const [leftTab, setLeftTab] = useState('design')
  const [viewMode, setViewMode] = useState('perspective')
  const [wireframe, setWireframe] = useState(false)
  const [viewToolsOpen, setViewToolsOpen] = useState(true)
  const [history, setHistory] = useState({ past: [], future: [] })
  const [optimization, setOptimization] = useState(null)
  const [optimizing, setOptimizing] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [cuttingStep, setCuttingStep] = useState(Math.max(0, initial.tiers.findIndex(tier => tier.id === chooseInitialTier(initial))))
  const [hideFutureTiers, setHideFutureTiers] = useState(false)
  const [autosaveStatus, setAutosaveStatus] = useState(startup.savedAt ? '已恢复' : '等待保存')
  const [cutFeedbackEnabled, setCutFeedbackEnabled] = useState(true)
  const [cutFeedback, setCutFeedback] = useState(null)
  const [activeTool, setActiveTool] = useState('select')
  const [cutScope, setCutScope] = useState('single')
  const [cutTool, setCutTool] = useState('fine')
  const [cutDirection, setCutDirection] = useState('in')
  const [cutDragging, setCutDragging] = useState(false)
  const directCutStart = useRef(null)

  const selectedTier = design.tiers.find(tier => tier.id === selectedTierId) || design.tiers[0]
  const selectedEdit = facetEdits[selectedTier?.id]?.[selectedFacet]
  const selectedAngle = selectedEdit?.angle ?? selectedTier?.angle ?? 0
  const selectedDepth = -(selectedEdit?.distanceDelta || 0) / .004
  const modelResult = useMemo(() => {
    try { return { model: buildGemFromDesign(design, facetEdits), error: '' } }
    catch (error) { return { model: null, error: error.message } }
  }, [design, facetEdits])
  const selectedModelFacet = modelResult.model?.facets.find(facet => facet.tier.id === selectedTier?.id && facet.facetIndex === selectedFacet)
  const meetLocked = Boolean(meetLock && meetLock.tierId === selectedTier?.id && meetLock.facetIndex === selectedFacet)
  const designFacetCount = design.tiers.filter(tier => Math.abs(tier.angle) < 89.95).reduce((sum, tier) => sum + tier.indexes.length, 0)
  const pavilionCandidates = design.tiers.filter(tier => tier.angle < -1 && tier.angle > -89.9)
  const pavilionTier = pavilionCandidates.find(tier => tier.code === 'P2') || [...pavilionCandidates].sort((a, b) => b.indexes.length - a.indexes.length)[0]
  const pavilionAngle = Math.abs(pavilionTier?.angle || 0)
  const critical = criticalAngle(ior)
  const leakage = leakageAssessment(pavilionAngle, ior)
  const measures = useMemo(() => modelResult.model ? measureGem(modelResult.model) : null, [modelResult.model])
  const raytrace = useMemo(() => modelResult.model ? traceFaceUp(modelResult.model, ior, 21, 16) : null, [modelResult.model, ior])
  const modelScale = measures ? finishedWidth / measures.width : 0
  const girdleTiers = useMemo(() => findGirdleTiers(design), [design])
  const girdleThicknessMm = measures ? measures.girdle * modelScale : 0
  const girdleThicknessRatio = measures ? measures.girdleToWidth * 100 : 0
  const rawToMm = modelResult.model ? modelResult.model.scale * modelScale : 0
  const girdleFacetCounts = useMemo(() => Array.from({ length: design.gear - 2 }, (_, index) => index + 3).filter(count => design.gear % count === 0), [design.gear])
  const estimatedCarats = measures ? measures.volume * modelScale ** 3 * density / 200 : 0
  const finishedLength = measures ? measures.length * modelScale : 0
  const finishedDepth = measures ? measures.depth * modelScale : 0
  const roughVolume = rough.length * rough.width * rough.height * (rough.shape === 'scan' && roughMesh ? roughMesh.volumeFactor : ROUGH_SHAPES[rough.shape].volumeFactor)
  const finishedVolume = measures ? measures.volume * modelScale ** 3 : 0
  const roughYield = roughVolume > 0 ? Math.min(100, finishedVolume / roughVolume * 100) : 0
  const roughFit = useMemo(() => evaluateRoughFit(modelResult.model, modelScale, rough, roughMesh), [modelResult.model, modelScale, rough, roughMesh])
  const defectReport = useMemo(() => evaluateDefects(modelResult.model, modelScale, rough, defects), [modelResult.model, modelScale, rough, defects])
  const productionReport = useMemo(() => modelResult.model && measures ? validateForProduction(design, modelResult.model, measures, roughFit, defectReport) : null, [design, modelResult.model, measures, roughFit, defectReport])
  const viewCamera = viewMode === 'top' ? { position: [0, 7.2, .01], up: [0, 0, -1], fov: 34 } : viewMode === 'side' ? { position: [7.2, 0, .01], up: [0, 1, 0], fov: 34 } : { position: [6.5, 4.5, 7.5], fov: 38 }
  const renderedHiddenTiers = useMemo(() => {
    const next = { ...hiddenTiers }
    if (assistantOpen && hideFutureTiers) design.tiers.slice(cuttingStep + 1).forEach(tier => { next[tier.id] = true })
    return next
  }, [hiddenTiers, assistantOpen, hideFutureTiers, cuttingStep, design.tiers])
  const activeCuttingTier = design.tiers[cuttingStep] || design.tiers[0]
  const directCutMode = activeTool === 'cut'
  const directCut = {
    enabled: directCutMode && !meetLocked && Boolean(selectedModelFacet),
    event: selectedModelFacet ? { n: selectedModelFacet.n, d: selectedModelFacet.d } : null,
    tool: cutTool,
    onStart: beginDirectCut,
    onMove: moveDirectCut,
    onEnd: endDirectCut,
  }
  const roughProps = { settings: rough, modelScale, customMesh: roughMesh, defects, defectReport, cutFeedbackEnabled: cutFeedbackEnabled && !directCutMode, cutFeedback, directCut, cutDragging, activeTool }
  const selectedDefect = defects.find(defect => defect.id === selectedDefectId) || defects[0]

  useEffect(() => { setIndexDraft(selectedTier?.indexes.join(' ') || '') }, [selectedTierId, selectedTier?.indexes])
  useEffect(() => { setMeetVertex(0) }, [selectedTierId, selectedFacet])
  useEffect(() => {
    setAutosaveStatus('保存中…')
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem('gem-cut-designer-workspace', JSON.stringify({ design, facetEdits, tierColors, facetColors, tierFinishes, facetFinishes, selectedTierId, selectedFacet, material, ior, gemColor, finishedWidth, density, rough, defects, sourceFormat, currentLibraryId, savedAt: Date.now() }))
        setAutosaveStatus('已自动保存')
      } catch { setAutosaveStatus('自动保存失败') }
    }, 500)
    return () => window.clearTimeout(timer)
  }, [design, facetEdits, tierColors, facetColors, tierFinishes, facetFinishes, selectedTierId, selectedFacet, material, ior, gemColor, finishedWidth, density, rough, defects, sourceFormat, currentLibraryId])
  useEffect(() => {
    const index = design.tiers.findIndex(tier => tier.id === selectedTierId)
    if (index >= 0) setCuttingStep(index)
  }, [selectedTierId, design.tiers])
  useEffect(() => {
    if (!cutFeedbackEnabled || !selectedModelFacet) return
    setCutFeedback({ id: performance.now(), n: [...selectedModelFacet.n], d: selectedModelFacet.d })
  }, [modelResult.model, selectedModelFacet, cutFeedbackEnabled])

  useEffect(() => {
    const handleKeyDown = event => {
      const tag = event.target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo(); else undo()
      } else if (event.key === '1') setViewMode('perspective')
      else if (event.key === '2') setViewMode('top')
      else if (event.key === '3') setViewMode('side')
      else if (event.key === '4') setViewMode('quad')
      else if (event.key.toLowerCase() === 's') setActiveTool('select')
      else if (event.key.toLowerCase() === 'o') setActiveTool('orbit')
      else if (event.key.toLowerCase() === 'c' && selectedModelFacet && !meetLocked) setActiveTool('cut')
      else if (assistantOpen && event.key === '[') goToCuttingStep(cuttingStep - 1)
      else if (assistantOpen && event.key === ']') goToCuttingStep(cuttingStep + 1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  function workspaceSnapshot() {
    return clone({ design, facetEdits, tierColors, facetColors, tierFinishes, facetFinishes, hiddenTiers, rough, defects, selectedTierId, selectedFacet })
  }

  function checkpoint() {
    const snapshot = workspaceSnapshot()
    setHistory(current => ({ past: [...current.past.slice(-29), snapshot], future: [] }))
  }

  function restoreSnapshot(snapshot) {
    setDesign(snapshot.design)
    setFacetEdits(snapshot.facetEdits)
    setTierColors(snapshot.tierColors)
    setFacetColors(snapshot.facetColors)
    setTierFinishes(snapshot.tierFinishes || {})
    setFacetFinishes(snapshot.facetFinishes || {})
    setHiddenTiers(snapshot.hiddenTiers)
    setRough(snapshot.rough || DEFAULT_ROUGH)
    setDefects(snapshot.defects || [])
    setSelectedTierId(snapshot.selectedTierId)
    setSelectedFacet(snapshot.selectedFacet)
  }

  function undo() {
    if (!history.past.length) return
    const target = history.past.at(-1)
    setHistory({ past: history.past.slice(0, -1), future: [workspaceSnapshot(), ...history.future].slice(0, 30) })
    restoreSnapshot(target)
    setImportStatus('已撤销上一步修改')
  }

  function redo() {
    if (!history.future.length) return
    const [target, ...future] = history.future
    setHistory({ past: [...history.past, workspaceSnapshot()].slice(-30), future })
    restoreSnapshot(target)
    setImportStatus('已重做修改')
  }

  function loadDesign(next, label, format, appearance = {}) {
    buildGemFromDesign(next)
    setDesign(next)
    setOriginalDesign(clone(next))
    setFacetEdits({})
    setSelectedTierId(chooseInitialTier(next))
    setSelectedFacet(0)
    setSourceFormat(format)
    setImportStatus(label)
    setMaterial('custom')
    setDensity(MATERIALS.custom.density)
    setIor(next.ior)
    setGearTarget(next.gear)
    const nextAppearance = { tierColors: clone(appearance.tierColors || {}), facetColors: clone(appearance.facetColors || {}), tierFinishes: clone(appearance.tierFinishes || {}), facetFinishes: clone(appearance.facetFinishes || {}) }
    setTierColors(nextAppearance.tierColors)
    setFacetColors(nextAppearance.facetColors)
    setTierFinishes(nextAppearance.tierFinishes)
    setFacetFinishes(nextAppearance.facetFinishes)
    setHiddenTiers({})
    setOriginalAppearance(clone(nextAppearance))
    setHistory({ past: [], future: [] })
  }

  function openLibraryDesign(id) {
    const builtIn = BUILTIN_DESIGNS.find(item => item.id === id)
    const saved = savedDesigns.find(item => item.id === id)
    if (!builtIn && !saved) return
    const next = builtIn ? (builtIn.asc ? parseAsc(builtIn.asc) : clone(builtIn.design)) : clone(saved.design)
    loadDesign(next, `琢型库：${builtIn?.name || saved.name}`, builtIn ? (builtIn.asc ? '内置 ASC' : '参数化基础型') : '本机设计', builtIn?.appearance || saved?.appearance)
    setCurrentLibraryId(id)
    if (id === 'fireworks-round-8') {
      setViewMode('quad')
      setPreviewOpen(false)
      setInspectorTab('facet')
    }
  }

  function saveToLibrary() {
    const baked = materializeDesign({ ...design, ior }, facetEdits)
    const appearance = materializeAppearance(design, facetEdits, tierColors, facetColors, tierFinishes, facetFinishes)
    const id = `local-${Date.now()}`
    const name = (design.title || '未命名设计').split(' · ')[0]
    const next = [...savedDesigns, { id, name, shape: inferShape(baked), design: baked, appearance }]
    localStorage.setItem('gem-cut-designer-library', JSON.stringify(next))
    setSavedDesigns(next)
    setDesign(baked)
    setOriginalDesign(clone(baked))
    setFacetEdits({})
    setTierColors(appearance.tierColors)
    setFacetColors(appearance.facetColors)
    setTierFinishes(appearance.tierFinishes)
    setFacetFinishes(appearance.facetFinishes)
    setSelectedTierId(chooseInitialTier(baked))
    setSelectedFacet(0)
    setCurrentLibraryId(id)
    setSourceFormat('本机设计')
    setOriginalAppearance(clone(appearance))
    setImportStatus(`已保存到本机琢型库：${name}`)
  }

  function removeFromLibrary() {
    if (!currentLibraryId.startsWith('local-')) return
    const next = savedDesigns.filter(item => item.id !== currentLibraryId)
    localStorage.setItem('gem-cut-designer-library', JSON.stringify(next))
    setSavedDesigns(next)
    setCurrentLibraryId('')
    setImportStatus('已从本机琢型库移除；当前模型仍保留在工作区')
  }

  async function importDesign(event) {
    const files = [...(event.target.files || [])]
    if (!files.length) return
    try {
      const results = []
      const failures = []
      for (const file of files) {
        try {
          const isGem = file.name.toLowerCase().endsWith('.gem')
          const next = isGem ? parseGem(await file.arrayBuffer()).design : parseAsc(await file.text())
          buildGemFromDesign(next)
          results.push({ file, design: next, format: isGem ? 'GEM→可编辑模型' : 'ASC' })
        } catch (error) { failures.push(`${file.name}: ${error.message}`) }
      }
      if (!results.length) throw new Error(failures.join('；'))
      if (files.length === 1) {
        const result = results[0]
        loadDesign(result.design, `已导入：${result.file.name}`, result.format)
        setCurrentLibraryId('')
      } else {
        const stamp = Date.now()
        const records = results.map((result, index) => ({ id: `local-${stamp}-${index}`, name: (result.design.title || result.file.name).split(' · ')[0], shape: inferShape(result.design), design: result.design }))
        const nextLibrary = [...savedDesigns, ...records]
        localStorage.setItem('gem-cut-designer-library', JSON.stringify(nextLibrary))
        setSavedDesigns(nextLibrary)
        loadDesign(clone(records[0].design), `批量导入成功 ${results.length} 个${failures.length ? `，失败 ${failures.length} 个` : ''}`, '本机设计')
        setCurrentLibraryId(records[0].id)
      }
    } catch (error) {
      setImportStatus(`导入失败：${error.message}`)
    } finally { event.target.value = '' }
  }

  function updateTier(patch) {
    checkpoint()
    setDesign(current => ({ ...current, tiers: current.tiers.map(tier => tier.id === selectedTier.id ? { ...tier, ...patch } : tier) }))
  }

  function clearTierFacetEdits(tierIds) {
    setFacetEdits(current => { const next = { ...current }; tierIds.forEach(id => { if (id) delete next[id] }); return next })
  }

  function applyGirdleThickness(value) {
    const target = Number(value)
    if (!Number.isFinite(target) || target <= 0 || !measures) return
    try {
      checkpoint()
      setDesign(setGirdleThickness(design, girdleThicknessMm, target, rawToMm))
      clearTierFacetEdits([girdleTiers.upper?.id, girdleTiers.lower?.id])
      if (girdleTiers.upper) { setSelectedTierId(girdleTiers.upper.id); setSelectedFacet(0) }
      setImportStatus(`腰厚已调整为约 ${target.toFixed(2)} mm；上下腰相接层已同步移动`)
    } catch (error) { setImportStatus(`腰厚调整失败：${error.message}`) }
  }

  function updateGirdleFacetCount(value) {
    if (!girdleTiers.girdle) { setImportStatus('当前设计没有独立腰围层'); return }
    try {
      const indexes = evenlySpacedIndexes(design.gear, Number(value))
      checkpoint()
      setDesign(current => ({ ...current, tiers: current.tiers.map(tier => tier.id === girdleTiers.girdle.id ? { ...tier, indexes } : tier) }))
      clearTierFacetEdits([girdleTiers.girdle.id])
      setFacetColors(current => { const next = { ...current }; delete next[girdleTiers.girdle.id]; return next })
      setSelectedTierId(girdleTiers.girdle.id); setSelectedFacet(0)
      setImportStatus(`腰围已改为 ${indexes.length} 个均分侧面；齿位按 ${design.gear} 齿重新排列`)
    } catch (error) { setImportStatus(`腰围面数调整失败：${error.message}`) }
  }

  function updateGirdleJunction(tier, angle) {
    if (!tier || !Number.isFinite(angle)) return
    checkpoint()
    setDesign(current => ({ ...current, tiers: current.tiers.map(item => item.id === tier.id ? { ...item, angle } : item) }))
    clearTierFacetEdits([tier.id])
    setSelectedTierId(tier.id); setSelectedFacet(0)
    setImportStatus(`已调整${tier.angle > 0 ? '上' : '下'}腰相接角，模型与共享交点已重新计算`)
  }

  function commitIndexList() {
    const values = indexDraft.trim().split(/[\s,，、]+/).filter(Boolean).map(Number)
    if (!values.length || values.some(value => !Number.isFinite(value) || value < 0 || value > design.gear)) {
      setImportStatus(`齿号无效：请输入 0–${design.gear}，用空格或逗号分隔`)
      setIndexDraft(selectedTier.indexes.join(' '))
      return
    }
    const positions = values.map(value => ((value % design.gear) + design.gear) % design.gear)
    if (new Set(positions).size !== positions.length) {
      setImportStatus('齿号无效：同一层不能有重叠方位（例如 0 与整圈齿号）')
      setIndexDraft(selectedTier.indexes.join(' '))
      return
    }
    updateTier({ indexes: values })
    setFacetEdits(current => { const next = { ...current }; delete next[selectedTier.id]; return next })
    setSelectedFacet(0)
    setImportStatus(`已更新 ${selectedTier.name}：${values.length} 个齿位`)
  }

  function updateSelectedIndex(value) {
    const index = Number(value)
    if (!Number.isFinite(index) || index < 0 || index > design.gear) return
    const indexes = [...selectedTier.indexes]
    indexes[selectedFacet] = index
    const positions = indexes.map(item => ((item % design.gear) + design.gear) % design.gear)
    if (new Set(positions).size !== positions.length) {
      setImportStatus('该齿位与本层另一刻面重叠，未应用')
      return
    }
    checkpoint()
    setDesign(current => ({ ...current, tiers: current.tiers.map(tier => tier.id === selectedTier.id ? { ...tier, indexes } : tier) }))
    if (meetLocked) { const distance = distanceThroughPoint(selectedAngle, index, design.gear, meetLock.point, design.gearDirection); setFacetEdits(current => ({ ...current, [selectedTier.id]: { ...(current[selectedTier.id] || {}), [selectedFacet]: { ...(current[selectedTier.id]?.[selectedFacet] || {}), distanceDelta: distance - selectedTier.distance } } })) }
  }

  function duplicateTier() {
    checkpoint()
    const id = `tier-${Date.now()}`
    const position = design.tiers.findIndex(tier => tier.id === selectedTier.id)
    const duplicate = { ...clone(selectedTier), id, name: `${selectedTier.name} 副本`, rawName: `${selectedTier.rawName || selectedTier.code || '层'}-copy` }
    setDesign(current => ({ ...current, tiers: [...current.tiers.slice(0, position + 1), duplicate, ...current.tiers.slice(position + 1)] }))
    setSelectedTierId(id)
    setSelectedFacet(0)
    if (tierColors[selectedTier.id]) setTierColors(current => ({ ...current, [id]: current[selectedTier.id] }))
    if (facetColors[selectedTier.id]) setFacetColors(current => ({ ...current, [id]: clone(current[selectedTier.id]) }))
    if (tierFinishes[selectedTier.id]) setTierFinishes(current => ({ ...current, [id]: current[selectedTier.id] }))
    if (facetFinishes[selectedTier.id]) setFacetFinishes(current => ({ ...current, [id]: clone(current[selectedTier.id]) }))
    setImportStatus('已复制切割层；请调整角度、中心距和齿位')
  }

  function deleteTier() {
    if (design.tiers.length <= 1) return
    checkpoint()
    const position = design.tiers.findIndex(tier => tier.id === selectedTier.id)
    const remaining = design.tiers.filter(tier => tier.id !== selectedTier.id)
    setDesign(current => ({ ...current, tiers: remaining }))
    setFacetEdits(current => { const next = { ...current }; delete next[selectedTier.id]; return next })
    setTierColors(current => { const next = { ...current }; delete next[selectedTier.id]; return next })
    setFacetColors(current => { const next = { ...current }; delete next[selectedTier.id]; return next })
    setTierFinishes(current => { const next = { ...current }; delete next[selectedTier.id]; return next })
    setFacetFinishes(current => { const next = { ...current }; delete next[selectedTier.id]; return next })
    setHiddenTiers(current => { const next = { ...current }; delete next[selectedTier.id]; return next })
    setSelectedTierId(remaining[Math.min(position, remaining.length - 1)].id)
    setSelectedFacet(0)
    setImportStatus(`已删除切割层：${selectedTier.name}（可用“恢复导入时设计”撤销）`)
  }

  function moveTier(direction) {
    const position = design.tiers.findIndex(tier => tier.id === selectedTier.id)
    const target = position + direction
    if (target < 0 || target >= design.tiers.length) return
    checkpoint()
    setDesign(current => {
      const tiers = [...current.tiers]
      ;[tiers[position], tiers[target]] = [tiers[target], tiers[position]]
      return { ...current, tiers }
    })
  }

  function applyGearConversion(preserveIndexes = false) {
    try {
      const target = Math.round(Number(gearTarget))
      if (target < 3 || target > 360) throw new Error('目标索引轮应为 3–360 齿')
      checkpoint()
      if (preserveIndexes) {
        if (design.tiers.some(tier => tier.indexes.some(index => index > target))) throw new Error(`存在大于 ${target} 的齿号，不能直接保留`)
        setDesign(current => ({ ...current, gear: target }))
        setImportStatus(`已改为 ${target} 齿并保留原齿号；刻面方位角已经改变`)
      } else {
        const result = convertDesignGear(design, target)
        setDesign(result.design)
        setFacetEdits({})
        setImportStatus(`已按方位换算为 ${target} 齿；换算 ${result.convertedIndexes} 个齿号，最大方位误差 ${result.maxErrorDegrees.toFixed(3)}°`)
      }
    } catch (error) { setImportStatus(`齿轮换算失败：${error.message}`) }
  }

  function updateSelectedFacet(patch) {
    checkpoint()
    setFacetEdits(current => ({ ...current, [selectedTier.id]: { ...(current[selectedTier.id] || {}), [selectedFacet]: { ...(current[selectedTier.id]?.[selectedFacet] || {}), ...patch } } }))
  }

  function beginDirectCut() {
    if (!modelResult.model || meetLocked) return
    checkpoint()
    const targets = cutScope === 'tier' ? selectedTier.indexes.map((_, index) => index) : [selectedFacet]
    directCutStart.current = { tierId: selectedTier.id, targets, distances: Object.fromEntries(targets.map(index => [index, facetEdits[selectedTier.id]?.[index]?.distanceDelta || 0])), modelScale: modelResult.model.scale }
    setCutDragging(true)
    setCutFeedback(null)
  }

  function moveDirectCut(displayDelta) {
    const start = directCutStart.current
    if (!start?.modelScale) return
    const movement = displayDelta / start.modelScale * CUT_TOOLS[cutTool].sensitivity
    const directed = cutDirection === 'in' ? -Math.abs(movement) : cutDirection === 'out' ? Math.abs(movement) : movement
    const rawDelta = Math.max(-.032, Math.min(.032, directed))
    setFacetEdits(current => {
      const tierEdits = { ...(current[start.tierId] || {}) }
      start.targets.forEach(index => { tierEdits[index] = { ...(tierEdits[index] || {}), distanceDelta: start.distances[index] + rawDelta } })
      const next = { ...current, [start.tierId]: tierEdits }
      try { buildGemFromDesign(design, next); return next } catch { return current }
    })
  }

  function endDirectCut() {
    if (!directCutStart.current) return
    const faceCount = directCutStart.current.targets.length
    directCutStart.current = null
    setCutDragging(false)
    setImportStatus(`已用${CUT_TOOLS[cutTool].name}调整 ${faceCount === 1 ? `${selectedTier.name} No.${selectedFacet + 1}` : `${selectedTier.name}全部 ${faceCount} 面`}；可用撤销恢复`)
  }

  function toggleDirectCut() {
    if (meetLocked) { setImportStatus('当前刻面锁定了相接点，请先解除锁定再拖动切割片'); return }
    setActiveTool(current => current === 'cut' ? 'select' : 'cut')
    setCutDragging(false)
    directCutStart.current = null
    document.body.classList.remove('dragging-cut-plane')
  }

  function applyCutAngle(angle) {
    if (cutScope === 'single') { updateSelectedAngle(angle); return }
    checkpoint()
    setFacetEdits(current => {
      const tierEdits = { ...(current[selectedTier.id] || {}) }
      selectedTier.indexes.forEach((_, index) => { tierEdits[index] = { ...(tierEdits[index] || {}), angle } })
      return { ...current, [selectedTier.id]: tierEdits }
    })
  }

  function rotateCutDirection(step) {
    checkpoint()
    setDesign(current => ({ ...current, tiers: current.tiers.map(tier => {
      if (tier.id !== selectedTier.id) return tier
      const indexes = [...tier.indexes]
      const shift = value => { const next = value + step; return next > current.gear ? next - current.gear : next < 0 ? next + current.gear : next }
      if (cutScope === 'tier') return { ...tier, indexes: indexes.map(shift) }
      indexes[selectedFacet] = shift(indexes[selectedFacet])
      return { ...tier, indexes }
    }) }))
  }

  function updateSelectedAngle(angle) { if (!meetLocked) { updateSelectedFacet({ angle }); return } const index = selectedTier.indexes[selectedFacet], distance = distanceThroughPoint(angle, index, design.gear, meetLock.point, design.gearDirection); updateSelectedFacet({ angle, distanceDelta: distance - selectedTier.distance }) }
  function lockMeetPoint() { const point = selectedModelFacet?.points[meetVertex]; if (!point || !modelResult.model?.scale) { setImportStatus('当前刻面没有可锁定的相接点'); return } setMeetLock({ tierId: selectedTier.id, facetIndex: selectedFacet, point: point.map(value => value / modelResult.model.scale), vertex: meetVertex }); setImportStatus(`已锁定 ${selectedTier.name} No.${selectedFacet + 1} 的相接点 ${meetVertex + 1}`) }
  function unlockMeetPoint() { setMeetLock(null); setImportStatus('已解除相接点锁定') }

  function resetSelectedFacet() {
    checkpoint()
    setFacetEdits(current => {
      const next = { ...current, [selectedTier.id]: { ...(current[selectedTier.id] || {}) } }
      delete next[selectedTier.id][selectedFacet]
      if (!Object.keys(next[selectedTier.id]).length) delete next[selectedTier.id]
      return next
    })
  }

  function restoreDesign() {
    checkpoint()
    setDesign(clone(originalDesign))
    setFacetEdits({})
    setSelectedTierId(chooseInitialTier(originalDesign))
    setSelectedFacet(0)
    setTierColors(clone(originalAppearance.tierColors))
    setFacetColors(clone(originalAppearance.facetColors))
    setTierFinishes(clone(originalAppearance.tierFinishes || {}))
    setFacetFinishes(clone(originalAppearance.facetFinishes || {}))
    setHiddenTiers({})
    setImportStatus(sourceFormat === 'ASC' ? '已恢复导入时设计' : '已恢复 GEM 原始设计')
  }

  function saveWorkspaceNow() { try { localStorage.setItem('gem-cut-designer-workspace', JSON.stringify({ design, facetEdits, tierColors, facetColors, tierFinishes, facetFinishes, selectedTierId, selectedFacet, material, ior, gemColor, finishedWidth, density, rough, defects, sourceFormat, currentLibraryId, savedAt: Date.now() })); setAutosaveStatus('已手动保存'); setImportStatus('当前工作区已保存到本机浏览器') } catch { setAutosaveStatus('保存失败'); setImportStatus('工作区保存失败：浏览器存储空间可能不足') } }

  function exportAsc() {
    const output = serializeAsc(materializeDesign({ ...design, ior }, facetEdits), ior)
    downloadText(output, `${safeDesignName()}.asc`, 'text/plain;charset=utf-8')
    setImportStatus('已导出当前可编辑设计为 ASC')
  }

  function safeDesignName() {
    return (design.title || 'gem-design').split(' · ')[0].replace(/[^\w\u4e00-\u9fff-]+/g, '-')
  }

  function downloadText(output, filename, type) {
    const url = URL.createObjectURL(new Blob([output], { type }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportCuttingChart() {
    const baked = materializeDesign(design, facetEdits)
    const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`
    const rows = [['步骤','部位','层名','角度(°)','中心距','齿号','刻面数','切割说明']]
    baked.tiers.forEach((tier, index) => rows.push([index + 1, tier.angle < -0.01 ? '亭部' : tier.angle > 0.01 ? '冠部/腰围' : '台面', tier.name, tier.angle, tier.distance, tier.indexes.join(' '), tier.indexes.length, tier.instructions || '']))
    downloadText(`\ufeff${rows.map(row => row.map(quote).join(',')).join('\n')}`, `${safeDesignName()}-切割步骤.csv`, 'text/csv;charset=utf-8')
    setImportStatus('已导出切割步骤表 CSV')
  }

  function exportDxf() {
    if (!modelResult.model || !measures) return
    const scale = finishedWidth / measures.width
    downloadText(serializeDxf(modelResult.model, scale, design.title || 'Gem Design'), `${safeDesignName()}-工程线稿.dxf`, 'application/dxf')
    setImportStatus('已导出真实刻面边界 DXF（俯视图 + 侧视图）')
  }

  function selectFacet(facet) {
    if (activeTool !== 'select') return
    setSelectedTierId(facet.tier.id)
    setSelectedFacet(facet.facetIndex)
  }

  function goToCuttingStep(position) {
    const next = Math.max(0, Math.min(design.tiers.length - 1, position))
    setCuttingStep(next)
    setSelectedTierId(design.tiers[next].id)
    setSelectedFacet(0)
  }

  function remapFacetRecord(record = {}, removedIndex) {
    return Object.fromEntries(Object.entries(record).filter(([key]) => Number(key) !== removedIndex).map(([key, value]) => [Number(key) > removedIndex ? Number(key) - 1 : Number(key), value]))
  }

  function enableFreeDesign() {
    checkpoint()
    setDesign(current => ({ ...current, symmetryFolds: 1, symmetryMirror: false }))
    setImportStatus('已进入自由设计模式：ASC 对称设置改为 1，无镜像')
  }

  function addFacetToSelectedTier() {
    const occupied = new Set(selectedTier.indexes.map(index => ((Math.round(index) % design.gear) + design.gear) % design.gear))
    if (occupied.size >= design.gear) { setImportStatus('当前索引轮已经没有可用齿位'); return }
    const sorted = [...occupied].sort((a, b) => a - b)
    let bestStart = sorted[0] || 0, bestGap = -1
    sorted.forEach((position, index) => {
      const next = index === sorted.length - 1 ? sorted[0] + design.gear : sorted[index + 1]
      if (next - position > bestGap) { bestGap = next - position; bestStart = position }
    })
    let candidate = Math.round(bestStart + bestGap / 2) % design.gear
    while (occupied.has(candidate)) candidate = (candidate + 1) % design.gear
    const displayIndex = candidate === 0 ? design.gear : candidate
    checkpoint()
    const indexes = [...selectedTier.indexes, displayIndex]
    setDesign(current => ({ ...current, symmetryFolds: 1, symmetryMirror: false, tiers: current.tiers.map(tier => tier.id === selectedTier.id ? { ...tier, indexes } : tier) }))
    setSelectedFacet(indexes.length - 1)
    setImportStatus(`已在最大齿位空档添加刻面 ${displayIndex}，并转为自由设计模式`)
  }

  function deleteSelectedFacet() {
    if (selectedTier.indexes.length <= 1) { setImportStatus('每个切割层至少需要保留一个刻面'); return }
    checkpoint()
    const indexes = selectedTier.indexes.filter((_, index) => index !== selectedFacet)
    setDesign(current => ({ ...current, symmetryFolds: 1, symmetryMirror: false, tiers: current.tiers.map(tier => tier.id === selectedTier.id ? { ...tier, indexes } : tier) }))
    setFacetEdits(current => ({ ...current, [selectedTier.id]: remapFacetRecord(current[selectedTier.id], selectedFacet) }))
    setFacetColors(current => ({ ...current, [selectedTier.id]: remapFacetRecord(current[selectedTier.id], selectedFacet) }))
    setFacetFinishes(current => ({ ...current, [selectedTier.id]: remapFacetRecord(current[selectedTier.id], selectedFacet) }))
    setSelectedFacet(Math.min(selectedFacet, indexes.length - 1))
    setImportStatus('已删除当前刻面，并转为自由设计模式')
  }

  function setTierColor(color) {
    checkpoint()
    setTierColors(current => ({ ...current, [selectedTier.id]: color }))
  }

  function clearTierColor() {
    checkpoint()
    setTierColors(current => { const next = { ...current }; delete next[selectedTier.id]; return next })
  }

  function setFacetColor(color) {
    checkpoint()
    setFacetColors(current => ({ ...current, [selectedTier.id]: { ...(current[selectedTier.id] || {}), [selectedFacet]: color } }))
  }

  function setTierFinish(finish) {
    checkpoint()
    setTierFinishes(current => ({ ...current, [selectedTier.id]: finish }))
  }

  function setFacetFinish(finish) {
    checkpoint()
    setFacetFinishes(current => {
      const next = { ...current, [selectedTier.id]: { ...(current[selectedTier.id] || {}) } }
      if (finish === 'inherit') delete next[selectedTier.id][selectedFacet]
      else next[selectedTier.id][selectedFacet] = finish
      if (!Object.keys(next[selectedTier.id]).length) delete next[selectedTier.id]
      return next
    })
  }

  function updateRough(patch) {
    checkpoint()
    setRough(current => ({ ...current, ...patch }))
  }

  function addDefect() { checkpoint(); const defect = { id: `defect-${Date.now()}`, name: `缺陷 ${defects.length + 1}`, type: 'inclusion', x: 0, y: 0, z: 0, radius: 1 }; setDefects(current => [...current, defect]); setSelectedDefectId(defect.id) }
  function updateDefect(patch) { if (!selectedDefect) return; checkpoint(); setDefects(current => current.map(defect => defect.id === selectedDefect.id ? { ...defect, ...patch } : defect)) }
  function removeDefect() { if (!selectedDefect) return; checkpoint(); const remaining = defects.filter(defect => defect.id !== selectedDefect.id); setDefects(remaining); setSelectedDefectId(remaining[0]?.id || '') }

  function runAutoNesting() { setNestingBusy(true); setNesting(null); setImportStatus('正在搜索原石旋转与平移方案…'); window.setTimeout(() => { try { const result = optimizeRoughPlacement(modelResult.model, modelScale, rough, defects, roughMesh); setNesting(result); if (result.improved) { checkpoint(); setRough(result.best.settings); setImportStatus(`自动套料完成：比较 ${result.tested} 个位置，可撤销恢复`) } else setImportStatus(`已比较 ${result.tested} 个位置，当前摆放已是搜索范围内最佳`) } catch (error) { setImportStatus(`自动套料失败：${error.message}`) } finally { setNestingBusy(false) } }, 40) }

  async function importRoughMesh(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const data = file.name.toLowerCase().endsWith('.obj') ? await file.text() : await file.arrayBuffer()
      const mesh = parseRoughMesh(file.name, data)
      checkpoint()
      setRoughMesh(mesh)
      setRough(current => ({ ...current, visible: true, shape: 'scan', length: Number(mesh.dimensions.length.toFixed(3)), width: Number(mesh.dimensions.width.toFixed(3)), height: Number(mesh.dimensions.height.toFixed(3)) }))
      setImportStatus(`已导入原石网格：${file.name} · ${mesh.triangleCount} 个三角面`)
      setLeftTab('rough')
    } catch (error) { setImportStatus(`原石导入失败：${error.message}`) }
    finally { event.target.value = '' }
  }

  function clearFacetColor() {
    checkpoint()
    setFacetColors(current => {
      const next = { ...current, [selectedTier.id]: { ...(current[selectedTier.id] || {}) } }
      delete next[selectedTier.id][selectedFacet]
      if (!Object.keys(next[selectedTier.id]).length) delete next[selectedTier.id]
      return next
    })
  }

  function runPavilionOptimization() {
    setOptimizing(true)
    setOptimization(null)
    setImportStatus('正在比较亭角方案…')
    window.setTimeout(() => {
      try {
        const baked = materializeDesign({ ...design, ior }, facetEdits)
        const appearance = materializeAppearance(design, facetEdits, tierColors, facetColors, tierFinishes, facetFinishes)
        const result = optimizePavilion(baked, ior)
        setOptimization({ ...result, appearance })
        setImportStatus(`亭角优化完成：比较了 ${result.tested} 个方案`)
      } catch (error) { setImportStatus(`亭角优化失败：${error.message}`) }
      finally { setOptimizing(false) }
    }, 40)
  }

  function applyPavilionOptimization() {
    if (!optimization) return
    checkpoint()
    setDesign(optimization.best.design)
    setFacetEdits({})
    setTierColors(optimization.appearance.tierColors)
    setFacetColors(optimization.appearance.facetColors)
    setTierFinishes(optimization.appearance.tierFinishes)
    setFacetFinishes(optimization.appearance.facetFinishes)
    setSelectedTierId(chooseInitialTier(optimization.best.design))
    setSelectedFacet(0)
    setOptimization(null)
    setImportStatus('已应用推荐亭角；可使用“撤销”恢复')
  }

  return <div className="app">
    <header className="header"><div><h1>宝石智能琢型设计系统</h1><p>Gemstone Intelligent Cut Designer</p></div><div className="header-status"><span>{autosaveStatus}</span><div className="version">Prototype 4.2 · Fireworks Cut</div></div></header>
    <main className="workspace">
      <aside className="panel controls"><div className="sidebar-tabs"><button className={leftTab === 'design' ? 'active' : ''} onClick={() => setLeftTab('design')}>设计</button><button className={leftTab === 'rough' ? 'active' : ''} onClick={() => setLeftTab('rough')}>原石</button><button className={leftTab === 'material' ? 'active' : ''} onClick={() => setLeftTab('material')}>材料</button><button className={leftTab === 'output' ? 'active' : ''} onClick={() => setLeftTab('output')}>输出</button></div>
        <details className="project-actions"><summary><span>项目操作</span><small>{autosaveStatus}</small></summary><div><button onClick={saveWorkspaceNow}>保存工作区</button><button onClick={restoreDesign}>恢复当前设计</button><button onClick={undo} disabled={!history.past.length}>撤销修改</button></div></details>
        {leftTab === 'material' && <><div className="panel-heading"><h2>材料与外观</h2><span>IOR {ior.toFixed(3)}</span></div>
        <label>宝石材料</label><select value={material} onChange={e => { const key = e.target.value; setMaterial(key); setIor(MATERIALS[key].ior); setDensity(MATERIALS[key].density); setGemColor(MATERIALS[key].color) }}>{Object.entries(MATERIALS).map(([key, value]) => <option key={key} value={key}>{value.name}</option>)}</select>
        <label>实际折射率（IOR）</label><input aria-label="折射率" type="number" min="1.01" max="3" step="0.001" value={ior} onChange={e => setIor(Math.min(3, Math.max(1.01, Number(e.target.value))))} />
        <label>宝石颜色</label><div className="color-control"><input aria-label="宝石颜色" type="color" value={gemColor} onChange={e => setGemColor(e.target.value)}/><span>{gemColor.toUpperCase()}</span></div>
        <label className="visibility-toggle"><input type="checkbox" checked={previewColors} onChange={e => setPreviewColors(e.target.checked)}/> 效果窗显示分面配色</label>
        <div className="compact-grid"><div><label>成品宽度（mm）</label><input type="number" min="0.1" max="1000" step="0.1" value={finishedWidth} onChange={e => setFinishedWidth(Math.max(.1, Number(e.target.value)))}/></div><div><label>密度（g/cm³）</label><input type="number" min="0.1" max="30" step="0.01" value={density} onChange={e => setDensity(Math.max(.1, Number(e.target.value)))}/></div></div>
        {measures && <div className="summary-card"><span>预计成品</span><strong>{(measures.length * modelScale).toFixed(2)} × {finishedWidth.toFixed(2)} × {(measures.depth * modelScale).toFixed(2)} mm</strong><small>约 {estimatedCarats.toFixed(2)} ct</small></div>}</>}

        {leftTab === 'design' && <><div className="panel-heading"><h2>设计库</h2><span>{design.tiers.length} 层 · {designFacetCount} 面</span></div>
        <label>琢型库</label><select value={currentLibraryId} onChange={e => openLibraryDesign(e.target.value)}>
          <option value="" disabled>选择一个设计</option>
          <optgroup label="已验证内置设计">{BUILTIN_DESIGNS.map(item => <option key={item.id} value={item.id}>{item.shape} · {item.name}</option>)}</optgroup>
          {savedDesigns.length > 0 && <optgroup label="我的本机设计">{savedDesigns.map(item => <option key={item.id} value={item.id}>{item.shape} · {item.name}</option>)}</optgroup>}
        </select>
        <details className="library-actions"><summary>保存、导入与设计库管理</summary><button className="secondary" onClick={saveToLibrary}>另存到本机琢型库</button>
        {currentLibraryId.startsWith('local-') && <button className="secondary danger" onClick={removeFromLibrary}>从本机琢型库移除</button>}
        <label className="secondary file-button">导入或批量导入 .GEM / .ASC<input multiple type="file" accept=".gem,.asc,.txt" onChange={importDesign}/></label>
        </details>
        <div className="status-card"><span>{importStatus}</span><small>{sourceFormat} · {design.gear} 齿 · {design.tiers.length} 个切割层</small></div></>}

        {leftTab === 'rough' && <><div className="panel-heading"><h2>原石规划</h2><span>{ROUGH_SHAPES[rough.shape].name}</span></div>
        <label className="visibility-toggle"><input type="checkbox" checked={rough.visible} onChange={event => updateRough({ visible: event.target.checked })}/> 在工程视图显示原石</label>
        <label>原石基础形状</label><select value={rough.shape} onChange={event => updateRough({ shape: event.target.value })}>{Object.entries(ROUGH_SHAPES).filter(([key]) => key !== 'scan' || roughMesh).map(([key, shape]) => <option key={key} value={key}>{shape.name}</option>)}</select>
        <label className="secondary file-button">导入真实原石 .STL / .OBJ<input type="file" accept=".stl,.obj" onChange={importRoughMesh}/></label>
        {roughMesh && <div className={`mesh-status ${roughMesh.closedEstimate ? 'ok' : 'warning'}`}><strong>{roughMesh.name}</strong><span>{roughMesh.triangleCount} 个三角面 · 原始尺寸按 mm 读取</span><small>{roughMesh.closedEstimate ? '网格具有可计算体积，请仍检查是否封闭和单位是否正确' : '未检测到可靠体积：网格可能未封闭或三角面方向不一致'}</small></div>}
        <div className="rough-dimensions"><div><label>长 mm</label><input type="number" min=".1" step=".1" value={rough.length} onChange={event => updateRough({ length: Math.max(.1, Number(event.target.value)) })}/></div><div><label>宽 mm</label><input type="number" min=".1" step=".1" value={rough.width} onChange={event => updateRough({ width: Math.max(.1, Number(event.target.value)) })}/></div><div><label>高 mm</label><input type="number" min=".1" step=".1" value={rough.height} onChange={event => updateRough({ height: Math.max(.1, Number(event.target.value)) })}/></div></div>
        <label>原石透明度：{Math.round(rough.opacity * 100)}%</label><input type="range" min=".05" max=".65" step=".01" value={rough.opacity} onChange={event => updateRough({ opacity: Number(event.target.value) })}/>
        <label>原石显示颜色</label><div className="color-control"><input type="color" value={rough.color} onChange={event => updateRough({ color: event.target.value })}/><span>{rough.color.toUpperCase()}</span></div>
        <details className="advanced-editor"><summary>摆放位置与旋转</summary>
          <p className="legend">平移用于避开裂隙或包体；旋转用于寻找更高出成率的放置方向。</p>
          <div className="rough-dimensions"><div><label>X 位移</label><input type="number" step=".1" value={rough.offsetX} onChange={event => updateRough({ offsetX: Number(event.target.value) })}/></div><div><label>Y 位移</label><input type="number" step=".1" value={rough.offsetY} onChange={event => updateRough({ offsetY: Number(event.target.value) })}/></div><div><label>Z 位移</label><input type="number" step=".1" value={rough.offsetZ} onChange={event => updateRough({ offsetZ: Number(event.target.value) })}/></div></div>
          <div className="rough-dimensions"><div><label>X 旋转</label><input type="number" step="1" value={rough.rotationX} onChange={event => updateRough({ rotationX: Number(event.target.value) })}/></div><div><label>Y 旋转</label><input type="number" step="1" value={rough.rotationY} onChange={event => updateRough({ rotationY: Number(event.target.value) })}/></div><div><label>Z 旋转</label><input type="number" step="1" value={rough.rotationZ} onChange={event => updateRough({ rotationZ: Number(event.target.value) })}/></div></div>
        </details>
        <button className="secondary primary-action" disabled={nestingBusy || (rough.shape === 'scan' && roughMesh?.triangleCount > 3000)} onClick={runAutoNesting}>{nestingBusy ? '正在自动套料…' : '自动寻找最佳摆放'}</button>
        {rough.shape === 'scan' && roughMesh?.triangleCount > 3000 && <p className="legend">扫描网格超过 3000 面，自动套料前需要在扫描软件中简化网格；手动摆放与精确检测仍可使用。</p>}
        {nesting && <div className="nesting-result"><span>已比较 {nesting.tested} 个候选位置</span><strong>{nesting.improved ? '已应用更优摆放' : '当前摆放无需调整'}</strong><small>穿出顶点 {nesting.baseline.fit.outside} → {nesting.best.fit.outside} · 缺陷冲突 {nesting.baseline.defectReport.conflicts} → {nesting.best.defectReport.conflicts}</small></div>}
        <div className="defect-heading"><div><strong>包体与裂隙</strong><span>{defectReport.conflicts ? `${defectReport.conflicts} 个冲突` : `${defects.length} 个标记`}</span></div><button onClick={addDefect}>＋ 添加</button></div>
        {selectedDefect && <div className="defect-editor">
          <label>当前缺陷</label><select value={selectedDefect.id} onChange={event => setSelectedDefectId(event.target.value)}>{defects.map(defect => <option key={defect.id} value={defect.id}>{defect.name} · {DEFECT_TYPES[defect.type].name}</option>)}</select>
          <label>名称</label><input type="text" value={selectedDefect.name} onChange={event => updateDefect({ name: event.target.value })}/>
          <label>缺陷类型</label><select value={selectedDefect.type} onChange={event => updateDefect({ type: event.target.value })}>{Object.entries(DEFECT_TYPES).map(([key, type]) => <option key={key} value={key}>{type.name}</option>)}</select>
          <div className="rough-dimensions"><div><label>局部 X</label><input type="number" step=".1" value={selectedDefect.x} onChange={event => updateDefect({ x: Number(event.target.value) })}/></div><div><label>局部 Y</label><input type="number" step=".1" value={selectedDefect.y} onChange={event => updateDefect({ y: Number(event.target.value) })}/></div><div><label>局部 Z</label><input type="number" step=".1" value={selectedDefect.z} onChange={event => updateDefect({ z: Number(event.target.value) })}/></div></div>
          <label>影响半径：{selectedDefect.radius.toFixed(2)} mm</label><input type="range" min=".05" max={Math.max(1, Math.min(rough.length, rough.width, rough.height) / 2)} step=".05" value={selectedDefect.radius} onChange={event => updateDefect({ radius: Number(event.target.value) })}/>
          <div className={`defect-state ${defectReport.items.find(item => item.id === selectedDefect.id)?.conflict ? 'conflict' : 'clear'}`}>{defectReport.items.find(item => item.id === selectedDefect.id)?.conflict ? '与当前成品范围冲突' : '当前未侵入成品范围'}</div>
          <button className="secondary danger" onClick={removeDefect}>删除当前缺陷</button>
        </div>}
        <div className={`rough-summary ${roughFit.fits ? 'fit' : 'warning'}`}><span>体积理论出成率</span><strong>{roughYield.toFixed(1)}%</strong><small>{!rough.visible ? '开启原石显示后进行精确包容检测' : roughFit.fits ? `已检测 ${roughFit.total} 个成品顶点，全部位于原石内` : `${roughFit.outside}/${roughFit.total} 个顶点穿出${roughFit.maxOverflowMm == null ? '' : `，最大近似超出 ${roughFit.maxOverflowMm.toFixed(2)} mm`}`}</small></div>
        <p className="legend">这是包围体初步估算，尚未扣除裂隙、包体、锯缝和预形成损耗。</p></>}

        {leftTab === 'output' && <><div className="panel-heading"><h2>机器与输出</h2><span>{design.gear} 齿</span></div>
        <label>目标索引轮齿数（当前 {design.gear} 齿）</label><input type="number" min="3" max="360" step="1" value={gearTarget} onChange={e => setGearTarget(e.target.value)}/>
        <button className="secondary" onClick={() => applyGearConversion(false)}>换算齿号并保持方位</button>
        <button className="secondary subtle" onClick={() => applyGearConversion(true)}>仅换齿轮，保留原齿号</button>
        <p className="legend">“保持方位”会把每个刻面换算到最接近的新齿位并报告误差；正式上机前仍需核对。</p>
        <button className="secondary primary-action" onClick={exportAsc}>导出设计 .ASC</button>
        <button className="secondary" onClick={exportCuttingChart}>导出切割步骤表 .CSV</button>
        <button className="secondary" onClick={exportDxf} disabled={!modelResult.model}>导出工程线稿 .DXF</button>
        <div className="status-card"><span>{importStatus}</span><small>导出前请核对齿轮、角度、中心距与切割顺序</small></div></>}
      </aside>

      <section className="viewer">
        <div className="viewport-header"><nav className="tool-rail" aria-label="工作工具"><button className={activeTool === 'select' ? 'active' : ''} onClick={() => setActiveTool('select')} title="选择刻面 (S)"><b>◇</b><span>选择</span><kbd>S</kbd></button><button className={activeTool === 'orbit' ? 'active' : ''} onClick={() => setActiveTool('orbit')} title="旋转视图 (O)"><b>↻</b><span>旋转</span><kbd>O</kbd></button><button className={activeTool === 'cut' ? 'active cut' : ''} disabled={!selectedModelFacet || meetLocked} onClick={toggleDirectCut} title="直接切割 (C)"><b>◩</b><span>切割</span><kbd>C</kbd></button></nav><div className="viewer-title"><span>{design.title || '未命名设计'} · {designFacetCount} 面</span><small>{activeTool === 'select' ? '单击刻面进行选择' : activeTool === 'orbit' ? '拖动旋转 · 滚轮缩放' : '沿黄色箭头拖动切割片'}</small>{rough.visible && !roughFit.fits && <b>原石穿出：{roughFit.outside} 个顶点在外</b>}{modelResult.error && <b>{modelResult.error}</b>}</div></div>
        <div className={`view-toolbar ${viewToolsOpen ? '' : 'collapsed'}`}><span className="toolbar-label">视图</span><div className="view-toolbar-actions"><button className="history-action" onClick={undo} disabled={!history.past.length}>撤销</button><button className="history-action" onClick={redo} disabled={!history.future.length}>重做</button><i/><button className={viewMode === 'perspective' ? 'active' : ''} onClick={() => setViewMode('perspective')}>透视</button><button className={viewMode === 'top' ? 'active' : ''} onClick={() => setViewMode('top')}>俯视</button><button className={viewMode === 'side' ? 'active' : ''} onClick={() => setViewMode('side')}>侧视</button><button className={viewMode === 'quad' ? 'active' : ''} onClick={() => setViewMode('quad')}>四视</button><button className={wireframe ? 'active' : ''} onClick={() => setWireframe(current => !current)}>线稿</button><button className={assistantOpen ? 'active' : ''} onClick={() => setAssistantOpen(current => !current)}>步骤</button><button className={previewOpen ? 'active' : ''} disabled={viewMode === 'quad'} onClick={() => setPreviewOpen(current => !current)}>效果窗</button></div><button className="toolbar-collapse" onClick={() => setViewToolsOpen(current => !current)} title={viewToolsOpen ? '收起视图工具' : '展开视图工具'}>{viewToolsOpen ? '收起' : '展开'}</button></div>
        {directCutMode && <div className={`direct-cut-hint ${cutDragging ? 'dragging' : ''}`}><b>{cutDragging ? '正在重算刻面交点' : '直接切割工具'}</b><span>{cutDragging ? '松开即可完成；按住 Shift 可精细移动' : '抓住蓝色切割片，沿黄色箭头拖动 · Shift 精调'}</span></div>}
        {viewMode === 'quad' ? <div className="quad-view"><ModelViewport label="俯视 / Crown" camera={{ position:[0,7.2,.01], up:[0,0,-1], fov:34 }} model={modelResult.model} roughProps={roughProps} modelProps={{ selectedTierId, selectedFacet, ior, gemColor, tierColors, facetColors, tierFinishes, facetFinishes, hiddenTiers: renderedHiddenTiers, wireframe, onSelect: selectFacet }}/><ModelViewport label="侧视 / Side" camera={{ position:[7.2,0,.01], up:[0,1,0], fov:34 }} model={modelResult.model} roughProps={roughProps} modelProps={{ selectedTierId, selectedFacet, ior, gemColor, tierColors, facetColors, tierFinishes, facetFinishes, hiddenTiers: renderedHiddenTiers, wireframe, onSelect: selectFacet }}/><ModelViewport label="端视 / End" camera={{ position:[.01,0,7.2], up:[0,1,0], fov:34 }} model={modelResult.model} roughProps={roughProps} modelProps={{ selectedTierId, selectedFacet, ior, gemColor, tierColors, facetColors, tierFinishes, facetFinishes, hiddenTiers: renderedHiddenTiers, wireframe, onSelect: selectFacet }}/><ModelViewport label="亭部 / Pavilion" camera={{ position:[0,-7.2,.01], up:[0,0,1], fov:34 }} model={modelResult.model} roughProps={roughProps} modelProps={{ selectedTierId, selectedFacet, ior, gemColor, tierColors, facetColors, tierFinishes, facetFinishes, hiddenTiers: renderedHiddenTiers, wireframe, onSelect: selectFacet }}/></div> : <ModelViewport key={viewMode} camera={viewCamera} model={modelResult.model} roughProps={roughProps} modelProps={{ selectedTierId, selectedFacet, ior, gemColor, tierColors, facetColors, tierFinishes, facetFinishes, hiddenTiers: renderedHiddenTiers, wireframe, onSelect: selectFacet }}/>} 
        {previewOpen && viewMode !== 'quad' ? <div className="effect-window"><div className="effect-title"><div><span>成品效果</span><small>面朝上 · {previewColors ? '分面配色' : '统一宝石色'}</small></div><button aria-label="隐藏效果预览" onClick={() => setPreviewOpen(false)}>隐藏</button></div>
          <div className="effect-canvas"><Canvas camera={{ position: [0, 11, .01], up: [0, 0, -1], fov: 42 }} frameloop="demand"><RenderSync revision={{ model: modelResult.model, selectedTierId, selectedFacet, ior, gemColor, tierColors, facetColors, tierFinishes, facetFinishes, previewColors }}/><ambientLight intensity={1.1}/><hemisphereLight args={['#e7f6ff','#13263b',1.5]}/><directionalLight position={[4,8,4]} intensity={4}/><directionalLight position={[-4,5,-3]} intensity={2}/>{modelResult.model && <GemModel model={modelResult.model} {...{selectedTierId, selectedFacet, ior, gemColor, tierColors, facetColors, tierFinishes, facetFinishes}} preview showAppearance={previewColors}/>}<OrbitControls enableDamping/></Canvas></div>
        </div> : null}
        {assistantOpen && <div className="cutting-assistant"><button onClick={() => goToCuttingStep(cuttingStep - 1)} disabled={cuttingStep === 0}>‹</button><div><span>切磨步骤 {cuttingStep + 1} / {design.tiers.length}</span><strong>{activeCuttingTier.name} · {activeCuttingTier.angle.toFixed(2)}°</strong><small>齿号 {activeCuttingTier.indexes.join(' · ')}</small></div><button onClick={() => goToCuttingStep(cuttingStep + 1)} disabled={cuttingStep === design.tiers.length - 1}>›</button><label><input type="checkbox" checked={hideFutureTiers} onChange={event => setHideFutureTiers(event.target.checked)}/> 隐藏后续层</label></div>}
        <div className="viewport-status"><span className={`tool-state ${activeTool}`}>{activeTool === 'select' ? '选择工具' : activeTool === 'orbit' ? '旋转工具' : '直接切割'}</span><span>{selectedTier.name} · 面 {selectedFacet + 1}</span><span>角度 {selectedAngle.toFixed(2)}°</span><span>切深 {selectedDepth.toFixed(2)}</span><em className={modelResult.error ? 'error' : ''}>{modelResult.error ? '几何错误' : '几何有效'}</em></div>
      </section>

      <aside className="panel result"><div className="inspector-tabs"><button className={inspectorTab === 'facet' ? 'active' : ''} onClick={() => setInspectorTab('facet')}>刻面</button><button className={inspectorTab === 'girdle' ? 'active' : ''} onClick={() => setInspectorTab('girdle')}>腰围</button><button className={inspectorTab === 'optics' ? 'active' : ''} onClick={() => setInspectorTab('optics')}>光学</button><button className={inspectorTab === 'measure' ? 'active' : ''} onClick={() => setInspectorTab('measure')}>比例</button><button className={inspectorTab === 'check' ? 'active' : ''} onClick={() => setInspectorTab('check')}>检查</button></div>
        {inspectorTab === 'facet' && <><div className="panel-heading"><h2>刻面与图层</h2><span>{selectedTier.name} · No.{selectedFacet + 1}</span></div>
        <div className={`design-mode ${design.symmetryFolds === 1 && !design.symmetryMirror ? 'free' : ''}`}><div><span>设计模式</span><strong>{design.symmetryFolds === 1 && !design.symmetryMirror ? '自由不对称' : `${design.symmetryFolds} 重对称${design.symmetryMirror ? ' · 镜像' : ''}`}</strong></div>{!(design.symmetryFolds === 1 && !design.symmetryMirror) && <button onClick={enableFreeDesign}>解除对称</button>}</div>
        <label>当前切割层</label><select value={selectedTier.id} onChange={e => { setSelectedTierId(e.target.value); setSelectedFacet(0) }}>{design.tiers.map((tier, index) => <option key={tier.id} value={tier.id}>{index + 1}. {tier.name} · {tier.indexes.length} 面</option>)}</select>
        <label className="visibility-toggle"><input type="checkbox" checked={!hiddenTiers[selectedTier.id]} onChange={e => setHiddenTiers(current => ({ ...current, [selectedTier.id]: !e.target.checked }))}/> 编辑视图显示本层</label>
        <label>本层显示颜色</label><div className="color-control"><input type="color" value={tierColors[selectedTier.id] || gemColor} onChange={e => setTierColor(e.target.value)}/><span>{(tierColors[selectedTier.id] || '跟随宝石色').toUpperCase()}</span><button onClick={clearTierColor}>清除</button></div>
        <label>本层表面效果</label><select value={tierFinishes[selectedTier.id] || 'polished'} onChange={event => setTierFinish(event.target.value)}><option value="polished">光面抛光</option><option value="frosted">磨砂 / 暗星强调</option></select>
        <label>当前刻面</label><select value={selectedFacet} onChange={e => setSelectedFacet(Number(e.target.value))}>{selectedTier.indexes.map((index, i) => <option value={i} key={`${index}-${i}`}>No.{i + 1} · 齿号 {index}</option>)}</select>
        <div className="facet-actions"><button onClick={addFacetToSelectedTier}>＋ 添加刻面</button><button className="danger" onClick={deleteSelectedFacet} disabled={selectedTier.indexes.length <= 1}>删除当前面</button></div>
        <label>当前刻面显示颜色</label><div className="color-control"><input type="color" value={facetColors[selectedTier.id]?.[selectedFacet] || tierColors[selectedTier.id] || gemColor} onChange={e => setFacetColor(e.target.value)}/><span>{(facetColors[selectedTier.id]?.[selectedFacet] || '跟随图层').toUpperCase()}</span><button onClick={clearFacetColor}>清除</button></div>
        <label>当前刻面表面效果</label><select value={facetFinishes[selectedTier.id]?.[selectedFacet] || 'inherit'} onChange={event => setFacetFinish(event.target.value)}><option value="inherit">跟随本层</option><option value="polished">单面光面抛光</option><option value="frosted">单面磨砂</option></select>
        {selectedTier.code === 'F' && <div className="status-card fireworks-card"><span>8 射线烟花强调层</span><small>本层 8 面在亭尖形成星芒。用“整层对称面”可一起拖动切深；表面可切换光面暗星或磨砂烟花效果。</small></div>}
        <div className="cut-workbench"><div className="cut-workbench-title"><div><strong>直接切割设置</strong><span>{cutScope === 'single' ? '只调整当前刻面' : `联动本层 ${selectedTier.indexes.length} 个对称面`}</span></div><button className={activeTool === 'cut' ? 'active' : ''} onClick={toggleDirectCut}>{activeTool === 'cut' ? '结束切割' : '开始切割'}</button></div>
          <label>切割范围</label><div className="cut-scope"><button className={cutScope === 'single' ? 'active' : ''} onClick={() => setCutScope('single')}>当前单面</button><button className={cutScope === 'tier' ? 'active' : ''} onClick={() => setCutScope('tier')}>整层对称面</button></div>
          <div className="compact-grid"><div><label>切割工具</label><select value={cutTool} onChange={event => setCutTool(event.target.value)}>{Object.entries(CUT_TOOLS).map(([key, tool]) => <option key={key} value={key}>{tool.name}</option>)}</select></div><div><label>移动方式</label><select value={cutDirection} onChange={event => setCutDirection(event.target.value)}><option value="in">向内进刀</option><option value="out">向外退刀</option><option value="free">双向调整</option></select></div></div>
          <div className="compact-grid"><div><label>切割角度</label><input type="number" min="-90" max="90" step="0.05" value={selectedAngle} onChange={event => applyCutAngle(Number(event.target.value))}/></div><div><label>当前方向（齿位）</label><input type="number" min="0" max={design.gear} step="1" value={selectedTier.indexes[selectedFacet]} onChange={event => updateSelectedIndex(event.target.value)}/></div></div>
          <div className="cut-direction-buttons"><button onClick={() => rotateCutDirection(-1)}>↶ 逆时针 1 齿</button><button onClick={() => rotateCutDirection(1)}>顺时针 1 齿 ↷</button></div>
        </div>
        <details className="precision-editor"><summary><span>精确参数</span><small>{selectedAngle.toFixed(2)}° · 齿号 {selectedTier.indexes[selectedFacet]} · 切深 {selectedDepth.toFixed(2)}</small></summary>
          <div className="compact-grid"><div><label>单面角度</label><input type="number" min="-90" max="90" step="0.05" value={selectedAngle} onChange={e => updateSelectedAngle(Number(e.target.value))}/></div><div><label>齿号</label><input type="number" min="0" max={design.gear} step="1" value={selectedTier.indexes[selectedFacet]} onChange={e => updateSelectedIndex(e.target.value)}/></div></div>
          <div className={`meetpoint-editor ${meetLocked ? 'locked' : ''}`}><div><strong>{meetLocked ? '相接点已锁定' : '相接点约束'}</strong><span>{meetLocked ? `顶点 ${meetLock.vertex + 1} · 改角度或齿号时自动修正切深` : '选择当前刻面的一个顶点作为固定相接点'}</span></div>{selectedModelFacet?.points?.length ? <><select value={Math.min(meetVertex, selectedModelFacet.points.length - 1)} onChange={event => setMeetVertex(Number(event.target.value))}>{selectedModelFacet.points.map((point, index) => <option key={index} value={index}>顶点 {index + 1}</option>)}</select><button onClick={meetLocked ? unlockMeetPoint : lockMeetPoint}>{meetLocked ? '解除' : '锁定'}</button></> : <small>当前刻面不可见</small>}</div>
          <label>单刻面切深：{selectedDepth.toFixed(2)}{meetLocked ? '（由相接点自动计算）' : ''}</label><input type="range" min="-10" max="10" step="0.1" value={selectedDepth} disabled={meetLocked} onChange={e => updateSelectedFacet({ distanceDelta: -Number(e.target.value) * .004 })}/>
          <button className="secondary" disabled={meetLocked} onClick={resetSelectedFacet}>恢复当前刻面</button>
        </details>
        <details className="advanced-editor"><summary>高级图层参数</summary><div className="tier-actions"><button onClick={() => moveTier(-1)} disabled={design.tiers[0].id === selectedTier.id}>上移</button><button onClick={() => moveTier(1)} disabled={design.tiers.at(-1).id === selectedTier.id}>下移</button><button onClick={duplicateTier}>复制层</button><button className="danger" onClick={deleteTier} disabled={design.tiers.length <= 1}>删除层</button></div>
          <label>切割层名称</label><input type="text" value={selectedTier.name} onChange={e => updateTier({ name: e.target.value })}/>
          <div className="compact-grid"><div><label>整层角度</label><input type="number" min="-90" max="90" step="0.05" value={selectedTier.angle} onChange={e => updateTier({ angle: Math.max(-90, Math.min(90, Number(e.target.value))) })}/></div><div><label>中心距</label><input type="number" step="0.0001" value={selectedTier.distance} onChange={e => updateTier({ distance: Number(e.target.value) })}/></div></div>
          <label>本层全部齿号</label><input type="text" value={indexDraft} onChange={e => setIndexDraft(e.target.value)} onBlur={commitIndexList} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}/>
          <label>切割说明</label><input type="text" placeholder="例如：切至与上一层相接" value={selectedTier.instructions || ''} onChange={e => updateTier({ instructions: e.target.value })}/>
          <div className="compact-grid"><div><label>ASC 对称重数</label><input type="number" min="1" max="96" step="1" value={design.symmetryFolds || 1} onChange={e => { checkpoint(); setDesign(current => ({ ...current, symmetryFolds: Math.max(1, Math.round(Number(e.target.value))) })) }}/></div><label className="visibility-toggle mirror-toggle"><input type="checkbox" checked={Boolean(design.symmetryMirror)} onChange={e => { checkpoint(); setDesign(current => ({ ...current, symmetryMirror: e.target.checked })) }}/> 镜像元数据</label></div>
        </details>
        <p className="legend">黄色为当前刻面，浅蓝为相邻刻面。几何修改会实时重新计算共享交点。</p>
        <details className="cut-chart"><summary>完整切割步骤表（{design.tiers.length} 层）</summary>{design.tiers.map((tier, index) => <button key={tier.id} className={tier.id === selectedTier.id ? 'tier-row active' : 'tier-row'} onClick={() => { setSelectedTierId(tier.id); setSelectedFacet(0) }}><span>{index + 1}. {tier.name}</span><b>{tier.angle.toFixed(2)}°</b><small>{tier.indexes.join(' · ')}</small>{tier.instructions && <em>{tier.instructions}</em>}</button>)}</details></>}

        {inspectorTab === 'girdle' && <><div className="panel-heading"><h2>腰围与上下腰线</h2><span>{girdleThicknessMm.toFixed(2)} mm · {girdleThicknessRatio.toFixed(1)}%</span></div>
        {girdleTiers.girdle && girdleTiers.upper && girdleTiers.lower ? <>
          <div className={`girdle-health ${girdleThicknessRatio < 1.5 || girdleThicknessRatio > 6 ? 'warning' : 'ok'}`}><span>当前腰厚</span><strong>{girdleThicknessMm.toFixed(2)} mm</strong><small>成品宽度占比 {girdleThicknessRatio.toFixed(2)}%{girdleThicknessRatio < 1.5 ? ' · 偏薄，崩腰风险较高' : girdleThicknessRatio > 6 ? ' · 偏厚，可能影响亮度与重量分配' : ' · 位于常用检查范围'}</small></div>
          <label>目标腰厚：{girdleThicknessMm.toFixed(2)} mm</label><input type="range" min={Math.max(.05, finishedWidth * .005)} max={Math.max(.3, finishedWidth * .1)} step=".01" value={girdleThicknessMm} onChange={event => applyGirdleThickness(event.target.value)}/>
          <div className="girdle-presets"><button onClick={() => applyGirdleThickness(finishedWidth * .02)}>薄 2%</button><button onClick={() => applyGirdleThickness(finishedWidth * .035)}>中 3.5%</button><button onClick={() => applyGirdleThickness(finishedWidth * .05)}>厚 5%</button></div>
          <div className="compact-grid"><div><label>腰围侧面数</label><select value={girdleTiers.girdle.indexes.length} onChange={event => updateGirdleFacetCount(event.target.value)}>{girdleFacetCounts.map(count => <option key={count} value={count}>{count} 面</option>)}</select></div><div><label>腰围层显示</label><button className={`layer-visibility ${hiddenTiers[girdleTiers.girdle.id] ? '' : 'active'}`} onClick={() => setHiddenTiers(current => ({ ...current, [girdleTiers.girdle.id]: !current[girdleTiers.girdle.id] }))}>{hiddenTiers[girdleTiers.girdle.id] ? '已隐藏' : '显示中'}</button></div></div>
          <div className="compact-grid"><div><label>上腰面角度</label><input type="number" min="0.1" max="89.9" step=".05" value={Math.abs(girdleTiers.upper.angle)} onChange={event => updateGirdleJunction(girdleTiers.upper, Math.abs(Number(event.target.value)))}/></div><div><label>下腰面角度</label><input type="number" min="0.1" max="89.9" step=".05" value={Math.abs(girdleTiers.lower.angle)} onChange={event => updateGirdleJunction(girdleTiers.lower, -Math.abs(Number(event.target.value)))}/></div></div>
          <div className="girdle-layers"><button onClick={() => { setSelectedTierId(girdleTiers.upper.id); setSelectedFacet(0) }}>选择上腰层 · {girdleTiers.upper.indexes.length} 面</button><button onClick={() => { setSelectedTierId(girdleTiers.girdle.id); setSelectedFacet(0) }}>选择腰围层 · {girdleTiers.girdle.indexes.length} 面</button><button onClick={() => { setSelectedTierId(girdleTiers.lower.id); setSelectedFacet(0) }}>选择下腰层 · {girdleTiers.lower.indexes.length} 面</button></div>
          <label className="visibility-toggle"><input type="checkbox" checked={cutFeedbackEnabled} onChange={event => setCutFeedbackEnabled(event.target.checked)}/> 参数变化时显示切削动画</label>
          <p className="legend">蓝色平面是当前刀面；半透明废料片沿切除方向移出。成品轮廓由全部刻面半空间实时求交，并非只做表面变形。</p>
        </> : <div className="status-card"><span>当前设计缺少独立腰围、上腰或下腰层</span><small>可在“刻面 → 高级图层参数”中建立对应层后再集中调整。</small></div>}</>}

        {inspectorTab === 'optics' && <><div className="panel-heading"><h2>光学检查</h2><span>{MATERIALS[material].name} · IOR {ior.toFixed(3)}</span></div>
        <Result label="材料" value={MATERIALS[material].name}/><Result label="折射率" value={ior.toFixed(3)}/><Result label="临界角" value={`${critical.toFixed(2)}°`}/><Result label="参考亭角" value={`${pavilionAngle.toFixed(2)}°`}/><Result label="安全余量" value={`${leakage.margin >= 0 ? '+' : ''}${leakage.margin.toFixed(2)}°`}/>
        <div className={`risk ${leakage.level}`}><span>亭部漏光风险</span><strong>{leakage.label}</strong><p>{leakage.detail}</p></div>
        <button className="secondary primary-action" disabled={optimizing || !modelResult.model} onClick={runPavilionOptimization}>{optimizing ? '正在搜索优化方案…' : '分析并推荐亭角'}</button>
        {optimization && <div className="optimizer-card"><div><span>推荐整体调整</span><strong>{optimization.best.delta >= 0 ? '+' : ''}{optimization.best.delta.toFixed(2)}°</strong></div><div className="optimizer-metrics"><span>返回光<br/><b>{optimization.baseline.trace.returnPercent.toFixed(1)}% → {optimization.best.trace.returnPercent.toFixed(1)}%</b></span><span>漏光<br/><b>{optimization.baseline.trace.leakagePercent.toFixed(1)}% → {optimization.best.trace.leakagePercent.toFixed(1)}%</b></span></div><small>已比较 {optimization.tested} 个方案；角度变化时同步修正中心距以近似保持腰围交线。</small><button className="secondary" disabled={Math.abs(optimization.best.delta) < .001} onClick={applyPavilionOptimization}>{Math.abs(optimization.best.delta) < .001 ? '当前已是搜索范围内最佳' : '应用推荐方案'}</button></div>}
        {raytrace && <><h2 className="section-title">面朝上光线追踪</h2><RayMap result={raytrace}/><Result label="有效入射光线" value={String(raytrace.entered)}/><Result label="返回光" value={`${raytrace.returnPercent.toFixed(1)}%`}/><Result label="漏光" value={`${raytrace.leakagePercent.toFixed(1)}%`}/><Result label="多次反射未收敛" value={`${raytrace.trappedPercent.toFixed(1)}%`}/><Result label="平均内部反射" value={`${raytrace.averageReflections.toFixed(2)} 次`}/></>}
        <p className="disclaimer">光线追踪按垂直面朝上入射、理想抛光界面计算；尚未计入色散、吸收、观察者头影和实际抛光损耗。</p></>}

        {inspectorTab === 'measure' && <><div className="panel-heading"><h2>尺寸与比例</h2><span>成品宽度 {finishedWidth.toFixed(1)} mm</span></div>{measures && <>
          <Result label="长宽比 L/W" value={measures.lengthToWidth.toFixed(3)}/><Result label="总深比 H/W" value={`${(measures.depthToWidth * 100).toFixed(1)}%`}/><Result label="冠高比 C/W" value={`${(measures.crownToWidth * 100).toFixed(1)}%`}/><Result label="亭深比 P/W" value={`${(measures.pavilionToWidth * 100).toFixed(1)}%`}/><Result label="腰厚比 G/W" value={`${(measures.girdleToWidth * 100).toFixed(1)}%`}/><Result label="体积比 V/W³" value={measures.volumeToWidthCubed.toFixed(3)}/><Result label="预计重量" value={`${estimatedCarats.toFixed(2)} ct`}/>
        </>}<p className="disclaimer">重量根据模型体积、成品宽度和材料密度估算；正式下机前请核对毛坯余量。</p></>}

        {inspectorTab === 'check' && <><div className="panel-heading"><h2>生产前检查</h2><span>{productionReport ? `${productionReport.errors} 错误 · ${productionReport.warnings} 提醒` : '等待模型'}</span></div>
        {productionReport?.checks.map(check => <div className={`production-check ${check.level}`} key={check.id}><i>{check.level === 'ok' ? '✓' : check.level === 'error' ? '!' : '△'}</i><div><strong>{check.label}</strong><p>{check.detail}</p></div></div>)}
        <div className="summary-card"><span>当前成品尺寸</span><strong>{finishedLength.toFixed(2)} × {finishedWidth.toFixed(2)} × {finishedDepth.toFixed(2)} mm</strong><small>{rough.visible ? `原石检测：${roughFit.fits ? '完全包容' : '存在穿出'}` : '尚未开启原石包容检测'}</small></div>
        <p className="disclaimer">本检查用于提前发现几何风险；实际生产仍需结合材料解理、设备精度、抛光余量与实物缺陷复核。</p></>}
      </aside>
    </main>
  </div>
}

function Result({ label, value }) { return <div className="result-card"><span>{label}</span><strong>{value}</strong></div> }
export default App
