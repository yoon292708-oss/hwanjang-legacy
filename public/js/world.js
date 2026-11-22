// =============================================================
//  world.js - 335m 대형 심리스 오픈월드 (마을+봄+대초원+여름+바다+사막+가을+유적지+겨울+결투장)
//  - 중앙 로비 통나무 원형 울타리 + 해자 물길 + 4방위 돌다리
//  - 사막·바다(모래섬+돌다리)·고대 유적지(성벽/폐허)·대초원(풍차/밀밭) + InstancedMesh 식생
// =============================================================
import * as THREE from 'three';
import { instance, staticParts } from './assets.js';
import { ZONES, REGIONS, TRAINERS } from './data.js';

export function isOnBridgeOrRoad(x, z) {
  const r = Math.hypot(x, z);
  if (r <= 33) return true;
  if (r <= 275 && (Math.abs(x) < 5.5 || Math.abs(z) < 5.5)) return true;
  if (Math.hypot(x - 115, z + 115) <= 36) return true;
  return false;
}

export function getTerrainY(zoneId, x, z) {
  if (zoneId !== 'world') return 0;
  const r = Math.hypot(x, z);
  // 중앙 마을 해자 물길
  const onNSBridge = Math.abs(x) < 4.6 && Math.abs(z) >= 33 && Math.abs(z) <= 45;
  const onEWBridge = Math.abs(z) < 4.6 && Math.abs(x) >= 33 && Math.abs(x) <= 45;
  if (r >= 34.5 && r <= 43.0 && !onNSBridge && !onEWBridge) {
    return -1.05;
  }
  if (onNSBridge || onEWBridge) {
    const distFromCenterMoat = Math.abs(r - 38.75) / 4.5;
    return Math.max(0, (1 - distFromCenterMoat * distFromCenterMoat) * 0.45);
  }
  // 남동쪽 에메랄드 바다 & 모래섬 지형
  const oceanD = Math.hypot(x - 190, z - 190);
  if (oceanD < 94) {
    const isl1 = Math.hypot(x - 165, z - 165);
    const isl2 = Math.hypot(x - 215, z - 215);
    const isl3 = Math.hypot(x - 162, z - 224);
    const islandMin = Math.min(isl1, isl2, isl3);
    if (islandMin < 20) return 0.25 * (1 - islandMin / 20);
    // 걷기 가능한 얕은 바다 바닥
    return -0.35;
  }

  if (r <= 47 || isOnBridgeOrRoad(x, z)) return 0;
  const edge = Math.min(1, (r - 47) / 45);
  // 사막 지역은 모래 언덕 굴곡 조금 더 강조
  const isDesert = x > Math.abs(z) && r > 170;
  const amp = isDesert ? 2.1 : 1.35;
  return (Math.sin(x * 0.04) * Math.cos(z * 0.04) * amp + Math.sin((x + z) * 0.022) * 0.7) * edge;
}

export function resolveWorldCollisions(zoneId, x, z) {
  if (zoneId !== 'world') return { x, z };
  const r = Math.hypot(x, z);
  // 통나무 원형 울타리 (r = 31.5, 4방위 10m 출입구 제외)
  if (r > 30.3 && r < 32.7) {
    const inGate = (Math.abs(x) < 4.8 && Math.abs(z) > 25) || (Math.abs(z) < 4.8 && Math.abs(x) > 25);
    if (!inGate) {
      const targetR = r < 31.5 ? 30.3 : 32.7;
      return { x: (x / r) * targetR, z: (z / r) * targetR };
    }
  }
  // 해자 물길 진입 방지 (돌다리로 건너도록 유도)
  if (r > 34.4 && r < 43.2) {
    const onNSBridge = Math.abs(x) < 4.4 && Math.abs(z) >= 33 && Math.abs(z) <= 45;
    const onEWBridge = Math.abs(z) < 4.4 && Math.abs(x) >= 33 && Math.abs(x) <= 45;
    if (!onNSBridge && !onEWBridge) {
      const targetR = r < 38.8 ? 34.4 : 43.2;
      return { x: (x / r) * targetR, z: (z / r) * targetR };
    }
  }
  return { x, z };
}

function seededRand(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export class WorldBuilder {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.portals = [];
    this.npcs = [];
    this.bonfires = [];
    this.dummies = [];
    this.particles = null;
    this.waterMeshes = [];
    this.buildToken = 0;
  }

  clear() {
    this.buildToken++;
    while (this.group.children.length) {
      this.group.remove(this.group.children.pop());
    }
    this.portals = [];
    this.npcs = [];
    this.bonfires = [];
    this.dummies = [];
    this.particles = null;
    this.waterMeshes = [];
  }

  async build(zoneId) {
    this.clear();
    const token = this.buildToken;
    const z = ZONES[zoneId] || ZONES.world;

    this.scene.background = new THREE.Color(z.skyColor);
    this.scene.fog = new THREE.FogExp2(z.fogColor, zoneId === 'world' ? 0.0034 : 0.0075);

    this._buildTerrain(zoneId, z);
    this._buildBoundaryRing(z);
    this._buildPortals(zoneId, z);
    this._buildAmbientParticles(zoneId, z);

    if (zoneId === 'world') {
      await this._buildSeamlessContinent(token);
    } else {
      await this._buildDungeon(zoneId, token);
    }
  }

  _buildTerrain(zoneId, z) {
    const size = z.radius * 2.3;
    const seg = zoneId === 'world' ? 170 : 64;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = [];

    const colVillage = new THREE.Color(0xcab99b);
    const colSpring = new THREE.Color(0x4f9d59);
    const colMeadow = new THREE.Color(0x74b843);
    const colSummer = new THREE.Color(0xe3c782);
    const colDesert = new THREE.Color(0xe6a147);
    const colOcean = new THREE.Color(0xdcc994);
    const colAutumn = new THREE.Color(0x9a5931);
    const colRuins = new THREE.Color(0x4b5563);
    const colWinter = new THREE.Color(0xdbeafe);
    const colArena = new THREE.Color(0x6c6662);
    const colRoad = new THREE.Color(0x9ca3af);
    const colMoat = new THREE.Color(0x1e4a5e);
    const baseCol = new THREE.Color(z.groundColor);
    const accCol = new THREE.Color(z.accentColor);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const pz = pos.getZ(i);
      const y = getTerrainY(zoneId, x, pz);
      pos.setY(i, y);

      if (zoneId === 'world') {
        const r = Math.hypot(x, pz);
        const arenaD = Math.hypot(x - 115, pz + 115);
        const oceanD = Math.hypot(x - 190, pz - 190);
        if (r <= 34.5) {
          const n = (Math.sin(x * 0.4) * Math.cos(pz * 0.4) + 1) * 0.04;
          tmp.copy(colVillage).offsetHSL(0, 0, n - 0.02);
        } else if (r < 43.2 && y < -0.2) {
          tmp.copy(colMoat);
        } else if (arenaD <= 35) {
          tmp.copy(colArena);
        } else if (oceanD <= 95) {
          tmp.copy(colOcean);
        } else {
          const outerBlend = Math.max(0, Math.min(1, (r - 155) / 35));
          const sCol = tmp.clone().copy(colSpring).lerp(colMeadow, outerBlend);
          const eCol = new THREE.Color(colSummer).lerp(colDesert, outerBlend);
          const wCol = new THREE.Color(colAutumn).lerp(colRuins, outerBlend);
          const nCol = colWinter;

          const wS = Math.max(0, pz / Math.max(1, r) - 0.2);
          const wN = Math.max(0, -pz / Math.max(1, r) - 0.2);
          const wE = Math.max(0, x / Math.max(1, r) - 0.2);
          const wW = Math.max(0, -x / Math.max(1, r) - 0.2);
          const sum = wS + wN + wE + wW || 1;
          tmp.setRGB(
            (sCol.r * wS + nCol.r * wN + eCol.r * wE + wCol.r * wW) / sum,
            (sCol.g * wS + nCol.g * wN + eCol.g * wE + wCol.g * wW) / sum,
            (sCol.b * wS + nCol.b * wN + eCol.b * wE + wCol.b * wW) / sum
          );

          if (r <= 270 && (Math.abs(x) < 4.5 || Math.abs(pz) < 4.5)) {
            tmp.lerp(colRoad, 0.72);
          } else {
            tmp.offsetHSL(0, 0, Math.sin(x * 0.12) * Math.cos(pz * 0.12) * 0.04);
          }
        }
      } else {
        const n = (Math.sin(x * 0.14) * Math.cos(pz * 0.14) + 1) * 0.5;
        tmp.copy(baseCol).lerp(accCol, n * 0.16);
      }
      colors.push(tmp.r, tmp.g, tmp.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.04 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.group.add(mesh);

    if (zoneId === 'world') {
      // 마을 외곽 해자 수면
      const moatWater = new THREE.Mesh(
        new THREE.RingGeometry(34.5, 43.2, 96).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.25,
          roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.82,
        })
      );
      moatWater.position.y = -0.32;
      this.group.add(moatWater);
      this.waterMeshes.push({ mesh: moatWater, baseY: -0.32 });

      // 남동쪽 에메랄드 바다 수면 (걷기 가능한 얕은 청록빛 바다!)
      const oceanWater = new THREE.Mesh(
        new THREE.CircleGeometry(94, 72).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({
          color: 0x06b6d4, emissive: 0x0369a1, emissiveIntensity: 0.3,
          roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.78,
        })
      );
      oceanWater.position.set(190, -0.15, 190);
      this.group.add(oceanWater);
      this.waterMeshes.push({ mesh: oceanWater, baseY: -0.15 });
    }
  }

  _buildBoundaryRing(z) {
    const ringGeo = new THREE.RingGeometry(z.radius - 1.0, z.radius + 1.0, 96);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: z.accentColor, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.08;
    this.group.add(ring);
  }

  _buildPortals(zoneId, z) {
    for (const p of z.portals || []) {
      const [px, , pz] = p.pos;
      const py = getTerrainY(zoneId, px, pz);
      const g = new THREE.Group();
      g.position.set(px, py, pz);

      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(2.1, 0.18, 12, 32),
        new THREE.MeshStandardMaterial({ color: p.color, emissive: p.color, emissiveIntensity: 0.85, roughness: 0.25 })
      );
      torus.position.y = 2.3;
      g.add(torus);

      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(1.9, 28),
        new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
      );
      disc.position.y = 2.3;
      g.add(disc);

      this.group.add(g);
      this.portals.push({ ...p, group: g, torus, x: px, y: py, z: pz });
    }
  }

  _buildAmbientParticles(zoneId, z) {
    const count = 300;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * z.radius * 1.4;
      pos[i * 3 + 1] = 0.6 + Math.random() * 14;
      pos[i * 3 + 2] = (Math.random() - 0.5) * z.radius * 1.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: zoneId === 'world' ? 0xfef9c3 : 0xc084fc,
      size: 0.3,
      transparent: true,
      opacity: 0.72,
    });
    const pts = new THREE.Points(geo, mat);
    this.group.add(pts);
    this.particles = { pts, mat, zoneId, radius: z.radius };
  }

  async _place(path, x, z, opts = {}, token) {
    try {
      const inst = await instance(path, opts);
      if (token !== this.buildToken) return null;
      const y = opts.y !== undefined ? opts.y : getTerrainY(opts.zoneId || 'world', x, z);
      inst.root.position.set(x, y, z);
      if (opts.rotY !== undefined) inst.root.rotation.y = opts.rotY;
      this.group.add(inst.root);
      return inst;
    } catch {
      return null;
    }
  }

  async _placeInstanced(path, transforms, targetHeight, token, zoneId = 'world') {
    if (!transforms.length) return;
    try {
      const { parts, meta } = await staticParts(path);
      if (token !== this.buildToken || !parts.length) return;
      const baseScale = targetHeight / (meta.height || 1);
      const dummy = new THREE.Object3D();

      for (const part of parts) {
        const im = new THREE.InstancedMesh(part.geometry, part.material, transforms.length);
        im.castShadow = true;
        im.receiveShadow = true;
        const m4 = new THREE.Matrix4();
        for (let i = 0; i < transforms.length; i++) {
          const tr = transforms[i];
          const s = baseScale * (tr.scale || 1);
          const y = tr.y !== undefined ? tr.y : getTerrainY(zoneId, tr.x, tr.z);
          dummy.position.set(tr.x, y - meta.minY * s, tr.z);
          dummy.rotation.set(0, tr.rotY || 0, 0);
          dummy.scale.setScalar(s);
          dummy.updateMatrix();
          m4.multiplyMatrices(dummy.matrix, part.matrix);
          im.setMatrixAt(i, m4);
        }
        im.instanceMatrix.needsUpdate = true;
        this.group.add(im);
      }
    } catch {}
  }

  async _buildSeamlessContinent(token) {
    const villageProps = [
      ['village/Bonfire_Lit.glb', 0, 0, { height: 2.1 }],
      ['village/Well.glb', 9, 7, { height: 3.0 }],
      ['village/Inn.glb', -19, -8, { height: 8.8, rotY: Math.PI * 0.35 }],
      ['village/Blacksmith.glb', 19, -7, { height: 7.4, rotY: -Math.PI * 0.4 }],
      ['village/House_1.glb', -20, 15, { height: 6.8, rotY: Math.PI * 0.5 }],
      ['village/House_2.glb', 20, 16, { height: 7.0, rotY: -Math.PI * 0.5 }],
      ['village/Bell_Tower.glb', -14, -21, { height: 11.5 }],
      ['village/MarketStand_1.glb', 12, 16, { height: 3.5, rotY: -Math.PI * 0.65 }],
      ['village/Gazebo.glb', -12, 19, { height: 5.2 }],
      ['village/Bench_1.glb', 5, -5, { height: 1.0, rotY: 0.7 }],
      ['village/Bench_2.glb', -5, 5, { height: 1.0, rotY: -2.4 }],
      ['village/Barrel.glb', 16, -12, { height: 1.2 }],
      ['village/Crate.glb', 17.5, -11, { height: 1.1 }],
    ];

    const fireLight = new THREE.PointLight(0xff944d, 4.5, 24);
    fireLight.position.set(0, 2.2, 0);
    this.group.add(fireLight);
    const healRing = new THREE.Mesh(
      new THREE.RingGeometry(4.2, 4.5, 44),
      new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.48, side: THREE.DoubleSide })
    );
    healRing.rotation.x = -Math.PI / 2;
    healRing.position.y = 0.06;
    this.group.add(healRing);
    this.bonfires.push({ x: 0, z: 0, r: 5.8, light: fireLight });

    this._buildLobbyLogFence(token);
    this._buildBridgesAndPaths(token);

    const npcDefs = [
      { id: 'quest', name: '📜 길드장 엘린 (퀘스트)', path: 'npc_f/Adventurer.glb', x: -10, z: -8, rotY: 0.5, action: 'openQuest' },
      { id: 'upgrade', name: '⚒️ 대장장이 볼칸', path: 'npc_m/Worker.glb', x: 13, z: -5, rotY: -0.6, action: 'openUpgrade' },
      { id: 'dungeon', name: '🌀 차원 안내인 세라', path: 'npc_f/Witch.glb', x: 14, z: 8, rotY: -1.1, action: 'openDungeon' },
      { id: 'market', name: '💎 거래소 상인 리나', path: 'npc_f/Casual.glb', x: 10, z: 13, rotY: -2.4, action: 'openMarket' },
      ...Object.values(TRAINERS).map((tr) => ({
        id: tr.id,
        name: tr.name,
        path: tr.model,
        tint: tr.tint,
        x: tr.x,
        z: tr.z,
        rotY: tr.rotY,
        action: 'openClass',
        trainerId: tr.id,
        isTrainer: true,
      })),
    ];

    await Promise.all([
      ...villageProps.map(([p, x, z, o]) => this._place(p, x, z, { ...o, zoneId: 'world' }, token)),
      ...npcDefs.map(async (n) => {
        const ny = getTerrainY('world', n.x, n.z);
        const inst = await this._place(n.path, n.x, n.z, { height: 2.1, rotY: n.rotY, tint: n.tint, zoneId: 'world' }, token);
        if (inst && token === this.buildToken) {
          inst.model.traverse((b) => {
            if (!b.isBone) return;
            if (b.name === 'UpperArmL') b.rotation.z = -1.15;
            if (b.name === 'UpperArmR') b.rotation.z = 1.15;
            if (b.name === 'LowerArmL') b.rotation.z = -0.2;
            if (b.name === 'LowerArmR') b.rotation.z = 0.2;
          });
          if (n.isTrainer) {
            const aura = new THREE.Mesh(
              new THREE.RingGeometry(1.15, 1.5, 32),
              new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
            );
            aura.rotation.x = -Math.PI / 2;
            aura.position.set(n.x, ny + 0.08, n.z);
            this.group.add(aura);
          }
          this.npcs.push({ ...n, inst, y: ny });
        }
      }),
      this._buildArenaArea(token),
      this._buildLandmarkBiomes(token),
      this._buildContinentNature(token),
    ]);
  }

  _buildLobbyLogFence(token) {
    const R = 31.5;
    const postTransforms = [];
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.88 });
    const count = 88;
    const posts = [];

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R;
      const inGate = (Math.abs(x) < 4.9 && Math.abs(z) > 24) || (Math.abs(z) < 4.9 && Math.abs(x) > 24);
      if (inGate) {
        posts.push(null);
        continue;
      }
      postTransforms.push({ x, z, rotY: -a, scale: 1.0, y: 0 });
      posts.push({ x, z });
    }
    for (const [gx, gz] of [[4.8, 31.5], [-4.8, 31.5], [4.8, -31.5], [-4.8, -31.5], [31.5, 4.8], [31.5, -4.8], [-31.5, 4.8], [-31.5, -4.8]]) {
      postTransforms.push({ x: gx, z: gz, rotY: 0, scale: 1.32, y: 0 });
    }
    this._placeInstanced('nature/WoodLog.glb', postTransforms, 2.25, token, 'world');

    for (let i = 0; i < count; i++) {
      const p1 = posts[i];
      const p2 = posts[(i + 1) % count];
      if (!p1 || !p2) continue;
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const dist = Math.hypot(dx, dz);
      const midX = (p1.x + p2.x) * 0.5;
      const midZ = (p1.z + p2.z) * 0.5;
      const ang = Math.atan2(dx, dz);

      for (const h of [0.75, 1.45]) {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, dist + 0.15, 8), barkMat);
        rail.rotation.x = Math.PI / 2;
        const wrap = new THREE.Group();
        wrap.position.set(midX, h, midZ);
        wrap.rotation.y = ang;
        wrap.add(rail);
        rail.castShadow = true;
        this.group.add(wrap);
      }
    }
  }

  _buildBridgesAndPaths(token) {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.78 });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });

    const bridges = [
      { x: 0, z: 38.8, rotY: 0 },
      { x: 0, z: -38.8, rotY: 0 },
      { x: 38.8, z: 0, rotY: Math.PI / 2 },
      { x: -38.8, z: 0, rotY: Math.PI / 2 },
    ];
    for (const b of bridges) {
      this._place('castle/Bridge.glb', b.x, b.z, { height: 4.5, rotY: b.rotY, y: -0.25, zoneId: 'world' }, token);

      const g = new THREE.Group();
      g.position.set(b.x, 0, b.z);
      g.rotation.y = b.rotY;

      const deck = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.55, 11.4), stoneMat);
      deck.position.y = -0.05;
      deck.receiveShadow = true;
      deck.castShadow = true;
      g.add(deck);

      for (const sx of [-3.4, 3.4]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.9, 11.2), curbMat);
        rail.position.set(sx, 0.45, 0);
        rail.castShadow = true;
        g.add(rail);
        for (const sz of [-5.2, 0, 5.2]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.35, 0.75), curbMat);
          post.position.set(sx, 0.68, sz);
          post.castShadow = true;
          g.add(post);
        }
      }
      this.group.add(g);
    }

    // 4방위 외곽 대륙까지 이어지는 긴 돌길
    const pathTiles = [];
    for (let d = 46; d <= 262; d += 5.5) {
      pathTiles.push({ x: 0, z: d, rotY: 0, scale: 1.1 });
      pathTiles.push({ x: 0, z: -d, rotY: 0, scale: 1.1 });
      pathTiles.push({ x: d, z: 0, rotY: Math.PI / 2, scale: 1.1 });
      pathTiles.push({ x: -d, z: 0, rotY: Math.PI / 2, scale: 1.1 });
    }
    this._placeInstanced('village/Path_Straight.glb', pathTiles, 0.35, token, 'world');

    // 바다 모래섬을 잇는 돌다리 & 개울 돌다리
    this._place('castle/Bridge.glb', 188, 188, { height: 4.0, rotY: Math.PI * 0.25, y: -0.25, zoneId: 'world' }, token);
    this._place('castle/Bridge.glb', -34, 96, { height: 3.4, rotY: 1.9, zoneId: 'world' }, token);

    // 모든 지역 보스 제단 링
    for (const reg of Object.values(REGIONS)) {
      if (!reg.bossPos) continue;
      const [bx, bz] = reg.bossPos;
      const altar = new THREE.Mesh(
        new THREE.RingGeometry(9.5, 10.3, 48),
        new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
      );
      altar.rotation.x = -Math.PI / 2;
      altar.position.set(bx, getTerrainY('world', bx, bz) + 0.08, bz);
      this.group.add(altar);
      this._place('castle/Banner.glb', bx - 8, bz, { height: 4.5, zoneId: 'world' }, token);
      this._place('castle/Banner.glb', bx + 8, bz, { height: 4.5, zoneId: 'world' }, token);
    }
  }

  async _buildLandmarkBiomes(token) {
    const jobs = [
      // 🌾 대초원 (남쪽 외곽): 풍차, 마차, 건초더미
      this._place('village/Mill.glb', -24, 215, { height: 12.5, rotY: 0.4, zoneId: 'world' }, token),
      this._place('village/Mill.glb', 28, 240, { height: 12.5, rotY: -0.5, zoneId: 'world' }, token),
      this._place('village/Cart.glb', -14, 195, { height: 2.2, rotY: 0.9, zoneId: 'world' }, token),
      this._place('village/Hay.glb', -18, 202, { height: 1.8, zoneId: 'world' }, token),
      this._place('village/Hay.glb', 22, 228, { height: 1.8, zoneId: 'world' }, token),
      this._place('village/House_3.glb', 22, 205, { height: 7.0, rotY: -0.8, zoneId: 'world' }, token),

      // 🏛️ 고대 유적지 (서쪽 외곽): 부서진 성벽, 유적 탑, 아치 입구
      this._place('castle/WallEntranceBricks.glb', -176, 0, { height: 9.0, rotY: Math.PI / 2, zoneId: 'world' }, token),
      this._place('castle/LargeSquareTowerBricks.glb', -215, -24, { height: 16.0, zoneId: 'world' }, token),
      this._place('castle/LargeSquareTowerBricks.glb', -215, 24, { height: 16.0, zoneId: 'world' }, token),
      this._place('castle/SimpleTowerBricks.glb', -250, -35, { height: 13.0, zoneId: 'world' }, token),
      this._place('castle/SimpleTowerBricks.glb', -250, 35, { height: 13.0, zoneId: 'world' }, token),
      this._place('castle/TallWallBricks.glb', -232, -28, { height: 7.5, rotY: 0.25, zoneId: 'world' }, token),
      this._place('castle/TallWallBricks.glb', -232, 28, { height: 7.5, rotY: -0.25, zoneId: 'world' }, token),
      this._place('castle/WallBricks.glb', -265, -22, { height: 5.5, rotY: 0.9, zoneId: 'world' }, token),
      this._place('castle/WallBricks.glb', -265, 22, { height: 5.5, rotY: -0.9, zoneId: 'world' }, token),

      // 🏜️ 대사막 (동쪽 외곽): 유적 감시탑 & 폐허 장식
      this._place('castle/WatchTowerWRoof.glb', 210, -25, { height: 12.0, rotY: -0.4, zoneId: 'world' }, token),
      this._place('castle/Watchtower.glb', 238, 28, { height: 11.0, rotY: 0.6, zoneId: 'world' }, token),

      // 🌊 바다 모래섬 위 야자수 & 보물 상자 장식
      this._place('nature/PalmTree_1.glb', 165, 165, { height: 8.5, zoneId: 'world' }, token),
      this._place('nature/PalmTree_2.glb', 215, 215, { height: 9.0, zoneId: 'world' }, token),
      this._place('nature/PalmTree_3.glb', 162, 224, { height: 8.2, zoneId: 'world' }, token),
    ];
    await Promise.all(jobs);
  }

  async _buildArenaArea(token) {
    const cx = 115, cz = -115;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(28, 29.2, 64),
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(cx, 0.07, cz);
    this.group.add(ring);

    const jobs = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      jobs.push(this._place('castle/Tower.glb', cx + Math.cos(a) * 32, cz + Math.sin(a) * 32, { height: 11, zoneId: 'world' }, token));
    }
    for (const [dx, dz] of [[cx - 10, cz - 8], [cx + 10, cz - 8]]) {
      jobs.push(
        this._place('castle/Dummy.glb', dx, dz, { height: 2.2, zoneId: 'world' }, token).then((inst) => {
          if (inst && token === this.buildToken) this.dummies.push({ x: dx, z: dz, inst });
        })
      );
    }
    await Promise.all(jobs);
  }

  async _buildContinentNature(token) {
    const rand = seededRand(20261122);
    const buckets = new Map();
    const pushBucket = (path, x, z, scale = 1) => {
      if (!buckets.has(path)) buckets.set(path, []);
      buckets.get(path).push({ x, z, rotY: rand() * Math.PI * 2, scale });
    };

    const isBlocked = (x, z) => {
      const r = Math.hypot(x, z);
      if (r < 46) return true;
      if (Math.abs(x) < 8 || Math.abs(z) < 8) return true;
      if (Math.hypot(x - 115, z + 115) < 38) return true;
      for (const reg of Object.values(REGIONS)) {
        if (reg.bossPos && Math.hypot(x - reg.bossPos[0], z - reg.bossPos[1]) < 15) return true;
      }
      return false;
    };

    const biomeSets = {
      spring: {
        trees: ['nature/BirchTree_1.glb', 'nature/BirchTree_2.glb', 'nature/CommonTree_1.glb', 'nature/CommonTree_3.glb', 'nature/Willow_2.glb'],
        grass: ['nature/Grass.glb', 'nature/Grass_2.glb', 'nature/Grass_Short.glb', 'nature/Flowers.glb', 'nature/BushBerries_1.glb'],
        rocks: ['nature/Rock_1.glb', 'nature/Rock_3.glb', 'nature/Rock_Moss_2.glb'],
      },
      meadow: {
        trees: ['nature/CommonTree_4.glb', 'nature/CommonTree_5.glb', 'nature/BirchTree_3.glb', 'nature/Willow_3.glb'],
        grass: ['nature/Grass.glb', 'nature/Grass_2.glb', 'nature/Flowers.glb', 'nature/Wheat.glb', 'nature/Corn_1.glb'],
        rocks: ['nature/Rock_1.glb', 'nature/Rock_2.glb'],
      },
      summer: {
        trees: ['nature/PalmTree_1.glb', 'nature/PalmTree_2.glb', 'nature/PalmTree_3.glb'],
        grass: ['nature/Cactus_1.glb', 'nature/Cactus_3.glb', 'nature/CactusFlowers_2.glb', 'nature/Grass_Short.glb'],
        rocks: ['nature/Rock_2.glb', 'nature/Rock_4.glb', 'nature/Rock_5.glb'],
      },
      desert: {
        trees: ['nature/BirchTree_Dead_1.glb', 'nature/CommonTree_Dead_1.glb', 'nature/PalmTree_4.glb'],
        grass: ['nature/Cactus_2.glb', 'nature/Cactus_4.glb', 'nature/Cactus_5.glb', 'nature/CactusFlowers_2.glb'],
        rocks: ['nature/Rock_4.glb', 'nature/Rock_5.glb', 'nature/Rock_6.glb', 'nature/Rock_7.glb'],
      },
      ocean: {
        trees: ['nature/PalmTree_1.glb', 'nature/PalmTree_4.glb'],
        grass: ['nature/Lilypad.glb'],
        rocks: ['nature/Rock_2.glb', 'nature/Rock_3.glb'],
      },
      autumn: {
        trees: ['nature/CommonTree_Autumn_1.glb', 'nature/CommonTree_Autumn_2.glb', 'nature/BirchTree_Autumn_1.glb', 'nature/Willow_Autumn_1.glb'],
        grass: ['nature/Grass_2.glb', 'nature/Bush_2.glb', 'nature/Plant_2.glb', 'nature/WoodLog_Moss.glb'],
        rocks: ['nature/Rock_Moss_1.glb', 'nature/Rock_Moss_3.glb', 'nature/Rock_6.glb'],
      },
      ruins: {
        trees: ['nature/Willow_Dead_1.glb', 'nature/Willow_Dead_2.glb', 'nature/CommonTree_Dead_2.glb'],
        grass: ['nature/Bush_1.glb', 'nature/WoodLog_Moss.glb', 'nature/TreeStump_Moss.glb'],
        rocks: ['nature/Rock_Moss_4.glb', 'nature/Rock_Moss_5.glb', 'nature/Rock_Moss_6.glb', 'nature/Rock_7.glb'],
      },
      winter: {
        trees: ['nature/PineTree_Snow_1.glb', 'nature/PineTree_Snow_2.glb', 'nature/CommonTree_Snow_1.glb', 'nature/BirchTree_Snow_1.glb'],
        grass: ['nature/Bush_Snow_1.glb', 'nature/Bush_Snow_2.glb', 'nature/TreeStump_Snow.glb'],
        rocks: ['nature/Rock_Snow_1.glb', 'nature/Rock_Snow_3.glb', 'nature/Rock_Snow_5.glb'],
      },
    };

    const getBiome = (x, z) => {
      const r = Math.hypot(x, z);
      if (Math.hypot(x - 190, z - 190) <= 95) return 'ocean';
      if (z >= Math.abs(x)) return r > 170 ? 'meadow' : 'spring';
      if (x > Math.abs(z)) return r > 170 ? 'desert' : 'summer';
      if (-x > Math.abs(z)) return r > 170 ? 'ruins' : 'autumn';
      return 'winter';
    };

    // 나무 ~250그루
    for (let i = 0; i < 270; i++) {
      const ang = rand() * Math.PI * 2;
      const dist = 50 + rand() * 265;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      if (isBlocked(x, z)) continue;
      const bKey = getBiome(x, z);
      if (bKey === 'ocean') continue; // 바다 물 위에는 나무 대신 연잎만
      const b = biomeSets[bKey];
      const m = b.trees[Math.floor(rand() * b.trees.length)];
      pushBucket(m, x, z, 0.8 + rand() * 0.55);
    }

    // 풀 / 꽃 / 밀밭 / 선인장 / 연잎 ~900개
    for (let i = 0; i < 950; i++) {
      const ang = rand() * Math.PI * 2;
      const dist = 46 + rand() * 270;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      if (isBlocked(x, z)) continue;
      const bKey = getBiome(x, z);
      const b = biomeSets[bKey];
      const m = b.grass[Math.floor(rand() * b.grass.length)];
      pushBucket(m, x, z, 0.75 + rand() * 0.6);
    }

    // 돌 & 바위 ~190개
    for (let i = 0; i < 200; i++) {
      const ang = rand() * Math.PI * 2;
      const dist = 48 + rand() * 268;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      if (isBlocked(x, z)) continue;
      const b = biomeSets[getBiome(x, z)];
      const m = b.rocks[Math.floor(rand() * b.rocks.length)];
      pushBucket(m, x, z, 0.7 + rand() * 0.95);
    }

    // 마을 안 꽃 & 풀
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = 26.5 + (i % 2) * 2.2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.abs(x) < 5.5 || Math.abs(z) < 5.5) continue;
      pushBucket(i % 2 === 0 ? 'nature/Flowers.glb' : 'nature/Grass_Short.glb', x, z, 0.85);
    }

    const jobs = [];
    for (const [path, list] of buckets) {
      let h = 1.2;
      if (path.includes('Tree') || path.includes('Willow')) h = 7.4;
      else if (path.includes('Rock')) h = 2.1;
      else if (path.includes('Cactus')) h = 2.6;
      else if (path.includes('Bush')) h = 1.6;
      else if (path.includes('Wheat') || path.includes('Corn')) h = 1.8;
      else if (path.includes('Lilypad')) h = 0.25;
      jobs.push(this._placeInstanced(path, list, h, token, 'world'));
    }
    await Promise.all(jobs);
  }

  async _buildDungeon(zoneId, token) {
    const col = zoneId === 'mirage' ? 0xa855f7 : 0xec4899;
    const rune = new THREE.Mesh(
      new THREE.RingGeometry(16, 16.6, 64),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
    );
    rune.rotation.x = -Math.PI / 2;
    rune.position.y = 0.06;
    this.group.add(rune);

    const tasks = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = 34;
      tasks.push(this._place('castle/LargeTower.glb', Math.cos(a) * r, Math.sin(a) * r, { height: 13, zoneId }, token));
    }
    await Promise.all(tasks);
  }

  update(dt, t, playerX = 0, playerZ = 0, zoneId = 'world') {
    for (const p of this.portals) {
      p.torus.rotation.z = t * 1.2;
      p.torus.position.y = 2.3 + Math.sin(t * 2.2) * 0.14;
    }
    for (const b of this.bonfires) {
      b.light.intensity = 4.0 + Math.sin(t * 14) * 0.65;
    }
    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i];
      if (n.inst?.root) n.inst.root.position.y = (n.y || 0) + Math.sin(t * 2.2 + i) * 0.04;
    }
    for (const w of this.waterMeshes) {
      w.mesh.position.y = w.baseY + Math.sin(t * 1.8) * 0.035;
    }
    if (this.particles) {
      const pos = this.particles.pts.geometry.attributes.position;
      const r = this.particles.radius * 1.4;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i);
        let x = pos.getX(i);
        y -= dt * 1.4;
        x += Math.sin(t + i) * dt * 0.5;
        if (y < 0.2) { y = 14; x = (Math.random() - 0.5) * r; }
        pos.setXY(i, x, y);
      }
      pos.needsUpdate = true;

      if (zoneId === 'world') {
        const dist = Math.hypot(playerX, playerZ);
        let col = 0xfef9c3;
        if (Math.hypot(playerX - 190, playerZ - 190) <= 95) col = 0x67e8f9;
        else if (playerZ > 35 && Math.abs(playerX) <= playerZ) col = dist > 170 ? 0xfef08a : 0xf9a8d4;
        else if (playerX > 35 && Math.abs(playerZ) <= playerX) col = dist > 170 ? 0xf59e0b : 0xfde047;
        else if (playerX < -35 && Math.abs(playerZ) <= -playerX) col = dist > 170 ? 0xa855f7 : 0xf97316;
        else if (playerZ < -35 && Math.abs(playerX) <= -playerZ) col = 0xe0f2fe;
        this.particles.mat.color.lerp(new THREE.Color(col), dt * 3);
      }
    }
  }
}
