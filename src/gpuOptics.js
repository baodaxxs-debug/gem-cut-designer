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
uniform vec3 cameraPosition,cameraForward,cameraRight,cameraUp,opticAxis,modelCenter,modelExtent,zoneColorA,zoneColorB,backgroundColor,absorptionShort;
uniform vec2 absorptionLong;
uniform sampler2D triangleData,accumulationTexture;
uniform int triangleCount,maxBounces,environmentPreset,spectralSamples,zoneMode,linearAccumulation;
uniform float ior,dispersion,birefringence,absorption,exposure,appearanceStrength,environmentRotation,environmentIntensity,zoneBoundary,zoneRotation,sampleIndex;
uniform vec2 pixelJitter;
uniform vec3 bodyColor;
const float EPS=.0015;
const int MAX_TRIANGLES=${MAX_TRIANGLES};

vec4 triangleTexel(int triangle,int column){return texelFetch(triangleData,ivec2(column,triangle),0);}

vec3 environmentLight(vec3 rawDirection){
  float cosine=cos(environmentRotation),sine=sin(environmentRotation);
  vec3 d=normalize(vec3(cosine*rawDirection.x+sine*rawDirection.z,rawDirection.y,-sine*rawDirection.x+cosine*rawDirection.z));
  float horizon=smoothstep(-.7,.9,d.y);
  vec3 low=vec3(.025),high=vec3(.84),warmColor=vec3(2.4);
  if(environmentPreset==1){low=vec3(.18);high=vec3(.98,1.,1.);warmColor=vec3(2.5,2.55,2.6);}
  else if(environmentPreset==2){low=vec3(.32);high=vec3(1.);warmColor=vec3(3.2);}
  else if(environmentPreset==3){low=vec3(.003);high=vec3(.22);warmColor=vec3(1.7);}
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

float cauchyIor(float dLineIor,float fMinusCDispersion,float wavelengthNm){
  const float fLine=486.13,dLine=589.29,cLine=656.27;
  float inverseF=1./(fLine*fLine),inverseC=1./(cLine*cLine);
  float coefficientB=max(0.,fMinusCDispersion)/max(1e-9,inverseF-inverseC);
  float coefficientA=dLineIor-coefficientB/(dLine*dLine);
  return max(1.001,coefficientA+coefficientB/(wavelengthNm*wavelengthNm));
}

// Five-sample real-time approximation of CIE 1931 2 degree XYZ under D65.
// Values are sampled from the official CIE 1 nm data sets and normalized to Y=1.
vec3 cieD65ToLinearSrgb(vec3 blue460,vec3 cyan500,vec3 green550,vec3 amber600,vec3 red650){
  float l460=dot(max(blue460,vec3(0.)),vec3(.02,.08,.90));
  float l500=dot(max(cyan500,vec3(0.)),vec3(.03,.52,.45));
  float l550=dot(max(green550,vec3(0.)),vec3(.04,.92,.04));
  float l600=dot(max(amber600,vec3(0.)),vec3(.57,.42,.01));
  float l650=dot(max(red650,vec3(0.)),vec3(.92,.08,0.));
  vec3 xyz=(
    l460*1.17812*vec3(.2908,.0600,1.6692)+
    l500*1.09354*vec3(.0049,.3230,.2720)+
    l550*1.04046*vec3(.43345,.99495,.00875)+
    l600*.900062*vec3(1.0622,.6310,.0008)+
    l650*.800268*vec3(.2835,.1070,0.)
  )/2.1125;
  return max(vec3(
    3.2406*xyz.x-1.5372*xyz.y-.4986*xyz.z,
    -.9689*xyz.x+1.8758*xyz.y+.0415*xyz.z,
    .0557*xyz.x-.2040*xyz.y+1.0570*xyz.z
  ),vec3(0.));
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

float colorAbsorptionAt(vec3 color,float wavelengthNm){
  float transmission;
  if(wavelengthNm<=480.)transmission=color.b;
  else if(wavelengthNm<=525.)transmission=mix(color.b,color.g,(wavelengthNm-480.)/45.);
  else if(wavelengthNm<=575.)transmission=color.g;
  else if(wavelengthNm<=625.)transmission=mix(color.g,color.r,(wavelengthNm-575.)/50.);
  else transmission=color.r;
  return -log(max(.035,.10+transmission*.90))*.15;
}

float absorptionAt(vec3 position,float wavelengthNm,float materialAbsorption){
  if(zoneMode==0)return absorption+materialAbsorption;
  return absorption+colorAbsorptionAt(zonedBodyColor(position),wavelengthNm);
}

vec3 traceGem(vec3 origin,vec3 direction,float baseIor,float extraordinaryRay,float channelSeed,float wavelengthNm,float channelAbsorption){
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
    throughput*=exp(-absorptionAt((insideOrigin+boundary)*.5,wavelengthNm,channelAbsorption)*boundaryT);
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

vec3 tracePolarized(vec3 origin,vec3 direction,float materialIor,float channelSeed,float wavelengthNm,float channelAbsorption){
  if(birefringence<.0001)return traceGem(origin,direction,materialIor,0.,channelSeed,wavelengthNm,channelAbsorption);
  if(spectralSamples<5)return traceGem(origin,direction,materialIor,.35,channelSeed+31.,wavelengthNm,channelAbsorption);
  vec3 ordinary=traceGem(origin,direction,materialIor,0.,channelSeed,wavelengthNm,channelAbsorption);
  vec3 extraordinary=traceGem(origin,direction,materialIor,1.,channelSeed+61.,wavelengthNm,channelAbsorption);
  return mix(ordinary,extraordinary,.5);
}

vec3 toneMapDisplay(vec3 color){
  color=clamp((color*(2.51*color+.03))/(color*(2.43*color+.59)+.14),0.,1.);
  return pow(color,vec3(1./2.2));
}

vec3 accumulateSample(vec3 color){
  vec3 prepared=linearAccumulation==1?color:toneMapDisplay(color);
  if(sampleIndex>.5){
    vec3 previous=texelFetch(accumulationTexture,ivec2(gl_FragCoord.xy),0).rgb;
    prepared=mix(previous,prepared,1./(sampleIndex+1.));
  }
  return prepared;
}

void main(){
  vec2 screen=((gl_FragCoord.xy+pixelJitter)/resolution-.5)*2.;screen.x*=resolution.x/max(1.,resolution.y);
  vec3 direction=normalize(cameraForward+cameraRight*screen.x*.16+cameraUp*screen.y*.16);
  float redIor=cauchyIor(ior,dispersion,650.),blueIor=cauchyIor(ior,dispersion,460.);
  vec3 red=tracePolarized(cameraPosition,direction,redIor,3.1,650.,absorptionLong.y);
  if(red.r<0.){
    float vignette=1.-smoothstep(.35,1.45,length(screen))*.08;
    outColor=vec4(accumulateSample(pow(backgroundColor,vec3(2.2))*vignette),1.);return;
  }
  vec3 green=tracePolarized(cameraPosition,direction,cauchyIor(ior,dispersion,550.),17.9,550.,absorptionShort.z),blue=tracePolarized(cameraPosition,direction,blueIor,41.3,460.,absorptionShort.x);
  vec3 color;
  if(spectralSamples>=5){
    vec3 amber=tracePolarized(cameraPosition,direction,cauchyIor(ior,dispersion,600.),9.7,600.,absorptionLong.x);
    vec3 cyan=tracePolarized(cameraPosition,direction,cauchyIor(ior,dispersion,500.),29.5,500.,absorptionShort.y);
    color=cieD65ToLinearSrgb(blue,cyan,green,amber,red);
  }else color=vec3(red.r,green.g,blue.b);
  color*=exp2(exposure);
  outColor=vec4(accumulateSample(color),1.);
}`

const DISPLAY_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 uv;
out vec4 outColor;
uniform sampler2D image;
uniform int linearInput;
void main(){
  vec3 color=texture(image,uv).rgb;
  if(linearInput==1){
    color=clamp((color*(2.51*color+.03))/(color*(2.43*color+.59)+.14),0.,1.);
    color=pow(color,vec3(1./2.2));
  }
  outColor=vec4(color,1.);
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

function program(gl, fragmentSource = FRAGMENT_SHADER) {
  const result = gl.createProgram()
  const vertex = shader(gl, gl.VERTEX_SHADER, VERTEX_SHADER), fragment = shader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  gl.attachShader(result, vertex); gl.attachShader(result, fragment); gl.bindAttribLocation(result, 0, 'position'); gl.linkProgram(result)
  gl.deleteShader(vertex); gl.deleteShader(fragment)
  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result))
  return result
}

export function createGpuOpticsRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' })
  if (!gl) throw new Error('此设备不支持 WebGL2 光学预览')
  const pipeline = program(gl)
  const displayPipeline = program(gl, DISPLAY_FRAGMENT_SHADER)
  const buffer = gl.createBuffer()
  const triangleTexture = gl.createTexture()
  const accumulationTextures = [gl.createTexture(), gl.createTexture()]
  const accumulationFramebuffers = [gl.createFramebuffer(), gl.createFramebuffer()]
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW)
  gl.useProgram(pipeline); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, triangleTexture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  const location = name => gl.getUniformLocation(pipeline, name)
  const uniforms = Object.fromEntries(['resolution','cameraPosition','cameraForward','cameraRight','cameraUp','opticAxis','modelCenter','modelExtent','zoneColorA','zoneColorB','backgroundColor','absorptionShort','absorptionLong','triangleData','accumulationTexture','triangleCount','maxBounces','ior','dispersion','birefringence','spectralSamples','zoneMode','absorption','exposure','appearanceStrength','environmentRotation','environmentIntensity','environmentPreset','zoneBoundary','zoneRotation','bodyColor','sampleIndex','pixelJitter','linearAccumulation'].map(name => [name, location(name)]))
  const displayUniforms = { image: gl.getUniformLocation(displayPipeline, 'image'), linearInput: gl.getUniformLocation(displayPipeline, 'linearInput') }
  const floatAccumulation = Boolean(gl.getExtension('EXT_color_buffer_float'))
  let last, animationFrame = 0, generation = 0, accumulationWidth = 0, accumulationHeight = 0
  const configureAccumulation = () => {
    if (accumulationWidth === canvas.width && accumulationHeight === canvas.height) return
    accumulationWidth = canvas.width; accumulationHeight = canvas.height
    accumulationTextures.forEach((texture, index) => {
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, floatAccumulation ? gl.RGBA16F : gl.RGBA8, canvas.width, canvas.height, 0, gl.RGBA, floatAccumulation ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null)
      gl.bindFramebuffer(gl.FRAMEBUFFER, accumulationFramebuffers[index])
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('无法创建渐进渲染缓冲区')
    })
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }
  const resize = options => {
    const ratio = Math.min(Math.max(1, Number(options?.pixelRatioMax) || 2), window.devicePixelRatio || 1), width = Math.max(1, Math.round(canvas.clientWidth * ratio)), height = Math.max(1, Math.round(canvas.clientHeight * ratio))
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; configureAccumulation(); return true }
    configureAccumulation(); return false
  }
  const observer = new ResizeObserver(() => { if (last) draw(last) }); observer.observe(canvas)
  function draw(options) {
    last = options; generation += 1
    if (animationFrame) cancelAnimationFrame(animationFrame)
    resize(options)
    const { packed, count, width, height } = packOpticalTriangles(options.model, options)
    const camera = options.cameraOrbit || {}, yaw = Number.isFinite(camera.yaw) ? camera.yaw : .68, pitch = Number.isFinite(camera.pitch) ? camera.pitch : .62, distance = Number.isFinite(camera.distance) ? camera.distance : 8.6
    const cameraPosition = [Math.sin(yaw) * Math.cos(pitch) * distance, Math.sin(pitch) * distance, Math.cos(yaw) * Math.cos(pitch) * distance], forward = normalize(cameraPosition.map(value => -value))
    const right = normalize(cross(forward, [0, 1, 0])), up = normalize(cross(right, forward))
    gl.viewport(0, 0, canvas.width, canvas.height); gl.useProgram(pipeline)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, triangleTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, packed)
    gl.uniform1i(uniforms.triangleData, 0); gl.uniform1i(uniforms.triangleCount, count)
    gl.uniform1i(uniforms.accumulationTexture, 1)
    gl.uniform1i(uniforms.linearAccumulation, floatAccumulation ? 1 : 0)
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height)
    gl.uniform3fv(uniforms.cameraPosition, cameraPosition); gl.uniform3fv(uniforms.cameraForward, forward); gl.uniform3fv(uniforms.cameraRight, right); gl.uniform3fv(uniforms.cameraUp, up)
    const azimuth = (Number(options.opticAxisAzimuth) || 0) * Math.PI / 180, tilt = Math.max(0, Math.min(90, Number(options.opticAxisTilt) || 0)) * Math.PI / 180
    gl.uniform3fv(uniforms.opticAxis, [Math.sin(tilt) * Math.cos(azimuth), Math.cos(tilt), Math.sin(tilt) * Math.sin(azimuth)])
    const points = options.model.facets.flatMap(facet => facet.points)
    const minimum = [0, 1, 2].map(axis => Math.min(...points.map(point => point[axis]))), maximum = [0, 1, 2].map(axis => Math.max(...points.map(point => point[axis])))
    gl.uniform3fv(uniforms.modelCenter, minimum.map((value, axis) => (value + maximum[axis]) / 2))
    gl.uniform3fv(uniforms.modelExtent, minimum.map((value, axis) => Math.max(.0001, (maximum[axis] - value) / 2)))
    gl.uniform1i(uniforms.maxBounces, Math.max(1, Math.min(8, options.bounces || 6)))
    const spectralAbsorption = Array.isArray(options.spectralAbsorption) && options.spectralAbsorption.length >= 5 ? options.spectralAbsorption : [0, 0, 0, 0, 0]
    gl.uniform1f(uniforms.ior, options.ior); gl.uniform1f(uniforms.dispersion, options.dispersion); gl.uniform1f(uniforms.birefringence, Math.max(0, Math.min(.2, Number(options.birefringence) || 0))); gl.uniform1i(uniforms.spectralSamples, options.spectralSamples >= 5 ? 5 : 3); gl.uniform1f(uniforms.absorption, .002); gl.uniform3fv(uniforms.absorptionShort, spectralAbsorption.slice(0, 3)); gl.uniform2fv(uniforms.absorptionLong, spectralAbsorption.slice(3, 5)); gl.uniform1f(uniforms.exposure, .2)
    gl.uniform1f(uniforms.appearanceStrength, options.showAppearance ? 1 : 0)
    gl.uniform1f(uniforms.environmentRotation, (Number(options.environmentRotation) || 0) * Math.PI / 180)
    gl.uniform1f(uniforms.environmentIntensity, Math.max(.2, Math.min(2.5, Number(options.environmentIntensity) || 1)))
    gl.uniform1i(uniforms.environmentPreset, Math.max(0, Math.min(3, Number(options.environmentPreset) || 0)))
    gl.uniform3fv(uniforms.backgroundColor, rgb(options.backgroundColor || '#17191c'))
    const zoneModes = { uniform: 0, watermelon: 1, bicolor: 2, gradient: 3 }
    gl.uniform1i(uniforms.zoneMode, zoneModes[options.colorZoneMode] || 0)
    gl.uniform3fv(uniforms.zoneColorA, rgb(options.zoneColorA || options.gemColor)); gl.uniform3fv(uniforms.zoneColorB, rgb(options.zoneColorB || options.gemColor))
    gl.uniform1f(uniforms.zoneBoundary, Math.max(.15, Math.min(.85, Number(options.zoneBoundary) || .58)))
    gl.uniform1f(uniforms.zoneRotation, (Number(options.zoneRotation) || 0) * Math.PI / 180)
    gl.uniform3fv(uniforms.bodyColor, rgb(options.gemColor))
    const targetSamples = Math.max(1, Math.min(128, Number(options.progressiveSamples) || 1))
    const currentGeneration = generation
    let sample = 0, readIndex = 0
    const halton = (index, base) => { let fraction = 1, result = 0, value = index; while (value > 0) { fraction /= base; result += fraction * (value % base); value = Math.floor(value / base) } return result }
    const renderSample = () => {
      if (currentGeneration !== generation) return
      const writeIndex = 1 - readIndex
      gl.bindFramebuffer(gl.FRAMEBUFFER, accumulationFramebuffers[writeIndex])
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.useProgram(pipeline)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, triangleTexture)
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, accumulationTextures[readIndex])
      gl.uniform1f(uniforms.sampleIndex, sample)
      gl.uniform2f(uniforms.pixelJitter, halton(sample + 1, 2) - .5, halton(sample + 1, 3) - .5)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.useProgram(displayPipeline)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, accumulationTextures[writeIndex])
      gl.uniform1i(displayUniforms.image, 0); gl.uniform1i(displayUniforms.linearInput, floatAccumulation ? 1 : 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      readIndex = writeIndex; sample += 1
      canvas.dataset.renderer = 'webgl2-progressive-raytrace'; canvas.dataset.samples = String(sample); canvas.dataset.accumulation = floatAccumulation ? 'linear-hdr16f' : 'display-rgba8'
      options.onProgress?.(sample, targetSamples, floatAccumulation ? 'HDR16F' : '兼容模式')
      if (sample < targetSamples) animationFrame = requestAnimationFrame(renderSample)
      else animationFrame = 0
    }
    renderSample()
  }
  const cancel = () => { generation += 1; if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = 0; last = null }
  return { draw, cancel, destroy() { cancel(); observer.disconnect(); gl.deleteTexture(triangleTexture); accumulationTextures.forEach(texture => gl.deleteTexture(texture)); accumulationFramebuffers.forEach(framebuffer => gl.deleteFramebuffer(framebuffer)); gl.deleteBuffer(buffer); gl.deleteProgram(pipeline); gl.deleteProgram(displayPipeline) } }
}
