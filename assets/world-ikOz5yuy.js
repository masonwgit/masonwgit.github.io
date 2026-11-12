import{B as e,C as t,D as n,F as r,G as i,H as a,J as o,L as s,M as c,N as l,O as u,P as d,S as f,V as p,W as m,X as h,Y as g,Z as _,_ as v,a as y,c as b,d as x,f as S,g as C,h as w,i as T,j as E,l as D,m as O,n as k,o as A,q as j,r as ee,t as te,u as M,v as N,w as P,x as F,y as ne}from"./three.module-DDVSe3mI.js";var I=`
vec3 pv_mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 pv_mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 pv_permute(vec4 x) { return pv_mod289(((x * 34.0) + 1.0) * x); }
vec4 pv_taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float pv_snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = pv_mod289(i);
  vec4 p = pv_permute(pv_permute(pv_permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0)) +
    i.y + vec4(0.0, i1.y, i2.y, 1.0)) +
    i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = pv_taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float pv_fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += a * pv_snoise(p);
    p = p * 2.03 + vec3(11.7, 3.1, 7.3);
    a *= 0.5;
  }
  return s;
}

float pv_fbm2(vec3 p) {
  return 0.55 * pv_snoise(p) + 0.3 * pv_snoise(p * 2.03 + vec3(11.7, 3.1, 7.3));
}

float pv_hash(float n) { return fract(sin(n) * 43758.5453123); }

// box-filtered checkerboard (Inigo Quilez), stays clean at grazing angles
float pv_checker(vec2 p) {
  vec2 w = max(fwidth(p), vec2(1e-4));
  vec2 i = 2.0 * (abs(fract((p - 0.5 * w) * 0.5) - 0.5) - abs(fract((p + 0.5 * w) * 0.5) - 0.5)) / w;
  return 0.5 - 0.5 * i.x * i.y;
}
`,re=`
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uHorizonSun;
  uniform vec3 uSea;
  uniform vec3 uCloud;
  uniform vec3 uCloudShade;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  varying vec3 vDir;
  ${I}
  void main() {
    vec3 d = normalize(vDir);
    float y = d.y;
    vec3 sun = normalize(uSunDir);
    float side = pow(max(dot(normalize(d.xz + 1e-5), normalize(sun.xz + 1e-5)), 0.0), 3.0);
    vec3 horizon = mix(uHorizon, uHorizonSun, side * smoothstep(0.45, 0.0, y));
    vec3 col = mix(horizon, uZenith, pow(clamp(y, 0.0, 1.0), 0.5));
    if (y > 0.0) {
      vec2 uv = d.xz / (y + 0.1) * 1.3;
      float n = pv_fbm(vec3(uv.x * 0.42, uv.y * 1.7, 0.3));
      float n2 = pv_fbm(vec3(uv * 2.6, 2.0));
      float c = smoothstep(0.08, 0.6, n + n2 * 0.3);
      c *= smoothstep(0.0, 0.07, y) * (1.0 - smoothstep(0.32, 0.75, y));
      vec3 cc = mix(uCloudShade, uCloud, smoothstep(-0.25, 0.55, n2 + side * 0.3));
      col = mix(col, cc, c * 0.8);
    } else {
      col = mix(horizon, uSea, smoothstep(0.0, -0.15, y));
    }
    float s = max(dot(d, sun), 0.0);
    col += uSunColor * (pow(s, 1200.0) * 8.0 + pow(s, 40.0) * 0.2 + pow(s, 5.0) * 0.07);
    gl_FragColor = vec4(col, 1.0);
  }
`;function ie(t,n,r=512){let i=new p({uniforms:{uZenith:{value:n.zenith},uHorizon:{value:n.horizon},uHorizonSun:{value:n.horizonSun},uSea:{value:n.sea},uCloud:{value:n.cloud},uCloudShade:{value:n.cloudShade},uSunDir:{value:n.sunDir},uSunColor:{value:n.sunColor}},side:1,depthWrite:!1,vertexShader:`varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,fragmentShader:re}),a=new m(10,64,32),o=new e;o.add(new P(a,i));let s=new k(r,{type:N});return new M(.1,100,s).update(t,o),i.dispose(),a.dispose(),s}function ae(e,t){let n={uDay:{value:e.texture},uDusk:{value:t.texture},uMix:{value:0},uRot:{value:0}},r=new p({uniforms:n,side:1,depthWrite:!1,fog:!1,vertexShader:`
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        // pinned to the far plane so the reflectors' oblique clip planes never cut it
        gl_Position.z = gl_Position.w;
      }
    `,fragmentShader:`
      uniform samplerCube uDay;
      uniform samplerCube uDusk;
      uniform float uMix;
      uniform float uRot;
      varying vec3 vDir;
      void main() {
        vec3 d0 = normalize(vDir);
        float cr = cos(uRot);
        float sr = sin(uRot);
        vec3 d = vec3(cr * d0.x - sr * d0.z, d0.y, sr * d0.x + cr * d0.z);
        gl_FragColor = vec4(mix(textureCube(uDay, d).rgb, textureCube(uDusk, d).rgb, uMix), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `}),i=new P(new m(4500,48,24),r);return i.frustumCulled=!1,i.renderOrder=-10,i.onBeforeRender=(e,t,n)=>{i.position.setFromMatrixPosition(n.matrixWorld),i.updateMatrixWorld()},{mesh:i,setMix:e=>n.uMix.value=e,setRotation:e=>n.uRot.value=e}}var L=class e extends P{constructor(n,r={}){super(n),this.isReflector=!0,this.type=`Reflector`,this.forceUpdate=!1,this._reflectionCameras=new WeakMap;let i=this,a=r.color===void 0?new D(8355711):new D(r.color),o=r.textureWidth||512,s=r.textureHeight||512,c=r.clipBias||0,u=r.shader||e.ReflectorShader,d=r.multisample===void 0?4:r.multisample,f=new l,m=new g,v=new g,y=new g,b=new t,x=new g(0,0,-1),S=new h,C=new g,w=new g,T=new h,E=new t,O=new _(o,s,{samples:d,type:N}),k=new p({name:u.name===void 0?`unspecified`:u.name,uniforms:j.clone(u.uniforms),fragmentShader:u.fragmentShader,vertexShader:u.vertexShader});k.uniforms.tDiffuse.value=O.texture,k.uniforms.color.value=a,k.uniforms.textureMatrix.value=E,this.material=k,this.onBeforeRender=function(e,t,n){let r=this.getReflectionCamera(n);if(v.setFromMatrixPosition(i.matrixWorld),y.setFromMatrixPosition(n.matrixWorld),b.extractRotation(i.matrixWorld),m.set(0,0,1),m.applyMatrix4(b),C.subVectors(v,y),C.dot(m)>0&&this.forceUpdate===!1)return;C.reflect(m).negate(),C.add(v),b.extractRotation(n.matrixWorld),x.set(0,0,-1),x.applyMatrix4(b),x.add(y),w.subVectors(v,x),w.reflect(m).negate(),w.add(v),r.position.copy(C),r.up.set(0,1,0),r.up.applyMatrix4(b),r.up.reflect(m),r.lookAt(w),r.far=n.far,r.updateMatrixWorld(),r.projectionMatrix.copy(n.projectionMatrix),r.projectionMatrix.elements[8]*=-1,r.projectionMatrix.elements[12]*=-1,E.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),E.multiply(r.projectionMatrix),E.multiply(r.matrixWorldInverse),E.multiply(i.matrixWorld),f.setFromNormalAndCoplanarPoint(m,v),f.applyMatrix4(r.matrixWorldInverse),S.set(f.normal.x,f.normal.y,f.normal.z,f.constant);let a=r.projectionMatrix;r.isOrthographicCamera?(T.x=(Math.sign(S.x)+a.elements[8])/a.elements[0],T.y=(Math.sign(S.y)+a.elements[9])/a.elements[5],T.z=-n.far,T.w=1):(T.x=(Math.sign(S.x)+a.elements[8])/a.elements[0],T.y=(Math.sign(S.y)+a.elements[9])/a.elements[5],T.z=-1,T.w=(1+a.elements[10])/a.elements[14]),S.multiplyScalar(2/S.dot(T)),a.elements[2]=S.x,a.elements[6]=S.y,r.isOrthographicCamera?(a.elements[10]=S.z-c,a.elements[14]=S.w-1):(a.elements[10]=S.z+1-c,a.elements[14]=S.w),i.visible=!1;let o=e.getRenderTarget(),s=e.xr.enabled,l=e.shadowMap.autoUpdate;e.xr.enabled=!1,e.shadowMap.autoUpdate=!1,e.setRenderTarget(O),e.state.buffers.depth.setMask(!0),e.autoClear===!1&&e.clear(),e.render(t,r),e.xr.enabled=s,e.shadowMap.autoUpdate=l,e.setRenderTarget(o);let u=n.viewport;u!==void 0&&e.state.viewport(u),i.visible=!0,this.forceUpdate=!1},this.getRenderTarget=function(){return O},this.dispose=function(){O.dispose(),i.material.dispose()},this.getReflectionCamera=function(e){let t=this._reflectionCameras.get(e);return t===void 0&&(t=e.clone(),this._reflectionCameras.set(e,t)),t}}};L.ReflectorShader={name:`ReflectorShader`,uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null}},vertexShader:`
		uniform mat4 textureMatrix;
		varying vec4 vUv;

		#include <common>
		#include <logdepthbuf_pars_vertex>

		void main() {

			vUv = textureMatrix * vec4( position, 1.0 );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

			#include <logdepthbuf_vertex>

		}`,fragmentShader:`
		uniform vec3 color;
		uniform sampler2D tDiffuse;
		varying vec4 vUv;

		#include <logdepthbuf_pars_fragment>

		float blendOverlay( float base, float blend ) {

			return( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );

		}

		vec3 blendOverlay( vec3 base, vec3 blend ) {

			return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );

		}

		void main() {

			#include <logdepthbuf_fragment>

			vec4 base = texture2DProj( tDiffuse, vUv );
			gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>

		}`};var R={name:`PavilionWater`,uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null},uTime:{value:0},uDeep:{value:new D(`#14205f`)},uFogColor:{value:new D(`#a9b5ea`)},uFogDensity:{value:75e-5},uSunDir:{value:new g(0,1,0)},uSunColor:{value:new D(`#ffffff`)},uDistort:{value:1}},vertexShader:`
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,fragmentShader:`
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec3 uDeep;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    uniform vec3 uSunDir;
    uniform vec3 uSunColor;
    uniform float uDistort;
    varying vec4 vUv;
    varying vec3 vWorld;

    vec2 swell(vec2 p, float t) {
      vec2 g = vec2(0.0);
      vec2 d1 = normalize(vec2(0.12, 1.0));  g += d1 * 0.016 * cos(dot(p, d1) * 0.9 - t * 1.05);
      vec2 d2 = normalize(vec2(-0.32, 1.0)); g += d2 * 0.012 * cos(dot(p, d2) * 1.8 - t * 1.5);
      vec2 d3 = normalize(vec2(0.55, 0.85)); g += d3 * 0.010 * cos(dot(p, d3) * 3.3 - t * 2.2);
      vec2 d4 = normalize(vec2(-0.8, 0.6));  g += d4 * 0.007 * cos(dot(p, d4) * 5.9 - t * 3.0);
      vec2 d5 = normalize(vec2(0.9, 0.35));  g += d5 * 0.006 * cos(dot(p, d5) * 7.7 - t * 3.6);
      vec2 d6 = normalize(vec2(-0.25, -1.0)); g += d6 * 0.005 * cos(dot(p, d6) * 10.3 - t * 4.1);
      return g;
    }

    void main() {
      vec3 toCam = cameraPosition - vWorld;
      float dist = length(toCam);
      vec3 V = toCam / dist;
      float calm = 1.0 / (1.0 + dist * 0.006);
      vec2 g = swell(vWorld.xz, uTime) * mix(0.35, 1.0, calm);
      vec3 N = normalize(vec3(-g.x, 1.0, -g.y));

      vec4 uv = vUv;
      uv.x += g.x * 0.55 * uDistort * uv.w;
      uv.y += g.y * 1.6 * uDistort * uv.w;
      vec3 refl = texture2DProj(tDiffuse, uv).rgb;

      float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
      float r = mix(0.42, 0.86, fres);
      vec3 col = mix(uDeep, refl * vec3(0.6, 0.7, 1.0), r);

      vec3 H = normalize(normalize(uSunDir) + V);
      col += uSunColor * pow(max(dot(N, H), 0.0), 500.0) * 3.0;

      float f = 1.0 - exp(-pow(uFogDensity * dist, 2.0));
      col = mix(col, uFogColor, f);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `},oe={name:`PavilionFloorMirror`,uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null}},vertexShader:`
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,fragmentShader:`
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    varying vec4 vUv;
    void main() {
      vec3 base = texture2DProj(tDiffuse, vUv).rgb;
      gl_FragColor = vec4(base * color, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `};function se({width:e,height:t}){let n=new L(new d(14e3,14e3),{textureWidth:e,textureHeight:t,clipBias:.002,shader:R,multisample:0});n.rotation.x=-Math.PI/2,n.renderOrder=-5;let r=n.material.uniforms;function i(e,t){r.uTime.value=t,r.uDeep.value.copy(e.deep),r.uFogColor.value.copy(e.fog),r.uSunDir.value.copy(e.sunDir),r.uSunColor.value.copy(e.sunColor).multiplyScalar(e.sunIntensity*.5)}return{mesh:n,apply:i}}function z({width:e,depth:t,textureWidth:n,textureHeight:r,hideDuringPass:i}){let a=new L(new d(e,t),{textureWidth:n,textureHeight:r,color:9606314,shader:oe,multisample:0});a.rotation.x=-Math.PI/2;let o=a.onBeforeRender;return a.onBeforeRender=function(e,t,n,...r){for(let e of i)e.visible=!1;o.call(this,e,t,n,...r);for(let e of i)e.visible=!0},a}function B(e,t=!1){let n=e[0].index!==null,r=new Set(Object.keys(e[0].attributes)),i=new Set(Object.keys(e[0].morphAttributes)),a={},o={},s=e[0].morphTargetsRelative,c=new A;c.morphTargetsRelative=s;let l=0;for(let u=0;u<e.length;++u){let d=e[u],f=0,p=0;if(n!==(d.index!==null))return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.`),null;for(let e in d.attributes){if(!r.has(e))return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. All geometries must have compatible attributes; make sure "`+e+`" attribute exists among all geometries, or in none of them.`),null;a[e]===void 0&&(a[e]=[]),a[e].push(d.attributes[e]),f++}if(f!==r.size)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. Make sure all geometries have the same number of attributes.`),null;if(s!==d.morphTargetsRelative)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. .morphTargetsRelative must be consistent throughout all geometries.`),null;for(let t in d.morphAttributes){if(!i.has(t))return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`.  .morphAttributes must be consistent throughout all geometries.`),null;if(d.morphAttributes[t].length!==e[0].morphAttributes[t].length)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. All geometries must have the same number of morph targets for the "`+t+`" morph attribute.`),null;o[t]===void 0&&(o[t]=[]),o[t].push(d.morphAttributes[t]),p++}if(p!==i.size)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. Make sure all geometries have the same number of morph attributes.`),null;if(t){let e;if(n)e=d.index.count;else if(d.attributes.position!==void 0)e=d.attributes.position.count;else return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index `+u+`. The geometry must have either an index or a position attribute`),null;c.addGroup(l,e,u),l+=e}}if(n){let t=0,n=[];for(let r=0;r<e.length;++r){let i=e[r].index;for(let e=0;e<i.count;++e)n.push(i.getX(e)+t);t+=e[r].attributes.position.count}c.setIndex(n)}for(let e in a){let t=V(a[e]);if(!t)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the `+e+` attribute.`),null;c.setAttribute(e,t)}for(let e in o){let t=o[e][0].length;if(t!==0){c.morphAttributes=c.morphAttributes||{},c.morphAttributes[e]=[];for(let n=0;n<t;++n){let t=[];for(let r=0;r<o[e].length;++r)t.push(o[e][r][n]);let r=V(t);if(!r)return console.error(`THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the `+e+` morphAttribute.`),null;c.morphAttributes[e].push(r)}}}return c}function V(e){let t,n,r,i=-1,a=0;for(let o=0;o<e.length;++o){let s=e[o];if(t===void 0&&(t=s.array.constructor),t!==s.array.constructor)return console.error(`THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes.`),null;if(n===void 0&&(n=s.itemSize),n!==s.itemSize)return console.error(`THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes.`),null;if(r===void 0&&(r=s.normalized),r!==s.normalized)return console.error(`THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes.`),null;if(i===-1&&(i=s.gpuType),i!==s.gpuType)return console.error(`THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes.`),null;a+=s.count*n}let o=new t(a),s=new y(o,n,r),c=0;for(let t=0;t<e.length;++t){let r=e[t];if(r.isInterleavedBufferAttribute){let e=c/n;for(let t=0,i=r.count;t<i;t++)for(let i=0;i<n;i++){let n=r.getComponent(t,i);s.setComponent(t+e,i,n)}}else o.set(r.array,c);c+=r.count*n}return i!==void 0&&(s.gpuType=i),s}function H(e=1){let t=e>>>0;return()=>{t+=1831565813;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}var U=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]],ce=.5*(Math.sqrt(3)-1),W=(3-Math.sqrt(3))/6;function G(e=1){let t=H(e),n=new Uint8Array(256);for(let e=0;e<256;e++)n[e]=e;for(let e=255;e>0;e--){let r=Math.floor(t()*(e+1)),i=n[e];n[e]=n[r],n[r]=i}let r=new Uint8Array(512);for(let e=0;e<512;e++)r[e]=n[e&255];return(e,t)=>{let n=(e+t)*ce,i=Math.floor(e+n),a=Math.floor(t+n),o=(i+a)*W,s=e-(i-o),c=t-(a-o),l=+(s>c),u=s>c?0:1,d=s-l+W,f=c-u+W,p=s-1+2*W,m=c-1+2*W,h=i&255,g=a&255,_=0,v=.5-s*s-c*c;if(v>0){let e=U[r[h+r[g]]&7];v*=v,_+=v*v*(e[0]*s+e[1]*c)}let y=.5-d*d-f*f;if(y>0){let e=U[r[h+l+r[g+u]]&7];y*=y,_+=y*y*(e[0]*d+e[1]*f)}let b=.5-p*p-m*m;if(b>0){let e=U[r[h+1+r[g+1]]&7];b*=b,_+=b*b*(e[0]*p+e[1]*m)}return 70*_}}function K(e,{key:t,uniforms:n={},fragmentPre:r=``,fragmentColor:i=``,fragmentRough:a=``,fragmentEmissive:o=``}){return e.onBeforeCompile=e=>{Object.assign(e.uniforms,n),e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
varying vec3 vPvWorld;
varying vec3 vPvObj;
varying vec3 vPvNormal;`).replace(`#include <worldpos_vertex>`,`#include <worldpos_vertex>
        vPvObj = transformed;
        vPvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vPvNormal = normalize(mat3(modelMatrix) * objectNormal);`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
        varying vec3 vPvWorld;
        varying vec3 vPvObj;
        varying vec3 vPvNormal;
        ${I}
        ${r}`).replace(`#include <color_fragment>`,`#include <color_fragment>\n${i}`).replace(`#include <roughnessmap_fragment>`,`#include <roughnessmap_fragment>\n${a}`).replace(`#include <emissivemap_fragment>`,`#include <emissivemap_fragment>\n${o}`)},e.customProgramCacheKey=()=>t,e}var q=e=>({value:new D(e)});function J({key:e,base:t,cloud:n,vein:r,scale:i=1,veinFreq:a=1,veinAmt:o=.85,mottle:s=0,roughness:c=.3,envMapIntensity:l=1}){return K(new u({color:16777215,roughness:c,metalness:0,envMapIntensity:l}),{key:`marble-`+e,uniforms:{uBase:q(t),uCloud:q(n),uVein:q(r),uScale:{value:i},uVeinFreq:{value:a},uVeinAmt:{value:o},uMottle:{value:s}},fragmentPre:`uniform vec3 uBase; uniform vec3 uCloud; uniform vec3 uVein;
      uniform float uScale; uniform float uVeinFreq; uniform float uVeinAmt; uniform float uMottle;`,fragmentColor:`
      vec3 mp = vPvWorld * uScale;
      float turb = pv_fbm2(mp * 0.7);
      float v = abs(sin((mp.y * 0.8 + mp.x * 0.45 + mp.z * 0.3) * uVeinFreq + turb * 6.5));
      float vein = pow(1.0 - v, 10.0);
      float cl = pv_snoise(mp * 1.6 + 4.3) * 0.5 + 0.5;
      vec3 mc = mix(uBase, uCloud, smoothstep(0.3, 0.85, cl));
      float speck = smoothstep(0.45, 0.8, pv_snoise(mp * 7.0)) * uMottle;
      mc = mix(mc, uVein, clamp(vein * uVeinAmt + speck * 0.55, 0.0, 1.0));
      diffuseColor.rgb = mc;
    `})}function le({key:e,a:t,b:n,size:r,alphaA:i=1,alphaB:a=1,grazing:o=1,roughness:s=.2,transparent:c=!1,emissive:l=0}){let d=new u({color:16777215,roughness:s,metalness:0,transparent:c});return c&&(d.depthWrite=!1,d.polygonOffset=!0,d.polygonOffsetFactor=-1,d.polygonOffsetUnits=-2),K(d,{key:`checker-`+e,uniforms:{uA:q(t),uB:q(n),uSize:{value:r},uAlphaA:{value:i},uAlphaB:{value:a},uGrazing:{value:o},uSelfLit:{value:l}},fragmentPre:`uniform vec3 uA; uniform vec3 uB; uniform float uSize; uniform float uAlphaA; uniform float uAlphaB; uniform float uGrazing; uniform float uSelfLit;`,fragmentColor:`
      float ck = pv_checker(vPvWorld.xz / uSize);
      diffuseColor.rgb = mix(uA, uB, ck);
      float tileAlpha = mix(uAlphaA, uAlphaB, ck);
      float fres = pow(1.0 - clamp(normalize(cameraPosition - vPvWorld).y, 0.0, 1.0), 3.0);
      diffuseColor.a *= mix(tileAlpha, tileAlpha * uGrazing, fres * mix(0.45, 1.0, ck));
    `,fragmentEmissive:`totalEmissiveRadiance += diffuseColor.rgb * uSelfLit;`})}function ue({key:e,size:t=.25}){return K(new u({color:16777215,metalness:1,roughness:.24}),{key:`gilt-`+e,uniforms:{uSize:{value:t}},fragmentPre:`uniform float uSize;`,fragmentColor:`
      vec3 q = floor(vPvObj / uSize + 0.0001);
      float ck = mod(q.x + q.y + q.z, 2.0);
      diffuseColor.rgb = mix(vec3(0.83, 0.62, 0.22), vec3(0.32, 0.22, 0.07), ck * 0.85);
    `})}function de(){return K(new u({color:16777215,roughness:.93,metalness:0,envMapIntensity:.6}),{key:`strata`,fragmentColor:`
      vec3 p = vPvWorld;
      vec3 n = normalize(vPvNormal);
      float warp = pv_snoise(vec3(p.xz * 0.012, 1.7)) * 3.0;
      float b = p.y * 0.2 + warp;
      float band = fract(b);
      float bandId = floor(b);
      float tone = pv_hash(bandId * 1.37 + 0.5);
      vec3 cHi = vec3(0.95, 0.95, 0.97);
      vec3 cMid = vec3(0.83, 0.84, 0.89);
      vec3 c = mix(cMid, cHi, tone);
      c *= 0.8 + 0.2 * smoothstep(0.0, 0.45, band);
      float steep = 1.0 - smoothstep(0.45, 0.8, n.y);
      float wx = n.x * n.x / (n.x * n.x + n.z * n.z + 1e-4);
      float along = mix(p.x, p.z, wx);
      float flute = 1.0 - abs(pv_snoise(vec3(along * 0.07, p.y * 0.006, 3.1)));
      float flute2 = pv_snoise(vec3(along * 0.9, p.y * 0.03 + bandId * 0.7, 9.4)) * 0.5 + 0.5;
      float streaks = smoothstep(0.55, 0.95, flute) * 0.55 + smoothstep(0.45, 0.85, flute2) * 0.45 * tone;
      c *= mix(1.0, 1.0 - 0.3 * streaks, steep);
      float topness = smoothstep(0.72, 0.93, n.y);
      float mossN = pv_snoise(vec3(p.xz * 0.045, 7.0)) * 0.5 + 0.5;
      vec3 moss = mix(vec3(0.13, 0.3, 0.16), vec3(0.36, 0.55, 0.24), mossN);
      c = mix(c, moss, topness * smoothstep(0.3, 0.55, mossN));
      c *= mix(0.5, 1.0, smoothstep(-1.0, 7.0, p.y));
      diffuseColor.rgb = c;
    `})}function fe({roughness:e=.18}={}){return new u({color:`#ecbf58`,metalness:.85,roughness:e,envMapIntensity:1.6})}var pe=[{n:5,x:[-460,-140],z:[-330,-600],r:[30,66],h:[60,135]},{n:6,x:[140,480],z:[-300,-580],r:[30,68],h:[75,170]},{n:4,x:[-210,-40],z:[-560,-780],r:[40,90],h:[55,110]},{n:4,x:[60,260],z:[-620,-820],r:[45,95],h:[60,120]},{n:11,x:[-1300,1300],z:[-1050,-1500],r:[70,170],h:[50,140]},{n:5,x:[-900,-420],z:[-250,-700],r:[60,140],h:[70,150]},{n:5,x:[420,900],z:[-250,-700],r:[60,140],h:[70,160]},{n:7,x:[-700,700],z:[260,760],r:[50,130],h:[60,150]}];function me(e,t,n,r,i=34){let o=new a,s=e()*100;for(let e=0;e<i;e++){let a=e/i*Math.PI*2,c=n*(1+.2*t(Math.cos(a)*1.3+s,Math.sin(a)*1.3+s)+.08*t(Math.cos(a)*4+s,Math.sin(a)*4-s)),l=Math.cos(a)*c*r,u=Math.sin(a)*c/r;e===0?o.moveTo(l,u):o.lineTo(l,u)}return o.closePath(),o}function he(e,t,{x:n,z:r,radius:i,height:a}){let o=[],s=.75+e()*.6,c=e()*Math.PI,l=-6,u=i,d=a+6;for(;d>2&&u>8;){let i=Math.min(d,9+e()*22),a=new O(me(e,t,u,s,30+Math.floor(e()*10)),{depth:i,bevelEnabled:!1,curveSegments:1});a.rotateX(-Math.PI/2),a.rotateY(c+(e()-.5)*.15),a.translate(n+(e()-.5)*u*.12,l,r+(e()-.5)*u*.12),o.push(a),l+=i,d-=i,u*=.8+e()*.17}return o}function ge(){let e=H(1997),t=G(7),n=[];for(let r of pe)for(let i=0;i<r.n;i++){let i=r.x[0]+e()*(r.x[1]-r.x[0]),a=r.z[0]+e()*(r.z[1]-r.z[0]),o=r.r[0]+e()*(r.r[1]-r.r[0]),s=r.h[0]+e()**.8*(r.h[1]-r.h[0]);n.push(...he(e,t,{x:i,z:a,radius:o,height:s}))}let r=B(n,!1);for(let e of n)e.dispose();r.deleteAttribute(`uv`),r.computeVertexNormals(),r.computeBoundingSphere();let i=new P(r,de());return i.matrixAutoUpdate=!1,i.updateMatrix(),i}var Y={floorY:.62,halfW:9.4,zFront:-10.4,zBack:8.4,colX:[-7.3,-3.45,3.45,7.3],colZFront:-9.1,colZBack:7.1,colH:6.2,beamD:1.45};Y.capTop=Y.floorY+Y.colH,Y.ceilY=Y.capTop+1.22,Y.midZ=(Y.colZFront+Y.colZBack)/2;var X={lilac:J({key:`lilac`,base:`#958fa6`,cloud:`#c3bfd0`,vein:`#433e58`,scale:1.4,veinFreq:.8,veinAmt:.35,mottle:.75,roughness:.34}),jade:J({key:`jade`,base:`#2f7a5d`,cloud:`#7dbb9f`,vein:`#0f3d2c`,scale:.9,veinFreq:1.2,veinAmt:.75,roughness:.12,envMapIntensity:1.5}),white:J({key:`white`,base:`#e4e2ea`,cloud:`#f7f6fb`,vein:`#9a97af`,scale:.7,veinFreq:.9,veinAmt:.5,roughness:.3})};function _e(e,t,n,r,i,o){let s=new a;s.moveTo(-e,-n),s.lineTo(e,-n),s.lineTo(e,-t),s.lineTo(-e,-t),s.closePath();let c=new E;return c.moveTo(-r,-o),c.lineTo(-r,-i),c.lineTo(r,-i),c.lineTo(r,-o),c.closePath(),s.holes.push(c),s}function ve(e,t,n){let r=new a;return r.moveTo(-e,-n),r.lineTo(e,-n),r.lineTo(e,-t),r.lineTo(-e,-t),r.closePath(),r}function Z(e,t,n=0){let r=new O(e,{depth:Math.max(.001,t-n*2),bevelEnabled:n>0,bevelSize:n,bevelThickness:n,bevelSegments:3,curveSegments:4});return r.rotateX(-Math.PI/2),r.translate(0,n,0),r}function ye(){let e=new v,t=(t,n,r)=>{let i=new P(t,n);return i.position.y=r,i.castShadow=!0,i.receiveShadow=!0,e.add(i),i},n=Y.floorY;t(new T(1.26,.28,1.26),X.white,n+.14),t(new i(.55,.1,14,48).rotateX(Math.PI/2),X.lilac,n+.38);let r=n+.4,a=n+Y.colH-.5,o=a-r,s=new x(.43,.49,o,44,18),c=s.attributes.position,l=H(5),u=Array.from({length:7},()=>[l()*6.28,1+Math.floor(l()*4),l()*3,.006+l()*.014]);for(let e=0;e<c.count;e++){let t=c.getX(e),n=c.getZ(e),r=c.getY(e),i=Math.hypot(t,n);if(i<.01)continue;let a=Math.atan2(n,t),o=0;for(let[e,t,n,i]of u)o+=Math.sin(a*t+e+r*n)*i;let s=(i+o)/i;c.setX(e,t*s),c.setZ(e,n*s)}return s.computeVertexNormals(),t(s,X.lilac,r+o/2),t(new i(.46,.06,12,44).rotateX(Math.PI/2),X.lilac,a),t(new x(.66,.46,.26,44),X.lilac,a+.13),t(new T(1.42,.24,1.42),X.white,a+.38),e}function be({mirrorSize:e}){let t=new v,n=Y.floorY,r=[{pad:.36,top:n-.025},{pad:.98,top:n-.25},{pad:1.6,top:n-.47}];for(let e of r){let n=Z(ve(Y.halfW+e.pad,Y.zFront-e.pad,Y.zBack+e.pad),e.top+3,.03),r=new P(n,X.white);r.position.y=-3,r.receiveShadow=!0,r.castShadow=!0,t.add(r)}let i=Y.halfW*2,a=Y.zBack-Y.zFront,o=new P(new d(i,a).rotateX(-Math.PI/2),le({key:`floor`,a:`#f1f2f8`,b:`#0c1142`,size:1.12,alphaA:.95,alphaB:.8,grazing:.5,roughness:.14,transparent:!0}));o.position.set(0,n,(Y.zFront+Y.zBack)/2),o.receiveShadow=!0,o.renderOrder=2;let s=z({width:i,depth:a,textureWidth:e.width,textureHeight:e.height,hideDuringPass:[o]});s.position.set(0,n-.02,(Y.zFront+Y.zBack)/2),t.add(s,o);let c=[];for(let e of Y.colX)c.push([e,Y.colZFront],[e,Y.colZBack]);let l=(Y.colZBack-Y.colZFront)/3;for(let e of[Y.colX[0],Y.colX[3]])c.push([e,Y.colZFront+l],[e,Y.colZFront+l*2]);let u=ye();for(let[e,n]of c){let r=u.clone();r.position.set(e,0,n),t.add(r)}let f=Y.colX[3],p=Y.beamD/2,m=[{og:0,ig:0,h:.62,mat:X.jade,bevel:.05},{og:-.07,ig:-.07,h:.38,mat:X.jade,bevel:.03},{og:.26,ig:.1,h:.26,mat:X.jade,bevel:.09}],h=Y.capTop;for(let e of m){let n=Z(_e(f+p+e.og,Y.colZFront-p-e.og,Y.colZBack+p+e.og,f-p-e.ig,Y.colZFront+p+e.ig,Y.colZBack-p-e.ig),e.h,e.bevel),r=new P(n,e.mat);r.position.y=h,r.castShadow=!0,r.receiveShadow=!0,t.add(r),h+=e.h}let g=new P(Z(ve(f+p+.42,Y.colZFront-p-.42,Y.colZBack+p+.42),.5,.06),X.white);g.position.y=h,g.castShadow=!0,t.add(g);let _=new P(Z(ve(f+p-.3,Y.colZFront-p+.3,Y.colZBack+p-.3),.32,.05),X.white);_.position.y=h+.46,_.castShadow=!0,t.add(_);let y=new P(new d((f-p)*2,Y.colZBack-Y.colZFront-Y.beamD).rotateX(Math.PI/2),le({key:`ceiling`,a:`#ebeaf2`,b:`#16161f`,size:.62,roughness:.4,emissive:.22}));return y.position.set(0,Y.ceilY,Y.midZ),y.receiveShadow=!0,t.add(y),{group:t,mirror:s,tiles:o}}var Q=o;function xe(){let e=[new Q(0,.62),new Q(.4,.62),new Q(.74,.35),new Q(.74,.27),new Q(0,-.98)],t=new F(e,8),i=new n({color:`#2b3a8f`,metalness:.45,roughness:.04,clearcoat:1,clearcoatRoughness:.02,iridescence:1,iridescenceIOR:1.9,iridescenceThicknessMinimum:120,iridescenceThicknessMaximum:820,envMapIntensity:3.2,flatShading:!0,emissive:`#4c63ff`,emissiveIntensity:0}),a=new P(t,i),o=new v;o.add(a),o.position.set(0,Y.ceilY-1.95,-2.6);let s=new r(`#a4b3ff`,0,34,2);return o.add(s),{group:o,mesh:a,light:s,baseY:o.position.y}}function Se(e,t,n,r=12){let i=[],a=[],o=0,s=0,c=e/r;for(let e=0;e<=r;e++){let a=e/r,l=n*a*a;e>0&&(o+=Math.cos(l)*c,s+=Math.sin(l)*c);let u=t*Math.sin(Math.PI*Math.min(1,a**.6))*(1-.3*a)+.004,d=-Math.sin(l),f=Math.cos(l),p=u*.42;i.push(-u,o-d*p,s-f*p),i.push(0,o,s),i.push(u,o-d*p,s-f*p)}for(let e=0;e<r;e++){let t=e*3,n=t+3;a.push(t,n,t+1,t+1,n,n+1,t+1,n+1,t+2,t+2,n+1,n+2)}let l=new A;return l.setAttribute(`position`,new w(i,3)),l.setIndex(a),l.computeVertexNormals(),l}function Ce(){let e=new v,t=H(42),n=[`#2e7a39`,`#3c9045`,`#235f2d`,`#4a9a4c`].map(e=>new u({color:e,roughness:.5,side:2})),r=[`#8a2638`,`#a8384a`].map(e=>new u({color:e,roughness:.5,side:2}));for(let i=0;i<24;i++){let a=i%6==2,o=1.35+t()*1.05,s=new P(Se(o,.075+t()*.04,.9+t()*1.5),a?r[i%2]:n[i%4]);s.rotation.order=`YXZ`,s.rotation.y=i/24*Math.PI*2+t()*.5,s.rotation.x=.1+t()*.35,s.position.set((t()-.5)*.18,0,(t()-.5)*.18),s.castShadow=!0,e.add(s)}return e}function we(){let e=new v,t=Y.floorY,n=new v,r=new P(new T(1,1.05,1),ue({key:`planter`,size:.25}));r.position.y=.525,r.castShadow=!0,r.receiveShadow=!0;let i=new P(new T(.88,.02,.88),new u({color:`#2b2118`,roughness:1}));i.position.y=1;let a=Ce();a.position.y=.98,n.add(r,i,a),n.position.set(-5.35,t,-6.7),n.scale.setScalar(1.15),n.rotation.y=.18,e.add(n);let o=new v,s=J({key:`granite`,base:`#9d9cab`,cloud:`#c9c8d4`,vein:`#4d4b5e`,scale:3.2,veinFreq:.6,veinAmt:.25,mottle:1,roughness:.22}),c=new P(new x(1.05,1.05,.1,72),s);c.position.y=1.02;let l=new P(new F([new Q(.001,0),new Q(.5,0),new Q(.5,.05),new Q(.16,.12),new Q(.09,.3),new Q(.085,.55),new Q(.17,.64),new Q(.09,.74),new Q(.11,.92),new Q(.3,.97),new Q(.001,.97)],48),fe({roughness:.2})),d=[new Q(.001,0),new Q(.2,0),new Q(.22,.04)];for(let e=1;e<=12;e++){let t=e/12*(Math.PI/2);d.push(new Q(.22+Math.sin(t)*.38,.04+(1-Math.cos(t))*.3))}d.push(new Q(.62,.345),new Q(.585,.35));for(let e=12;e>=0;e--){let t=e/12*(Math.PI/2);d.push(new Q(.001+Math.sin(t)*.575,.08+(1-Math.cos(t))*.265))}let f=new P(new F(d,64),new u({color:`#f2c45e`,metalness:.6,roughness:.32,envMapIntensity:1.5,side:2}));f.position.y=1.07;for(let e of[c,l,f])e.castShadow=!0,e.receiveShadow=!0;return o.add(c,l,f),o.position.set(5.25,t,-6.2),o.scale.setScalar(1.22),e.add(o),{group:e}}var Te={zenith:`#203cc4`,horizon:`#b7c4f3`,horizonSun:`#d4dcfa`,sea:`#1b2766`,cloud:`#ffffff`,cloudShade:`#97a1d8`,fog:`#bcc8f2`,sunColor:`#fff1dc`,sunIntensity:3.6,sunDir:[-.46,.6,.66],hemiSky:`#d3d8f4`,hemiGround:`#3a3c58`,hemiIntensity:.62,deep:`#14205f`,exposure:.96,glow:0},Ee={zenith:`#1a1c58`,horizon:`#a493cf`,horizonSun:`#ffad73`,sea:`#17173f`,cloud:`#ffcfae`,cloudShade:`#6e5c99`,fog:`#b59fce`,sunColor:`#ffae63`,sunIntensity:2.3,sunDir:[-.22,.1,-.97],hemiSky:`#a092d6`,hemiGround:`#251f3e`,hemiIntensity:.75,deep:`#15153f`,exposure:1.05,glow:1};function De(e){let t={};for(let[n,r]of Object.entries(e))t[n]=typeof r==`string`?new D(r):Array.isArray(r)?new g(...r).normalize():r;return t}var Oe=De(Te),ke=De(Ee);function Ae(){return De(Te)}function je(e,t){for(let n of Object.keys(Oe)){let r=Oe[n],i=ke[n];r.isColor?e[n].copy(r).lerp(i,t):r.isVector3?e[n].copy(r).lerp(i,t).normalize():e[n]=r+(i-r)*t}return e}var $=[{name:`The pavilion`,pos:[0,1.75,7.6],look:[0,3.5,-40],fov:60,phone:{look:[0,.6,-40],fov:70}},{name:`The crystal`,pos:[-2.6,3.3,5.4],look:[0,5,-2.6],fov:56},{name:`Out to sea`,pos:[.6,1.8,-11.4],look:[-16,9,-150],fov:56},{name:`The cliffs`,pos:[-30,3.6,-100],look:[42,30,-320],fov:56},{name:`Late light`,pos:[36,9,-232],look:[108,52,-410],fov:56},{name:`Dusk`,pos:[9,3.4,-46],look:[0,3.6,-1],fov:52}];function Me(e){let t=(t,n)=>e&&t.phone?.[n]||t[n];return{pos:new b($.map(e=>new g(...t(e,`pos`))),!1,`centripetal`),look:new b($.map(e=>new g(...t(e,`look`))),!1,`centripetal`),fov:$.map(e=>t(e,`fov`))}}function Ne(){let e=Me(!1),t=Me(!0),n=e,r=$.length-1;return{last:r,setAspect(r){n=r<.7?t:e},sample(e,t,i){let a=f.clamp(e,0,r);n.pos.getPoint(a/r,t),n.look.getPoint(a/r,i);let o=Math.min(r-1,Math.floor(a));return f.lerp(n.fov[o],n.fov[o+1],a-o)}}}var Pe=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},Fe=e=>e<.5?4*e*e*e:1-(-2*e+2)**3/2;function Ie(t,{reducedMotion:n=!1,still:r=!1,onReady:i,onFrame:a}={}){let l=t.parentElement,u=new ee({canvas:t,antialias:!0,preserveDrawingBuffer:r});u.toneMapping=4,u.shadowMap.enabled=!0,u.shadowMap.type=1,u.shadowMap.autoUpdate=!1;let d=Math.min(window.devicePixelRatio||1,1.25),p=.5,m=new e;m.fog=new C(12372210,75e-5);let h=new c(60,1,.25,7e3),_=Ae(),v=ie(u,je(Ae(),0)),y=ie(u,je(Ae(),1)),b=ae(v,y);m.add(b.mesh);let x=new te(u),w=[x.fromCubemap(v.texture).texture,x.fromCubemap(y.texture).texture];x.dispose();let T=new S(16777215,3);T.castShadow=!0,T.shadow.mapSize.set(2048,2048),Object.assign(T.shadow.camera,{left:-15,right:15,top:15,bottom:-15,near:1,far:90}),T.shadow.bias=-4e-4,T.shadow.normalBias=.03,T.target.position.set(0,0,Y.midZ);let E=new ne(16777215,2236996,1);m.add(T,T.target,E);let D=se({width:256,height:256});m.add(D.mesh);let O=be({mirrorSize:{width:256,height:256}});m.add(O.group);let k=xe();m.add(k.group),m.add(we().group),m.add(ge());let A=Ne(),j=new g,M=new g,N=0,P=null,F=0,I=0,re=-1,L=0,R=0,oe=!1,z=!1,B=!n&&!r;function V(){!L&&oe&&(R=performance.now(),L=requestAnimationFrame(ce))}function H(){let e=Math.max(1,l.clientWidth),t=Math.max(1,l.clientHeight);u.setPixelRatio(d),u.setSize(e,t,!1),h.aspect=e/t,h.updateProjectionMatrix(),A.setAspect(h.aspect);let n=Math.round(e*d*p),r=Math.round(t*d*p);D.mesh.getRenderTarget().setSize(n,r),O.mirror.getRenderTarget().setSize(n,r),V()}function U(e){je(_,e),b.setMix(e),D.apply(_,F),m.fog.color.copy(_.fog),T.color.copy(_.sunColor),T.intensity=_.sunIntensity,T.position.copy(T.target.position).addScaledVector(_.sunDir,50),E.color.copy(_.hemiSky),E.groundColor.copy(_.hemiGround),E.intensity=_.hemiIntensity,u.toneMappingExposure=_.exposure,k.mesh.material.emissiveIntensity=_.glow*1.4,k.light.intensity=_.glow*45,m.environment=e>.5?w[1]:w[0],Math.abs(e-re)>.03&&(u.shadowMap.needsUpdate=!0,re=e)}function ce(e){L=0;let t=Math.min(.05,Math.max(0,(e-R)/1e3));R=e;let n=!1;if(P){let t=Math.min(1,(e-P.start)/P.dur);N=P.from+(P.to-P.from)*Fe(t),t<1?n=!0:P=null}B?(F+=t,k.mesh.rotation.y+=t*(.32+I),I*=Math.exp(-t*1.3),k.group.position.y=k.baseY+Math.sin(F*.9)*.07,b.setRotation(F*.0025)):(I>.02&&(k.mesh.rotation.y+=t*I,I*=Math.exp(-t*1.3),n=!0),n&&(F+=t));let r=A.sample(N,j,M);B&&(M.x+=Math.sin(F*.21)*.35,M.y+=Math.sin(F*.17)*.18,j.x+=Math.sin(F*.13)*.12),h.position.copy(j),h.lookAt(M),Math.abs(r-h.fov)>.01&&(h.fov=r,h.updateProjectionMatrix());let o=Pe(3,A.last,N);U(o),u.render(m,h),a?.({t:N,moving:n,dusk:o}),z||(z=!0,i?.()),(n||B)&&V()}function W(e){let t=f.clamp(e,0,A.last);t!==(P?P.to:N)&&(n?(P=null,N=t):P={from:N,to:t,start:performance.now(),dur:1e3*Math.min(3.4,1.2+.55*Math.abs(t-N))},V())}let G=new s,K=new o;function q(e){let n=t.getBoundingClientRect();return K.set((e.clientX-n.left)/n.width*2-1,-((e.clientY-n.top)/n.height)*2+1),G.setFromCamera(K,h),G.intersectObject(k.mesh,!1).length>0}return t.addEventListener(`pointermove`,e=>{t.style.cursor=q(e)?`pointer`:``}),t.addEventListener(`click`,e=>{q(e)&&(I=n?2:7,V())}),(u.compileAsync?u.compileAsync(m,h):Promise.resolve()).catch(()=>{}).then(()=>{oe=!0,new ResizeObserver(H).observe(l),H()}),{goTo:W,jump(e){P=null,N=f.clamp(e,0,A.last),V()},shots:$,debug:{renderer:u,scene:m,camera:h,get t(){return N}}}}export{Ie as createWorld};