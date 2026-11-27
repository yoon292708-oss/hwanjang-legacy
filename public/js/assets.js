// =============================================================
//  assets.js - GLB 로더 / 캐시 / 정규화 / 애니메이션 / 무기 장착
// =============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const cache = new Map();
const metaCache = new Map();
export const BASE = './assets/';

export function loadGLB(path) {
  const url = path.startsWith('.') || path.startsWith('/') ? path : BASE + path;
  if (cache.has(url)) return cache.get(url);
  const p = new Promise((resolve, reject) => {
    loader.load(
      url,
      (g) => {
        g.scene.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            if (o.isSkinnedMesh) {
              o.frustumCulled = false;
              const sw = o.geometry?.attributes?.skinWeight;
              if (sw) {
                let fixed = false;
                for (let i = 0; i < sw.count; i++) {
                  let x = sw.getX(i), y = sw.getY(i), z = sw.getZ(i), w = sw.getW(i);
                  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(w) || (x + y + z + w) <= 0) {
                    x = Number.isFinite(x) ? Math.max(0, x) : 0;
                    y = Number.isFinite(y) ? Math.max(0, y) : 0;
                    z = Number.isFinite(z) ? Math.max(0, z) : 0;
                    w = Number.isFinite(w) ? Math.max(0, w) : 0;
                    const sum = x + y + z + w;
                    if (sum > 0) sw.setXYZW(i, x / sum, y / sum, z / sum, w / sum);
                    else sw.setXYZW(i, 1, 0, 0, 0);
                    fixed = true;
                  }
                }
                if (fixed) sw.needsUpdate = true;
              }
            }
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((m) => {
              if (!m) return;
              if (m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.anisotropy = 4; }
              if (m.metalness !== undefined) {
                m.metalness = 0.05;
                m.roughness = Math.max(m.roughness ?? 0.85, 0.65);
              }
              const mn = (m.name || '').toLowerCase();
              if (!m.map && m.color && !mn.includes('eye') && !mn.includes('black') && !mn.includes('pupil')) {
                const lum = m.color.r + m.color.g + m.color.b;
                if (lum > 0 && lum < 0.16) m.color.offsetHSL(0, 0, 0.08);
              }
            });
          }
        });
        resolve(g);
      },
      undefined,
      (e) => {
        console.warn('GLB load fail:', url, e);
        reject(e);
      }
    );
  });
  cache.set(url, p);
  return p;
}

function isFiniteBox(b) {
  return b && !b.isEmpty()
    && Number.isFinite(b.min.x) && Number.isFinite(b.min.y) && Number.isFinite(b.min.z)
    && Number.isFinite(b.max.x) && Number.isFinite(b.max.y) && Number.isFinite(b.max.z);
}

function measure(url, scene) {
  if (metaCache.has(url)) return metaCache.get(url);
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  scene.traverse((o) => {
    if (o.isSkinnedMesh) {
      o.computeBoundingBox();
      if (isFiniteBox(o.boundingBox)) {
        tmp.copy(o.boundingBox).applyMatrix4(o.matrixWorld);
        if (isFiniteBox(tmp)) box.union(tmp);
      } else if (o.geometry) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        if (isFiniteBox(o.geometry.boundingBox)) {
          tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
          if (isFiniteBox(tmp)) box.union(tmp);
        }
      }
    } else if (o.isMesh) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      if (isFiniteBox(o.geometry.boundingBox)) {
        tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        if (isFiniteBox(tmp)) box.union(tmp);
      }
    }
  });
  if (!isFiniteBox(box)) {
    box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
  }
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const meta = { height: Math.max(0.05, size.y || 1), size, minY: box.min.y, center, box };
  metaCache.set(url, meta);
  return meta;
}

function hasSkin(scene) {
  let f = false;
  scene.traverse((o) => { if (o.isSkinnedMesh) f = true; });
  return f;
}

export function applyTint(model, { tint, emissive, emissiveIntensity = 0.35, opacity } = {}) {
  const tc = tint ? new THREE.Color(tint) : null;
  const ec = emissive ? new THREE.Color(emissive) : null;
  model.traverse((o) => {
    if (!o.isMesh) return;
    const conv = (m) => {
      const c = m.clone();
      const mn = (c.name || '').toLowerCase();
      const skipPart = mn.includes('eye') || mn.includes('white') || mn.includes('teeth') || mn.includes('horn') || mn.includes('black');
      if (tc && !skipPart) {
        if (c.map) c.color.lerp(tc, 0.35);
        else c.color.lerp(tc, 0.48);
      }
      if (ec && c.emissive && !skipPart) { c.emissive.copy(ec); c.emissiveIntensity = emissiveIntensity; }
      if (opacity !== undefined && opacity < 1) {
        c.transparent = true;
        c.opacity = opacity;
        c.depthWrite = opacity > 0.6;
      }
      return c;
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
  });
}

export function setVisibleParts(model, hide = [], show = []) {
  const hs = (hide || []).map((s) => s.toLowerCase());
  const ss = (show || []).map((s) => s.toLowerCase());
  model.traverse((o) => {
    const n = (o.name || '').toLowerCase();
    if (!n) return;
    if (hs.some((h) => n === h || n.startsWith(h + '_'))) o.visible = false;
  });
  if (ss.length) {
    model.traverse((o) => {
      const n = (o.name || '').toLowerCase();
      if (ss.some((s) => n === s || n.startsWith(s + '_'))) {
        o.traverse((ch) => { ch.visible = true; });
      }
    });
  }
}

export async function instance(path, opts = {}) {
  const g = await loadGLB(path);
  const url = path.startsWith('.') || path.startsWith('/') ? path : BASE + path;
  const meta = measure(url, g.scene);
  const skinned = g.animations.length > 0 || hasSkin(g.scene);
  const model = skinned ? SkeletonUtils.clone(g.scene) : g.scene.clone(true);
  const root = new THREE.Group();
  const holder = new THREE.Group();
  root.add(holder);
  holder.add(model);

  let s = 1;
  if (opts.height) s = opts.height / meta.height;
  else if (opts.width) s = opts.width / Math.max(meta.size.x, meta.size.z || 1);
  else if (opts.scale) s = opts.scale;

  holder.scale.setScalar(s);
  model.position.set(opts.center ? -meta.center.x : 0, -meta.minY, opts.center ? -meta.center.z : 0);
  if (opts.yaw) holder.rotation.y = opts.yaw;
  if (opts.tint || opts.emissive || opts.opacity !== undefined) applyTint(model, opts);
  if (opts.hide || opts.show) setVisibleParts(model, opts.hide, opts.show);

  let mixer = null;
  const actions = {};
  if (g.animations.length) {
    mixer = new THREE.AnimationMixer(model);
    for (const clip of g.animations) {
      const name = clip.name.includes('|') ? clip.name.split('|').pop() : clip.name;
      actions[name] = mixer.clipAction(clip);
    }
  }
  return { root, holder, model, mixer, actions, clips: g.animations, meta, scale: s, currentAction: null, currentKey: '' };
}

export function playAnim(inst, keywords, { loop = true, fade = 0.14, speed = 1 } = {}) {
  if (!inst || !inst.mixer) return null;
  const keys = Object.keys(inst.actions);
  if (!keys.length) return null;
  const kwList = Array.isArray(keywords) ? keywords : [keywords];
  let matched = null;
  for (const kw of kwList) {
    const low = kw.toLowerCase();
    matched = keys.find((k) => k.toLowerCase() === low) || keys.find((k) => k.toLowerCase().includes(low));
    if (matched) break;
  }
  if (!matched) matched = keys[0];
  const next = inst.actions[matched];
  if (!next) return null;

  next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
  next.clampWhenFinished = !loop;
  next.timeScale = speed;

  if (inst.currentAction === next) {
    if (!loop) next.reset().play();
    return matched;
  }
  next.reset().play();
  if (inst.currentAction) {
    inst.currentAction.crossFadeTo(next, fade, true);
  }
  inst.currentAction = next;
  inst.currentKey = matched;
  return matched;
}

function findBone(root, candidates) {
  let found = null;
  const lows = candidates.map((c) => c.toLowerCase());
  root.traverse((o) => {
    if (found) return;
    if (o.isBone || o.type === 'Object3D') {
      const n = (o.name || '').toLowerCase();
      if (lows.includes(n)) found = o;
    }
  });
  return found;
}

export async function attachWeapon(inst, itemPath, opts = {}) {
  if (!inst || !itemPath) return null;
  try {
    const g = await loadGLB(itemPath);
    const url = itemPath.startsWith('.') || itemPath.startsWith('/') ? itemPath : BASE + itemPath;
    const meta = measure(url, g.scene);
    const clone = g.scene.clone(true);
    const maxDim = Math.max(meta.size.x, meta.size.y, meta.size.z, 0.2);
    const targetLen = opts.size || 1.05;
    const sc = (targetLen / maxDim) / (inst.scale || 1);
    const wrap = new THREE.Group();
    wrap.add(clone);
    wrap.scale.setScalar(sc);
    if (opts.tint || opts.emissive) applyTint(clone, opts);
    wrap.rotation.set(opts.rx ?? Math.PI * 0.45, opts.ry ?? 0, opts.rz ?? 0);
    wrap.position.set(opts.px ?? 0, opts.py ?? 0.08, opts.pz ?? 0.05);

    const hand = findBone(inst.model, ['handr', 'hand_r', 'handslotr', 'righthand']);
    if (hand) {
      hand.add(wrap);
    } else {
      wrap.position.set(0.45, 1.0, 0.35);
      inst.root.add(wrap);
    }
    return wrap;
  } catch (e) {
    console.warn('attachWeapon failed:', itemPath, e);
    return null;
  }
}

export function attachFanWeapon(inst, opts = {}) {
  if (!inst) return null;
  const col = opts.color ?? 0xef4444;
  const rimCol = opts.rimColor ?? 0xfacc15;
  const fan = new THREE.Group();

  const ribMat = new THREE.MeshStandardMaterial({ color: rimCol, metalness: 0.4, roughness: 0.35, emissive: rimCol, emissiveIntensity: 0.25 });
  const leafMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.15, emissive: col, emissiveIntensity: 0.55, side: THREE.DoubleSide });

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.35, 8), ribMat);
  handle.position.y = 0.12;
  fan.add(handle);

  const count = 7;
  for (let i = 0; i < count; i++) {
    const ang = ((i - (count - 1) / 2) / ((count - 1) / 2)) * 0.92;
    const rib = new THREE.Group();
    rib.position.y = 0.22;
    rib.rotation.z = ang;
    const stick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.72, 0.02), ribMat);
    stick.position.y = 0.36;
    const petal = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.56, 0.015), leafMat);
    petal.position.y = 0.44;
    rib.add(stick);
    rib.add(petal);
    fan.add(rib);
  }

  const sc = (1.15 / (inst.scale || 1));
  fan.scale.setScalar(sc);
  fan.rotation.set(Math.PI * 0.38, 0, 0);
  fan.position.set(0, 0.06, 0.04);

  const hand = findBone(inst.model, ['handr', 'hand_r', 'handslotr', 'righthand']);
  if (hand) hand.add(fan);
  else { fan.position.set(0.5, 1.1, 0.3); inst.root.add(fan); }
  return fan;
}

export async function staticParts(path) {
  const g = await loadGLB(path);
  const url = path.startsWith('.') || path.startsWith('/') ? path : BASE + path;
  const meta = measure(url, g.scene);
  const parts = [];
  g.scene.updateMatrixWorld(true);
  g.scene.traverse((o) => {
    if (o.isMesh && !o.isSkinnedMesh) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.length === 1) {
        parts.push({ geometry: o.geometry, material: mats[0], matrix: o.matrixWorld.clone() });
      } else {
        o.geometry.groups.forEach((gr) => {
          const sub = o.geometry.clone();
          sub.clearGroups();
          const idx = sub.index;
          if (idx) {
            const arr = idx.array.slice(gr.start, gr.start + gr.count);
            sub.setIndex(new THREE.BufferAttribute(arr, 1));
          }
          parts.push({ geometry: sub, material: mats[gr.materialIndex], matrix: o.matrixWorld.clone() });
        });
      }
    }
  });
  return { parts, meta };
}

export async function preload(list, onEach) {
  let done = 0;
  await Promise.all(
    list.map((p) =>
      loadGLB(p)
        .catch(() => null)
        .then(() => {
          done++;
          if (onEach) onEach(done, list.length, p);
        })
    )
  );
}

const rawSkillCache = new Map();

function buildCenteredRawGLB(entry, targetSize = 2.0, centerY = true) {
  const { scene, meta } = entry;
  const clone = scene.clone(true);
  const maxDim = Math.max(meta.size.x, meta.size.y, meta.size.z, 0.2);
  const s = targetSize / maxDim;
  clone.scale.setScalar(s);
  const yShift = centerY ? -meta.center.y * s : -meta.minY * s;
  clone.position.set(-meta.center.x * s, yShift, -meta.center.z * s);
  const wrap = new THREE.Group();
  wrap.add(clone);
  return wrap;
}

export async function preloadRawSkillGLBs(paths) {
  await Promise.all(paths.map(async (p) => {
    try {
      const g = await loadGLB(p);
      const url = p.startsWith('.') || p.startsWith('/') ? p : BASE + p;
      const meta = measure(url, g.scene);
      rawSkillCache.set(p, { scene: g.scene, meta });
    } catch {}
  }));
}

export function spawnCachedSkillGLB(path, targetSize = 2.0, centerY = true) {
  const cached = rawSkillCache.get(path);
  if (cached) return buildCenteredRawGLB(cached, targetSize, centerY);
  const holder = new THREE.Group();
  loadGLB(path).then((g) => {
    const url = path.startsWith('.') || path.startsWith('/') ? path : BASE + path;
    const entry = { scene: g.scene, meta: measure(url, g.scene) };
    rawSkillCache.set(path, entry);
    holder.add(buildCenteredRawGLB(entry, targetSize, centerY));
  }).catch(() => {});
  return holder;
}
