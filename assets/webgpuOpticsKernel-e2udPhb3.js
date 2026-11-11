const g=`
struct Settings {
  triangleCount: u32,
  bvhCount: u32,
  rayCount: u32,
  maxSteps: u32,
  ior: f32,
  dispersion: f32,
  absorption: f32,
  maxBounces: u32,
  acceptanceCos: f32,
  rayEpsilon: f32,
  _padding0: f32,
  _padding1: f32,
}

@group(0) @binding(0) var<storage, read> triangles: array<vec4f>;
@group(0) @binding(1) var<storage, read> bvhNodes: array<vec4f>;
@group(0) @binding(2) var<storage, read> rays: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> results: array<vec4f>;
@group(0) @binding(4) var<uniform> settings: Settings;

const EPSILON: f32 = 0.0000001;
const DETERMINANT_EPSILON: f32 = 0.00000001;
const BARYCENTRIC_EPSILON: f32 = 0.000001;
const STACK_SIZE: u32 = 64u;

fn safeInverse(value: f32) -> f32 {
  if (abs(value) >= 0.00000001) { return 1.0 / value; }
  return select(-100000000.0, 100000000.0, value >= 0.0);
}

fn intersectsBounds(origin: vec3f, inverseDirection: vec3f, minimum: vec3f, maximum: vec3f, maximumDistance: f32) -> bool {
  let first = (minimum - origin) * inverseDirection;
  let second = (maximum - origin) * inverseDirection;
  let nearValue = min(first, second);
  let farValue = max(first, second);
  let nearDistance = max(max(nearValue.x, nearValue.y), max(nearValue.z, 0.0));
  let farDistance = min(farValue.x, min(farValue.y, farValue.z));
  return farDistance >= nearDistance && nearDistance < maximumDistance;
}

// Returns distance in x and a hit flag in w.
fn intersectTriangle(origin: vec3f, direction: vec3f, a: vec3f, b: vec3f, c: vec3f) -> vec4f {
  let edge1 = b - a;
  let edge2 = c - a;
  let p = cross(direction, edge2);
  let determinant = dot(edge1, p);
  if (abs(determinant) < DETERMINANT_EPSILON) { return vec4f(0.0); }
  let inverse = 1.0 / determinant;
  let offset = origin - a;
  let u = dot(offset, p) * inverse;
  if (u < -BARYCENTRIC_EPSILON || u > 1.0 + BARYCENTRIC_EPSILON) { return vec4f(0.0); }
  let q = cross(offset, edge1);
  let v = dot(direction, q) * inverse;
  if (v < -BARYCENTRIC_EPSILON || u + v > 1.0 + BARYCENTRIC_EPSILON) { return vec4f(0.0); }
  let distance = dot(edge2, q) * inverse;
  return vec4f(distance, u, v, select(0.0, 1.0, distance > max(EPSILON, settings.rayEpsilon * 0.25)));
}

// x=distance, y=triangle index, z=hit flag.
fn nearestHit(origin: vec3f, direction: vec3f, excludedFacet: i32) -> vec3f {
  var nearest = 100000000000000000000.0;
  var nearestTriangle = 0u;
  var found = false;
  let inverseDirection = vec3f(safeInverse(direction.x), safeInverse(direction.y), safeInverse(direction.z));
  var stack: array<u32, 64>;
  var stackSize = 1u;
  stack[0] = 0u;
  var step = 0u;
  loop {
    if (stackSize == 0u || step >= settings.maxSteps) { break; }
    step += 1u;
    stackSize -= 1u;
    let node = stack[stackSize];
    if (node >= settings.bvhCount) { continue; }
    let minimumData = bvhNodes[node * 2u];
    let maximumData = bvhNodes[node * 2u + 1u];
    if (!intersectsBounds(origin, inverseDirection, minimumData.xyz, maximumData.xyz, nearest)) { continue; }
    if (minimumData.w < 0.0) {
      let first = u32(-minimumData.w) - 1u;
      let count = u32(maximumData.w + 0.5);
      for (var offset = 0u; offset < 4u; offset += 1u) {
        if (offset >= count) { break; }
        let triangle = first + offset;
        if (triangle >= settings.triangleCount) { break; }
        let base = triangle * 8u;
        if (i32(triangles[base].w + 0.5) == excludedFacet) { continue; }
        let hit = intersectTriangle(origin, direction, triangles[base].xyz, triangles[base + 1u].xyz, triangles[base + 2u].xyz);
        if (hit.w > 0.5 && hit.x < nearest) {
          nearest = hit.x;
          nearestTriangle = triangle;
          found = true;
        }
      }
    } else if (stackSize + 2u <= STACK_SIZE) {
      stack[stackSize] = u32(maximumData.w + 0.5);
      stack[stackSize + 1u] = u32(minimumData.w + 0.5);
      stackSize += 2u;
    }
  }
  return vec3f(nearest, f32(nearestTriangle), select(0.0, 1.0, found));
}

// x = s-polarized reflectance, y = p-polarized reflectance.
fn fresnelComponents(cosineIncident: f32, n1: f32, n2: f32) -> vec2f {
  let ci = clamp(abs(cosineIncident), 0.0, 1.0);
  let ratio = n1 / n2;
  let transmittedSineSquared = ratio * ratio * max(0.0, 1.0 - ci * ci);
  if (transmittedSineSquared >= 1.0) { return vec2f(1.0); }
  let ct = sqrt(max(0.0, 1.0 - transmittedSineSquared));
  let parallel = ((n2 * ci) - (n1 * ct)) / max(0.000001, (n2 * ci) + (n1 * ct));
  let perpendicular = ((n1 * ci) - (n2 * ct)) / max(0.000001, (n1 * ci) + (n2 * ct));
  return vec2f(perpendicular * perpendicular, parallel * parallel);
}

fn fresnelUnpolarized(cosineIncident: f32, n1: f32, n2: f32) -> f32 {
  let components = fresnelComponents(cosineIncident, n1, n2);
  return 0.5 * (components.x + components.y);
}

fn spectralIor(wavelengthNm: f32) -> f32 {
  let blueLine = 430.8;
  let dLine = 589.29;
  let redLine = 686.7;
  let inverseBlue = 1.0 / (blueLine * blueLine);
  let inverseRed = 1.0 / (redLine * redLine);
  let coefficientB = max(0.0, settings.dispersion) / max(0.000000001, inverseBlue - inverseRed);
  let coefficientA = settings.ior - coefficientB / (dLine * dLine);
  return max(1.001, coefficientA + coefficientB / (wavelengthNm * wavelengthNm));
}

fn opticalNormal(triangle: u32, point: vec3f) -> vec3f {
  let base = triangle * 8u;
  let faceNormal = normalize(triangles[base + 3u].xyz);
  if (triangles[base + 3u].w >= -1.5) { return faceNormal; }
  let a = triangles[base].xyz;
  let edge0 = triangles[base + 1u].xyz - a;
  let edge1 = triangles[base + 2u].xyz - a;
  let relative = point - a;
  let d00 = dot(edge0, edge0);
  let d01 = dot(edge0, edge1);
  let d11 = dot(edge1, edge1);
  let d20 = dot(relative, edge0);
  let d21 = dot(relative, edge1);
  let denominator = max(0.000000000001, d00 * d11 - d01 * d01);
  let v = (d11 * d20 - d01 * d21) / denominator;
  let w = (d00 * d21 - d01 * d20) / denominator;
  let u = 1.0 - v - w;
  var smoothNormal = normalize(
    triangles[base + 5u].xyz * u +
    triangles[base + 6u].xyz * v +
    triangles[base + 7u].xyz * w
  );
  if (dot(smoothNormal, faceNormal) < 0.0) { smoothNormal = -smoothNormal; }
  return smoothNormal;
}

@compute @workgroup_size(64)
fn traceOpticalInterfaces(@builtin(global_invocation_id) invocation: vec3u) {
  let rayIndex = invocation.x;
  if (rayIndex >= settings.rayCount) { return; }
  let origin = rays[rayIndex * 2u].xyz;
  let direction = normalize(rays[rayIndex * 2u + 1u].xyz);
  let hit = nearestHit(origin, direction, -1);
  if (hit.z < 0.5) {
    results[rayIndex] = vec4f(-1.0, 0.0, 0.0, 0.0);
    return;
  }
  let triangle = u32(hit.y + 0.5);
  var normal = opticalNormal(triangle, origin + direction * hit.x);
  if (dot(direction, normal) > 0.0) { normal = -normal; }
  let reflectance = fresnelUnpolarized(dot(-direction, normal), 1.0, settings.ior);
  let transmitted = refract(direction, normal, 1.0 / settings.ior);
  // distance, Fresnel energy, transmitted cosine, hit flag
  results[rayIndex] = vec4f(hit.x, reflectance, dot(-normal, transmitted), 1.0);
}

// Energy result: returned to the observer, escaped elsewhere, absorbed,
// and residual energy still travelling after the configured bounce budget.
@compute @workgroup_size(64)
fn traceSpectralEnergy(@builtin(global_invocation_id) invocation: vec3u) {
  let rayIndex = invocation.x;
  if (rayIndex >= settings.rayCount) { return; }
  let rawOrigin = rays[rayIndex * 2u];
  let origin = rawOrigin.xyz;
  let rawDirection = rays[rayIndex * 2u + 1u];
  let initialDirection = normalize(rawDirection.xyz);
  let wavelengthNm = select(589.29, rawDirection.w, rawDirection.w > 0.0);
  let rayAbsorption = select(max(0.0, settings.absorption), max(0.0, rawOrigin.w), rawOrigin.w >= 0.0);
  let materialIor = spectralIor(wavelengthNm);
  let entryHit = nearestHit(origin, initialDirection, -1);
  if (entryHit.z < 0.5) {
    results[rayIndex * 2u] = vec4f(0.0);
    results[rayIndex * 2u + 1u] = vec4f(0.0, 0.0, wavelengthNm, 0.0);
    return;
  }

  let entryTriangle = u32(entryHit.y + 0.5);
  var excludedFacet = i32(triangles[entryTriangle * 5u].w + 0.5);
  let entryPoint = origin + initialDirection * entryHit.x;
  var entryNormal = opticalNormal(entryTriangle, entryPoint);
  if (dot(initialDirection, entryNormal) > 0.0) { entryNormal = -entryNormal; }
  let entryComponents = fresnelComponents(dot(-initialDirection, entryNormal), 1.0, materialIor);
  let entryReflectance = 0.5 * (entryComponents.x + entryComponents.y);
  var returnedEnergy = 0.0;
  var escapedEnergy = 0.0;
  var absorbedEnergy = 0.0;
  var throughputComponents = 0.5 * (vec2f(1.0) - entryComponents);
  var throughput = throughputComponents.x + throughputComponents.y;
  var direction = refract(initialDirection, entryNormal, 1.0 / materialIor);
  if (dot(direction, direction) < 0.0000001) {
    results[rayIndex * 2u] = vec4f(returnedEnergy, escapedEnergy, absorbedEnergy, throughput);
    results[rayIndex * 2u + 1u] = vec4f(entryReflectance, 1.0 - entryReflectance, wavelengthNm, 1.0);
    return;
  }
  var insideOrigin = entryPoint + direction * settings.rayEpsilon;

  var bounce = 0u;
  loop {
    if (bounce >= settings.maxBounces || throughput < 0.000001) { break; }
    let boundaryHit = nearestHit(insideOrigin, direction, excludedFacet);
    if (boundaryHit.z < 0.5) {
      // A ray that has already entered a closed gem cannot physically escape
      // without crossing a surface. Keep a missing continuation hit as
      // unresolved residual energy, matching the CPU tracer's trapped bucket.
      break;
    }
    let boundary = insideOrigin + direction * boundaryHit.x;
    let transmission = exp(-rayAbsorption * boundaryHit.x);
    absorbedEnergy += throughput * (1.0 - transmission);
    throughputComponents *= transmission;
    throughput = throughputComponents.x + throughputComponents.y;

    let triangle = u32(boundaryHit.y + 0.5);
    excludedFacet = i32(triangles[triangle * 5u].w + 0.5);
    var boundaryNormal = opticalNormal(triangle, boundary);
    if (dot(direction, boundaryNormal) < 0.0) { boundaryNormal = -boundaryNormal; }
    let boundaryComponents = fresnelComponents(dot(direction, boundaryNormal), materialIor, 1.0);
    let reflectance = 0.5 * (boundaryComponents.x + boundaryComponents.y);
    let exitDirection = refract(direction, -boundaryNormal, materialIor);
    if (dot(exitDirection, exitDirection) > 0.0000001) {
      let transmittedComponents = throughputComponents * (vec2f(1.0) - boundaryComponents);
      let transmittedEnergy = transmittedComponents.x + transmittedComponents.y;
      if (dot(normalize(exitDirection), -initialDirection) >= settings.acceptanceCos) {
        returnedEnergy += transmittedEnergy;
      } else {
        escapedEnergy += transmittedEnergy;
      }
    }
    throughputComponents *= boundaryComponents;
    throughput = throughputComponents.x + throughputComponents.y;
    direction = reflect(direction, boundaryNormal);
    insideOrigin = boundary + direction * settings.rayEpsilon;
    bounce += 1u;
  }
  results[rayIndex * 2u] = vec4f(returnedEnergy, escapedEnergy, absorbedEnergy, throughput);
  results[rayIndex * 2u + 1u] = vec4f(entryReflectance, 1.0 - entryReflectance, wavelengthNm, 1.0);
}
`;function y(r=2.417){const t=new Float32Array([-1,0,-1,0,1,0,-1,0,0,0,1,0,0,1,0,0,1,1,1,0,0,1,0,0,0,1,0,0,0,1,0,0]),e=new Float32Array([-1,0,-1,-1,1,0,1,1]),i=new Float32Array([0,1,0,0,0,-1,0,0]),a=new ArrayBuffer(48),s=new Uint32Array(a),n=new Float32Array(a);return s.set([1,1,1,2048],0),n[4]=r,n[5]=.044,n[6]=0,s[7]=6,n[8]=Math.cos(25*Math.PI/180),n[9]=.0015,{triangles:t,bvh:e,rays:i,settings:a,resultBytes:16}}function v(r=2.417,t=0){const e=(u,d,f,l,m)=>[...u,m,...d,0,...f,0,...l,0,1,1,1,0,...l,0,...l,0,...l,0],i=new Float32Array([...e([-1,0,-1],[1,0,1],[1,0,-1],[0,1,0],0),...e([-1,0,-1],[-1,0,1],[1,0,1],[0,1,0],0),...e([-1,-1,-1],[1,-1,-1],[1,-1,1],[0,-1,0],1),...e([-1,-1,-1],[1,-1,1],[-1,-1,1],[0,-1,0],1)]),a=new Float32Array([-1,-1,-1,-1,1,0,1,4]),s=new Float32Array([0,1,0,-1,0,-1,0,589.29]),n=new ArrayBuffer(48),c=new Uint32Array(n),o=new Float32Array(n);return c.set([4,1,1,2048],0),o[4]=r,o[5]=.044,o[6]=t,c[7]=8,o[8]=Math.cos(25*Math.PI/180),o[9]=.0015,{triangles:i,bvh:a,rays:s,settings:n,resultBytes:32}}function p(r,t=0){return Array.from(r).slice(t,t+4).reduce((e,i)=>e+i,0)}function x(r,t){const e=(r-t)/(r+t);return e*e}export{g as W,v as a,y as c,p as e,x as n};
