const MAX_TRIANGLES = 512
const TRIANGLE_TEXELS = 5
const LEGACY_MAX_PLANES = 128

const VERTEX_SHADER = `#version 300 es
in vec2 position;
out vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 uv;
out vec4 outColor;
uniform vec2 resolution;
uniform vec3 cameraPosition,cameraForward,cameraRight,cameraUp,opticAxis,modelCenter,modelExtent,zoneColorA,zoneColorB;
uniform sampler2D triangleData;
uniform int triangleCount,maxBounces,environmentPreset,spectralSamples,zoneMode;
uniform float ior,dispersion,birefringence,absorption,exposure,appearanceStrength,environmentRotation,environmentIntensity,zoneBoundary,zoneRotation;
uniform vec3 bodyColor;
const float EPS=.0015;
const int MAX_TRIANGLES=${MAX_TRIANGLES};

vec4 triangleTexel(int triangle,int column){return texelFetch(triangleData,ivec2(column,triangle),0);}

vec3 environmentLight(vec3 rawDirection){
  float cosine=cos(environmentRotation),sine=sin(environmentRotation);
  vec3 d=normalize(vec3(cosine*rawDirection.x+sine*rawDirection.z,rawDirection.y,-sine*rawDirection.x+cosine*rawDirection.z));
  float horizon=smoothstep(-.7,.9,d.y);
  vec3 low=vec3(.025,.035,.055),high=vec3(.82,.88,.94),warmColor=vec3(2.7,1.5,.55);
  if(environmentPreset==1){low=vec3(.055,.075,.11);high=vec3(.94,.98,1.);warmColor=vec3(1.3,1.9,2.8);}
  else if(environmentPreset==2){low=vec3(.055,.025,.018);high=vec3(1.,.72,.42);warmColor=vec3(4.2,1.5,.38);}
  else if(environmentPreset==3){low=vec3(.004,.006,.012);high=vec3(.62,.68,.8);warmColor=vec3(2.2,.85,.25);}
  vec3 base=mix(low,high,horizon);
  float left=pow(max(0.,dot(d,normalize(vec3(-.72,.48,.5)))),48.);
  float right=pow(max(0.,dot(d,normalize(vec3(.78,.32,.54)))),68.);
  float top=pow(max(0.,dot(d,normalize(vec3(.05,.98,.14)))),110.);
  float warm=pow(max(0.,dot(d,normalize(vec3(-.18,.18,.97)))),90.);
  float dark=pow(max(0.,dot(d,normalize(vec3(.15,.25,-.96)))),5.);
  return max(vec3(.003),base+left*vec3(5.4,5.8,6.4)+right*vec3(6.8,6.1,5.6)+top*vec3(3.5,3.9,4.6)+warm*warmColor-dark*.72)*environmentIntensity;
}

bool intersectTriangle(vec3 origin,vec3 direction,vec3 a,vec3 b,vec3 c,out float distance){
  vec3 edge1=b-a,edge2=c-a;
  vec3 p=cross(direction,edge2);
  float determinant=dot(edge1,p);
  if(abs(determinant)<1e-7)return false;
  float inverse=1./determinant;
  vec3 offset=origin-a;
  float u=dot(offset,p)*inverse;
  if(u<0.||u>1.)return false;
  vec3 q=cross(offset,edge1);
  float v=dot(direction,q)*inverse;
  if(v<0.||u+v>1.)return false;
  distance=dot(edge2,q)*inverse;
  return distance>EPS;
}

bool nearestHit(vec3 origin,vec3 direction,out float hitT,out vec3 hitNormal,out vec3 hitColor,out float hitRoughness){
  hitT=1e20;hitNormal=vec3(0.,1.,0.);hitColor=vec3(1.);hitRoughness=0.;bool found=false;
  for(int triangle=0;triangle<MAX_TRIANGLES;triangle++){
    if(triangle>=triangleCount)break;
    vec3 a=triangleTexel(triangle,0).xyz,b=triangleTexel(triangle,1).xyz,c=triangleTexel(triangle,2).xyz;
    float distance;
    if(intersectTriangle(origin,direction,a,b,c,distance)&&distance<hitT){
      vec4 normalAndRoughness=triangleTexel(triangle,3);
      hitT=distance;hitNormal=normalize(normalAndRoughness.xyz);hitRoughness=normalAndRoughness.w;
      hitColor=triangleTexel(triangle,4).rgb;found=true;
    }
  }
  return found;
}

float hash(float value){return fract(sin(value*91.3458+17.17)*47453.5453);}
vec3 roughNormal(vec3 normal,float roughness,float seed){
  if(roughness<.02)return normal;
  vec3 noise=vec3(hash(seed),hash(seed+11.7),hash(seed+29.3))*2.-1.;
  vec3 candidate=normalize(normal+noise*roughness*roughness*.45);
  return dot(candidate,normal)<0.?-candidate:candidate;
}

float extraordinaryIor(float ordinaryIor,vec3 direction){
  float extraordinary=max(1.001,ordinaryIor+birefringence);
  float cosine=clamp(abs(dot(normalize(direction),normalize(opticAxis))),0.,1.);
  float cosine2=cosine*cosine,sine2=1.-cosine2;
  return ordinaryIor*extraordinary/sqrt(max(1e-6,extraordinary*extraordinary*cosine2+ordinaryIor*ordinaryIor*sine2));
}

float fresnel(float cosineIncident,float n1,float n2){
  float ci=clamp(abs(cosineIncident),0.,1.);float ratio=n1/n2;
  float st2=ratio*ratio*max(0.,1.-ci*ci);if(st2>=1.)return 1.;
  float ct=sqrt(max(0.,1.-st2));
  float parallel=((n2*ci)-(n1*ct))/max(1e-6,(n2*ci)+(n1*ct));
  float perpendicular=((n1*ci)-(n2*ct))/max(1e-6,(n1*ci)+(n2*ct));
  return .5*(parallel*parallel+perpendicular*perpendicular);
}

vec3 zonedBodyColor(vec3 position){
  if(zoneMode==0)return bodyColor;
  vec3 local=(position-modelCenter)/max(modelExtent,vec3(.0001));
  float cosine=cos(zoneRotation),sine=sin(zoneRotation);
  vec2 rotated=vec2(cosine*local.x+sine*local.z,-sine*local.x+cosine*local.z);
  if(zoneMode==1){
    float radial=length(rotated);
    float transition=smoothstep(zoneBoundary-.055,zoneBoundary+.055,radial);
    vec3 color=mix(zoneColorA,zoneColorB,transition);
    float paleBand=1.-smoothstep(.025,.12,abs(radial-zoneBoundary));
    return mix(color,vec3(.94,.98,.94),paleBand*.62);
  }
  float divider=zoneBoundary*1.6-.8;
  if(zoneMode==2)return mix(zoneColorA,zoneColorB,smoothstep(divider-.055,divider+.055,rotated.x));
  return mix(zoneColorA,zoneColorB,smoothstep(divider-.5,divider+.5,rotated.x));
}

vec3 absorptionAt(vec3 position){
  return vec3(absorption)-log(max(zonedBodyColor(position),vec3(.02)))*.9;
}

vec3 traceGem(vec3 origin,vec3 direction,float baseIor,float extraordinaryRay,float channelSeed){
  float entryT,entryRoughness;vec3 entryNormal,entryColor;
  if(!nearestHit(origin,direction,entryT,entryNormal,entryColor,entryRoughness))return vec3(-1.);
  if(dot(direction,entryNormal)>0.)entryNormal=-entryNormal;
  entryNormal=roughNormal(entryNormal,entryRoughness,gl_FragCoord.x+gl_FragCoord.y*1.91+channelSeed);
  vec3 entry=origin+direction*entryT;
  float materialIor=mix(baseIor,extraordinaryIor(baseIor,direction),extraordinaryRay);
  float entryFresnel=fresnel(dot(-direction,entryNormal),1.,materialIor);
  vec3 entryTint=mix(vec3(1.),entryColor,appearanceStrength*.6);
  vec3 radiance=environmentLight(reflect(direction,entryNormal))*entryFresnel*entryTint;
  vec3 insideDirection=refract(direction,entryNormal,1./materialIor);
  if(dot(insideDirection,insideDirection)<1e-7)return radiance;
  vec3 throughput=vec3(1.-entryFresnel);vec3 insideOrigin=entry+insideDirection*EPS;
  for(int bounce=0;bounce<8;bounce++){
    if(bounce>=maxBounces)break;
    float boundaryT,boundaryRoughness;vec3 boundaryNormal,boundaryColor;
    if(!nearestHit(insideOrigin,insideDirection,boundaryT,boundaryNormal,boundaryColor,boundaryRoughness))break;
    vec3 boundary=insideOrigin+insideDirection*boundaryT;
    throughput*=exp(-absorptionAt((insideOrigin+boundary)*.5)*boundaryT);
    if(dot(insideDirection,boundaryNormal)<0.)boundaryNormal=-boundaryNormal;
    boundaryNormal=roughNormal(boundaryNormal,boundaryRoughness,gl_FragCoord.x*1.37+gl_FragCoord.y+float(bounce)*37.1+channelSeed);
    float localIor=mix(baseIor,extraordinaryIor(baseIor,insideDirection),extraordinaryRay);
    float reflected=fresnel(dot(insideDirection,boundaryNormal),localIor,1.);
    vec3 exitDirection=refract(insideDirection,-boundaryNormal,localIor);
    vec3 surfaceTint=mix(vec3(1.),boundaryColor,appearanceStrength*.6);
    if(dot(exitDirection,exitDirection)>1e-7)radiance+=throughput*(1.-reflected)*environmentLight(exitDirection)*surfaceTint;
    throughput*=reflected;
    if(max(throughput.r,max(throughput.g,throughput.b))<.002)break;
    insideDirection=reflect(insideDirection,boundaryNormal);insideOrigin=boundary+insideDirection*EPS;
  }
  return radiance;
}

vec3 tracePolarized(vec3 origin,vec3 direction,float materialIor,float channelSeed){
  if(birefringence<.0001)return traceGem(origin,direction,materialIor,0.,channelSeed);
  if(spectralSamples<5)return traceGem(origin,direction,materialIor,.35,channelSeed+31.);
  vec3 ordinary=traceGem(origin,direction,materialIor,0.,channelSeed);
  vec3 extraordinary=traceGem(origin,direction,materialIor,1.,channelSeed+61.);
  return mix(ordinary,extraordinary,.5);
}

void main(){
  vec2 screen=(gl_FragCoord.xy/resolution-.5)*2.;screen.x*=resolution.x/max(1.,resolution.y);
  vec3 direction=normalize(cameraForward+cameraRight*screen.x*.16+cameraUp*screen.y*.16);
  float redIor=max(1.001,ior-dispersion*.48),blueIor=ior+dispersion*.52;
  vec3 red=tracePolarized(cameraPosition,direction,redIor,3.1);
  if(red.r<0.){vec3 bg=environmentLight(direction)*.16;outColor=vec4(pow(bg,vec3(1./2.2)),1.);return;}
  vec3 green=tracePolarized(cameraPosition,direction,ior,17.9),blue=tracePolarized(cameraPosition,direction,blueIor,41.3);
  vec3 color;
  if(spectralSamples>=5){
    vec3 amber=tracePolarized(cameraPosition,direction,max(1.001,ior-dispersion*.24),9.7);
    vec3 cyan=tracePolarized(cameraPosition,direction,ior+dispersion*.26,29.5);
    color=(red*vec3(1.,0.,0.)+amber*vec3(1.,.45,0.)+green*vec3(.15,1.,.04)+cyan*vec3(0.,.42,1.)+blue*vec3(.26,0.,1.))/vec3(2.41,1.87,2.04);
  }else color=vec3(red.r,green.g,blue.b);
  color*=exp2(exposure);
  color=clamp((color*(2.51*color+.03))/(color*(2.43*color+.59)+.14),0.,1.);
  outColor=vec4(pow(color,vec3(1./2.2)),1.);
}`

const normalize = vector => {
  const length = Math.hypot(...vector) || 1
  return vector.map(value => value / length)
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const subtract = (a, b) => a.map((value, index) => value - b[index])
const rgb = hex => {
  const value = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '#ffffff'
  return [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16) / 255)
}

function facetAppearance(facet, options) {
  const tierId = facet.tier?.id
  const facetIndex = facet.facetIndex
  const finish = options.facetFinishes?.[tierId]?.[facetIndex] || options.tierFinishes?.[tierId] || 'polished'
  const annotation = options.facetColors?.[tierId]?.[facetIndex] || options.tierColors?.[tierId]
  const color = options.showAppearance ? annotation || options.gemColor : '#ffffff'
  return { color: rgb(color), roughness: finish === 'frosted' ? .72 : .025 }
}

// Kept for ASC/geometry diagnostics that still inspect the original convex
// half-space representation. Rendering itself now uses triangle data below.
export function packOpticalPlanes(model, limit = LEGACY_MAX_PLANES) {
  if (!model?.facets?.length) throw new Error('没有可追踪的宝石刻面')
  if (model.facets.length > limit) throw new Error(`当前光学预览最多支持 ${limit} 个有效平面`)
  const packed = new Float32Array(limit * 4)
  model.facets.forEach((facet, index) => packed.set([...normalize(facet.n), facet.d], index * 4))
  return { packed, count: model.facets.length }
}

export function packOpticalTriangles(model, options = {}, limit = MAX_TRIANGLES) {
  if (!model?.facets?.length) throw new Error('没有可追踪的宝石刻面')
  const triangles = []
  model.facets.forEach(facet => {
    if (!facet.points?.length || facet.points.length < 3) return
    const appearance = facetAppearance(facet, options)
    for (let index = 1; index < facet.points.length - 1; index += 1) {
      const a = facet.points[0], b = facet.points[index], c = facet.points[index + 1]
      const normal = normalize(facet.n?.length === 3 ? facet.n : cross(subtract(b, a), subtract(c, a)))
      triangles.push({ a, b, c, normal, ...appearance })
    }
  })
  if (!triangles.length) throw new Error('没有可追踪的宝石三角面')
  if (triangles.length > limit) throw new Error(`当前 GPU 光学预览最多支持 ${limit} 个三角面`)
  const packed = new Float32Array(TRIANGLE_TEXELS * 4 * triangles.length)
  triangles.forEach((triangle, index) => {
    const offset = index * TRIANGLE_TEXELS * 4
    packed.set([...triangle.a, 0], offset)
    packed.set([...triangle.b, 0], offset + 4)
    packed.set([...triangle.c, 0], offset + 8)
    packed.set([...triangle.normal, triangle.roughness], offset + 12)
    packed.set([...triangle.color, 0], offset + 16)
  })
  return { packed, count: triangles.length, width: TRIANGLE_TEXELS, height: triangles.length }
}

function shader(gl, type, source) {
  const result = gl.createShader(type)
  gl.shaderSource(result, source); gl.compileShader(result)
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result))
  return result
}

function program(gl) {
  const result = gl.createProgram()
  const vertex = shader(gl, gl.VERTEX_SHADER, VERTEX_SHADER), fragment = shader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  gl.attachShader(result, vertex); gl.attachShader(result, fragment); gl.bindAttribLocation(result, 0, 'position'); gl.linkProgram(result)
  gl.deleteShader(vertex); gl.deleteShader(fragment)
  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result))
  return result
}

export function createGpuOpticsRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' })
  if (!gl) throw new Error('此设备不支持 WebGL2 光学预览')
  const pipeline = program(gl)
  const buffer = gl.createBuffer()
  const triangleTexture = gl.createTexture()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW)
  gl.useProgram(pipeline); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, triangleTexture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  const location = name => gl.getUniformLocation(pipeline, name)
  const uniforms = Object.fromEntries(['resolution','cameraPosition','cameraForward','cameraRight','cameraUp','opticAxis','modelCenter','modelExtent','zoneColorA','zoneColorB','triangleData','triangleCount','maxBounces','ior','dispersion','birefringence','spectralSamples','zoneMode','absorption','exposure','appearanceStrength','environmentRotation','environmentIntensity','environmentPreset','zoneBoundary','zoneRotation','bodyColor'].map(name => [name, location(name)]))
  let last
  const resize = () => {
    const ratio = Math.min(2, window.devicePixelRatio || 1), width = Math.max(1, Math.round(canvas.clientWidth * ratio)), height = Math.max(1, Math.round(canvas.clientHeight * ratio))
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
  }
  const observer = new ResizeObserver(() => { resize(); if (last) draw(last) }); observer.observe(canvas)
  function draw(options) {
    last = options; resize()
    const { packed, count, width, height } = packOpticalTriangles(options.model, options)
    const camera = options.cameraOrbit || {}, yaw = Number.isFinite(camera.yaw) ? camera.yaw : .68, pitch = Number.isFinite(camera.pitch) ? camera.pitch : .62, distance = Number.isFinite(camera.distance) ? camera.distance : 8.6
    const cameraPosition = [Math.sin(yaw) * Math.cos(pitch) * distance, Math.sin(pitch) * distance, Math.cos(yaw) * Math.cos(pitch) * distance], forward = normalize(cameraPosition.map(value => -value))
    const right = normalize(cross(forward, [0, 1, 0])), up = normalize(cross(right, forward))
    gl.viewport(0, 0, canvas.width, canvas.height); gl.useProgram(pipeline)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, triangleTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, packed)
    gl.uniform1i(uniforms.triangleData, 0); gl.uniform1i(uniforms.triangleCount, count)
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height)
    gl.uniform3fv(uniforms.cameraPosition, cameraPosition); gl.uniform3fv(uniforms.cameraForward, forward); gl.uniform3fv(uniforms.cameraRight, right); gl.uniform3fv(uniforms.cameraUp, up)
    const azimuth = (Number(options.opticAxisAzimuth) || 0) * Math.PI / 180, tilt = Math.max(0, Math.min(90, Number(options.opticAxisTilt) || 0)) * Math.PI / 180
    gl.uniform3fv(uniforms.opticAxis, [Math.sin(tilt) * Math.cos(azimuth), Math.cos(tilt), Math.sin(tilt) * Math.sin(azimuth)])
    const points = options.model.facets.flatMap(facet => facet.points)
    const minimum = [0, 1, 2].map(axis => Math.min(...points.map(point => point[axis]))), maximum = [0, 1, 2].map(axis => Math.max(...points.map(point => point[axis])))
    gl.uniform3fv(uniforms.modelCenter, minimum.map((value, axis) => (value + maximum[axis]) / 2))
    gl.uniform3fv(uniforms.modelExtent, minimum.map((value, axis) => Math.max(.0001, (maximum[axis] - value) / 2)))
    gl.uniform1i(uniforms.maxBounces, Math.max(1, Math.min(8, options.bounces || 6)))
    gl.uniform1f(uniforms.ior, options.ior); gl.uniform1f(uniforms.dispersion, options.dispersion); gl.uniform1f(uniforms.birefringence, Math.max(0, Math.min(.2, Number(options.birefringence) || 0))); gl.uniform1i(uniforms.spectralSamples, options.spectralSamples >= 5 ? 5 : 3); gl.uniform1f(uniforms.absorption, Math.max(0, options.bodyColorStrength - .1) * .18); gl.uniform1f(uniforms.exposure, .2)
    gl.uniform1f(uniforms.appearanceStrength, options.showAppearance ? 1 : 0)
    gl.uniform1f(uniforms.environmentRotation, (Number(options.environmentRotation) || 0) * Math.PI / 180)
    gl.uniform1f(uniforms.environmentIntensity, Math.max(.2, Math.min(2.5, Number(options.environmentIntensity) || 1)))
    gl.uniform1i(uniforms.environmentPreset, Math.max(0, Math.min(3, Number(options.environmentPreset) || 0)))
    const zoneModes = { uniform: 0, watermelon: 1, bicolor: 2, gradient: 3 }
    gl.uniform1i(uniforms.zoneMode, zoneModes[options.colorZoneMode] || 0)
    gl.uniform3fv(uniforms.zoneColorA, rgb(options.zoneColorA || options.gemColor)); gl.uniform3fv(uniforms.zoneColorB, rgb(options.zoneColorB || options.gemColor))
    gl.uniform1f(uniforms.zoneBoundary, Math.max(.15, Math.min(.85, Number(options.zoneBoundary) || .58)))
    gl.uniform1f(uniforms.zoneRotation, (Number(options.zoneRotation) || 0) * Math.PI / 180)
    gl.uniform3fv(uniforms.bodyColor, rgb(options.gemColor)); gl.drawArrays(gl.TRIANGLES, 0, 3)
    canvas.dataset.renderer = 'webgl2-triangle-raytrace'
  }
  return { draw, destroy() { observer.disconnect(); gl.deleteTexture(triangleTexture); gl.deleteBuffer(buffer); gl.deleteProgram(pipeline); last = null } }
}
