import{M as ge,p as Ve,r as ee,a as Ke,R as We}from"./index-CYkTlCsE.js";import"./vendor-react-LH54K9D1.js";import"./vendor-three-CYGhrtLC.js";const W=8,re=2,ae=4,Ee=2048,Ye=64,je=128,$e=Object.freeze([1.034971,.988495,1.014262]);function Ze(r,i,e=1,o=2,n=1){const h=Math.min(Math.max(1,Number(o)||2),Math.max(1,Number(e)||1))*Math.max(.3,Math.min(1,Number(n)||1)),s=Math.max(1,Math.round(Math.min(Math.max(1,Number(r)||1),Math.max(1,Number(i)||1))*h));return{width:s,height:s,ratio:h}}function Je(r,i){const e=Math.max(0,Math.floor(Number(r)||0)),o=Math.max(1,Math.floor(Number(i)||1));return o<12||e>=o&&e%o===0}function Qe(r,i,e=256){const o=Math.max(1,Math.floor(Number(e)||256)),n=Math.max(1,Math.min(o,Math.round(Number(r)||1))),l=Math.max(1,Math.floor(Number(i)||1));return l<12?n:Math.max(l,Math.floor(n/l)*l)}function xe(r,i=1){const e=Math.max(1e-6,Number(i)||1);return r.map(o=>Math.max(0,Number(o)||0)/e)}const te=Object.freeze({12:Object.freeze([3.39179,3.42813,3.40625]),24:Object.freeze([3.43665,3.41083,3.318]),36:Object.freeze([3.44154,3.41131,3.31552])}),er=`#version 300 es
in vec2 position;
out vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`,De=`#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 uv;
out vec4 outColor;
uniform vec2 resolution;
uniform vec3 cameraPosition,cameraForward,cameraRight,cameraUp,cameraPositionB,cameraForwardB,cameraRightB,cameraUpB,opticAxis,principalIorOffsets,modelCenter,modelExtent,zoneColorA,zoneColorB,backgroundColor;
uniform vec4 curvedSurfaceProfile,curvedSurfaceHeights;
uniform float absorptionSpectrumOrdinary[24],absorptionSpectrumExtraordinary[24],principalSpectrumOrdinary[24],principalSpectrumExtraordinary[24];
uniform sampler2D triangleData,bvhData,accumulationTexture;
uniform vec4 defectData[16],defectOptics[16];
uniform int triangleCount,maxBounces,environmentPreset,spectralSamples,zoneMode,linearAccumulation,dispersionModelType,anisotropicDispersionModelType,inspectionSplit,cameraProjection,defectCount,opticalClassType;
uniform float ior,dispersion,birefringence,opticAxisRoll,absorption,exposure,appearanceStrength,environmentRotation,environmentIntensity,zoneBoundary,zoneRotation,sampleIndex,headShadowAngle,headShadowStrength,volumeHaze,volumeScatterAlbedo,volumePhaseG,surfaceTextureStrength,surfaceTextureScale,volumeTextureStrength,volumeTextureScale,rayEpsilon,millimetersPerUnit;
uniform vec2 pixelJitter;
uniform vec3 bodyColor,sellmeierB,sellmeierC,sellmeierExtraB,sellmeierExtraC;
const int MAX_BVH_STEPS=${Ee};
const int MAX_BVH_STACK=${Ye};

vec4 triangleTexel(int triangle,int column){return texelFetch(triangleData,ivec2(column,triangle),0);}
vec4 bvhTexel(int node,int column){return texelFetch(bvhData,ivec2(column,node),0);}

float environmentHash(vec2 cell){return fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453123);}

vec3 applyHeadShadow(vec3 light,vec3 rawDirection){
  if(headShadowAngle<=.01||headShadowStrength<=.001)return light;
  float alignment=dot(normalize(rawDirection),-normalize(cameraForward));
  float edge=cos(radians(headShadowAngle));
  float mask=smoothstep(edge,min(1.,edge+.025),alignment)*headShadowStrength;
  return mix(light,vec3(.003),mask);
}

vec3 environmentLight(vec3 rawDirection){
  float cosine=cos(environmentRotation),sine=sin(environmentRotation);
  vec3 d=normalize(vec3(cosine*rawDirection.x+sine*rawDirection.z,rawDirection.y,-sine*rawDirection.x+cosine*rawDirection.z));
  float horizon=smoothstep(-.7,.9,d.y);
  vec3 low=vec3(.012),high=vec3(.34,.37,.42),warmColor=vec3(1.05,.91,.78);
  if(environmentPreset==4){
    // Approximate H&A reflecting viewer. Alpha is measured from the optical axis:
    // a dark observation pupil is surrounded by diffuse illumination and a coloured
    // reflecting field. The scope contains no artificial eight-fold pattern.
    // Arrows and hearts are rendered separately by reversing the gemstone view.
    // Only the hemisphere on the observer/scope side is illuminated. Using
    // abs(d.y) here would incorrectly turn pavilion leakage into red return.
    float axial=dot(d,-normalize(cameraForward));
    if(axial<=0.)return vec3(.004)*environmentIntensity;
    float alpha=degrees(acos(clamp(axial,0.,1.)));
    float leavePupil=smoothstep(4.2,5.2,alpha);
    float leaveWhiteCone=smoothstep(15.7,17.0,alpha);
    vec3 scope=mix(vec3(.004),vec3(1.05),leavePupil);
    scope=mix(scope,vec3(1.18,.025,.04),leaveWhiteCone);
    return max(vec3(.003),scope)*environmentIntensity;
  }
  if(environmentPreset==5){
    // ASET angular map, face-up: gray is pavilion-side escape/leakage;
    // green is 0-45 degrees above the horizon, red 45-75, blue 75-90 obstruction.
    if(d.y<=0.)return vec3(.15)*environmentIntensity;
    if(d.y<.70710678)return vec3(.055,.72,.22)*environmentIntensity;
    if(d.y<.96592583)return vec3(1.22,.035,.045)*environmentIntensity;
    return vec3(.035,.15,.86)*environmentIntensity;
  }
  if(environmentPreset==6){
    // Isometric lighting: equal radiance arrives from every direction. It is
    // useful for separating geometry/light-return changes from studio styling.
    return applyHeadShadow(vec3(1.),rawDirection)*environmentIntensity;
  }
  if(environmentPreset==7){
    // Cosine illumination centred on the observer axis, matching the falloff
    // of a broad diffuse source rather than a collection of point lights.
    float facing=max(0.,dot(d,-normalize(cameraForward)));
    return applyHeadShadow(vec3(pow(facing,.8)),rawDirection)*environmentIntensity;
  }
  if(environmentPreset==8){
    // Diagnostic angular rings relative to the observer. These colours belong
    // to the light source, so any pattern on the gem must be produced by facets.
    float facing=dot(d,-normalize(cameraForward));
    if(facing<=0.)return vec3(.003)*environmentIntensity;
    float angle=degrees(acos(clamp(facing,0.,1.)));
    vec3 rings=angle<15.?vec3(1.05,.04,.04):angle<30.?vec3(.02,.92,1.05):angle<50.?vec3(1.05,.88,.04):vec3(.92,.04,1.02);
    return applyHeadShadow(rings,rawDirection)*environmentIntensity;
  }
  if(environmentPreset==9){
    // Deterministic random softbox field, corresponding to the Random lighting
    // model used by gem-design renderers. Rotation lets the user search for
    // extinction and scintillation without changing the gemstone or camera.
    float longitude=atan(d.z,d.x)/6.28318530718+.5;
    float latitude=asin(clamp(d.y,-1.,1.))/3.14159265359+.5;
    vec2 grid=vec2(longitude*12.,latitude*6.);
    vec2 cell=floor(grid),local=fract(grid);
    float seed=environmentHash(cell);
    float edgeX=smoothstep(.06,.22,local.x)*smoothstep(.06,.22,1.-local.x);
    float edgeY=smoothstep(.08,.26,local.y)*smoothstep(.08,.26,1.-local.y);
    float panel=edgeX*edgeY*step(.48,seed);
    float level=mix(.018,mix(.42,1.45,environmentHash(cell+17.3)),panel);
    vec3 randomPanels=vec3(level)*mix(vec3(.96,.98,1.03),vec3(1.04,.99,.94),environmentHash(cell+5.8));
    return applyHeadShadow(randomPanels,rawDirection)*environmentIntensity;
  }
  if(environmentPreset==10){
    // Jewelry photography dome: small hard sources reveal scintillation while
    // broad fill keeps the cut readable. Dark cards create extinction rather
    // than the uniformly bright transmission that makes gemstones look glassy.
    vec3 neutral=vec3(.055)+vec3(.08,.09,.11)*smoothstep(-.45,.8,d.y);
    float key=pow(max(0.,dot(d,normalize(vec3(-.58,.62,.53)))),520.);
    float fill=pow(max(0.,dot(d,normalize(vec3(.71,.40,.58)))),360.);
    float crown=pow(max(0.,dot(d,normalize(vec3(.04,.96,-.26)))),720.);
    float rim=pow(max(0.,dot(d,normalize(vec3(-.32,.18,-.93)))),240.);
    float strip=pow(max(0.,dot(d,normalize(vec3(.92,.12,-.38)))),95.);
    float softbox=pow(max(0.,dot(d,normalize(vec3(-.12,.88,.46)))),16.);
    float blackCard=pow(max(0.,dot(d,normalize(vec3(.10,.24,.97)))),7.);
    vec3 dome=neutral
      +key*vec3(4.8,4.55,4.25)
      +fill*vec3(2.2,2.45,2.8)
      +crown*vec3(3.5,3.65,3.9)
      +rim*vec3(1.5,1.72,2.15)
      +strip*vec3(.52,.58,.68)
      +softbox*vec3(.52,.57,.66)
      -blackCard*vec3(.12);
    return applyHeadShadow(max(vec3(.002),dome),rawDirection)*environmentIntensity;
  }
  if(environmentPreset==11){
    // Neutral material-comparison dome. Unlike the jewelry scene it contains
    // no black cards or tiny hard sources: every material is compared under
    // the same broad D65-weighted illumination and fixed exposure. D65 spectral
    // weighting is applied later by the colour integration path.
    float upper=smoothstep(-.35,.85,d.y);
    // Keep the dome below display white so ACES tone mapping preserves the
    // wavelength-selective body colour instead of clipping every material to
    // the same pale highlight. Surface reflections remain neutral by design.
    vec3 dome=mix(vec3(.14),vec3(.40),upper);
    float broadKey=pow(max(0.,dot(d,normalize(vec3(-.42,.78,.46)))),9.);
    float broadFill=pow(max(0.,dot(d,normalize(vec3(.65,.56,.50)))),13.);
    return (dome+broadKey*vec3(.22)+broadFill*vec3(.10))*environmentIntensity;
  }
  if(environmentPreset==12){
    // Cabochon inspection dome: professional surface inspection uses broad,
    // continuous reflection bands. Tiny hard cards are useful for faceted
    // scintillation but make their repeated internal images look like false
    // polygon faces on an otherwise smooth curved stone.
    float upper=smoothstep(-.65,.92,d.y);
    vec3 dome=mix(vec3(.035,.042,.052),vec3(.30,.34,.40),upper);
    float key=pow(max(0.,dot(d,normalize(vec3(-.62,.68,.39)))),7.);
    float fill=pow(max(0.,dot(d,normalize(vec3(.68,.55,.48)))),10.);
    float rim=pow(max(0.,dot(d,normalize(vec3(-.28,.20,-.94)))),18.);
    float horizonBand=pow(max(0.,1.-abs(d.y-.04)),24.);
    vec3 curvedStudio=dome
      +key*vec3(.48,.52,.58)
      +fill*vec3(.22,.25,.30)
      +rim*vec3(.18,.22,.30)
      +horizonBand*vec3(.055,.065,.08);
    return applyHeadShadow(curvedStudio,rawDirection)*environmentIntensity;
  }
  if(environmentPreset==1){low=vec3(.07);high=vec3(.58,.60,.63);warmColor=vec3(1.18,1.20,1.24);}
  else if(environmentPreset==2){low=vec3(.16);high=vec3(.72);warmColor=vec3(1.45);}
  else if(environmentPreset==3){low=vec3(.002);high=vec3(.09,.10,.12);warmColor=vec3(.72,.64,.58);}
  vec3 base=mix(low,high,horizon);
  float left=pow(max(0.,dot(d,normalize(vec3(-.72,.48,.5)))),48.);
  float right=pow(max(0.,dot(d,normalize(vec3(.78,.32,.54)))),68.);
  float top=pow(max(0.,dot(d,normalize(vec3(.05,.98,.14)))),110.);
  float warm=pow(max(0.,dot(d,normalize(vec3(-.18,.18,.97)))),90.);
  float dark=pow(max(0.,dot(d,normalize(vec3(.15,.25,-.96)))),5.);
  // Broad, bounded softboxes retain facet contrast without clipping most of
  // the gemstone to white. The previous 5-7x panels hid colour and fire.
  vec3 studio=max(vec3(.003),base+left*vec3(1.55,1.68,1.86)+right*vec3(1.82,1.68,1.54)+top*vec3(1.05,1.14,1.30)+warm*warmColor-dark*.22);
  return applyHeadShadow(studio,rawDirection)*environmentIntensity;
}

bool intersectTriangle(vec3 origin,vec3 direction,vec3 a,vec3 b,vec3 c,out float distance){
  vec3 edge1=b-a,edge2=c-a;
  vec3 p=cross(direction,edge2);
  float determinant=dot(edge1,p);
  if(abs(determinant)<1e-8)return false;
  float inverse=1./determinant;
  vec3 offset=origin-a;
  float u=dot(offset,p)*inverse;
  const float edgeTolerance=1e-6;
  if(u<-edgeTolerance||u>1.+edgeTolerance)return false;
  vec3 q=cross(offset,edge1);
  float v=dot(direction,q)*inverse;
  if(v<-edgeTolerance||u+v>1.+edgeTolerance)return false;
  distance=dot(edge2,q)*inverse;
  return distance>max(1e-7,rayEpsilon*.25);
}

float refineCurvedDistance(vec3 origin,vec3 direction,float initialDistance,int surfaceKind,vec3 a,vec3 b,vec3 c){
  if(surfaceKind==0)return initialDistance;
  vec2 radii=max(curvedSurfaceProfile.xy,vec2(1e-6));
  if(surfaceKind==1){
    vec2 localOrigin=(origin.xz-modelCenter.xz)/radii;
    vec2 localDirection=direction.xz/radii;
    float qa=dot(localDirection,localDirection);
    float qb=2.*dot(localOrigin,localDirection);
    float qc=dot(localOrigin,localOrigin)-1.;
    float discriminant=qb*qb-4.*qa*qc;
    if(qa<1e-12||discriminant<0.)return initialDistance;
    float root=sqrt(max(0.,discriminant));
    float first=(-qb-root)/(2.*qa),second=(-qb+root)/(2.*qa);
    float refined=first>0.&&abs(first-initialDistance)<abs(second-initialDistance)?first:second;
    if(refined<=0.)return initialDistance;
    float refinedY=(origin+direction*refined).y;
    float minimumY=min(a.y,min(b.y,c.y))-max(rayEpsilon*8.,1e-4);
    float maximumY=max(a.y,max(b.y,c.y))+max(rayEpsilon*8.,1e-4);
    return refinedY>=minimumY&&refinedY<=maximumY?refined:initialDistance;
  }
  if(curvedSurfaceProfile.w<.5)return initialDistance;
  float base=surfaceKind==2?curvedSurfaceHeights.x:-curvedSurfaceHeights.x;
  float amplitude=surfaceKind==2?curvedSurfaceHeights.y:(curvedSurfaceHeights.w<1.5?-curvedSurfaceHeights.z:curvedSurfaceHeights.z);
  float power=max(1.01,curvedSurfaceProfile.z);
  float refined=initialDistance;
  for(int iteration=0;iteration<6;iteration++){
    vec3 point=origin+direction*refined;
    vec2 local=(point.xz-modelCenter.xz)/radii;
    float radius=max(1e-7,length(local));
    float radialPower=pow(radius,power);
    float functionValue=point.y-(base+amplitude*(1.-radialPower));
    float radialDerivative=power*pow(radius,power-2.)*dot(local,direction.xz/radii);
    float derivative=direction.y+amplitude*radialDerivative;
    if(abs(derivative)<1e-8)break;
    refined-=functionValue/derivative;
  }
  return refined>0.?refined:initialDistance;
}

vec3 analyticCurvedNormal(vec3 point,int surfaceKind,vec3 fallback){
  vec2 radii=max(curvedSurfaceProfile.xy,vec2(1e-6));
  vec2 local=(point.xz-modelCenter.xz)/radii;
  if(surfaceKind==1){
    vec3 normal=normalize(vec3(local.x/radii.x,0.,local.y/radii.y));
    return dot(normal,fallback)<0.?-normal:normal;
  }
  if(surfaceKind<2||curvedSurfaceProfile.w<.5)return fallback;
  float amplitude=surfaceKind==2?curvedSurfaceHeights.y:(curvedSurfaceHeights.w<1.5?-curvedSurfaceHeights.z:curvedSurfaceHeights.z);
  float power=max(1.01,curvedSurfaceProfile.z);
  float radius=max(1e-7,length(local));
  vec2 slope=amplitude*power*pow(radius,power-2.)*local/radii;
  vec3 normal=surfaceKind==2?normalize(vec3(slope.x,1.,slope.y)):normalize(vec3(-slope.x,-1.,-slope.y));
  return dot(normal,fallback)<0.?-normal:normal;
}

bool analyticProfileHit(vec3 origin,vec3 direction,float base,float amplitude,bool upper,out float distance,out vec3 normal){
  vec2 radii=max(curvedSurfaceProfile.xy,vec2(1e-6));
  vec2 localOrigin=(origin.xz-modelCenter.xz)/radii;
  vec2 localDirection=direction.xz/radii;
  float qa=amplitude*dot(localDirection,localDirection);
  float qb=2.*amplitude*dot(localOrigin,localDirection)+direction.y;
  float qc=amplitude*dot(localOrigin,localOrigin)+origin.y-base-amplitude;
  float discriminant=qb*qb-4.*qa*qc;
  if(abs(qa)<1e-12||discriminant<0.)return false;
  float root=sqrt(max(0.,discriminant));
  float candidates[2];candidates[0]=(-qb-root)/(2.*qa);candidates[1]=(-qb+root)/(2.*qa);
  distance=1e20;bool found=false;
  for(int index=0;index<2;index++){
    float candidate=candidates[index];
    if(candidate<=max(1e-7,rayEpsilon*.25)||candidate>=distance)continue;
    vec3 point=origin+direction*candidate;
    vec2 local=(point.xz-modelCenter.xz)/radii;
    if(dot(local,local)>1.00001)continue;
    distance=candidate;
    vec2 slope=2.*amplitude*local/radii;
    normal=upper?normalize(vec3(slope.x,1.,slope.y)):normalize(vec3(-slope.x,-1.,-slope.y));
    found=true;
  }
  return found;
}

bool analyticCurvedHit(vec3 origin,vec3 direction,out float distance,out vec3 normal){
  // The common cabochon profile uses curvature 2 and therefore has an exact
  // quadratic intersection. It bypasses the tessellated support mesh entirely.
  if(curvedSurfaceProfile.w<.5||abs(curvedSurfaceProfile.z-2.)>.0001)return false;
  distance=1e20;normal=vec3(0.,1.,0.);bool found=false;
  float candidate;vec3 candidateNormal;
  if(analyticProfileHit(origin,direction,curvedSurfaceHeights.x,curvedSurfaceHeights.y,true,candidate,candidateNormal)&&candidate<distance){distance=candidate;normal=candidateNormal;found=true;}
  vec2 radii=max(curvedSurfaceProfile.xy,vec2(1e-6));
  vec2 localOrigin=(origin.xz-modelCenter.xz)/radii;
  vec2 localDirection=direction.xz/radii;
  float qa=dot(localDirection,localDirection),qb=2.*dot(localOrigin,localDirection),qc=dot(localOrigin,localOrigin)-1.;
  float discriminant=qb*qb-4.*qa*qc;
  if(qa>1e-12&&discriminant>=0.){
    float root=sqrt(max(0.,discriminant));
    float cylinderCandidates[2];cylinderCandidates[0]=(-qb-root)/(2.*qa);cylinderCandidates[1]=(-qb+root)/(2.*qa);
    for(int index=0;index<2;index++){
      float cylinderDistance=cylinderCandidates[index];
      if(cylinderDistance<=max(1e-7,rayEpsilon*.25)||cylinderDistance>=distance)continue;
      vec3 point=origin+direction*cylinderDistance;
      if(point.y<-curvedSurfaceHeights.x-1e-5||point.y>curvedSurfaceHeights.x+1e-5)continue;
      vec2 local=(point.xz-modelCenter.xz)/radii;
      distance=cylinderDistance;normal=normalize(vec3(local.x/radii.x,0.,local.y/radii.y));found=true;
    }
  }
  if(curvedSurfaceHeights.w<.5){
    if(abs(direction.y)>1e-9){
      float planeDistance=(-curvedSurfaceHeights.x-origin.y)/direction.y;
      if(planeDistance>max(1e-7,rayEpsilon*.25)&&planeDistance<distance){
        vec3 point=origin+direction*planeDistance;
        vec2 local=(point.xz-modelCenter.xz)/radii;
        if(dot(local,local)<=1.00001){distance=planeDistance;normal=vec3(0.,-1.,0.);found=true;}
      }
    }
  }else{
    float lowerAmplitude=curvedSurfaceHeights.w<1.5?-curvedSurfaceHeights.z:curvedSurfaceHeights.z;
    if(analyticProfileHit(origin,direction,-curvedSurfaceHeights.x,lowerAmplitude,false,candidate,candidateNormal)&&candidate<distance){distance=candidate;normal=candidateNormal;found=true;}
  }
  return found;
}

bool intersectBounds(vec3 origin,vec3 inverseDirection,vec3 minimum,vec3 maximum,float maximumDistance){
  vec3 first=(minimum-origin)*inverseDirection,second=(maximum-origin)*inverseDirection;
  vec3 nearValue=min(first,second),farValue=max(first,second);
  float nearDistance=max(max(nearValue.x,nearValue.y),max(nearValue.z,0.));
  float farDistance=min(farValue.x,min(farValue.y,farValue.z));
  return farDistance>=nearDistance&&nearDistance<maximumDistance;
}

bool nearestHit(vec3 origin,vec3 direction,out float hitT,out vec3 hitNormal,out vec3 hitColor,out float hitRoughness){
  hitT=1e20;hitNormal=vec3(0.,1.,0.);hitColor=vec3(1.);hitRoughness=0.;bool found=false;
  float curvedDistance;vec3 curvedNormal;
  if(analyticCurvedHit(origin,direction,curvedDistance,curvedNormal)){
    hitT=curvedDistance;hitNormal=curvedNormal;hitColor=bodyColor;found=true;
  }
  vec3 inverseDirection=1./vec3(abs(direction.x)<1e-8?(direction.x<0.?-1e-8:1e-8):direction.x,abs(direction.y)<1e-8?(direction.y<0.?-1e-8:1e-8):direction.y,abs(direction.z)<1e-8?(direction.z<0.?-1e-8:1e-8):direction.z);
  int stack[MAX_BVH_STACK];int stackSize=1;stack[0]=0;
  for(int step=0;step<MAX_BVH_STEPS;step++){
    if(stackSize<=0)break;
    int node=stack[--stackSize];
    vec4 minimumData=bvhTexel(node,0),maximumData=bvhTexel(node,1);
    if(!intersectBounds(origin,inverseDirection,minimumData.xyz,maximumData.xyz,hitT))continue;
    if(minimumData.w<0.){
      int first=int(-minimumData.w)-1,count=int(maximumData.w+.5);
      for(int offset=0;offset<${ae};offset++){
        if(offset>=count)break;
        int triangle=first+offset;
        vec3 a=triangleTexel(triangle,0).xyz,b=triangleTexel(triangle,1).xyz,c=triangleTexel(triangle,2).xyz;
        float distance;
        if(intersectTriangle(origin,direction,a,b,c,distance)){
          vec4 normalAndRoughness=triangleTexel(triangle,3);
          int surfaceKind=int(triangleTexel(triangle,4).w+.5);
          if(curvedSurfaceProfile.w>.5&&surfaceKind>0)continue;
          distance=refineCurvedDistance(origin,direction,distance,surfaceKind,a,b,c);
          if(distance>=hitT)continue;
          hitT=distance;hitNormal=normalize(normalAndRoughness.xyz);hitRoughness=normalAndRoughness.w;
          if(hitRoughness<-1.5){
            // Continuous curved surfaces keep the triangle only for ray
            // intersection. Their optical normal is interpolated from the
            // analytic vertex normals, so the support mesh is not rendered as
            // a collection of artificial triangular facets.
            vec3 hitPoint=origin+direction*distance;
            vec3 edge0=b-a,edge1=c-a,relative=hitPoint-a;
            float d00=dot(edge0,edge0),d01=dot(edge0,edge1),d11=dot(edge1,edge1);
            float d20=dot(relative,edge0),d21=dot(relative,edge1);
            float denominator=max(1e-12,d00*d11-d01*d01);
            float v=(d11*d20-d01*d21)/denominator,w=(d00*d21-d01*d20)/denominator,u=1.-v-w;
            vec3 smoothNormal=normalize(
              triangleTexel(triangle,5).xyz*u+
              triangleTexel(triangle,6).xyz*v+
              triangleTexel(triangle,7).xyz*w
            );
            if(dot(smoothNormal,hitNormal)<0.)smoothNormal=-smoothNormal;
            hitNormal=smoothNormal;
            hitRoughness=max(0.,-hitRoughness-2.);
          }else if(hitRoughness<-.5){
            // The BVH intersects a dense hidden support mesh, but a polished
            // round/elliptical girdle must reflect from a continuous surface.
            // The gradient of x²/a²+z²/b²=1 supplies that analytic normal.
            vec3 hitPoint=origin+direction*distance;
            vec2 safeRadius=max(modelExtent.xz,vec2(1e-5));
            vec3 curvedNormal=normalize(vec3(
              (hitPoint.x-modelCenter.x)/(safeRadius.x*safeRadius.x),
              0.,
              (hitPoint.z-modelCenter.z)/(safeRadius.y*safeRadius.y)
            ));
            if(dot(curvedNormal,hitNormal)<0.)curvedNormal=-curvedNormal;
            hitNormal=curvedNormal;
            hitRoughness=max(0.,-hitRoughness-1.);
          }
          hitNormal=analyticCurvedNormal(origin+direction*distance,surfaceKind,hitNormal);
          hitColor=triangleTexel(triangle,4).rgb;found=true;
        }
      }
    }else if(stackSize<=MAX_BVH_STACK-2){
      stack[stackSize++]=int(maximumData.w+.5);
      stack[stackSize++]=int(minimumData.w+.5);
    }
  }
  return found;
}

float hash(float value){return fract(sin(value*91.3458+17.17)*47453.5453);}
float materialNoise(vec3 position,float scale){
  vec3 extent=max(modelExtent,vec3(1e-5));
  vec3 p=(position-modelCenter)/extent*max(1.,scale);
  float broad=sin(dot(p,vec3(.83,1.37,1.91))+sin(dot(p,vec3(1.73,-.61,.47))));
  float fine=sin(dot(p,vec3(-2.11,.79,1.29))*1.7+1.9);
  // Thin, spatially stable density ridges approximate healed fissures and
  // jardin without drawing a camera-facing texture over the gemstone.
  float ridgeField=abs(sin(dot(p,vec3(.47,1.00,-.31))+.38*sin(dot(p,vec3(1.13,-.42,.79)))));
  float ridge=1.-smoothstep(.035,.16,ridgeField);
  return clamp(.38+.24*broad+.14*fine+.72*ridge,0.,1.45);
}
vec3 texturedSurfaceNormal(vec3 normal,vec3 position){
  if(surfaceTextureStrength<1e-6)return normal;
  vec3 helper=abs(normal.y)<.95?vec3(0.,1.,0.):vec3(1.,0.,0.);
  vec3 tangent=normalize(cross(helper,normal));
  vec3 bitangent=cross(normal,tangent);
  vec3 extent=max(modelExtent,vec3(1e-5));
  vec3 p=(position-modelCenter)/extent*max(1.,surfaceTextureScale);
  float lineA=sin(dot(p,vec3(1.0,.37,.19))*3.1+sin(dot(p,vec3(.13,1.0,.51))));
  float lineB=sin(dot(p,vec3(-.29,.41,1.0))*4.7+1.3);
  return normalize(normal+surfaceTextureStrength*(lineA*tangent+lineB*bitangent));
}
vec3 roughNormal(vec3 normal,float roughness,float seed){
  if(roughness<.005)return normal;
  // Sample a GGX-like microfacet slope. Varying it with sampleIndex lets the
  // progressive renderer converge polished, fine-polished and frosted facets
  // instead of baking one arbitrary normal perturbation into every pixel.
  float u1=clamp(hash(seed+sampleIndex*17.71),.001,.999);
  float u2=hash(seed+sampleIndex*31.37+11.7);
  float alpha=max(.0001,roughness*roughness);
  float slope=min(3.,alpha*sqrt(u1/max(.001,1.-u1)));
  float phi=6.28318530718*u2;
  vec3 helper=abs(normal.y)<.95?vec3(0.,1.,0.):vec3(1.,0.,0.);
  vec3 tangent=normalize(cross(helper,normal));
  vec3 bitangent=cross(normal,tangent);
  return normalize(normal+slope*(cos(phi)*tangent+sin(phi)*bitangent));
}

float henyeyGreenstein(float cosineAngle,float g){
  float safeG=clamp(g,-.75,.75);
  float denominator=max(.02,1.+safeG*safeG-2.*safeG*clamp(cosineAngle,-1.,1.));
  return (1.-safeG*safeG)/pow(denominator,1.5);
}

vec3 crystalDirection(vec3 direction){
  vec3 axisZ=normalize(opticAxis);
  vec3 helper=abs(axisZ.y)<.95?vec3(0.,1.,0.):vec3(1.,0.,0.);
  vec3 axisX=normalize(cross(helper,axisZ)),axisY=cross(axisZ,axisX);
  float cosine=cos(opticAxisRoll),sine=sin(opticAxisRoll);
  vec3 rotatedX=cosine*axisX+sine*axisY,rotatedY=-sine*axisX+cosine*axisY;
  vec3 unitDirection=normalize(direction);
  return vec3(dot(unitDirection,rotatedX),dot(unitDirection,rotatedY),dot(unitDirection,axisZ));
}

float sellmeierFromCoefficients(vec3 coefficientsB,vec3 coefficientsC,float wavelengthNm){
  float wavelengthUm=wavelengthNm/1000.,squared=wavelengthUm*wavelengthUm;
  vec3 terms=coefficientsB*squared/(vec3(squared)-coefficientsC);
  return sqrt(max(1.002001,1.+terms.x+terms.y+terms.z));
}

vec3 spectralPrincipalIors(float centerIor,float wavelengthNm){
  if(anisotropicDispersionModelType==2){
    float position=clamp((wavelengthNm-407.5)/15.,0.,23.);
    int lower=int(floor(position)),upper=min(23,lower+1);
    float ratio=fract(position);
    float ordinary=mix(principalSpectrumOrdinary[lower],principalSpectrumOrdinary[upper],ratio);
    float extraordinary=mix(principalSpectrumExtraordinary[lower],principalSpectrumExtraordinary[upper],ratio);
    return max(vec3(1.001),vec3(ordinary,ordinary,extraordinary));
  }
  if(anisotropicDispersionModelType!=1)return max(vec3(1.001),vec3(centerIor)+principalIorOffsets);
  float ordinary=sellmeierFromCoefficients(sellmeierB,sellmeierC,wavelengthNm);
  float extraordinary=sellmeierFromCoefficients(sellmeierExtraB,sellmeierExtraC,wavelengthNm);
  float ordinaryD=sellmeierFromCoefficients(sellmeierB,sellmeierC,589.29);
  float extraordinaryD=sellmeierFromCoefficients(sellmeierExtraB,sellmeierExtraC,589.29);
  float center=(2.*ordinary+extraordinary)/3.+ior-(2.*ordinaryD+extraordinaryD)/3.;
  float measuredDeltaD=extraordinaryD-ordinaryD;
  float signedDelta=abs(measuredDeltaD)>1e-8?(extraordinary-ordinary)*birefringence/abs(measuredDeltaD):0.;
  return max(vec3(1.001),vec3(center-signedDelta/3.,center-signedDelta/3.,center+2.*signedDelta/3.));
}

vec2 anisotropicModeIors(float centerIor,vec3 direction,float wavelengthNm){
  if(opticalClassType==0||birefringence<.0001)return vec2(centerIor);
  vec3 localDirection=crystalDirection(direction);
  vec3 helper=abs(localDirection.z)<.9?vec3(0.,0.,1.):vec3(0.,1.,0.);
  vec3 basisU=normalize(cross(localDirection,helper)),basisV=cross(localDirection,basisU);
  vec3 principal=spectralPrincipalIors(centerIor,wavelengthNm);
  vec3 impermeability=1./(principal*principal);
  float a=dot(basisU*basisU,impermeability),c=dot(basisV*basisV,impermeability),offDiagonal=dot(basisU*basisV,impermeability);
  float root=sqrt(max(0.,(a-c)*(a-c)+4.*offDiagonal*offDiagonal));
  float lambdaLow=max(1e-8,(a+c-root)*.5),lambdaHigh=max(1e-8,(a+c+root)*.5);
  return vec2(1./sqrt(lambdaHigh),1./sqrt(lambdaLow));
}

float cauchyIor(float dLineIor,float fMinusCDispersion,float wavelengthNm){
  const float blueLine=430.8,dLine=589.29,redLine=686.7;
  float inverseF=1./(blueLine*blueLine),inverseC=1./(redLine*redLine);
  float coefficientB=max(0.,fMinusCDispersion)/max(1e-9,inverseF-inverseC);
  float coefficientA=dLineIor-coefficientB/(dLine*dLine);
  return max(1.001,coefficientA+coefficientB/(wavelengthNm*wavelengthNm));
}

float sellmeierIor(float wavelengthNm){
  return sellmeierFromCoefficients(sellmeierB,sellmeierC,wavelengthNm);
}

float spectralIor(float wavelengthNm){
  if(dispersionModelType==1)return max(1.001,sellmeierIor(wavelengthNm)+ior-sellmeierIor(589.29));
  if(dispersionModelType==2){
    vec3 principal=spectralPrincipalIors(ior,wavelengthNm);
    return (principal.x+principal.y+principal.z)/3.;
  }
  return cauchyIor(ior,dispersion,wavelengthNm);
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
  ),vec3(0.))*vec3(${$e.join(",")});
}

// Smooth CIE 1931 approximation (asymmetric Gaussian lobes) lets the final
// renderer use denser wavelength strata without repeating twelve colour bins.
float cieLobe(float wavelengthNm,float center,float leftWidth,float rightWidth){
  float width=wavelengthNm<center?leftWidth:rightWidth;
  float t=(wavelengthNm-center)*width;
  return exp(-.5*t*t);
}
vec3 cie1931(float wavelengthNm){
  float x=1.056*cieLobe(wavelengthNm,599.8,.0264,.0323)+.362*cieLobe(wavelengthNm,442.,.0624,.0374)-.065*cieLobe(wavelengthNm,501.1,.0490,.0382);
  float y=.821*cieLobe(wavelengthNm,568.8,.0213,.0247)+.286*cieLobe(wavelengthNm,530.9,.0613,.0322);
  float z=1.217*cieLobe(wavelengthNm,437.,.0847,.0278)+.681*cieLobe(wavelengthNm,459.,.0385,.0725);
  return max(vec3(x,y,z),vec3(0.));
}

float d65RelativePower(float wavelengthNm){
  if(wavelengthNm<=420.)return .93431;
  if(wavelengthNm<=450.)return mix(.93431,1.17008,(wavelengthNm-420.)/30.);
  if(wavelengthNm<=480.)return mix(1.17008,1.15923,(wavelengthNm-450.)/30.);
  if(wavelengthNm<=510.)return mix(1.15923,1.09354,(wavelengthNm-480.)/30.);
  if(wavelengthNm<=540.)return mix(1.09354,1.04046,(wavelengthNm-510.)/30.);
  if(wavelengthNm<=570.)return mix(1.04046,.963342,(wavelengthNm-540.)/30.);
  if(wavelengthNm<=600.)return mix(.963342,.900062,(wavelengthNm-570.)/30.);
  if(wavelengthNm<=630.)return mix(.900062,.832904,(wavelengthNm-600.)/30.);
  if(wavelengthNm<=660.)return mix(.832904,.800268,(wavelengthNm-630.)/30.);
  if(wavelengthNm<=690.)return mix(.800268,.716609,(wavelengthNm-660.)/30.);
  if(wavelengthNm<=720.)return mix(.716609,.698856,(wavelengthNm-690.)/30.);
  if(wavelengthNm<=750.)return mix(.698856,.635927,(wavelengthNm-720.)/30.);
  return .635927;
}

float rgbSpectralIntensity(vec3 color,float wavelengthNm){
  color=max(color,vec3(0.));
  if(wavelengthNm<=480.)return mix(color.b,color.g,clamp((wavelengthNm-440.)/40.,0.,1.));
  if(wavelengthNm<=570.)return color.g;
  return mix(color.g,color.r,clamp((wavelengthNm-570.)/80.,0.,1.));
}

vec3 xyzToLinearSrgb(vec3 xyz){
  return vec3(
    3.2406*xyz.x-1.5372*xyz.y-.4986*xyz.z,
    -.9689*xyz.x+1.8758*xyz.y+.0415*xyz.z,
    .0557*xyz.x-.2040*xyz.y+1.0570*xyz.z
  );
}

vec2 fresnelSp(float cosineIncident,float n1,float n2){
  float ci=clamp(abs(cosineIncident),0.,1.);float ratio=n1/n2;
  float st2=ratio*ratio*max(0.,1.-ci*ci);if(st2>=1.)return vec2(1.);
  float ct=sqrt(max(0.,1.-st2));
  float parallel=((n2*ci)-(n1*ct))/max(1e-6,(n2*ci)+(n1*ct));
  float perpendicular=((n1*ci)-(n2*ct))/max(1e-6,(n1*ci)+(n2*ct));
  return clamp(vec2(perpendicular*perpendicular,parallel*parallel),0.,1.);
}

float fresnel(float cosineIncident,float n1,float n2){
  vec2 components=fresnelSp(cosineIncident,n1,n2);
  return .5*(components.x+components.y);
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

float defectPathLength(vec3 origin,vec3 direction,float maximumDistance,vec4 packedDefect){
  float radius=abs(packedDefect.w);
  if(radius<1e-5)return 0.;
  float yScale=packedDefect.w<0.?.18:1.;
  vec3 scale=vec3(radius,radius*yScale,radius);
  vec3 localOrigin=(origin-packedDefect.xyz)/scale;
  vec3 localDirection=direction/scale;
  float a=dot(localDirection,localDirection);
  float b=dot(localOrigin,localDirection);
  float c=dot(localOrigin,localOrigin)-1.;
  float discriminant=b*b-a*c;
  if(discriminant<=0.)return 0.;
  float root=sqrt(discriminant);
  float nearDistance=(-b-root)/a,farDistance=(-b+root)/a;
  return max(0.,min(maximumDistance,farDistance)-max(0.,nearDistance));
}

void sampleDefects(vec3 origin,vec3 direction,float maximumDistance,out float opticalDepth,out vec3 scatterTint){
  opticalDepth=0.;scatterTint=vec3(0.);
  for(int index=0;index<16;index++){
    if(index>=defectCount)break;
    float path=defectPathLength(origin,direction,maximumDistance,defectData[index]);
    float localDepth=path*(defectData[index].w<0.?4.2:1.65)*clamp(defectOptics[index].w,.03,1.);
    opticalDepth+=localDepth;
    scatterTint+=defectOptics[index].rgb*localDepth;
  }
  scatterTint=opticalDepth>.00001?scatterTint/opticalDepth:vec3(1.);
}

float sampledAbsorptionCurve(float wavelengthNm,bool extraordinary){
  float position=clamp((wavelengthNm-407.5)/15.,0.,23.);
  int lowerIndex=int(floor(position));
  int upperIndex=min(23,lowerIndex+1);
  float lower=extraordinary?absorptionSpectrumExtraordinary[lowerIndex]:absorptionSpectrumOrdinary[lowerIndex];
  float upper=extraordinary?absorptionSpectrumExtraordinary[upperIndex]:absorptionSpectrumOrdinary[upperIndex];
  return mix(lower,upper,fract(position));
}

float directionalModeAbsorption(float wavelengthNm,float modeSelector,vec3 direction){
  float ordinary=sampledAbsorptionCurve(wavelengthNm,false);
  if(opticalClassType==0||birefringence<.0001)return ordinary;
  float extraordinary=sampledAbsorptionCurve(wavelengthNm,true);
  // The extraordinary electric field approaches the optic axis when the ray
  // travels across it and becomes degenerate with the ordinary response when
  // the ray travels along it. This first-order dichroic model makes crystal
  // orientation affect body colour without requiring a full Mueller solver.
  float transverse=1.-pow(clamp(abs(dot(normalize(direction),normalize(opticAxis))),0.,1.),2.);
  float effectiveExtraordinary=mix(ordinary,extraordinary,transverse);
  return mix(ordinary,effectiveExtraordinary,modeSelector);
}

vec3 traceGem(vec3 origin,vec3 direction,float baseIor,float modeSelector,float channelSeed,float wavelengthNm){
  float entryT,entryRoughness;vec3 entryNormal,entryColor;
  if(!nearestHit(origin,direction,entryT,entryNormal,entryColor,entryRoughness))return vec3(-1.);
  if(dot(direction,entryNormal)>0.)entryNormal=-entryNormal;
  vec3 entry=origin+direction*entryT;
  vec3 entryGeometricNormal=entryNormal;
  entryNormal=texturedSurfaceNormal(entryNormal,entry);
  entryNormal=roughNormal(entryNormal,entryRoughness,gl_FragCoord.x+gl_FragCoord.y*1.91+channelSeed);
  if(dot(direction,entryNormal)>=-1e-5)entryNormal=entryGeometricNormal;
  vec2 entryModes=anisotropicModeIors(baseIor,direction,wavelengthNm);
  float materialIor=mix(entryModes.x,entryModes.y,modeSelector);
  vec2 entryFresnelSp=fresnelSp(dot(-direction,entryNormal),1.,materialIor);
  float entryFresnel=.5*(entryFresnelSp.x+entryFresnelSp.y);
  vec3 entryTint=mix(vec3(1.),entryColor,appearanceStrength*.6);
  vec3 radiance=environmentLight(reflect(direction,entryNormal))*entryFresnel*entryTint;
  vec3 insideDirection=refract(direction,entryNormal,1./materialIor);
  if(dot(insideDirection,insideDirection)<1e-7)return radiance;
  vec2 throughputSp=.5*(vec2(1.)-entryFresnelSp);vec3 insideOrigin=entry+insideDirection*rayEpsilon;
  for(int bounce=0;bounce<12;bounce++){
    if(bounce>=maxBounces)break;
    float boundaryT,boundaryRoughness;vec3 boundaryNormal,boundaryColor;
    if(!nearestHit(insideOrigin,insideDirection,boundaryT,boundaryNormal,boundaryColor,boundaryRoughness))break;
    vec3 boundary=insideOrigin+insideDirection*boundaryT;
    float defectDepth;vec3 defectTint;
    sampleDefects(insideOrigin,insideDirection,boundaryT,defectDepth,defectTint);
    float channelAbsorption=directionalModeAbsorption(wavelengthNm,modeSelector,insideDirection);
    vec3 pathMidpoint=(insideOrigin+boundary)*.5;
    float volumePattern=materialNoise(pathMidpoint,volumeTextureScale);
    float pathAbsorption=absorptionAt(pathMidpoint,wavelengthNm,channelAbsorption)*mix(1.,.90+.20*volumePattern,volumeTextureStrength);
    float pathLengthMm=boundaryT*millimetersPerUnit;
    float pathTransmission=exp(-pathAbsorption*pathLengthMm);
    float texturedHaze=volumeHaze*mix(1.,.45+1.10*volumePattern,volumeTextureStrength);
    float volumeTransmission=exp(-texturedHaze*boundaryT-defectDepth);
    float scatterEnergy=.5*(throughputSp.x+throughputSp.y)*(1.-volumeTransmission);
    vec3 scatterColor=defectDepth>.001?mix(vec3(1.),defectTint,.78):vec3(1.);
    float forwardPhase=henyeyGreenstein(1.,volumePhaseG);
    float backwardPhase=henyeyGreenstein(-1.,volumePhaseG);
    vec3 scatterIllumination=(environmentLight(insideDirection)*forwardPhase+environmentLight(-insideDirection)*backwardPhase)/max(.001,forwardPhase+backwardPhase);
    // Natural-gem haze is a weak directional volume contribution rather than
    // an unbounded white glow. The return half-path preserves body colour.
    vec3 volumeTint=mix(vec3(1.),bodyColor,.16);
    radiance+=scatterColor*volumeTint*scatterIllumination*scatterEnergy*sqrt(pathTransmission)*volumeScatterAlbedo*mix(.18,.34,step(.001,defectDepth));
    throughputSp*=volumeTransmission*pathTransmission;
    if(dot(insideDirection,boundaryNormal)<0.)boundaryNormal=-boundaryNormal;
    vec3 boundaryGeometricNormal=boundaryNormal;
    boundaryNormal=texturedSurfaceNormal(boundaryNormal,boundary);
    boundaryNormal=roughNormal(boundaryNormal,boundaryRoughness,gl_FragCoord.x*1.37+gl_FragCoord.y+float(bounce)*37.1+channelSeed);
    if(dot(insideDirection,boundaryNormal)<=1e-5)boundaryNormal=boundaryGeometricNormal;
    vec2 boundaryModes=anisotropicModeIors(baseIor,insideDirection,wavelengthNm);
    float localIor=mix(boundaryModes.x,boundaryModes.y,modeSelector);
    vec2 reflectedSp=fresnelSp(dot(insideDirection,boundaryNormal),localIor,1.);
    vec3 exitDirection=refract(insideDirection,-boundaryNormal,localIor);
    vec3 surfaceTint=mix(vec3(1.),boundaryColor,appearanceStrength*.6);
    if(dot(exitDirection,exitDirection)>1e-7)radiance+=dot(throughputSp,vec2(1.)-reflectedSp)*environmentLight(exitDirection)*surfaceTint;
    throughputSp*=reflectedSp;
    if(throughputSp.x+throughputSp.y<.002)break;
    insideDirection=reflect(insideDirection,boundaryNormal);insideOrigin=boundary+insideDirection*rayEpsilon;
  }
  return radiance;
}

vec3 tracePolarized(vec3 origin,vec3 direction,float materialIor,float channelSeed,float wavelengthNm){
  if(opticalClassType==0||birefringence<.0001)return traceGem(origin,direction,materialIor,0.,channelSeed,wavelengthNm);
  if(spectralSamples<5)return traceGem(origin,direction,materialIor,.5,channelSeed+31.,wavelengthNm);
  vec3 firstMode=traceGem(origin,direction,materialIor,0.,channelSeed,wavelengthNm);
  vec3 secondMode=traceGem(origin,direction,materialIor,1.,channelSeed+61.,wavelengthNm);
  return mix(firstMode,secondMode,.5);
}

vec3 traceAset(vec3 origin,vec3 direction,float materialIor){
  float entryT,entryRoughness;vec3 entryNormal,entryColor;
  if(!nearestHit(origin,direction,entryT,entryNormal,entryColor,entryRoughness))return vec3(-1.);
  if(dot(direction,entryNormal)>0.)entryNormal=-entryNormal;
  vec3 entry=origin+direction*entryT;
  vec3 insideDirection=refract(direction,entryNormal,1./materialIor);
  if(dot(insideDirection,insideDirection)<1e-7)return environmentLight(reflect(direction,entryNormal));
  vec3 insideOrigin=entry+insideDirection*rayEpsilon;
  for(int bounce=0;bounce<12;bounce++){
    if(bounce>=maxBounces)break;
    float boundaryT,boundaryRoughness;vec3 boundaryNormal,boundaryColor;
    if(!nearestHit(insideOrigin,insideDirection,boundaryT,boundaryNormal,boundaryColor,boundaryRoughness))break;
    vec3 boundary=insideOrigin+insideDirection*boundaryT;
    if(dot(insideDirection,boundaryNormal)<0.)boundaryNormal=-boundaryNormal;
    vec3 exitDirection=refract(insideDirection,-boundaryNormal,materialIor);
    if(dot(exitDirection,exitDirection)>1e-7)return environmentLight(exitDirection);
    insideDirection=reflect(insideDirection,boundaryNormal);
    insideOrigin=boundary+insideDirection*rayEpsilon;
  }
  return vec3(.15)*environmentIntensity;
}

vec3 linearToSrgb(vec3 color){
  color=max(color,vec3(0.));
  vec3 low=12.92*color;
  vec3 high=1.055*pow(color,vec3(1./2.4))-.055;
  return mix(low,high,step(vec3(.0031308),color));
}

vec3 srgbToLinear(vec3 color){
  color=clamp(color,0.,1.);
  vec3 low=color/12.92;
  vec3 high=pow((color+.055)/1.055,vec3(2.4));
  return mix(low,high,step(vec3(.04045),color));
}

vec3 toneMapDisplay(vec3 color){
  color=max(color,vec3(0.));
  color=clamp((color*(2.51*color+.03))/(color*(2.43*color+.59)+.14),0.,1.);
  return linearToSrgb(color);
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
  vec2 pixelUv=(gl_FragCoord.xy+pixelJitter)/resolution;
  bool useSecond=inspectionSplit==1&&pixelUv.x>=.5;
  vec2 localUv=pixelUv;
  if(inspectionSplit==1)localUv.x=fract(pixelUv.x*2.);
  vec2 screen=(localUv-.5)*2.;screen.x*=(resolution.x*(inspectionSplit == 1 ? .5 : 1.))/max(1.,resolution.y);
  vec3 rayOrigin=useSecond?cameraPositionB:cameraPosition;
  vec3 rayForward=useSecond?cameraForwardB:cameraForward;
  vec3 rayRight=useSecond?cameraRightB:cameraRight;
  vec3 rayUp=useSecond?cameraUpB:cameraUp;
  vec3 direction=normalize(rayForward+rayRight*screen.x*.16+rayUp*screen.y*.16);
  if(cameraProjection==1||environmentPreset==4||environmentPreset==5){
    // H&A and ASET are axial diagnostic views, not close-up perspective views.
    // The ASET reference geometry places the observer 250 mm from the table; at
    // gemstone scale this is effectively a parallel/telecentric projection.
    float frameRadius=max(modelExtent.x,max(modelExtent.y,modelExtent.z))*(environmentPreset==4||environmentPreset==5?1.08:1.18);
    float observerDistance=max(8.,length(rayOrigin-modelCenter));
    rayOrigin=modelCenter-rayForward*observerDistance+rayRight*screen.x*frameRadius+rayUp*screen.y*frameRadius;
    direction=rayForward;
  }
  if(environmentPreset==5){
    vec3 aset=traceAset(rayOrigin,direction,spectralIor(550.));
    if(aset.r<0.){
      float vignette=1.-smoothstep(.35,1.45,length(screen))*.08;
      outColor=vec4(accumulateSample(srgbToLinear(backgroundColor)*vignette),1.);return;
    }
    outColor=vec4(accumulateSample(aset),1.);return;
  }
  if(spectralSamples>=12){
    float strata=float(spectralSamples);
    float wavelengthNm=400.+360.*((mod(sampleIndex,strata)+.5)/strata);
    vec3 spectralRadiance=tracePolarized(rayOrigin,direction,spectralIor(wavelengthNm),23.7,wavelengthNm);
    if(spectralRadiance.r<0.){
      float vignette=1.-smoothstep(.35,1.45,length(screen))*.08;
      outColor=vec4(accumulateSample(srgbToLinear(backgroundColor)*vignette),1.);return;
    }
    float intensity=rgbSpectralIntensity(spectralRadiance,wavelengthNm);
    vec3 xyz=intensity*d65RelativePower(wavelengthNm)*cie1931(wavelengthNm);
    vec3 spectralWhiteBalance=spectralSamples>=36
      ?vec3(${te[36].join(",")})
      :spectralSamples>=24
        ?vec3(${te[24].join(",")})
        :vec3(${te[12].join(",")});
    vec3 color=xyzToLinearSrgb(xyz)*spectralWhiteBalance*exp2(exposure);
    outColor=vec4(accumulateSample(color),1.);return;
  }
  float redIor=spectralIor(650.),blueIor=spectralIor(460.);
  vec3 red=tracePolarized(rayOrigin,direction,redIor,3.1,650.);
  if(red.r<0.){
    float vignette=1.-smoothstep(.35,1.45,length(screen))*.08;
    outColor=vec4(accumulateSample(srgbToLinear(backgroundColor)*vignette),1.);return;
  }
  vec3 green=tracePolarized(rayOrigin,direction,spectralIor(550.),17.9,550.),blue=tracePolarized(rayOrigin,direction,blueIor,41.3,460.);
  vec3 color;
  if(spectralSamples>=5){
    vec3 amber=tracePolarized(rayOrigin,direction,spectralIor(600.),9.7,600.);
    vec3 cyan=tracePolarized(rayOrigin,direction,spectralIor(500.),29.5,500.);
    color=cieD65ToLinearSrgb(blue,cyan,green,amber,red);
  }else color=vec3(red.r,green.g,blue.b);
  color*=exp2(exposure);
  outColor=vec4(accumulateSample(color),1.);
}`,sr=De,rr=`#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 uv;
out vec4 outColor;
uniform sampler2D image;
uniform int linearInput;
vec3 linearToSrgb(vec3 color){
  color=max(color,vec3(0.));
  vec3 low=12.92*color;
  vec3 high=1.055*pow(color,vec3(1./2.4))-.055;
  return mix(low,high,step(vec3(.0031308),color));
}
void main(){
  vec3 color=texture(image,uv).rgb;
  if(linearInput==1){
    color=max(color,vec3(0.));
    color=clamp((color*(2.51*color+.03))/(color*(2.43*color+.59)+.14),0.,1.);
    color=linearToSrgb(color);
  }
  outColor=vec4(color,1.);
}`,P=r=>{const i=Math.hypot(...r)||1;return r.map(e=>e/i)},ie=(r,i)=>[r[1]*i[2]-r[2]*i[1],r[2]*i[0]-r[0]*i[2],r[0]*i[1]-r[1]*i[0]],ye=(r,i)=>r.map((e,o)=>e-i[o]);function be(r={}){const i=Number.isFinite(r.yaw)?r.yaw:.68,e=Number.isFinite(r.pitch)?r.pitch:.62,o=Number.isFinite(r.distance)?r.distance:8.6,n=[Math.sin(i)*Math.cos(e)*o,Math.sin(e)*o,Math.cos(i)*Math.cos(e)*o],l=P(n.map(c=>-c)),h=Math.abs(l[1])>.999?[0,0,-1]:[0,1,0],s=P(ie(l,h)),m=P(ie(s,l));return{position:n,forward:l,right:s,up:m}}const M=r=>{const i=/^#[0-9a-f]{6}$/i.test(r||"")?r:"#ffffff";return[1,3,5].map(e=>parseInt(i.slice(e,e+2),16)/255)},we=Object.freeze({polished:.006,"fine-polish":.035,frosted:.45});function tr(r,i){const e=r.tier?.id,o=r.facetIndex,n=i.facetFinishes?.[e]?.[o]||i.tierFinishes?.[e]||"polished",l=i.facetColors?.[e]?.[o]||i.tierColors?.[e],h=i.showAppearance?l||i.gemColor:"#ffffff",s=we[n]??we.polished,m=Math.max(0,Math.min(.2,Number(i.materialSurfaceRoughness)||0)),c=Math.min(.6,Math.hypot(s,m));return{color:M(h),roughness:c}}function mr(r,i=je){if(!r?.facets?.length)throw new Error("没有可追踪的宝石刻面");if(r.facets.length>i)throw new Error(`当前光学预览最多支持 ${i} 个有效平面`);const e=new Float32Array(i*4);return r.facets.forEach((o,n)=>e.set([...P(o.n),o.d],n*4)),{packed:e,count:r.facets.length}}function Ne(r,i={}){if(!r?.facets?.length)throw new Error("没有可追踪的宝石刻面");const e=[];if(r.facets.forEach((o,n)=>{if(!o.points?.length||o.points.length<3)return;const l=tr(o,i),h=o.curvedSurface?o.tier?.id==="curved-girdle"?1:o.tier?.id==="curved-top"?2:o.tier?.id==="curved-bottom"?r.curvedSurface?.style==="single-convex"?4:3:0:0,s=r.design?.girdleStyle==="smooth"&&(o.tier?.code==="G"||Math.abs(Math.abs(o.angle||o.tier?.angle||0)-90)<.05);for(let m=1;m<o.points.length-1;m+=1){const c=o.points[0],u=o.points[m],d=o.points[m+1],f=P(o.n?.length===3?o.n:ie(ye(u,c),ye(d,c))),w=!!(o.curvedSurface&&o.vertexNormals?.length===o.points.length),N=w?[o.vertexNormals[0],o.vertexNormals[m],o.vertexNormals[m+1]].map(a=>P(a)):[f,f,f];e.push({a:c,b:u,c:d,normal:f,vertexNormals:N,smoothSurface:w,surfaceKind:h||(s?1:0),facetId:n,curvedGirdle:s,...l})}}),!e.length)throw new Error("没有可追踪的宝石三角面");return e}function ze(r){const i=new Float32Array(W*4*r.length);return r.forEach((e,o)=>{const n=o*W*4;i.set([...e.a,e.facetId],n),i.set([...e.b,0],n+4),i.set([...e.c,0],n+8);const l=e.smoothSurface?-(2+e.roughness):e.curvedGirdle?-(1+e.roughness):e.roughness;i.set([...e.normal,l],n+12),i.set([...e.color,e.surfaceKind||0],n+16),i.set([...e.vertexNormals[0],0],n+20),i.set([...e.vertexNormals[1],0],n+24),i.set([...e.vertexNormals[2],0],n+28)}),i}function dr(r,i={},e=1/0){const o=Ne(r,i);if(o.length>e)throw new Error(`当前 GPU 光学预览最多支持 ${e} 个三角面`);return{packed:ze(o),count:o.length,width:W,height:o.length}}function ar(r,i={},e=1/0){const o=Ne(r,i);if(o.length>e)throw new Error(`当前 GPU 光学预览最多支持 ${e} 个三角面`);const n=[],l=[],h=c=>{const u=c.flatMap(d=>[d.a,d.b,d.c]);return{minimum:[0,1,2].map(d=>Math.min(...u.map(f=>f[d]))),maximum:[0,1,2].map(d=>Math.max(...u.map(f=>f[d])))}},s=c=>{const u=n.length,d=h(c);if(n.push(null),c.length<=ae){const v=l.length;return l.push(...c),n[u]={...d,leaf:!0,first:v,count:c.length},u}const f=c.map(v=>[0,1,2].map(g=>(v.a[g]+v.b[g]+v.c[g])/3)),w=[0,1,2].map(v=>Math.max(...f.map(g=>g[v]))-Math.min(...f.map(g=>g[v]))),N=w.indexOf(Math.max(...w)),a=c.map((v,g)=>({triangle:v,center:f[g][N]})).sort((v,g)=>v.center-g.center).map(v=>v.triangle),I=Math.floor(a.length/2),y=s(a.slice(0,I)),z=s(a.slice(I));return n[u]={...d,leaf:!1,left:y,right:z},u};s(o);const m=new Float32Array(n.length*re*4);return n.forEach((c,u)=>{const d=u*re*4;m.set([...c.minimum,c.leaf?-(c.first+1):c.left],d),m.set([...c.maximum,c.leaf?c.count:c.right],d+4)}),{packed:ze(l),count:l.length,width:W,height:l.length,bvhPacked:m,bvhCount:n.length,bvhWidth:re,bvhHeight:n.length,leafSize:ae}}function ir(r=[],i=16){const e=r.filter(l=>l?.type!=="void"&&Array.isArray(l?.center)&&l.center.length===3&&l.center.every(Number.isFinite)&&Number.isFinite(l.radius)&&l.radius>0).slice(0,i),o=new Float32Array(i*4),n=new Float32Array(i*4);return e.forEach((l,h)=>{o.set([...l.center,l.type==="crack"?-l.radius:l.radius],h*4);const s=M(l.color||(l.type==="crack"?"#d8edf5":"#c49a68")),m=Number.isFinite(l.opticalDensity)?Math.max(.03,Math.min(1,l.opticalDensity)):.65;n.set([...s,m],h*4)}),{packed:o,optics:n,count:e.length}}function or(r,i={}){return!!(r&&r.model===i.model&&r.showAppearance===i.showAppearance&&r.gemColor===i.gemColor&&r.tierColors===i.tierColors&&r.facetColors===i.facetColors&&r.tierFinishes===i.tierFinishes&&r.facetFinishes===i.facetFinishes&&r.materialSurfaceRoughness===i.materialSurfaceRoughness)}function Se(r,i,e){const o=r.createShader(i);if(r.shaderSource(o,e),r.compileShader(o),!r.getShaderParameter(o,r.COMPILE_STATUS))throw new Error(r.getShaderInfoLog(o));return o}function Te(r,i=De){const e=r.createProgram(),o=Se(r,r.VERTEX_SHADER,er),n=Se(r,r.FRAGMENT_SHADER,i);if(r.attachShader(e,o),r.attachShader(e,n),r.bindAttribLocation(e,0,"position"),r.linkProgram(e),r.deleteShader(o),r.deleteShader(n),!r.getProgramParameter(e,r.LINK_STATUS))throw new Error(r.getProgramInfoLog(e));return e}function ur(r,i={}){const e=r.getContext("webgl2",{antialias:!1,alpha:!1,powerPreference:"high-performance"});if(!e)throw new Error("此设备不支持 WebGL2 光学预览");let o=()=>{},n=!1;const l=t=>{t.preventDefault(),!n&&(n=!0,o(),i.onContextLost?.("GPU 绘图上下文已丢失，光学画面已暂停"))},h=()=>{n=!1,i.onContextRestored?.()};r.addEventListener("webglcontextlost",l,!1),r.addEventListener("webglcontextrestored",h,!1);const s=Te(e),m=Te(e,rr),c=e.createBuffer(),u=e.createTexture(),d=e.createTexture(),f=[e.createTexture(),e.createTexture()],w=[e.createFramebuffer(),e.createFramebuffer()];e.bindBuffer(e.ARRAY_BUFFER,c),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW),e.useProgram(s),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,u),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.activeTexture(e.TEXTURE2),e.bindTexture(e.TEXTURE_2D,d),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE);const N=t=>e.getUniformLocation(s,t),a=Object.fromEntries(["resolution","cameraPosition","cameraForward","cameraRight","cameraUp","cameraPositionB","cameraForwardB","cameraRightB","cameraUpB","opticAxis","principalIorOffsets","modelCenter","modelExtent","curvedSurfaceProfile","curvedSurfaceHeights","zoneColorA","zoneColorB","backgroundColor","absorptionSpectrumOrdinary","absorptionSpectrumExtraordinary","principalSpectrumOrdinary","principalSpectrumExtraordinary","sellmeierB","sellmeierC","sellmeierExtraB","sellmeierExtraC","triangleData","bvhData","accumulationTexture","triangleCount","maxBounces","ior","dispersion","birefringence","opticAxisRoll","opticalClassType","spectralSamples","zoneMode","absorption","exposure","appearanceStrength","environmentRotation","environmentIntensity","environmentPreset","zoneBoundary","zoneRotation","bodyColor","sampleIndex","pixelJitter","linearAccumulation","dispersionModelType","anisotropicDispersionModelType","inspectionSplit","cameraProjection","headShadowAngle","headShadowStrength","volumeHaze","volumeScatterAlbedo","volumePhaseG","surfaceTextureStrength","surfaceTextureScale","volumeTextureStrength","volumeTextureScale","rayEpsilon","millimetersPerUnit","defectCount"].map(t=>[t,N(t)]));a.defectData=N("defectData[0]"),a.defectOptics=N("defectOptics[0]");const I={image:e.getUniformLocation(m,"image"),linearInput:e.getUniformLocation(m,"linearInput")},y=!!e.getExtension("EXT_color_buffer_float"),z=e.getParameter(e.MAX_TEXTURE_SIZE),v=e.getExtension("WEBGL_debug_renderer_info"),g=v?e.getParameter(v.UNMASKED_RENDERER_WEBGL):"WebGL2 GPU";let A=0,H=0,oe=0,ne=0,Y=null;const le=()=>{oe===r.width&&ne===r.height||(oe=r.width,ne=r.height,f.forEach((t,b)=>{if(e.bindTexture(e.TEXTURE_2D,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,y?e.RGBA16F:e.RGBA8,r.width,r.height,0,e.RGBA,y?e.HALF_FLOAT:e.UNSIGNED_BYTE,null),e.bindFramebuffer(e.FRAMEBUFFER,w[b]),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0),e.checkFramebufferStatus(e.FRAMEBUFFER)!==e.FRAMEBUFFER_COMPLETE)throw new Error("无法创建渐进渲染缓冲区")}),e.bindFramebuffer(e.FRAMEBUFFER,null))},Ae=t=>{const{width:b,height:F}=Ze(r.clientWidth,r.clientHeight,window.devicePixelRatio||1,t?.pixelRatioMax,t?.resolutionScale);return r.width!==b||r.height!==F?(r.width=b,r.height=F,le(),!0):(le(),!1)},ce=new ResizeObserver(()=>{r.dataset.displayResize="css-only"});ce.observe(r);function Re(t){H+=1,A&&cancelAnimationFrame(A),Ae(t),delete r.dataset.displayResize;const b=or(Y,t);let F=0;if(!b){const x=performance.now(),p=ar(t.model,t),D=t.model.facets.flatMap(O=>O.points),C=[0,1,2].map(O=>Math.min(...D.map(Q=>Q[O]))),T=[0,1,2].map(O=>Math.max(...D.map(Q=>Q[O])));F=performance.now()-x,Y={...p,minimum:C,maximum:T,model:t.model,showAppearance:t.showAppearance,gemColor:t.gemColor,tierColors:t.tierColors,facetColors:t.facetColors,tierFinishes:t.tierFinishes,facetFinishes:t.facetFinishes,materialSurfaceRoughness:t.materialSurfaceRoughness}}const{packed:Ce,count:L,width:Me,height:se,bvhPacked:Pe,bvhWidth:Ie,bvhHeight:_,minimum:B,maximum:U}=Y;if(se>z||_>z)throw new Error(`当前设备纹理高度上限为 ${z}，无法容纳 ${L} 个三角面 / ${_} 个 BVH 节点`);const k=be(t.cameraOrbit),G=be(t.secondCameraOrbit||t.cameraOrbit);e.viewport(0,0,r.width,r.height),e.useProgram(s),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,u),b||e.texImage2D(e.TEXTURE_2D,0,e.RGBA32F,Me,se,0,e.RGBA,e.FLOAT,Ce),e.uniform1i(a.triangleData,0),e.uniform1i(a.triangleCount,L),e.activeTexture(e.TEXTURE2),e.bindTexture(e.TEXTURE_2D,d),b||e.texImage2D(e.TEXTURE_2D,0,e.RGBA32F,Ie,_,0,e.RGBA,e.FLOAT,Pe),e.uniform1i(a.bvhData,2);const $=ir(t.opticalDefects);e.uniform1i(a.defectCount,$.count),e.uniform4fv(a.defectData,$.packed),e.uniform4fv(a.defectOptics,$.optics),e.uniform1i(a.accumulationTexture,1),e.uniform1i(a.linearAccumulation,y?1:0),e.uniform2f(a.resolution,r.width,r.height),e.uniform3fv(a.cameraPosition,k.position),e.uniform3fv(a.cameraForward,k.forward),e.uniform3fv(a.cameraRight,k.right),e.uniform3fv(a.cameraUp,k.up),e.uniform3fv(a.cameraPositionB,G.position),e.uniform3fv(a.cameraForwardB,G.forward),e.uniform3fv(a.cameraRightB,G.right),e.uniform3fv(a.cameraUpB,G.up),e.uniform1i(a.inspectionSplit,t.inspectionSplit?1:0);const me=(Number(t.opticAxisAzimuth)||0)*Math.PI/180,Z=Math.max(0,Math.min(90,Number(t.opticAxisTilt)||0))*Math.PI/180;e.uniform3fv(a.opticAxis,[Math.sin(Z)*Math.cos(me),Math.cos(Z),Math.sin(Z)*Math.sin(me)]),e.uniform1f(a.opticAxisRoll,(Number(t.opticAxisRoll)||0)*Math.PI/180);const de=ge[t.material]||ge.custom,Fe=Ve(t.material,t.ior,t.birefringence);e.uniform3fv(a.principalIorOffsets,Fe.map(x=>x-Number(t.ior))),e.uniform1i(a.opticalClassType,de.opticalClass==="biaxial"?2:de.opticalClass==="isotropic"||Number(t.birefringence)<1e-4?0:1),e.uniform3fv(a.modelCenter,B.map((x,p)=>(x+U[p])/2)),e.uniform3fv(a.modelExtent,B.map((x,p)=>Math.max(1e-4,(U[p]-x)/2)));const R=t.model.curvedSurface,_e=Math.max(1e-4,(U[0]-B[0])/2),Be=Math.max(1e-4,(U[2]-B[2])/2);e.uniform4f(a.curvedSurfaceProfile,_e,Be,Math.max(1.01,Number(R?.curvature)||2),R?1:0),e.uniform4f(a.curvedSurfaceHeights,Number(R?.girdleHalf)||0,Number(R?.domeHeight)||0,Number(R?.undersideDepth)||0,R?.style==="double-convex"?1:R?.style==="convex-concave"?2:0);const Ue=Math.max(...B.map((x,p)=>U[p]-x));e.uniform1f(a.rayEpsilon,Math.max(1e-7,Math.min(5e-5,Ue*2e-6))),e.uniform1i(a.maxBounces,Math.max(1,Math.min(12,t.bounces||6)));const X=Math.max(1e-6,Number(t.millimetersPerUnit)||1),Oe=Array.isArray(t.spectralAbsorption)&&t.spectralAbsorption.length>=5?ee(t.spectralAbsorption):new Array(24).fill(0),ue=Array.isArray(t.polarizedAbsorption?.ordinary)&&t.polarizedAbsorption.ordinary.length>=5?ee(t.polarizedAbsorption.ordinary):Oe,He=Array.isArray(t.polarizedAbsorption?.extraordinary)&&t.polarizedAbsorption.extraordinary.length>=5?ee(t.polarizedAbsorption.extraordinary):ue,Le=xe(ue,X),ke=xe(He,X),q=Number(t.spectralSamples)||3,V=q>=36&&y?36:q>=24&&y?24:q>=12&&y?12:q>=5?5:3,E=["sellmeier","sampled-principal"].includes(t.dispersionModel?.type)?t.dispersionModel:null,K=E?.type==="sampled-principal"?Ke(E,We):null;e.uniform1i(a.dispersionModelType,E?.type==="sellmeier"?1:K?2:0),e.uniform3fv(a.sellmeierB,E?.b||[0,0,0]),e.uniform3fv(a.sellmeierC,E?.c||[1,1,1]),e.uniform1i(a.anisotropicDispersionModelType,E?.extraordinary?1:K?2:0),e.uniform3fv(a.sellmeierExtraB,E?.extraordinary?.b||[0,0,0]),e.uniform3fv(a.sellmeierExtraC,E?.extraordinary?.c||[1,1,1]),e.uniform1fv(a.principalSpectrumOrdinary,K?.ordinary||new Array(24).fill(t.ior)),e.uniform1fv(a.principalSpectrumExtraordinary,K?.extraordinary||new Array(24).fill(t.ior)),e.uniform1f(a.ior,t.ior),e.uniform1f(a.dispersion,t.dispersion),e.uniform1f(a.birefringence,Math.max(0,Math.min(.2,Number(t.birefringence)||0))),e.uniform1i(a.spectralSamples,V),e.uniform1f(a.absorption,.002/X),e.uniform1f(a.millimetersPerUnit,X),e.uniform1fv(a.absorptionSpectrumOrdinary,Le),e.uniform1fv(a.absorptionSpectrumExtraordinary,ke),e.uniform1f(a.exposure,Math.max(-2,Math.min(2,Number(t.exposureEv)||0))),e.uniform1i(a.cameraProjection,t.cameraProjection==="orthographic"?1:0),e.uniform1f(a.appearanceStrength,t.showAppearance?1:0),e.uniform1f(a.environmentRotation,(Number(t.environmentRotation)||0)*Math.PI/180),e.uniform1f(a.environmentIntensity,Math.max(.2,Math.min(2.5,Number(t.environmentIntensity)||1))),e.uniform1i(a.environmentPreset,Math.max(0,Math.min(12,Number(t.environmentPreset)||0))),e.uniform1f(a.headShadowAngle,Math.max(0,Math.min(40,Number(t.headShadowAngle)||0))),e.uniform1f(a.headShadowStrength,Math.max(0,Math.min(1,Number(t.headShadowStrength)||0)));const fe=Math.max(0,Math.min(1,Number(t.internalHaze)||0));e.uniform1f(a.volumeHaze,fe*fe*1.4),e.uniform1f(a.volumeScatterAlbedo,Math.max(0,Math.min(1,Number(t.volumeScatterAlbedo)||0))),e.uniform1f(a.volumePhaseG,Math.max(-.75,Math.min(.75,Number(t.volumePhaseG)||0))),e.uniform1f(a.surfaceTextureStrength,Math.max(0,Math.min(.08,Number(t.surfaceTextureStrength)||0))),e.uniform1f(a.surfaceTextureScale,Math.max(1,Math.min(80,Number(t.surfaceTextureScale)||18))),e.uniform1f(a.volumeTextureStrength,Math.max(0,Math.min(1,Number(t.volumeTextureStrength)||0))),e.uniform1f(a.volumeTextureScale,Math.max(1,Math.min(24,Number(t.volumeTextureScale)||4))),e.uniform3fv(a.backgroundColor,M(t.backgroundColor||"#17191c"));const Ge={uniform:0,watermelon:1,bicolor:2,gradient:3};e.uniform1i(a.zoneMode,Ge[t.colorZoneMode]||0),e.uniform3fv(a.zoneColorA,M(t.zoneColorA||t.gemColor)),e.uniform3fv(a.zoneColorB,M(t.zoneColorB||t.gemColor)),e.uniform1f(a.zoneBoundary,Math.max(.15,Math.min(.85,Number(t.zoneBoundary)||.58))),e.uniform1f(a.zoneRotation,(Number(t.zoneRotation)||0)*Math.PI/180),e.uniform3fv(a.bodyColor,M(t.gemColor));const ve=Qe(t.progressiveSamples,V),Xe=H,qe=performance.now();let S=0,J=0;const he=(x,p)=>{let D=1,C=0,T=x;for(;T>0;)D/=p,C+=D*(T%p),T=Math.floor(T/p);return C},pe=()=>{if(Xe!==H)return;const x=performance.now(),p=1-J;e.bindFramebuffer(e.FRAMEBUFFER,w[p]),e.viewport(0,0,r.width,r.height),e.useProgram(s),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,u),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,f[J]),e.activeTexture(e.TEXTURE2),e.bindTexture(e.TEXTURE_2D,d),e.uniform1f(a.sampleIndex,S),e.uniform2f(a.pixelJitter,he(S+1,2)-.5,he(S+1,3)-.5),e.drawArrays(e.TRIANGLES,0,3),e.bindFramebuffer(e.FRAMEBUFFER,null);const D=S+1;Je(D,V)&&(e.useProgram(m),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,f[p]),e.uniform1i(I.image,0),e.uniform1i(I.linearInput,y?1:0),e.drawArrays(e.TRIANGLES,0,3));const C=performance.now()-x;J=p,S=D,r.dataset.renderer="webgl2-progressive-raytrace",r.dataset.acceleration="gpu-bvh",r.dataset.triangles=String(L),r.dataset.bvhNodes=String(_),r.dataset.samples=String(S),r.dataset.spectralSamples=String(V),r.dataset.accumulation=y?"linear-hdr16f":"display-rgba8",r.dataset.material=String(t.material||"custom"),r.dataset.environmentPreset=String(t.environmentPreset??0),r.dataset.surfaceRoughness=String(t.materialSurfaceRoughness??0),r.dataset.surfaceTextureStrength=String(t.surfaceTextureStrength??0),r.dataset.volumeTextureStrength=String(t.volumeTextureStrength??0),r.dataset.scatterAlbedo=String(t.volumeScatterAlbedo??0),r.dataset.resolutionScale=String(t.resolutionScale??1),r.dataset.bounces=String(Math.max(1,Math.min(12,t.bounces||6))),r.dataset.cameraYaw=String(Number(t.cameraOrbit?.yaw)||0),r.dataset.cameraPitch=String(Number(t.cameraOrbit?.pitch)||0),t.onProgress?.(S,ve,`GPU BVH · ${y?"HDR16F":"兼容模式"}`);const T=performance.now()-qe;t.onStats?.({acceleration:b?"GPU BVH · 已复用":"GPU BVH · 已重建",triangles:L,bvhNodes:_,bvhBuildMs:F,bvhCached:b,frameSubmitMs:C,elapsedMs:T,samplesPerSecond:S/Math.max(.001,T/1e3),maximumTextureSize:z,textureTriangleCapacity:z,traversalBudget:Ee,deviceRenderer:g,precision:y?"HDR16F":"RGBA8"}),S<ve?A=requestAnimationFrame(pe):A=0};pe()}const j=()=>{H+=1,A&&cancelAnimationFrame(A),A=0};return o=j,{draw:Re,cancel:j,destroy(){j(),ce.disconnect(),r.removeEventListener("webglcontextlost",l,!1),r.removeEventListener("webglcontextrestored",h,!1),e.deleteTexture(u),e.deleteTexture(d),f.forEach(t=>e.deleteTexture(t)),w.forEach(t=>e.deleteFramebuffer(t)),e.deleteBuffer(c),e.deleteProgram(s),e.deleteProgram(m)}}}export{te as DENSE_SPECTRAL_WHITE_BALANCE,we as FACET_FINISH_ROUGHNESS,$e as FIVE_SPECTRAL_WHITE_BALANCE,sr as FRAGMENT_SHADER_FOR_TESTS,xe as absorptionPerMillimeter,ur as createGpuOpticsRenderer,be as createOpticalCameraBasis,or as opticalGeometryCacheMatches,Ze as opticalRenderSize,ar as packOpticalBvh,ir as packOpticalDefects,mr as packOpticalPlanes,dr as packOpticalTriangles,Qe as resolveProgressiveSampleCount,Je as shouldPresentSpectralSample};
