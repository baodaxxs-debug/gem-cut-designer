const MAX_PLANES = 128

const VERTEX_SHADER = `#version 300 es
in vec2 position;
out vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 outColor;
uniform vec2 resolution;
uniform vec3 cameraPosition,cameraForward,cameraRight,cameraUp;
uniform vec4 planes[${MAX_PLANES}];
uniform int planeCount,maxBounces;
uniform float ior,dispersion,absorption,exposure;
uniform vec3 bodyColor;
const float EPS=.0015;

vec3 environmentLight(vec3 rawDirection){
  vec3 d=normalize(rawDirection);
  float horizon=smoothstep(-.7,.9,d.y);
  vec3 base=mix(vec3(.025,.035,.055),vec3(.82,.88,.94),horizon);
  float left=pow(max(0.,dot(d,normalize(vec3(-.72,.48,.5)))),48.);
  float right=pow(max(0.,dot(d,normalize(vec3(.78,.32,.54)))),68.);
  float top=pow(max(0.,dot(d,normalize(vec3(.05,.98,.14)))),110.);
  float warm=pow(max(0.,dot(d,normalize(vec3(-.18,.18,.97)))),90.);
  float dark=pow(max(0.,dot(d,normalize(vec3(.15,.25,-.96)))),5.);
  return max(vec3(.003),base+left*vec3(5.4,5.8,6.4)+right*vec3(6.8,6.1,5.6)+top*vec3(3.5,3.9,4.6)+warm*vec3(2.7,1.5,.55)-dark*.72);
}

bool intersectGem(vec3 origin,vec3 direction,out float nearT,out float farT,out vec3 nearNormal){
  nearT=-1e5;farT=1e5;nearNormal=vec3(0.,1.,0.);
  for(int n=0;n<${MAX_PLANES};n++){
    if(n>=planeCount)break;
    vec4 p=planes[n];float denominator=dot(p.xyz,direction);float signedDistance=p.w-dot(p.xyz,origin);
    if(abs(denominator)<1e-6){if(signedDistance<0.)return false;continue;}
    float distance=signedDistance/denominator;
    if(denominator<0.&&distance>nearT){nearT=distance;nearNormal=p.xyz;}
    else if(denominator>0.)farT=min(farT,distance);
    if(nearT>farT)return false;
  }
  return farT>max(nearT,0.);
}

bool nextBoundary(vec3 origin,vec3 direction,out float hitT,out vec3 hitNormal){
  hitT=1e5;hitNormal=vec3(0.,1.,0.);
  for(int n=0;n<${MAX_PLANES};n++){
    if(n>=planeCount)break;
    vec4 p=planes[n];float denominator=dot(p.xyz,direction);
    if(denominator<=1e-6)continue;
    float distance=(p.w-dot(p.xyz,origin))/denominator;
    if(distance>EPS&&distance<hitT){hitT=distance;hitNormal=p.xyz;}
  }
  return hitT<1e4;
}

float fresnel(float cosineIncident,float n1,float n2){
  float ci=clamp(abs(cosineIncident),0.,1.);float ratio=n1/n2;
  float st2=ratio*ratio*max(0.,1.-ci*ci);if(st2>=1.)return 1.;
  float ct=sqrt(max(0.,1.-st2));
  float parallel=((n2*ci)-(n1*ct))/max(1e-6,(n2*ci)+(n1*ct));
  float perpendicular=((n1*ci)-(n2*ct))/max(1e-6,(n1*ci)+(n2*ct));
  return .5*(parallel*parallel+perpendicular*perpendicular);
}

vec3 traceGem(vec3 origin,vec3 direction,float materialIor){
  float nearT,farT;vec3 entryNormal;
  if(!intersectGem(origin,direction,nearT,farT,entryNormal)||nearT<0.)return vec3(-1.);
  vec3 entry=origin+direction*nearT;
  float entryFresnel=fresnel(dot(-direction,entryNormal),1.,materialIor);
  vec3 radiance=environmentLight(reflect(direction,entryNormal))*entryFresnel;
  vec3 insideDirection=refract(direction,entryNormal,1./materialIor);
  if(dot(insideDirection,insideDirection)<1e-7)return radiance;
  vec3 throughput=vec3(1.-entryFresnel);vec3 insideOrigin=entry+insideDirection*EPS;
  vec3 absorptionColor=vec3(absorption)-log(max(bodyColor,vec3(.02)))*.9;
  for(int bounce=0;bounce<8;bounce++){
    if(bounce>=maxBounces)break;
    float boundaryT;vec3 boundaryNormal;if(!nextBoundary(insideOrigin,insideDirection,boundaryT,boundaryNormal))break;
    vec3 boundary=insideOrigin+insideDirection*boundaryT;
    throughput*=exp(-absorptionColor*boundaryT);
    float reflected=fresnel(dot(insideDirection,boundaryNormal),materialIor,1.);
    vec3 exitDirection=refract(insideDirection,-boundaryNormal,materialIor);
    if(dot(exitDirection,exitDirection)>1e-7)radiance+=throughput*(1.-reflected)*environmentLight(exitDirection);
    throughput*=reflected;if(max(throughput.r,max(throughput.g,throughput.b))<.002)break;
    insideDirection=reflect(insideDirection,boundaryNormal);insideOrigin=boundary+insideDirection*EPS;
  }
  return radiance;
}

void main(){
  vec2 screen=(gl_FragCoord.xy/resolution-.5)*2.;screen.x*=resolution.x/max(1.,resolution.y);
  vec3 direction=normalize(cameraForward+cameraRight*screen.x*.16+cameraUp*screen.y*.16);
  float redIor=max(1.001,ior-dispersion*.48),blueIor=ior+dispersion*.52;
  vec3 red=traceGem(cameraPosition,direction,redIor);
  if(red.r<0.){vec3 bg=environmentLight(direction)*.16;outColor=vec4(pow(bg,vec3(1./2.2)),1.);return;}
  vec3 green=traceGem(cameraPosition,direction,ior),blue=traceGem(cameraPosition,direction,blueIor);
  vec3 color=vec3(red.r,green.g,blue.b)*exp2(exposure);
  color=clamp((color*(2.51*color+.03))/(color*(2.43*color+.59)+.14),0.,1.);
  outColor=vec4(pow(color,vec3(1./2.2)),1.);
}`

const normalize = vector => {
  const length = Math.hypot(...vector) || 1
  return vector.map(value => value / length)
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

export function packOpticalPlanes(model, limit = MAX_PLANES) {
  if (!model?.facets?.length) throw new Error('没有可追踪的宝石刻面')
  if (model.facets.length > limit) throw new Error(`当前光学预览最多支持 ${limit} 个有效平面`)
  const packed = new Float32Array(limit * 4)
  model.facets.forEach((facet, index) => packed.set([...normalize(facet.n), facet.d], index * 4))
  return { packed, count: model.facets.length }
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

const rgb = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)

export function createGpuOpticsRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' })
  if (!gl) throw new Error('此设备不支持 WebGL2 光学预览')
  const pipeline = program(gl)
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW)
  gl.useProgram(pipeline); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  const location = name => gl.getUniformLocation(pipeline, name)
  const uniforms = Object.fromEntries(['resolution','cameraPosition','cameraForward','cameraRight','cameraUp','planes[0]','planeCount','maxBounces','ior','dispersion','absorption','exposure','bodyColor'].map(name => [name, location(name)]))
  let last
  const resize = () => {
    const ratio = Math.min(2, window.devicePixelRatio || 1), width = Math.max(1, Math.round(canvas.clientWidth * ratio)), height = Math.max(1, Math.round(canvas.clientHeight * ratio))
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
  }
  const observer = new ResizeObserver(() => { resize(); if (last) draw(last) }); observer.observe(canvas)
  function draw(options) {
    last = options; resize()
    const { packed, count } = packOpticalPlanes(options.model)
    const cameraPosition = [4.4, 5, 5.4], forward = normalize(cameraPosition.map(value => -value))
    const right = normalize(cross(forward, [0, 1, 0])), up = normalize(cross(right, forward))
    gl.viewport(0, 0, canvas.width, canvas.height); gl.useProgram(pipeline)
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height)
    gl.uniform3fv(uniforms.cameraPosition, cameraPosition); gl.uniform3fv(uniforms.cameraForward, forward); gl.uniform3fv(uniforms.cameraRight, right); gl.uniform3fv(uniforms.cameraUp, up)
    gl.uniform4fv(uniforms['planes[0]'], packed); gl.uniform1i(uniforms.planeCount, count); gl.uniform1i(uniforms.maxBounces, Math.max(1, Math.min(8, options.bounces || 6)))
    gl.uniform1f(uniforms.ior, options.ior); gl.uniform1f(uniforms.dispersion, options.dispersion); gl.uniform1f(uniforms.absorption, Math.max(0, options.bodyColorStrength - .1) * .18); gl.uniform1f(uniforms.exposure, .2)
    gl.uniform3fv(uniforms.bodyColor, rgb(options.gemColor)); gl.drawArrays(gl.TRIANGLES, 0, 3)
    canvas.dataset.renderer = 'webgl2-raytrace'
  }
  return { draw, destroy() { observer.disconnect(); gl.deleteBuffer(buffer); gl.deleteProgram(pipeline); last = null } }
}
