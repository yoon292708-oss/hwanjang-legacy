// =============================================================
//  combat.js - 3D 스킬 이펙트 / 투사체 / 몬스터 AI / 소환수 / 데미지 팝업
// =============================================================
import * as THREE from 'three';
import { instance, playAnim } from './assets.js';
import { getTerrainY } from './world.js';

function vfxMat(color, opacity = 0.92, emissiveInt = 0.78) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: emissiveInt,
    roughness: 0.22,
    metalness: 0.25,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
  });
}

function setGroupOpacity(obj, op) {
  obj.traverse((ch) => {
    if (ch.isMesh && ch.material) {
      const base = ch.material.userData.baseOp ?? 0.92;
      ch.material.opacity = base * Math.max(0, op);
    }
  });
}

function buildProjectileModel(shape, color, radius = 0.55) {
  const g = new THREE.Group();
  const s = Math.max(0.45, radius * 1.45);
  const mk = (geo, col, op = 0.95, ei = 0.85) => {
    const m = vfxMat(col, op, ei);
    m.userData.baseOp = op;
    return new THREE.Mesh(geo, m);
  };

  if (shape === 'crescent') {
    const arc = mk(new THREE.TorusGeometry(s * 1.25, s * 0.16, 10, 24, Math.PI * 1.15), color, 0.96, 1.0);
    arc.rotation.x = Math.PI / 2;
    arc.rotation.z = -Math.PI * 0.08;
    const inner = mk(new THREE.TorusGeometry(s * 0.95, s * 0.09, 8, 20, Math.PI * 0.95), 0xffffff, 0.88, 1.2);
    inner.rotation.x = Math.PI / 2;
    const gem = mk(new THREE.OctahedronGeometry(s * 0.34, 0), 0xfef08a, 0.95, 1.1);
    g.add(arc, inner, gem);
  } else if (shape === 'blade') {
    const wing = mk(new THREE.TorusGeometry(s * 1.05, s * 0.15, 8, 18, Math.PI * 0.88), color, 0.95, 0.9);
    wing.rotation.x = Math.PI / 2;
    wing.rotation.z = Math.PI * 0.06;
    const core = mk(new THREE.ConeGeometry(s * 0.26, s * 1.9, 6), 0xffffff, 0.9, 1.1);
    core.rotation.x = Math.PI / 2;
    g.add(wing, core);
  } else if (shape === 'arrow') {
    const shaft = mk(new THREE.CylinderGeometry(s * 0.07, s * 0.07, s * 2.1, 8), 0xfef08a, 0.95, 0.7);
    shaft.rotation.x = Math.PI / 2;
    const tip = mk(new THREE.ConeGeometry(s * 0.24, s * 0.65, 6), color, 0.98, 1.0);
    tip.rotation.x = Math.PI / 2;
    tip.position.z = s * 1.15;
    const ring = mk(new THREE.TorusGeometry(s * 0.32, s * 0.05, 6, 16), color, 0.85, 0.9);
    ring.position.z = -s * 0.5;
    g.add(shaft, tip, ring);
  } else if (shape === 'spear') {
    const pole = mk(new THREE.CylinderGeometry(s * 0.08, s * 0.08, s * 2.5, 8), 0xe2e8f0, 0.92, 0.5);
    pole.rotation.x = Math.PI / 2;
    const head = mk(new THREE.ConeGeometry(s * 0.28, s * 0.95, 4), color, 0.98, 1.0);
    head.rotation.x = Math.PI / 2;
    head.position.z = s * 1.35;
    const aura = mk(new THREE.TorusGeometry(s * 0.42, s * 0.07, 8, 18), color, 0.85, 0.95);
    aura.position.z = s * 0.6;
    g.add(pole, head, aura);
  } else {
    // 'orb'
    const core = mk(new THREE.OctahedronGeometry(s * 0.65, 1), color, 0.96, 1.0);
    const r1 = mk(new THREE.TorusGeometry(s * 0.95, s * 0.08, 8, 22), 0xffffff, 0.88, 1.1);
    const r2 = mk(new THREE.TorusGeometry(s * 1.1, s * 0.07, 8, 22), color, 0.82, 0.9);
    r1.rotation.x = Math.PI / 3;
    r2.rotation.y = Math.PI / 3;
    g.add(core, r1, r2);
  }
  return g;
}

function buildMeteorModel(shape, color) {
  const g = new THREE.Group();
  const mk = (geo, col, op = 0.96, ei = 0.9) => {
    const m = vfxMat(col, op, ei);
    m.userData.baseOp = op;
    return new THREE.Mesh(geo, m);
  };

  if (shape === 'sword') {
    // Giant 3D radiant sword plunging point-down
    const blade = mk(new THREE.ConeGeometry(0.52, 4.4, 4), 0xf8fafc, 0.96, 1.05);
    blade.rotation.x = Math.PI;
    blade.position.y = 0.2;
    const guard = mk(new THREE.BoxGeometry(2.1, 0.26, 0.42), color, 0.96, 0.9);
    guard.position.y = 2.45;
    const hilt = mk(new THREE.CylinderGeometry(0.16, 0.16, 1.1, 8), 0xfacc15, 0.95, 0.7);
    hilt.position.y = 3.05;
    const halo = mk(new THREE.TorusGeometry(1.45, 0.1, 8, 28), color, 0.9, 1.1);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 2.4;
    g.add(blade, guard, hilt, halo);
  } else if (shape === 'moon') {
    const orb = mk(new THREE.SphereGeometry(1.55, 20, 20), color, 0.96, 1.05);
    const r1 = mk(new THREE.TorusGeometry(2.3, 0.14, 10, 32), 0xffffff, 0.9, 1.15);
    const r2 = mk(new THREE.TorusGeometry(2.75, 0.11, 10, 32), color, 0.85, 0.95);
    r1.rotation.x = Math.PI * 0.36;
    r2.rotation.x = -Math.PI * 0.36;
    r2.rotation.y = Math.PI * 0.25;
    g.add(orb, r1, r2);
  } else {
    const rock = mk(new THREE.DodecahedronGeometry(1.45, 0), color, 0.96, 0.9);
    const ring1 = mk(new THREE.TorusGeometry(2.05, 0.14, 8, 24), 0xfef08a, 0.9, 1.1);
    const ring2 = mk(new THREE.TorusGeometry(2.35, 0.1, 8, 24), color, 0.85, 0.95);
    ring1.rotation.x = Math.PI / 2.6;
    ring2.rotation.y = Math.PI / 2.6;
    g.add(rock, ring1, ring2);
  }
  return g;
}

export class VFXManager {
  constructor(scene, damageLayer) {
    this.scene = scene;
    this.damageLayer = damageLayer;
    this.effects = [];
    this.projectiles = [];
    this.telegraphs = [];
  }

  clear() {
    for (const e of this.effects) this.scene.remove(e.mesh);
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    for (const t of this.telegraphs) this.scene.remove(t.group);
    this.effects = [];
    this.projectiles = [];
    this.telegraphs = [];
  }

  slashArc(x, y, z, yaw, color = 0x38bdf8, radius = 3.2) {
    const g = new THREE.Group();
    const m1 = vfxMat(color, 0.92, 0.9); m1.userData.baseOp = 0.92;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.78, 0.16, 8, 24, Math.PI * 0.92), m1);
    arc.rotation.x = Math.PI / 2;
    arc.rotation.z = -Math.PI * 0.46;
    const m2 = vfxMat(0xffffff, 0.85, 1.1); m2.userData.baseOp = 0.85;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.9, 0.07, 6, 24, Math.PI * 0.86), m2);
    rim.rotation.x = Math.PI / 2;
    rim.rotation.z = -Math.PI * 0.43;
    g.add(arc, rim);
    g.position.set(x, y + 1.05, z);
    g.rotation.y = yaw;
    g.rotation.z = 0.22;
    this.scene.add(g);
    this.effects.push({ mesh: g, age: 0, dur: 0.26, type: 'slash', spinY: 2.2 });
  }

  ringBurst(x, y, z, radius = 5.0, color = 0x22d3ee) {
    const g = new THREE.Group();
    const mk = (geo, col, op = 0.9) => { const m = vfxMat(col, op, 0.95); m.userData.baseOp = op; return new THREE.Mesh(geo, m); };
    const torus = mk(new THREE.TorusGeometry(0.9, 0.12, 10, 32), color, 0.92);
    torus.rotation.x = Math.PI / 2;
    torus.position.y = 0.25;
    g.add(torus);
    const spikeGeo = new THREE.ConeGeometry(0.18, 1.25, 5);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const sp = mk(spikeGeo, i % 2 === 0 ? color : 0xffffff, 0.85);
      sp.position.set(Math.cos(a) * 0.75, 0.6, Math.sin(a) * 0.75);
      sp.rotation.z = -Math.cos(a) * 0.35;
      sp.rotation.x = Math.sin(a) * 0.35;
      g.add(sp);
    }
    g.position.set(x, y + 0.1, z);
    this.scene.add(g);
    this.effects.push({ mesh: g, age: 0, dur: 0.48, type: 'burst', targetScale: Math.max(2.5, radius * 0.9), spinY: 4.5 });
  }

  meteor(tx, ty, tz, radius = 6.5, color = 0xf43f5e, onImpact = null, shape = 'meteor') {
    const mesh = buildMeteorModel(shape, color);
    mesh.position.set(shape === 'sword' ? tx : tx + 4, ty + 18, shape === 'sword' ? tz : tz + 4);
    this.scene.add(mesh);
    this.effects.push({
      mesh, age: 0, dur: 0.48, type: 'meteor',
      startPos: mesh.position.clone(),
      endPos: new THREE.Vector3(tx, ty + (shape === 'sword' ? 1.8 : 1.0), tz),
      radius, color, onImpact,
      spinY: shape === 'sword' ? 6.0 : 3.2,
    });
  }

  spawnProjectile({ x, y, z, vx, vz, radius = 0.45, color = 0x38bdf8, dur = 1.4, pierce = false, shape = 'orb', onHit }) {
    const mesh = buildProjectileModel(shape, color, radius);
    mesh.position.set(x, y + 1.15, z);
    mesh.rotation.y = Math.atan2(vx, vz);
    this.scene.add(mesh);
    const spin = shape === 'orb' || shape === 'crescent' ? 7.5 : 0;
    this.projectiles.push({ mesh, vx, vz, age: 0, dur, pierce, hitIds: new Set(), spin, onHit });
  }

  spawnTelegraph(x, z, radius, duration, zoneId, onStrike) {
    const y = getTerrainY(zoneId, x, z) + 0.08;
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const outer = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.18, radius, 40),
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
    );
    outer.rotation.x = -Math.PI / 2;
    group.add(outer);

    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 40),
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
    );
    fill.rotation.x = -Math.PI / 2;
    fill.scale.setScalar(0.05);
    group.add(fill);

    this.scene.add(group);
    this.telegraphs.push({ group, fill, x, y, z, radius, age: 0, dur: duration, onStrike });
  }

  popupText(worldPos, text, cls = 'normal', camera) {
    if (!this.damageLayer || !camera) return;
    const v = worldPos.clone();
    v.y += 2.2;
    v.project(camera);
    if (v.z > 1) return;
    const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
    const el = document.createElement('div');
    el.className = `dmg-pop ${cls}`;
    el.textContent = text;
    el.style.left = `${sx + (Math.random() - 0.5) * 26}px`;
    el.style.top = `${sy}px`;
    this.damageLayer.appendChild(el);
    setTimeout(() => el.remove(), 820);
  }

  update(dt, mobs, zoneId) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.age += dt;
      const k = Math.min(1, e.age / e.dur);
      if (e.spinY) e.mesh.rotation.y += e.spinY * dt;
      if (e.type === 'slash') {
        e.mesh.scale.setScalar(0.85 + k * 0.5);
        setGroupOpacity(e.mesh, 1 - k);
      } else if (e.type === 'burst') {
        e.mesh.scale.setScalar(0.8 + k * (e.targetScale || 5));
        setGroupOpacity(e.mesh, 1 - k);
      } else if (e.type === 'meteor') {
        e.mesh.position.lerpVectors(e.startPos, e.endPos, k);
        if (k >= 1) {
          this.ringBurst(e.endPos.x, e.endPos.y - 0.6, e.endPos.z, e.radius, e.color);
          if (e.onImpact) e.onImpact(e.endPos);
        }
      }
      if (k >= 1) {
        this.scene.remove(e.mesh);
        this.effects.splice(i, 1);
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.position.y = getTerrainY(zoneId, p.mesh.position.x, p.mesh.position.z) + 1.15;
      if (p.spin) p.mesh.rotation.y += p.spin * dt;

      let remove = p.age >= p.dur;
      for (const m of mobs) {
        if (m.dead || p.hitIds.has(m.uid)) continue;
        const dist = Math.hypot(m.x - p.mesh.position.x, m.z - p.mesh.position.z);
        if (dist <= (m.hitRadius || 1.6)) {
          p.hitIds.add(m.uid);
          if (p.onHit) p.onHit(m);
          if (!p.pierce) { remove = true; break; }
        }
      }
      if (remove) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const t = this.telegraphs[i];
      t.age += dt;
      const k = Math.min(1, t.age / t.dur);
      t.fill.scale.setScalar(Math.max(0.05, k));
      if (k >= 1) {
        this.ringBurst(t.x, t.y, t.z, t.radius, 0xef4444);
        if (t.onStrike) t.onStrike(t.x, t.z, t.radius);
        this.scene.remove(t.group);
        this.telegraphs.splice(i, 1);
      }
    }
  }
}

export class MonsterManager {
  constructor(scene, worldUiLayer, vfx) {
    this.scene = scene;
    this.worldUiLayer = worldUiLayer;
    this.vfx = vfx;
    this.mobs = [];
    this.summons = [];
    this.nextUid = 1;
    this.zoneToken = 0;
  }

  clear() {
    this.zoneToken++;
    for (const m of this.mobs) {
      if (m.root) this.scene.remove(m.root);
      if (m.hpEl) m.hpEl.remove();
    }
    for (const s of this.summons) {
      if (s.root) this.scene.remove(s.root);
      if (s.hpEl) s.hpEl.remove();
    }
    this.mobs = [];
    this.summons = [];
  }

  async spawnMob(def, x, z, zoneId, opts = {}) {
    const token = this.zoneToken;
    const uid = this.nextUid++;
    const y = getTerrainY(zoneId, x, z);

    const placeholder = new THREE.Group();
    placeholder.position.set(x, y, z);
    this.scene.add(placeholder);

    const mob = {
      uid,
      id: def.id,
      name: opts.nameOverride || def.name,
      level: opts.levelOverride || def.level || 1,
      hp: opts.hpOverride || def.hp,
      maxHp: opts.hpOverride || def.hp,
      atk: opts.atkOverride || def.atk,
      spd: def.spd || 3.8,
      exp: opts.expOverride ?? def.exp,
      gold: opts.goldOverride ?? def.gold,
      stone: opts.stoneOverride ?? (def.stone || 0),
      crystal: opts.crystalOverride ?? (def.crystal || 1),
      isBoss: !!(opts.isBoss ?? def.isBoss),
      isWorldBoss: !!opts.isWorldBoss,
      isMeteorCore: !!opts.isMeteorCore,
      zoneId,
      spawnX: x,
      spawnZ: z,
      x, y, z,
      ry: Math.random() * Math.PI * 2,
      hitRadius: Math.max(1.4, (def.size || 1.6) * 0.65),
      atkRange: def.isBoss ? 4.4 : 2.3,
      atkCd: 0,
      specialCd: 3.5,
      stunTimer: 0,
      dead: false,
      respawnTimer: 0,
      noRespawn: !!opts.noRespawn,
      root: placeholder,
      inst: null,
      hpEl: null,
      hpFill: null,
    };

    // UI Nameplate
    const el = document.createElement('div');
    el.className = `mob-plate ${mob.isBoss ? 'boss' : ''}`;
    el.innerHTML = `<div class="mob-name">Lv.${mob.level} ${mob.name}</div><div class="mob-bar"><div class="mob-fill"></div></div>`;
    this.worldUiLayer.appendChild(el);
    mob.hpEl = el;
    mob.hpFill = el.querySelector('.mob-fill');
    this.mobs.push(mob);

    try {
      const inst = await instance(def.model, {
        height: def.size || 1.8,
        tint: def.tint,
        emissive: def.emissive,
      });
      if (token !== this.zoneToken) {
        this.scene.remove(placeholder);
        el.remove();
        return null;
      }
      placeholder.add(inst.root);
      mob.inst = inst;
      playAnim(inst, ['idle', 'flying', 'chest_close']);
    } catch {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(def.size * 0.7, def.size, def.size * 0.7),
        new THREE.MeshStandardMaterial({ color: def.tint || 0xef4444 })
      );
      box.position.y = (def.size || 1.6) * 0.5;
      placeholder.add(box);
    }
    return mob;
  }

  async spawnSummon(px, pz, zoneId, atkPower, duration = 22) {
    const token = this.zoneToken;
    if (this.summons.length >= 4) {
      const old = this.summons.shift();
      this.scene.remove(old.root);
      if (old.hpEl) old.hpEl.remove();
    }
    const sx = px + (Math.random() - 0.5) * 4;
    const sz = pz + (Math.random() - 0.5) * 4;
    const sy = getTerrainY(zoneId, sx, sz);

    const group = new THREE.Group();
    group.position.set(sx, sy, sz);
    this.scene.add(group);

    const el = document.createElement('div');
    el.className = 'mob-plate summon';
    el.innerHTML = `<div class="mob-name">💀 해골 전사</div>`;
    this.worldUiLayer.appendChild(el);

    const s = {
      root: group,
      inst: null,
      hpEl: el,
      x: sx, y: sy, z: sz,
      ry: 0,
      atk: Math.max(12, Math.floor(atkPower * 0.75)),
      atkCd: 0,
      ttl: duration,
    };
    this.summons.push(s);

    try {
      const inst = await instance('mobs/Skeleton_Warrior.glb', { height: 1.75, tint: 0xc084fc, emissive: 0x6b21a8 });
      if (token !== this.zoneToken) {
        this.scene.remove(group);
        el.remove();
        return;
      }
      group.add(inst.root);
      s.inst = inst;
      playAnim(inst, ['idle']);
    } catch {}
  }

  update(dt, player, zoneId, camera, onPlayerDamaged, onMobDamagedBySummon) {
    // Update Monsters
    for (const m of this.mobs) {
      const distPlayer = Math.hypot(m.x - player.x, m.z - player.z);
      if (distPlayer < 68 && m.inst?.mixer) m.inst.mixer.update(dt);

      if (m.dead) {
        if (m.hpEl) m.hpEl.style.display = 'none';
        if (!m.noRespawn) {
          m.respawnTimer -= dt;
          if (m.respawnTimer <= 0) {
            m.dead = false;
            m.hp = m.maxHp;
            m.x = m.spawnX;
            m.z = m.spawnZ;
            m.y = getTerrainY(zoneId, m.x, m.z);
            m.root.position.set(m.x, m.y, m.z);
            m.root.visible = true;
            if (m.inst) playAnim(m.inst, ['idle', 'flying', 'chest_close']);
          }
        }
        continue;
      }

      if (m.stunTimer > 0) {
        m.stunTimer -= dt;
        if (m.inst) playAnim(m.inst, ['idle', 'flying', 'chest_close']);
      } else if (!m.isMeteorCore) {
        const dx = player.x - m.x;
        const dz = player.z - m.z;
        const dist = Math.hypot(dx, dz);
        const aggroDist = m.isBoss ? 26 : 16;

        if (!player.dead && dist < aggroDist) {
          m.ry = Math.atan2(dx, dz);
          m.root.rotation.y = m.ry;

          if (dist > m.atkRange) {
            const step = m.spd * dt;
            m.x += (dx / dist) * step;
            m.z += (dz / dist) * step;
            m.y = getTerrainY(zoneId, m.x, m.z);
            m.root.position.set(m.x, m.y, m.z);
            if (m.inst) playAnim(m.inst, ['run', 'gallop', 'flying', 'walk', 'jump', 'chest_open']);
          } else {
            if (m.atkCd <= 0) {
              m.atkCd = m.isBoss ? 1.5 : 1.35;
              if (m.inst) playAnim(m.inst, ['attack', 'bite', 'chop', 'headbutt', 'chest_open'], { loop: false });
              onPlayerDamaged(m.atk, m);
            } else {
              if (m.inst && m.atkCd < 0.7) playAnim(m.inst, ['idle', 'flying', 'chest_close']);
            }
          }

          // Boss Special Telegraph Attack
          if (m.isBoss && dist < 18) {
            m.specialCd -= dt;
            if (m.specialCd <= 0) {
              m.specialCd = 6.0;
              const tx = player.x;
              const tz = player.z;
              this.vfx.spawnTelegraph(tx, tz, 5.2, 1.35, zoneId, (sx, sz, rad) => {
                if (Math.hypot(player.x - sx, player.z - sz) <= rad) {
                  onPlayerDamaged(Math.floor(m.atk * 1.85), m, true);
                }
              });
            }
          }
        } else {
          // Return near spawn
          const sx = m.spawnX - m.x;
          const sz = m.spawnZ - m.z;
          const sd = Math.hypot(sx, sz);
          if (sd > 2.5) {
            m.ry = Math.atan2(sx, sz);
            m.root.rotation.y = m.ry;
            m.x += (sx / sd) * (m.spd * 0.65) * dt;
            m.z += (sz / sd) * (m.spd * 0.65) * dt;
            m.y = getTerrainY(zoneId, m.x, m.z);
            m.root.position.set(m.x, m.y, m.z);
            if (m.inst) playAnim(m.inst, ['walk', 'run', 'flying']);
          } else if (m.inst) {
            playAnim(m.inst, ['idle', 'flying', 'chest_close']);
          }
        }
      }

      if (m.atkCd > 0) m.atkCd -= dt;

      // Update nameplate projection
      if (m.hpEl && camera) {
        const v = new THREE.Vector3(m.x, m.y + (m.isBoss ? 4.4 : 2.3), m.z).project(camera);
        const distCam = Math.hypot(m.x - player.x, m.z - player.z);
        if (v.z > 1 || distCam > 42) {
          m.hpEl.style.display = 'none';
        } else {
          m.hpEl.style.display = 'block';
          m.hpEl.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
          m.hpEl.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
          m.hpFill.style.width = `${Math.max(0, (m.hp / m.maxHp) * 100)}%`;
        }
      }
    }

    // Update Necromancer Summons
    for (let i = this.summons.length - 1; i >= 0; i--) {
      const s = this.summons[i];
      s.ttl -= dt;
      if (s.ttl <= 0) {
        this.scene.remove(s.root);
        if (s.hpEl) s.hpEl.remove();
        this.summons.splice(i, 1);
        continue;
      }
      if (s.inst?.mixer) s.inst.mixer.update(dt);
      if (s.atkCd > 0) s.atkCd -= dt;

      let target = null;
      let bestD = 22;
      for (const m of this.mobs) {
        if (m.dead) continue;
        const d = Math.hypot(m.x - s.x, m.z - s.z);
        if (d < bestD) { bestD = d; target = m; }
      }

      if (target) {
        const dx = target.x - s.x;
        const dz = target.z - s.z;
        const d = Math.hypot(dx, dz);
        s.ry = Math.atan2(dx, dz);
        s.root.rotation.y = s.ry;
        if (d > 2.2) {
          s.x += (dx / d) * 7.2 * dt;
          s.z += (dz / d) * 7.2 * dt;
          s.y = getTerrainY(zoneId, s.x, s.z);
          s.root.position.set(s.x, s.y, s.z);
          if (s.inst) playAnim(s.inst, ['running_a', 'walk']);
        } else if (s.atkCd <= 0) {
          s.atkCd = 0.9;
          if (s.inst) playAnim(s.inst, ['1h_melee_attack_chop', 'attack'], { loop: false });
          this.vfx.slashArc(s.x, s.y, s.z, s.ry, 0xa855f7, 2.2);
          onMobDamagedBySummon(target, s.atk);
        }
      } else {
        const dx = player.x - s.x;
        const dz = player.z - s.z;
        const d = Math.hypot(dx, dz);
        if (d > 4.2) {
          s.ry = Math.atan2(dx, dz);
          s.root.rotation.y = s.ry;
          s.x += (dx / d) * 7.8 * dt;
          s.z += (dz / d) * 7.8 * dt;
          s.y = getTerrainY(zoneId, s.x, s.z);
          s.root.position.set(s.x, s.y, s.z);
          if (s.inst) playAnim(s.inst, ['running_a', 'walk']);
        } else if (s.inst) {
          playAnim(s.inst, ['idle']);
        }
      }

      if (s.hpEl && camera) {
        const v = new THREE.Vector3(s.x, s.y + 2.2, s.z).project(camera);
        if (v.z > 1) s.hpEl.style.display = 'none';
        else {
          s.hpEl.style.display = 'block';
          s.hpEl.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
          s.hpEl.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
        }
      }
    }
  }
}
