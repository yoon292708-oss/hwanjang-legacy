// =============================================================
//  game.js - 환장 래거시 3D 웹 MMORPG 메인 클라이언트
// =============================================================
import * as THREE from 'three';
import { instance, playAnim, attachWeapon } from './assets.js';
import { SFX } from './audio.js';
import { CLASSES, CLASS_ORDER, HERO_WEAPON_HIDE, EQUIP_GRADES, ZONES, REGIONS, getRegionAt, TITLES, QUESTS, COUPONS } from './data.js';
import { WorldBuilder, getTerrainY, resolveWorldCollisions } from './world.js';
import { VFXManager, MonsterManager } from './combat.js';

const $ = (id) => document.getElementById(id);

function showToast(msg) {
  const box = $('toast-box');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function addChatLine(html, cls = '') {
  const log = $('chat-log');
  const div = document.createElement('div');
  div.className = `chat-line ${cls}`;
  div.innerHTML = html;
  log.appendChild(div);
  while (log.children.length > 80) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------- Game State ----------------
const state = {
  token: localStorage.getItem('ody_token') || '',
  nick: '',
  isAdmin: false,
  cls: 'swordman',
  unlockedClasses: ['swordman'],
  level: 1,
  exp: 0,
  gold: 200,
  stone: 5,
  crystal: 10,
  equipGrade: 0,
  enh: 0,
  enhFailBonus: 0,
  title: 't1',
  questIdx: 0,
  questProg: 0,
  dailyKills: 0,
  dailyDate: null,
  todayStr: '',
  bossKills: 0,
  dragonKilled: false,
  bestWave: 0,
  abyssFloor: 1,
  abyssSelectedFloor: 1,
  pvpWins: 0,
  usedCoupons: [],
};

function expNeeded(lv) {
  return Math.floor(100 * Math.pow(1.16, lv - 1));
}

function currentClass() {
  return CLASSES[state.cls] || CLASSES.swordman;
}
function currentTitle() {
  return TITLES.find((t) => t.id === state.title) || TITLES[0];
}
function currentGrade() {
  return EQUIP_GRADES[state.equipGrade] || EQUIP_GRADES[0];
}

function calcStats() {
  const c = currentClass();
  const t = currentTitle();
  const g = currentGrade();
  const lvScale = 1 + (state.level - 1) * 0.16;
  const enhMult = 1 + state.enh * 0.14;
  const partyMult = myParty && myParty.members.length > 1 ? 1.15 : 1.0;

  const atk = Math.floor((c.baseAtk * lvScale * g.mult * enhMult + t.atkBonus) * partyMult);
  const maxHp = Math.floor((c.baseHp * lvScale * (1 + state.equipGrade * 0.25 + state.enh * 0.06)) + t.hpBonus);
  const crit = Math.min(0.75, 0.1 + (c.critBonus || 0) + state.enh * 0.01);
  return { atk, maxHp, crit };
}

// ---------------- Three.js Setup ----------------
const wrap = $('canvas-wrap');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.2, 420);

scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x475569, 1.45);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
dirLight.position.set(28, 46, 22);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.camera.near = 5;
dirLight.shadow.camera.far = 140;
dirLight.shadow.camera.left = -55;
dirLight.shadow.camera.right = 55;
dirLight.shadow.camera.top = 55;
dirLight.shadow.camera.bottom = -55;
scene.add(dirLight);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const worldBuilder = new WorldBuilder(scene);
const vfx = new VFXManager(scene, $('damage-layer'));
const monsterMgr = new MonsterManager(scene, $('world-ui-layer'), vfx);

// ---------------- Player & Camera ----------------
const player = {
  zone: 'world',
  x: 0, y: 0, z: 12, ry: Math.PI,
  vy: 0, onGround: true,
  hp: 150, maxHp: 150,
  dead: false, respawnTimer: 0,
  atkCd: 0,
  cds: [0, 0, 0],
  dashCd: 0, dashTimer: 0, invulnTimer: 0,
  guardActive: false, guardTimer: 0, parryWindow: 0,
  healCd: 0,
  combo: 0, comboTimer: 0,
  pvpOn: false,
  autoHunt: false,
  root: new THREE.Group(),
  inst: null,
  buildGen: 0,
};
scene.add(player.root);

let camYaw = 0;
let camPitch = 0.48;
let camDist = 13.5;

async function rebuildPlayerModel() {
  const gen = ++player.buildGen;
  while (player.root.children.length) player.root.remove(player.root.children[0]);
  const c = currentClass();
  try {
    const inst = await instance(c.model, {
      height: 2.0,
      tint: c.tint,
      emissive: c.emissive,
      hide: HERO_WEAPON_HIDE,
      show: c.showParts || [],
    });
    if (gen !== player.buildGen) return;
    player.inst = inst;
    player.root.add(inst.root);
    playAnim(inst, ['idle']);
    if (c.weapon) {
      await attachWeapon(inst, c.weapon, { size: 1.05, emissive: state.equipGrade >= 2 ? c.color : undefined });
    }
  } catch {
    const box = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.45, 1.0, 6, 10),
      new THREE.MeshStandardMaterial({ color: c.color })
    );
    box.position.y = 1.0;
    player.root.add(box);
  }
}

// ---------------- Remote Players & Multiplayer ----------------
let ws = null;
let wsConnected = false;
let onlineCount = 1;
let partiesList = [];
let myParty = null;
let marketListings = [];
let activeWorld = null;
let worldSpawnedId = null;

const remotePlayers = new Map(); // nick -> { nick, st, x, y, z, ry, root, inst, hpEl, hpFill, nameEl }

async function upsertRemotePlayer(nick, st) {
  if (!st || st.zone !== player.zone) {
    removeRemotePlayer(nick);
    return;
  }
  let rp = remotePlayers.get(nick);
  if (!rp) {
    const root = new THREE.Group();
    root.position.set(st.x, st.y, st.z);
    scene.add(root);

    const el = document.createElement('div');
    el.className = 'mob-plate player';
    el.innerHTML = `<div class="mob-name"></div><div class="mob-bar"><div class="mob-fill"></div></div>`;
    $('world-ui-layer').appendChild(el);

    rp = {
      nick, st,
      x: st.x, y: st.y, z: st.z, ry: st.ry,
      clsLoaded: '',
      root, inst: null,
      hpEl: el,
      nameEl: el.querySelector('.mob-name'),
      hpFill: el.querySelector('.mob-fill'),
    };
    remotePlayers.set(nick, rp);
  }
  rp.st = st;
  const cName = CLASSES[st.cls]?.name || '모험가';
  const pvpTag = st.pvpOn || player.zone === 'arena' ? ' ⚔️' : '';
  rp.nameEl.textContent = `Lv.${st.lv} ${nick} (${cName})${pvpTag}`;
  rp.hpFill.style.width = `${Math.max(0, Math.min(100, (st.hp / Math.max(1, st.mhp)) * 100))}%`;

  if (rp.clsLoaded !== st.cls) {
    rp.clsLoaded = st.cls;
    while (rp.root.children.length) rp.root.remove(rp.root.children[0]);
    const c = CLASSES[st.cls] || CLASSES.swordman;
    try {
      const inst = await instance(c.model, { height: 2.0, tint: c.tint, hide: HERO_WEAPON_HIDE, show: c.showParts || [] });
      if (!remotePlayers.has(nick) || rp.clsLoaded !== st.cls) return;
      rp.inst = inst;
      rp.root.add(inst.root);
      playAnim(inst, ['idle']);
      if (c.weapon) attachWeapon(inst, c.weapon, { size: 1.0 });
    } catch {}
  }
}

function removeRemotePlayer(nick) {
  const rp = remotePlayers.get(nick);
  if (!rp) return;
  scene.remove(rp.root);
  if (rp.hpEl) rp.hpEl.remove();
  remotePlayers.delete(nick);
}

function clearRemotePlayers() {
  for (const nick of [...remotePlayers.keys()]) removeRemotePlayer(nick);
}

// ---------------- Zone & Dungeon State ----------------
let mirageWave = 0;
let miragePending = false;
let abyssActive = false;
let lastRegionId = 'village';

function spawnRegionMonsters(reg, baseAng, minR = 56, maxR = 162, countEach = 4) {
  if (!reg.monsters) return;
  const total = reg.monsters.length;
  for (let i = 0; i < total; i++) {
    const mDef = reg.monsters[i];
    for (let k = 0; k < countEach; k++) {
      const ratio = (i * countEach + k) / Math.max(1, total * countEach - 1);
      const ang = baseAng + (ratio - 0.5) * 1.1 + (Math.random() - 0.5) * 0.08;
      const rad = minR + ((i * 19 + k * 27) % Math.max(10, maxR - minR));
      const mx = Math.cos(ang) * rad;
      const mz = Math.sin(ang) * rad;
      if (Math.hypot(mx - 115, mz + 115) < 40) continue;
      if (Math.hypot(mx - 190, mz - 190) < 96) continue;
      monsterMgr.spawnMob(mDef, mx, mz, 'world');
    }
  }
  if (reg.boss && reg.bossPos) {
    monsterMgr.spawnMob(reg.boss, reg.bossPos[0], reg.bossPos[1], 'world');
  }
}

function spawnCircleMonsters(reg, cx, cz, minR = 20, maxR = 80, countEach = 4) {
  if (!reg.monsters) return;
  const total = reg.monsters.length;
  for (let i = 0; i < total; i++) {
    const mDef = reg.monsters[i];
    for (let k = 0; k < countEach; k++) {
      const ang = ((i * countEach + k) / (total * countEach)) * Math.PI * 2 + 0.25;
      const rad = minR + ((i * 13 + k * 17) % (maxR - minR));
      const mx = cx + Math.cos(ang) * rad;
      const mz = cz + Math.sin(ang) * rad;
      if (Math.hypot(mx, mz) > 325) continue;
      monsterMgr.spawnMob(mDef, mx, mz, 'world');
    }
  }
  if (reg.boss && reg.bossPos) {
    monsterMgr.spawnMob(reg.boss, reg.bossPos[0], reg.bossPos[1], 'world');
  }
}

async function enterZone(zoneId, warpPos = null) {
  const z = ZONES[zoneId];
  if (!z) return;

  player.zone = zoneId;
  player.x = warpPos ? warpPos[0] : z.spawn[0];
  player.z = warpPos ? warpPos[1] : z.spawn[2];
  player.y = getTerrainY(zoneId, player.x, player.z);
  player.vy = 0;
  player.root.position.set(player.x, player.y, player.z);
  mirageWave = 0;
  miragePending = false;
  abyssActive = false;
  worldSpawnedId = null;

  clearRemotePlayers();
  clearZonePlates();
  vfx.clear();
  monsterMgr.clear();

  await worldBuilder.build(zoneId);
  if (player.zone !== zoneId) return;

  if (zoneId === 'world') {
    const reg = getRegionAt(player.x, player.z);
    lastRegionId = reg.id;
    $('zone-banner').textContent = `${reg.name} · ${reg.tag}`;
  } else {
    $('zone-banner').textContent = `${z.name} · ${z.tag}`;
  }

  for (const n of worldBuilder.npcs) {
    const el = document.createElement('div');
    el.className = 'mob-plate npc';
    el.innerHTML = `<div class="mob-name">${n.name}</div>`;
    el.dataset.zonePlate = '1';
    $('world-ui-layer').appendChild(el);
    n.plateEl = el;
  }
  for (const p of worldBuilder.portals) {
    const el = document.createElement('div');
    el.className = 'mob-plate npc';
    el.innerHTML = `<div class="mob-name">${p.label}</div>`;
    el.dataset.zonePlate = '1';
    $('world-ui-layer').appendChild(el);
    p.plateEl = el;
  }

  if (zoneId === 'world') {
    spawnRegionMonsters(REGIONS.spring, Math.PI * 0.5, 55, 162, 4);
    spawnRegionMonsters(REGIONS.meadow, Math.PI * 0.5, 178, 295, 4);
    spawnRegionMonsters(REGIONS.summer, 0, 55, 162, 4);
    spawnRegionMonsters(REGIONS.desert, 0, 178, 295, 4);
    spawnCircleMonsters(REGIONS.ocean, 190, 190, 20, 82, 4);
    spawnRegionMonsters(REGIONS.autumn, Math.PI, 55, 162, 4);
    spawnRegionMonsters(REGIONS.ruins, Math.PI, 178, 295, 4);
    spawnRegionMonsters(REGIONS.winter, -Math.PI * 0.5, 56, 285, 4);
  } else if (zoneId === 'mirage') {
    startMirageWave(1);
  } else if (zoneId === 'abyss') {
    startAbyssFloor(state.abyssSelectedFloor || 1);
  }

  checkWorldEventSpawn();
  showToast(`📍 ${zoneId === 'world' ? getRegionAt(player.x, player.z).name : z.name}에 입장했습니다.`);
  saveGame();
}

function clearZonePlates() {
  document.querySelectorAll('[data-zone-plate="1"]').forEach((el) => el.remove());
}

function startMirageWave(wave) {
  mirageWave = wave;
  miragePending = false;
  showToast(`🌀 신기루 던전 WAVE ${wave} 시작!`);
  const pool = [
    { id: 'mir_mob1', name: `신기루 망령`, model: 'mobs/Skeleton_Warrior.glb', tint: 0xc084fc, size: 1.9 },
    { id: 'mir_mob2', name: `신기루 사술사`, model: 'mobs/Skeleton_Mage.glb', tint: 0xa855f7, size: 1.9 },
    { id: 'mir_mob3', name: `신기루 야수`, model: 'mobs/Wolf.glb', tint: 0xd8b4fe, size: 1.8 },
  ];
  const count = Math.min(14, 4 + wave);
  for (let i = 0; i < count; i++) {
    const pick = pool[i % pool.length];
    const ang = (i / count) * Math.PI * 2;
    const rad = 16 + (i % 3) * 5;
    const isBoss = wave % 3 === 0 && i === 0;
    const lv = Math.min(99, 5 + wave * 4);
    const hp = Math.floor((140 + wave * 120 * (1 + wave * 0.14)) * (isBoss ? 3.5 : 1));
    monsterMgr.spawnMob(
      { ...pick, size: isBoss ? 3.2 : pick.size },
      Math.cos(ang) * rad,
      Math.sin(ang) * rad - 6,
      'mirage',
      {
        nameOverride: isBoss ? `[신기루 군주] ${pick.name}` : pick.name,
        levelOverride: lv,
        hpOverride: hp,
        atkOverride: Math.floor((14 + wave * 8) * (isBoss ? 1.6 : 1)),
        expOverride: Math.floor((50 + wave * 40) * (isBoss ? 3 : 1)),
        goldOverride: Math.floor((45 + wave * 35) * (isBoss ? 3.5 : 1)),
        stoneOverride: isBoss ? 3 : (i % 2 === 0 ? 1 : 0),
        crystalOverride: isBoss ? 8 : 2,
        isBoss,
        noRespawn: true,
      }
    );
  }
}

function startAbyssFloor(floor) {
  abyssActive = true;
  state.abyssSelectedFloor = floor;
  showToast(`🕳️ 지하 심연 던전 ${floor}층 보스 소환!`);
  const models = ['mobs/Skeleton_Warrior.glb', 'mobs/Bull.glb', 'mobs/Stegosaurus.glb', 'mobs/Apatosaurus.glb', 'mobs/Trex.glb'];
  const m = models[(floor - 1) % models.length];
  const hp = Math.floor(900 * Math.pow(1.24, floor - 1));
  const atk = Math.floor(28 * Math.pow(1.15, floor - 1));
  monsterMgr.spawnMob(
    { id: 'abyss_boss', name: `심연 ${floor}층 수호자`, model: m, tint: 0xf43f5e, emissive: 0x9f1239, size: 3.8 + Math.min(2, floor * 0.08), spd: 4.4 },
    0, -14, 'abyss',
    {
      levelOverride: Math.min(99, floor * 3 + 4),
      hpOverride: hp,
      atkOverride: atk,
      expOverride: Math.floor(280 * Math.pow(1.18, floor - 1)),
      goldOverride: Math.floor(260 * Math.pow(1.18, floor - 1)),
      stoneOverride: 3 + Math.floor(floor * 0.6),
      crystalOverride: 8 + floor * 2,
      isBoss: true,
      noRespawn: true,
    }
  );
}

function checkWorldEventSpawn() {
  if (!activeWorld) return;
  if (player.zone !== 'world') return;
  if (worldSpawnedId === activeWorld.id) return;
  worldSpawnedId = activeWorld.id;

  const anchorMap = { spring: [0, 115], summer: [115, 0], autumn: [-115, 0], winter: [0, -115] };
  const [ax, az] = anchorMap[activeWorld.zone] || [0, -115];

  if (activeWorld.kind === 'raid') {
    const bossMap = {
      trex: 'mobs/Trex.glb',
      apato: 'mobs/Apatosaurus.glb',
      stego: 'mobs/Stegosaurus.glb',
      bargon: 'mobs/Skeleton_Warrior.glb',
    };
    monsterMgr.spawnMob(
      {
        id: 'world_event_boss',
        name: activeWorld.name,
        model: bossMap[activeWorld.boss] || 'mobs/Trex.glb',
        tint: 0xfbbf24,
        emissive: 0xdc2626,
        size: 6.2,
        spd: 4.5,
      },
      ax, az, 'world',
      {
        levelOverride: activeWorld.level,
        hpOverride: activeWorld.maxHp,
        atkOverride: Math.floor(35 + activeWorld.level * 2.5),
        expOverride: 0, goldOverride: 0, stoneOverride: 0, crystalOverride: 0,
        isBoss: true, isWorldBoss: true, noRespawn: true,
      }
    );
    SFX.bossAlert();
  } else if (activeWorld.kind === 'meteor') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      monsterMgr.spawnMob(
        { id: 'meteor_core', name: '☄️ 붉은 유성 핵', model: 'mobs/Skull.glb', tint: 0xef4444, emissive: 0xef4444, size: 2.6, spd: 0 },
        ax + Math.cos(a) * 18, az + Math.sin(a) * 18, 'world',
        {
          levelOverride: activeWorld.level,
          hpOverride: 400 + activeWorld.level * 30,
          atkOverride: 0,
          expOverride: 120, goldOverride: 100, stoneOverride: 2, crystalOverride: 4,
          isMeteorCore: true, noRespawn: false,
        }
      );
    }
  } else if (activeWorld.kind === 'horde') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      monsterMgr.spawnMob(
        { id: 'horde_mob', name: '침공군 해골 돌격병', model: 'mobs/Skeleton_Warrior.glb', tint: 0xf87171, size: 2.2, spd: 5.0 },
        ax + Math.cos(a) * 20, az + Math.sin(a) * 20, 'world',
        {
          levelOverride: activeWorld.level,
          hpOverride: 300 + activeWorld.level * 25,
          atkOverride: 20 + activeWorld.level * 1.4,
          expOverride: 140, goldOverride: 110, stoneOverride: 1, crystalOverride: 3,
          noRespawn: false,
        }
      );
    }
  }
}

// ---------------- Combat Actions ----------------
function grantExpAndLoot(exp, gold, stone, crystal, mobId) {
  const c = currentClass();
  const partyExpMult = myParty && myParty.members.length > 1 ? 1.2 : 1.0;
  const finalExp = Math.floor(exp * partyExpMult);
  const finalGold = Math.floor(gold * (1 + (c.goldBonus || 0)));

  state.gold += finalGold;
  state.stone += stone;
  state.crystal += crystal;

  if (state.level < 99) {
    state.exp += finalExp;
    while (state.level < 99 && state.exp >= expNeeded(state.level)) {
      state.exp -= expNeeded(state.level);
      state.level++;
      const stats = calcStats();
      player.maxHp = stats.maxHp;
      player.hp = stats.maxHp;
      SFX.levelUp();
      vfx.ringBurst(player.x, player.y, player.z, 6.0, 0xfacc15);
      showToast(`🎉 LEVEL UP! Lv.${state.level} 달성!`);
    }
  }

  // Quest Progress
  const q = QUESTS[state.questIdx];
  if (q && mobId === q.targetId) {
    state.questProg++;
    if (state.questProg >= q.count) {
      state.gold += q.gold;
      state.stone += q.stone;
      state.crystal += q.crystal;
      state.questIdx++;
      state.questProg = 0;
      showToast(`📜 퀘스트 완료 [${q.title}]! +${q.gold}G +🔮${q.stone} +💎${q.crystal}`);
      grantExpAndLoot(q.exp, 0, 0, 0, '__quest__');
    }
  }

  // Daily Quest
  if (mobId && !mobId.startsWith('__')) {
    state.dailyKills = Math.min(10, (state.dailyKills || 0) + 1);
  }
  updateHUD();
}

function damageMob(mob, rawDmg, isCrit = false, stunSec = 0) {
  if (!mob || mob.dead) return;
  const dmg = Math.max(1, Math.floor(rawDmg));
  mob.hp = Math.max(0, mob.hp - dmg);
  if (stunSec > 0 && !mob.isWorldBoss) mob.stunTimer = Math.max(mob.stunTimer, stunSec);

  player.combo++;
  player.comboTimer = 3.2;
  SFX.hit(isCrit);

  vfx.popupText(new THREE.Vector3(mob.x, mob.y, mob.z), isCrit ? `💥 ${dmg}!` : `${dmg}`, isCrit ? 'crit' : 'normal', camera);

  if (mob.isWorldBoss && ws && wsConnected) {
    ws.send(JSON.stringify({ type: 'wq_hit', dmg }));
  }

  if (mob.hp <= 0) {
    mob.dead = true;
    mob.root.visible = false;
    mob.respawnTimer = mob.isBoss ? 18 : 6.5;

    if (mob.isBoss) {
      state.bossKills++;
      if (mob.id === 'world_dragon') state.dragonKilled = true;
      showToast(`🏆 ${mob.name} 토벌 성공!`);
    }
    if ((mob.isMeteorCore || mob.id === 'horde_mob') && ws && wsConnected) {
      ws.send(JSON.stringify({ type: 'wq_count', n: 1 }));
    }

    grantExpAndLoot(mob.exp, mob.gold, mob.stone, mob.crystal, mob.id);

    if (player.zone === 'mirage' && !miragePending) {
      const alive = monsterMgr.mobs.some((m) => !m.dead);
      if (!alive) {
        miragePending = true;
        if (mirageWave > state.bestWave) state.bestWave = mirageWave;
        const bonusG = 80 + mirageWave * 45;
        state.gold += bonusG;
        state.stone += 2;
        showToast(`✨ WAVE ${mirageWave} 클리어! 보상 +${bonusG}G +🔮2`);
        setTimeout(() => {
          if (player.zone === 'mirage') {
            monsterMgr.clear();
            startMirageWave(mirageWave + 1);
          }
        }, 2200);
      }
    }

    if (player.zone === 'abyss' && mob.id === 'abyss_boss') {
      const cleared = state.abyssSelectedFloor;
      if (cleared >= state.abyssFloor && state.abyssFloor < 50) {
        state.abyssFloor++;
        showToast(`🕳️ 심연 ${cleared}층 돌파! ${state.abyssFloor}층이 해금되었습니다!`);
      }
    }
  }
}

function isInArena(x, z) {
  return Math.hypot(x - 115, z + 115) <= 35;
}
function isSafeAt(zoneId, x, z) {
  if (zoneId !== 'world') return !!ZONES[zoneId]?.safe;
  return Math.hypot(x, z) <= 35;
}

function hitPvpTargets(x, z, range, dmg) {
  if (isSafeAt(player.zone, player.x, player.z)) return;
  const inArena = player.zone === 'world' && isInArena(player.x, player.z);
  if (!inArena && !player.pvpOn) return;
  for (const [nick, rp] of remotePlayers) {
    if (rp.st?.dead) continue;
    const targetArena = player.zone === 'world' && isInArena(rp.x, rp.z);
    if (!(inArena && targetArena) && !rp.st?.pvpOn) continue;
    if (Math.hypot(rp.x - x, rp.z - z) <= range) {
      if (ws && wsConnected) {
        ws.send(JSON.stringify({ type: 'pvp_hit', target: nick, dmg }));
        vfx.popupText(new THREE.Vector3(rp.x, rp.y, rp.z), `⚔️ ${dmg}`, 'crit', camera);
      }
    }
  }
  if (inArena) {
    for (const d of worldBuilder.dummies) {
      if (Math.hypot(d.x - x, d.z - z) <= range + 1.2) {
        vfx.popupText(new THREE.Vector3(d.x, 0.5, d.z), `${dmg}`, 'normal', camera);
        SFX.hit(false);
      }
    }
  }
}

function sendRemoteAction(act, tx = 0, tz = 0) {
  if (ws && wsConnected) ws.send(JSON.stringify({ type: 'act', act, tx, tz }));
}

function doAttack() {
  if (player.dead || player.atkCd > 0) return;
  const c = currentClass();
  const stats = calcStats();
  player.atkCd = c.speed;

  if (player.inst) playAnim(player.inst, [c.animAttack || '1H_Melee_Attack_Chop', 'attack'], { loop: false, speed: 1.3 });
  SFX.slash();
  sendRemoteAction('atk', player.x, player.z);

  const isCrit = Math.random() < stats.crit;
  const dmg = stats.atk * (isCrit ? 1.85 : 1.0);
  const dirX = Math.sin(player.ry);
  const dirZ = Math.cos(player.ry);

  if (c.isRanged) {
    vfx.spawnProjectile({
      x: player.x, y: player.y, z: player.z,
      vx: dirX * 26, vz: dirZ * 26,
      color: c.color, dur: c.range / 26,
      onHit: (m) => damageMob(m, dmg, isCrit),
    });
    hitPvpTargets(player.x + dirX * 5, player.z + dirZ * 5, 5.5, Math.floor(dmg));
  } else {
    vfx.slashArc(player.x, player.y, player.z, player.ry, c.color, c.range);
    for (const m of monsterMgr.mobs) {
      if (m.dead) continue;
      const dx = m.x - player.x;
      const dz = m.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d <= c.range + (m.hitRadius || 1.2)) {
        const dot = (dx * dirX + dz * dirZ) / Math.max(0.001, d);
        if (dot >= -0.2 || d <= 2.1) damageMob(m, dmg, isCrit);
      }
    }
    hitPvpTargets(player.x + dirX * (c.range * 0.55), player.z + dirZ * (c.range * 0.55), c.range, Math.floor(dmg));
  }
}

function doSkill(idx) {
  if (player.dead) return;
  const c = currentClass();
  const sk = c.skills[idx];
  if (!sk || player.cds[idx] > 0) return;

  player.cds[idx] = sk.cd;
  const stats = calcStats();
  const isCrit = Math.random() < stats.crit + 0.12;
  const dmg = stats.atk * sk.mult * (isCrit ? 1.75 : 1.0);
  const skColor = sk.color || c.color;

  if (player.inst) playAnim(player.inst, ['Spellcast_Shoot', '2H_Melee_Attack_Spin', c.animAttack], { loop: false, speed: 1.25 });
  SFX.skill();
  sendRemoteAction(`s${idx + 1}`, player.x, player.z);

  const fx = Math.sin(player.ry);
  const fz = Math.cos(player.ry);

  if (sk.type === 'proj') {
    for (let a = -1; a <= 1; a += 2) {
      const ang = player.ry + a * 0.08;
      vfx.spawnProjectile({
        x: player.x, y: player.y, z: player.z,
        vx: Math.sin(ang) * 28, vz: Math.cos(ang) * 28,
        radius: 0.6, color: skColor, dur: 1.2, pierce: true,
        onHit: (m) => damageMob(m, dmg * 0.65, isCrit, sk.stun || 0),
      });
    }
    hitPvpTargets(player.x + fx * 6, player.z + fz * 6, 6.5, Math.floor(dmg));
  } else if (sk.type === 'dash_aoe') {
    const dist = sk.dash || 7.0;
    const rad = ZONES[player.zone].radius - 2;
    player.x = Math.max(-rad, Math.min(rad, player.x + fx * dist));
    player.z = Math.max(-rad, Math.min(rad, player.z + fz * dist));
    player.y = getTerrainY(player.zone, player.x, player.z);
    player.invulnTimer = 0.45;
    vfx.ringBurst(player.x, player.y, player.z, sk.range || 5.5, skColor);
    for (const m of monsterMgr.mobs) {
      if (!m.dead && Math.hypot(m.x - player.x, m.z - player.z) <= (sk.range || 5.5) + (m.hitRadius || 1)) {
        damageMob(m, dmg, isCrit, sk.stun || 0);
      }
    }
    hitPvpTargets(player.x, player.z, sk.range || 5.5, Math.floor(dmg));
  } else if (sk.type === 'meteor') {
    let tx = player.x + fx * 7;
    let tz = player.z + fz * 7;
    const nearest = findNearestMob(16);
    if (nearest) { tx = nearest.x; tz = nearest.z; }
    const ty = getTerrainY(player.zone, tx, tz);
    vfx.meteor(tx, ty, tz, sk.range || 7.0, skColor, () => {
      SFX.hit(true);
      for (const m of monsterMgr.mobs) {
        if (!m.dead && Math.hypot(m.x - tx, m.z - tz) <= (sk.range || 7.0) + (m.hitRadius || 1)) {
          damageMob(m, dmg, isCrit, sk.stun || 0.8);
        }
      }
      hitPvpTargets(tx, tz, sk.range || 7.0, Math.floor(dmg));
    });
  } else if (sk.type === 'summon' || sk.type === 'summon_aoe') {
    const count = sk.type === 'summon_aoe' ? 2 : 1;
    for (let i = 0; i < count; i++) {
      monsterMgr.spawnSummon(player.x, player.z, player.zone, stats.atk, 24);
    }
    vfx.ringBurst(player.x, player.y, player.z, sk.range || 5.5, skColor);
    if (sk.type === 'summon_aoe') {
      for (const m of monsterMgr.mobs) {
        if (!m.dead && Math.hypot(m.x - player.x, m.z - player.z) <= (sk.range || 8.0)) {
          damageMob(m, dmg, isCrit, 1.0);
        }
      }
    }
    showToast('💀 해골 전사가 소환되었습니다!');
  } else {
    // 'aoe' or 'heal_aoe'
    vfx.ringBurst(player.x, player.y, player.z, sk.range || 5.5, skColor);
    for (const m of monsterMgr.mobs) {
      if (!m.dead && Math.hypot(m.x - player.x, m.z - player.z) <= (sk.range || 5.5) + (m.hitRadius || 1)) {
        damageMob(m, dmg, isCrit, sk.stun || 0);
      }
    }
    hitPvpTargets(player.x, player.z, sk.range || 5.5, Math.floor(dmg));
    if (sk.healPct) {
      const heal = Math.floor(player.maxHp * sk.healPct);
      player.hp = Math.min(player.maxHp, player.hp + heal);
      SFX.heal();
      vfx.popupText(new THREE.Vector3(player.x, player.y, player.z), `+${heal} HP`, 'heal', camera);
    }
  }
}

function doDash() {
  if (player.dead || player.dashCd > 0) return;
  player.dashCd = 2.6;
  player.dashTimer = 0.22;
  player.invulnTimer = 0.35;
  SFX.dash();
  if (player.inst) playAnim(player.inst, ['dodge_forward', 'running_a'], { loop: false });
  vfx.ringBurst(player.x, player.y, player.z, 2.5, 0x38bdf8);
}

function doGuard() {
  if (player.dead || player.guardActive) return;
  player.guardActive = true;
  player.guardTimer = 1.1;
  player.parryWindow = 0.4;
  if (player.inst) playAnim(player.inst, ['block'], { loop: true });
}

function doHeal() {
  if (player.dead || player.healCd > 0) return;
  player.healCd = 7.5;
  const heal = Math.floor(player.maxHp * 0.45);
  player.hp = Math.min(player.maxHp, player.hp + heal);
  SFX.heal();
  vfx.ringBurst(player.x, player.y, player.z, 3.5, 0x4ade80);
  vfx.popupText(new THREE.Vector3(player.x, player.y, player.z), `+${heal} HP`, 'heal', camera);
}

function onPlayerDamaged(rawDmg, attackerMob, isSpecial = false) {
  if (player.dead || player.invulnTimer > 0) return;

  // Perfect Parry!
  if (player.guardActive && player.parryWindow > 0) {
    SFX.parry();
    vfx.ringBurst(player.x, player.y, player.z, 5.0, 0x38bdf8);
    vfx.popupText(new THREE.Vector3(player.x, player.y, player.z), '🛡️ 패링 성공!', 'parry', camera);
    if (attackerMob) {
      const counterDmg = calcStats().atk * 2.2;
      damageMob(attackerMob, counterDmg, true, 2.2);
    }
    return;
  }

  let dmg = rawDmg;
  if (player.guardActive) dmg = Math.floor(dmg * 0.3);
  dmg = Math.max(1, Math.floor(dmg));
  player.hp = Math.max(0, player.hp - dmg);
  vfx.popupText(new THREE.Vector3(player.x, player.y, player.z), `-${dmg}`, 'hurt', camera);

  if (player.hp <= 0) {
    player.dead = true;
    player.respawnTimer = 3.5;
    if (player.inst) playAnim(player.inst, ['death_a'], { loop: false });
    showToast('💀 쓰러졌습니다... 3.5초 후 성채 마을에서 부활합니다.');
  }
}

function findNearestMob(maxDist = 60) {
  let best = null;
  let bestD = maxDist;
  for (const m of monsterMgr.mobs) {
    if (m.dead) continue;
    const d = Math.hypot(m.x - player.x, m.z - player.z);
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}

// ---------------- Interaction & Modals ----------------
function getNearestInteractable() {
  for (const p of worldBuilder.portals) {
    if (Math.hypot(p.x - player.x, p.z - player.z) < 4.5) {
      return { type: 'portal', item: p, text: `[E] ${p.label}` };
    }
  }
  for (const n of worldBuilder.npcs) {
    if (Math.hypot(n.x - player.x, n.z - player.z) < 4.5) {
      return { type: 'npc', item: n, text: `[E] ${n.name} 대화하기` };
    }
  }
  return null;
}

function doInteract() {
  const inter = getNearestInteractable();
  if (!inter) return;
  if (inter.type === 'portal') {
    clearZonePlates();
    enterZone(inter.item.to);
  } else if (inter.type === 'npc') {
    openModalByAction(inter.item.action);
  }
}

function openModal(title, html) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = html;
  $('modal-backdrop').classList.remove('hidden');
}
function closeModal() {
  $('modal-backdrop').classList.add('hidden');
}
$('btn-modal-close').onclick = closeModal;
$('modal-backdrop').onclick = (e) => { if (e.target === $('modal-backdrop')) closeModal(); };

function openModalByAction(act) {
  if (act === 'openClass') openClassModal();
  else if (act === 'openUpgrade') openUpgradeModal();
  else if (act === 'openDungeon') openDungeonModal();
  else if (act === 'openMarket') openMarketModal();
}

function openClassModal(filterCat = 'all') {
  if (typeof filterCat !== 'string') filterCat = 'all';
  const cur = currentClass();
  const statsNow = calcStats();
  const list = CLASS_ORDER.filter((id) => filterCat === 'all' || CLASSES[id].category === filterCat);

  const cards = list.map((id) => {
    const c = CLASSES[id];
    const unlocked = state.unlockedClasses.includes(id);
    const active = state.cls === id;
    const tierCls = c.tier.startsWith('S') ? 's' : c.tier.startsWith('A') ? 'a' : '';
    const canBuy = state.gold >= c.unlockCost;
    const skHtml = c.skills.map((s, i) => `<div class="skill-mini"><b>[${i + 1}] ${s.name}</b> (${s.cd}s) · ${s.desc}</div>`).join('');
    let btnHtml = '';
    if (active) btnHtml = `<button class="btn sec" disabled>✅ 현재 장착 중</button>`;
    else if (unlocked) btnHtml = `<button class="btn primary" data-switch-cls="${id}">🔄 이 직업으로 전환</button>`;
    else btnHtml = `<button class="btn ${canBuy ? 'accent' : 'sec'}" data-unlock-cls="${id}">🔓 해금하기 (🪙 ${c.unlockCost.toLocaleString()}G)</button>`;

    return `
      <div class="cls-card ${active ? 'active' : ''}" style="--cls-col:${c.hex}">
        <div class="item-title" style="color:${c.hex}">
          <span>${c.icon} ${c.name}</span>
          <span class="tier-tag ${tierCls}">${c.tier}</span>
        </div>
        <div class="item-desc">${c.desc}</div>
        <div class="stat-pills">
          <span class="stat-pill">⚔️ 공격 ${c.baseAtk}</span>
          <span class="stat-pill">❤️ 체력 ${c.baseHp}</span>
          <span class="stat-pill">🎯 사거리 ${c.range}m</span>
          ${c.goldBonus ? `<span class="stat-pill">🪙 골드 +35%</span>` : `<span class="stat-pill">💥 치명 +${Math.round((c.critBonus || 0) * 100)}%</span>`}
        </div>
        <div class="cls-skills">${skHtml}</div>
        <div class="cls-foot">${btnHtml}</div>
      </div>
    `;
  }).join('');

  const banner = `
    <div class="class-hero-banner">
      <div class="class-hero-main">
        <div class="class-hero-icon">${cur.icon}</div>
        <div>
          <div style="font-size:16px;font-weight:800;color:${cur.hex}">현재 직업: ${cur.name} <span class="tier-tag">${cur.tier}</span></div>
          <div class="class-hero-meta">
            <span>⚔️ 전투력 ATK <b>${statsNow.atk}</b></span>
            <span>❤️ 최대 HP <b>${statsNow.maxHp}</b></span>
            <span>🔓 해금 <b>${state.unlockedClasses.length} / ${CLASS_ORDER.length}</b></span>
          </div>
        </div>
      </div>
      <div style="font-size:14px;font-weight:800;color:#facc15">보유 골드: 🪙 ${state.gold.toLocaleString()}G</div>
    </div>
    <div class="filter-tabs">
      <button class="filter-tab ${filterCat === 'all' ? 'active' : ''}" data-cls-tab="all">전체 (11)</button>
      <button class="filter-tab ${filterCat === 'melee' ? 'active' : ''}" data-cls-tab="melee">⚔️ 근접·전투</button>
      <button class="filter-tab ${filterCat === 'magic' ? 'active' : ''}" data-cls-tab="magic">🔮 마법·사령</button>
      <button class="filter-tab ${filterCat === 'support' ? 'active' : ''}" data-cls-tab="support">✨ 지원·특수</button>
    </div>
  `;

  openModal('⚔️ 전직 교관 아서 — 11종 전직 센터', `${banner}<div class="card-grid">${cards}</div>`);

  $('modal-body').querySelectorAll('[data-cls-tab]').forEach((b) => {
    b.onclick = () => openClassModal(b.dataset.clsTab);
  });
  $('modal-body').querySelectorAll('[data-switch-cls]').forEach((b) => {
    b.onclick = async () => {
      state.cls = b.dataset.switchCls;
      const stats = calcStats();
      player.maxHp = stats.maxHp;
      player.hp = Math.min(player.hp, stats.maxHp);
      await rebuildPlayerModel();
      updateHUD();
      saveGame();
      showToast(`⚔️ [${currentClass().name}] 직업으로 전환했습니다!`);
      openClassModal(filterCat);
    };
  });
  $('modal-body').querySelectorAll('[data-unlock-cls]').forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.unlockCls;
      const c = CLASSES[id];
      if (state.gold < c.unlockCost) { showToast(`골드가 부족합니다! (필요: ${c.unlockCost}G)`); return; }
      state.gold -= c.unlockCost;
      if (!state.unlockedClasses.includes(id)) state.unlockedClasses.push(id);
      state.cls = id;
      const stats = calcStats();
      player.maxHp = stats.maxHp;
      player.hp = stats.maxHp;
      await rebuildPlayerModel();
      SFX.levelUp();
      updateHUD();
      saveGame();
      showToast(`🎉 신규 직업 [${c.name}] 해금 및 전직 완료!`);
      openClassModal(filterCat);
    };
  });
}

function openUpgradeModal() {
  const g = currentGrade();
  const nextG = EQUIP_GRADES[state.equipGrade + 1];
  const enhGold = 100 + state.enh * 120;
  const enhStone = 1 + Math.floor(state.enh / 2);
  const baseRate = Math.max(25, 100 - state.enh * 4);
  const finalRate = Math.min(100, baseRate + state.enhFailBonus * 10);
  const stats = calcStats();

  const html = `
    <div class="upgrade-box">
      <h3>⚒️ 무기 강화 (현재: <span style="color:${g.color}">${g.name} +${state.enh}</span> · 파괴 없음!)</h3>
      <p class="item-desc">현재 전투력 — 공격력 <b>${stats.atk}</b> · 최대 HP <b>${stats.maxHp}</b> · 치명타 <b>${Math.round(stats.crit * 100)}%</b></p>
      <p class="item-desc">다음 강화 (+${state.enh + 1}): 성공 확률 <b>${finalRate}%</b> (실패 시 다음 확률 +10% 누적 보너스!)</p>
      <p class="item-desc">비용: 🪙 <b>${enhGold}G</b> · 🔮 <b>${enhStone}개</b></p>
      <button id="btn-do-enh" class="btn primary" ${state.enh >= 20 ? 'disabled' : ''}>${state.enh >= 20 ? '최고 강화(+20) 달성' : '⚒️ 무기 강화 시도'}</button>
    </div>
    <div class="upgrade-box">
      <h3>🌟 장비 등급 승급 (현재 등급: <span style="color:${g.color}">${g.name}</span> · 배율 ${g.mult}x)</h3>
      ${nextG
        ? `<p class="item-desc">다음 등급: <b style="color:${nextG.color}">${nextG.name}</b> (공격력 배율 ${nextG.mult}x) · 비용: 🪙 ${nextG.costGold}G · 🔮 ${nextG.costStone}개 · 💎 ${nextG.grade * 10}개</p>
           <button id="btn-do-grade" class="btn accent">🌟 ${nextG.name} 등급으로 승급 (100%)</button>`
        : '<p class="item-desc">최고 등급 [초월] 달성!</p>'
      }
    </div>
  `;
  openModal('⚒️ 대장장이 강화 & 승급', html);

  const btnEnh = $('btn-do-enh');
  if (btnEnh) btnEnh.onclick = () => {
    if (state.enh >= 20) return;
    if (state.gold < enhGold || state.stone < enhStone) { showToast('골드 또는 강화석이 부족합니다.'); return; }
    state.gold -= enhGold;
    state.stone -= enhStone;
    if (Math.random() * 100 < finalRate) {
      state.enh++;
      state.enhFailBonus = 0;
      SFX.upgrade(true);
      showToast(`✨ 강화 성공! +${state.enh} 달성!`);
    } else {
      state.enhFailBonus++;
      SFX.upgrade(false);
      showToast(`💨 강화 실패... (장비 유지 · 다음 성공률 +10% 보너스!)`);
    }
    const st = calcStats();
    player.maxHp = st.maxHp;
    updateHUD();
    saveGame();
    openUpgradeModal();
  };

  const btnGrade = $('btn-do-grade');
  if (btnGrade && nextG) btnGrade.onclick = () => {
    const needCrys = nextG.grade * 10;
    if (state.gold < nextG.costGold || state.stone < nextG.costStone || state.crystal < needCrys) {
      showToast(`재화가 부족합니다! (필요: ${nextG.costGold}G, 🔮${nextG.costStone}, 💎${needCrys})`);
      return;
    }
    state.gold -= nextG.costGold;
    state.stone -= nextG.costStone;
    state.crystal -= needCrys;
    state.equipGrade++;
    SFX.levelUp();
    rebuildPlayerModel();
    const st = calcStats();
    player.maxHp = st.maxHp;
    player.hp = st.maxHp;
    updateHUD();
    saveGame();
    showToast(`🌟 [${nextG.name}] 등급 승급 성공!`);
    openUpgradeModal();
  };
}

function openDungeonModal() {
  const floorOpts = Array.from({ length: state.abyssFloor }, (_, i) => i + 1)
    .map((f) => `<option value="${f}" ${f === state.abyssSelectedFloor ? 'selected' : ''}>지하 심연 ${f}층</option>`).join('');

  const html = `
    <div class="upgrade-box">
      <h3>🌀 신기루 웨이브 던전 (최고 기록: WAVE ${state.bestWave})</h3>
      <p class="item-desc">끝없이 몰려오는 웨이브를 막아내며 골드·강화석·심연의 결정을 파밍하세요!</p>
      <button id="btn-go-mirage" class="btn primary">🌀 신기루 던전 입장</button>
    </div>
    <div class="upgrade-box">
      <h3>🕳️ 지하 심연 던전 (해금 층: ${state.abyssFloor}층 / 50층)</h3>
      <p class="item-desc">각 층의 강력한 심연 수호자를 처치하고 다음 층을 해금하세요.</p>
      <div class="row-inputs">
        <select id="sel-abyss-floor">${floorOpts}</select>
        <button id="btn-go-abyss" class="btn accent">🕳️ 선택한 층 도전</button>
      </div>
    </div>
    <div class="upgrade-box">
      <h3>🐉 서버 월드 이벤트 / 레이드 보스 소환</h3>
      <p class="item-desc">현재 진행 중인 월드 이벤트가 없다면, 서버 전체 유저가 함께 참여하는 월드 보스나 대재앙을 발동할 수 있습니다!</p>
      <div class="row-inputs">
        <select id="sel-wq-kind">
          <option value="raid">🐉 월드 보스 레이드</option>
          <option value="meteor">☄️ 대재앙: 붉은 유성우</option>
          <option value="horde">💀 몬스터 대침공</option>
        </select>
        <select id="sel-wq-zone">
          <option value="spring">🌸 봄 지역 (Lv.15)</option>
          <option value="summer">☀️ 여름 지역 (Lv.35)</option>
          <option value="autumn">🍁 가을 지역 (Lv.60)</option>
          <option value="winter" selected>❄️ 겨울 지역 (Lv.85)</option>
        </select>
        <button id="btn-req-wq" class="btn danger">🚨 월드 이벤트 발동</button>
      </div>
    </div>
  `;
  openModal('🌀 던전 & 월드 보스 레이드', html);

  $('btn-go-mirage').onclick = () => { closeModal(); clearZonePlates(); enterZone('mirage'); };
  $('btn-go-abyss').onclick = () => {
    state.abyssSelectedFloor = Number($('sel-abyss-floor').value) || 1;
    closeModal(); clearZonePlates(); enterZone('abyss');
  };
  $('btn-req-wq').onclick = () => {
    if (!ws || !wsConnected) { showToast('서버에 연결되어 있지 않습니다.'); return; }
    const kind = $('sel-wq-kind').value;
    const zone = $('sel-wq-zone').value;
    const lvMap = { spring: 15, summer: 35, autumn: 60, winter: 85 };
    ws.send(JSON.stringify({ type: 'wq_start_req', kind, zone, level: lvMap[zone] || 50 }));
    closeModal();
  };
}

function openMapModal() {
  const curReg = player.zone === 'world' ? getRegionAt(player.x, player.z).id : '';
  const cards = Object.values(REGIONS).map((reg) => {
    const active = curReg === reg.id;
    return `
      <div class="item-card ${active ? 'active' : ''}">
        <div class="item-title">${reg.name}</div>
        <div class="item-desc">${reg.tag} (권장 Lv.${reg.minLevel}+)</div>
        <button class="btn ${active ? 'sec' : 'primary'}" data-warp-reg="${reg.id}" ${active ? 'disabled' : ''}>
          ${active ? '현재 위치' : '⚡ 빠른 이동'}
        </button>
      </div>
    `;
  }).join('');
  const note = `<p class="item-desc" style="margin-bottom:12px;">🌍 <b>하나의 통합 심리스 대륙!</b> 마을의 통나무 울타리 출입구와 4방위 돌다리를 건너 모든 사계절 지역과 결투장으로 걸어서 이동할 수 있습니다.</p>`;
  openModal('🗺️ 사계절 통합 대륙 지도 (빠른 이동)', `${note}<div class="card-grid">${cards}</div>`);
  $('modal-body').querySelectorAll('[data-warp-reg]').forEach((b) => {
    b.onclick = () => {
      const reg = REGIONS[b.dataset.warpReg];
      if (!reg) return;
      closeModal();
      if (player.zone !== 'world') {
        enterZone('world', reg.warp);
      } else {
        player.x = reg.warp[0];
        player.z = reg.warp[1];
        player.y = getTerrainY('world', player.x, player.z);
        player.root.position.set(player.x, player.y, player.z);
        showToast(`⚡ ${reg.name}(으)로 빠르게 이동했습니다!`);
      }
    };
  });
}

function openTitleModal() {
  const cards = TITLES.map((t) => {
    const unlocked = t.cond(state);
    const active = state.title === t.id;
    return `
      <div class="item-card ${active ? 'active' : ''}">
        <div class="item-title">[${t.name}] <span class="tier-tag">${unlocked ? '보유' : '잠금'}</span></div>
        <div class="item-desc">${t.desc}</div>
        <div class="item-desc">보너스: ATK +${t.atkBonus} · HP +${t.hpBonus}</div>
        <button class="btn ${active ? 'sec' : 'primary'}" data-title="${t.id}" ${!unlocked || active ? 'disabled' : ''}>
          ${active ? '장착 중' : unlocked ? '장착하기' : '미달성'}
        </button>
      </div>
    `;
  }).join('');
  openModal('🏆 칭호 도감', `<div class="card-grid">${cards}</div>`);
  $('modal-body').querySelectorAll('[data-title]').forEach((b) => {
    b.onclick = () => {
      state.title = b.dataset.title;
      const st = calcStats();
      player.maxHp = st.maxHp;
      updateHUD(); saveGame();
      showToast(`🏆 [${currentTitle().name}] 칭호를 장착했습니다!`);
      openTitleModal();
    };
  });
}

function openMarketModal() {
  const rows = marketListings.length
    ? marketListings.map((l) => `
      <div class="list-row">
        <div>
          <b>${l.itemName} × ${l.qty}</b>
          <div class="item-desc">판매자: ${escapeHtml(l.seller)} · 가격: 🪙 ${l.price}G</div>
        </div>
        ${l.seller === state.nick
          ? `<button class="btn sec" data-mkt-cancel="${l.id}">취소</button>`
          : `<button class="btn primary" data-mkt-buy="${l.id}">구매 (${l.price}G)</button>`}
      </div>`).join('')
    : '<p class="item-desc">현재 등록된 매물이 없습니다. 강화석이나 결정을 등록해 보세요!</p>';

  const html = `
    <div class="upgrade-box">
      <h3>📦 거래소 물품 등록 (보유: 🔮 ${state.stone} · 💎 ${state.crystal})</h3>
      <div class="row-inputs">
        <select id="mkt-type">
          <option value="stone">🔮 강화석</option>
          <option value="crystal">💎 심연의 결정</option>
        </select>
        <input id="mkt-qty" type="number" min="1" max="999" value="5" style="width:90px" placeholder="수량" />
        <input id="mkt-price" type="number" min="10" max="999999" value="250" style="width:110px" placeholder="총 가격(G)" />
        <button id="btn-mkt-list" class="btn accent">등록하기</button>
      </div>
    </div>
    <h3>🛒 실시간 거래소 목록</h3>
    ${rows}
  `;
  openModal('💎 유저 간 실시간 거래소', html);

  $('btn-mkt-list').onclick = () => {
    const itemType = $('mkt-type').value;
    const qty = Math.max(1, Math.floor(Number($('mkt-qty').value) || 1));
    const price = Math.max(10, Math.floor(Number($('mkt-price').value) || 100));
    if (itemType === 'stone' && state.stone < qty) { showToast('강화석이 부족합니다.'); return; }
    if (itemType === 'crystal' && state.crystal < qty) { showToast('심연의 결정이 부족합니다.'); return; }
    if (!ws || !wsConnected) { showToast('서버에 연결되어 있지 않습니다.'); return; }
    if (itemType === 'stone') state.stone -= qty;
    else state.crystal -= qty;
    updateHUD(); saveGame();
    ws.send(JSON.stringify({ type: 'market_list', itemType, qty, price }));
  };
  $('modal-body').querySelectorAll('[data-mkt-buy]').forEach((b) => {
    b.onclick = () => {
      const l = marketListings.find((x) => x.id === b.dataset.mktBuy);
      if (!l) return;
      if (state.gold < l.price) { showToast('골드가 부족합니다!'); return; }
      ws.send(JSON.stringify({ type: 'market_buy', id: l.id }));
    };
  });
  $('modal-body').querySelectorAll('[data-mkt-cancel]').forEach((b) => {
    b.onclick = () => { ws.send(JSON.stringify({ type: 'market_cancel', id: b.dataset.mktCancel })); };
  });
}

async function openPartyRankingModal() {
  let rankHtml = '<p class="item-desc">랭킹 불러오는 중...</p>';
  try {
    const r = await fetch('/api/ranking').then((res) => res.json());
    rankHtml = (r.list || []).map((u, idx) => `
      <div class="list-row">
        <div><b>#${idx + 1} ${escapeHtml(u.nick)}</b> · Lv.${u.level} ${CLASSES[u.cls]?.name || ''}</div>
        <div class="item-desc">심연 ${u.abyssFloor}층 · 보스 ${u.bossKills}킬</div>
      </div>`).join('') || '<p class="item-desc">아직 기록이 없습니다.</p>';
  } catch {}

  const pRows = partiesList.length
    ? partiesList.map((pt) => {
      const joined = myParty && myParty.id === pt.id;
      return `
        <div class="list-row">
          <div>
            <b>🛡️ ${escapeHtml(pt.name)}</b> (${pt.members.length}/8명)
            <div class="item-desc">파티장: ${escapeHtml(pt.leader)} · 멤버: ${pt.members.map(escapeHtml).join(', ')}</div>
          </div>
          ${joined
            ? `<button id="btn-party-leave" class="btn danger">탈퇴</button>`
            : `<button class="btn primary" data-party-join="${pt.id}">참여</button>`}
        </div>`;
    }).join('')
    : '<p class="item-desc">생성된 파티가 없습니다. 파티를 만들어 시너지 버프(+15% ATK, +20% EXP)를 받으세요!</p>';

  const html = `
    <div class="upgrade-box">
      <h3>🛡️ 8인 파티 시스템 (파티 시너지: ATK +15% · EXP +20%)</h3>
      <div class="row-inputs">
        <input id="party-name-in" type="text" maxlength="20" placeholder="파티 이름 (예: 월드드래곤 팟)" style="flex:1" />
        <button id="btn-party-create" class="btn accent">파티 창설</button>
      </div>
      ${pRows}
    </div>
    <h3>🏆 서버 명예의 전당 (TOP 30)</h3>
    ${rankHtml}
  `;
  openModal('🛡️ 파티 & 서버 랭킹', html);

  $('btn-party-create').onclick = () => {
    if (!ws || !wsConnected) return;
    ws.send(JSON.stringify({ type: 'party_create', name: $('party-name-in').value.trim() || `${state.nick}의 파티` }));
    setTimeout(openPartyRankingModal, 180);
  };
  const leaveBtn = $('btn-party-leave');
  if (leaveBtn) leaveBtn.onclick = () => {
    ws.send(JSON.stringify({ type: 'party_leave' }));
    setTimeout(openPartyRankingModal, 180);
  };
  $('modal-body').querySelectorAll('[data-party-join]').forEach((b) => {
    b.onclick = () => {
      ws.send(JSON.stringify({ type: 'party_join', id: b.dataset.partyJoin }));
      setTimeout(openPartyRankingModal, 180);
    };
  });
}

function openCouponModal() {
  const html = `
    <div class="upgrade-box">
      <h3>🎟️ 환장 래거시 쿠폰 입력</h3>
      <p class="item-desc">사용 가능 예시 코드: <b>LEGACY2026</b>, <b>CRAZY2026</b>, <b>ODYSSEY777</b>, <b>HWANJANG</b></p>
      <div class="row-inputs">
        <input id="coupon-input" type="text" placeholder="쿠폰 코드 입력 (대소문자 무관)" style="flex:1" />
        <button id="btn-coupon-apply" class="btn primary">사용하기</button>
      </div>
    </div>
  `;
  openModal('🎟️ 쿠폰 교환소', html);
  $('btn-coupon-apply').onclick = () => {
    const code = $('coupon-input').value.trim().toUpperCase();
    const c = COUPONS[code];
    if (!c) { showToast('❌ 유효하지 않은 쿠폰 코드입니다.'); return; }
    if (state.usedCoupons.includes(code)) { showToast('⚠️ 이미 사용한 쿠폰입니다.'); return; }
    state.usedCoupons.push(code);
    state.gold += c.gold;
    state.stone += c.stone;
    state.crystal += c.crystal;
    SFX.levelUp();
    updateHUD();
    saveGame();
    showToast(`🎁 [${c.desc}] +${c.gold}G +🔮${c.stone} +💎${c.crystal}`);
    closeModal();
  };
}

// ---------------- HUD & Minimap ----------------
function updateHUD() {
  const c = currentClass();
  const t = currentTitle();
  const g = currentGrade();
  const stats = calcStats();
  player.maxHp = stats.maxHp;
  if (player.hp > player.maxHp) player.hp = player.maxHp;

  $('hud-level').textContent = `Lv.${state.level}`;
  $('hud-title').textContent = `[${t.name}]`;
  $('hud-class').textContent = c.name;
  $('hud-nick').textContent = state.nick;

  $('hp-fill').style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
  $('hp-text').textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;

  const need = expNeeded(state.level);
  const expPct = state.level >= 99 ? 100 : Math.min(100, (state.exp / need) * 100);
  $('exp-fill').style.width = `${expPct}%`;
  $('exp-text').textContent = state.level >= 99 ? 'MAX (Lv.99)' : `${Math.floor(expPct)}%`;

  $('cur-gold').textContent = state.gold.toLocaleString();
  $('cur-stone').textContent = state.stone.toLocaleString();
  $('cur-crystal').textContent = state.crystal.toLocaleString();
  $('hud-equip').textContent = `${g.name} +${state.enh}`;
  $('hud-equip').style.color = g.color;

  $('s1-name').textContent = c.skills[0].name;
  $('s2-name').textContent = c.skills[1].name;
  $('s3-name').textContent = c.skills[2].name;

  $('party-buff-tag').classList.toggle('hidden', !(myParty && myParty.members.length > 1));

  // Quest UI
  const q = QUESTS[state.questIdx];
  if (q) {
    $('quest-title').textContent = q.title;
    $('quest-desc').textContent = `${q.desc} (${Math.min(state.questProg, q.count)}/${q.count})`;
    $('quest-reward').textContent = `보상: ${q.gold}G · 🔮${q.stone} · 💎${q.crystal}`;
  } else {
    $('quest-title').textContent = '모든 메인 퀘스트 완료!';
    $('quest-desc').textContent = '신기루/심연 던전 및 월드 레이드에 도전하세요.';
    $('quest-reward').textContent = '🎉 대륙의 영웅';
  }

  // Daily Quest UI
  const claimed = state.dailyDate && state.dailyDate === state.todayStr;
  if (claimed) {
    $('daily-text').textContent = '📅 일일 퀘스트 완료 ✓';
    $('btn-daily-claim').classList.add('hidden');
  } else {
    $('daily-text').textContent = `📅 일일: 몬스터 10처치 (${state.dailyKills}/10)`;
    $('btn-daily-claim').classList.toggle('hidden', state.dailyKills < 10);
  }
}

$('btn-daily-claim').onclick = async () => {
  if (state.dailyKills < 10) return;
  try {
    const r = await fetch('/api/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ action: 'claim' }),
    }).then((x) => x.json());
    if (r.ok) {
      state.dailyDate = r.today;
      state.todayStr = r.today;
      state.gold += 600;
      state.stone += 6;
      state.crystal += 15;
      SFX.levelUp();
      showToast('📅 일일 퀘스트 보상 수령! +600G +🔮6 +💎15');
      updateHUD();
      saveGame();
    } else {
      showToast(r.error || '이미 수령했습니다.');
    }
  } catch {}
};

function updateCooldownsUI() {
  const setCd = (id, val) => {
    const el = $(id);
    if (val > 0.05) { el.classList.remove('hidden'); el.textContent = val.toFixed(1); }
    else el.classList.add('hidden');
  };
  setCd('s1-cd', player.cds[0]);
  setCd('s2-cd', player.cds[1]);
  setCd('s3-cd', player.cds[2]);
  setCd('dash-cd', player.dashCd);
  setCd('heal-cd', player.healCd);
  $('guard-active').classList.toggle('hidden', !player.guardActive);

  if (player.combo > 1 && player.comboTimer > 0) {
    $('combo-box').classList.remove('hidden');
    $('combo-num').textContent = player.combo;
  } else {
    $('combo-box').classList.add('hidden');
  }

  // Boss HUD (근처 보스 또는 던전 보스)
  const boss = monsterMgr.mobs.find(
    (m) => m.isBoss && !m.dead && (player.zone !== 'world' || Math.hypot(m.x - player.x, m.z - player.z) < 58)
  );
  if (boss) {
    $('boss-hud').classList.remove('hidden');
    $('boss-name').textContent = `Lv.${boss.level} ${boss.name}`;
    $('boss-hp-text').textContent = `${boss.hp.toLocaleString()} / ${boss.maxHp.toLocaleString()}`;
    $('boss-hp-fill').style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
  } else {
    $('boss-hud').classList.add('hidden');
  }

  // World Event Banner
  if (activeWorld) {
    $('world-banner').classList.remove('hidden');
    const rem = Math.max(0, Math.ceil((activeWorld.endAt - Date.now()) / 1000));
    const mm = String(Math.floor(rem / 60)).padStart(2, '0');
    const ss = String(rem % 60).padStart(2, '0');
    $('world-name').textContent = `${activeWorld.name} (${REGIONS[activeWorld.zone]?.name || activeWorld.zone})`;
    $('world-timer').textContent = `${mm}:${ss}`;
    if (activeWorld.kind === 'raid') {
      const pct = Math.max(0, (activeWorld.hp / Math.max(1, activeWorld.maxHp)) * 100);
      $('world-fill').style.width = `${pct}%`;
      $('world-prog-text').textContent = `${activeWorld.hp.toLocaleString()} / ${activeWorld.maxHp.toLocaleString()}`;
    } else {
      const pct = Math.min(100, (activeWorld.count / Math.max(1, activeWorld.goal)) * 100);
      $('world-fill').style.width = `${pct}%`;
      $('world-prog-text').textContent = `${activeWorld.count} / ${activeWorld.goal}`;
    }
  } else {
    $('world-banner').classList.add('hidden');
  }
}

function drawMinimap() {
  const cvs = $('minimap');
  const ctx = cvs.getContext('2d');
  const W = cvs.width;
  const H = cvs.height;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, H);

  if (player.zone === 'world') {
    const viewR = 105;
    const scale = (W * 0.48) / viewR;
    const toXY = (wx, wz) => [W / 2 + (wx - player.x) * scale, H / 2 + (wz - player.z) * scale];

    // 에메랄드 바다 해역 표시
    const [ox, oy] = toXY(190, 190);
    ctx.fillStyle = 'rgba(6,182,212,0.22)';
    ctx.beginPath(); ctx.arc(ox, oy, 94 * scale, 0, Math.PI * 2); ctx.fill();

    // 콜로세움 결투장 표시
    const [ax, ay] = toXY(115, -115);
    ctx.strokeStyle = 'rgba(239,68,68,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ax, ay, 34 * scale, 0, Math.PI * 2); ctx.stroke();

    // 마을 통나무 울타리 & 해자 물길
    const [vx, vy] = toXY(0, 0);
    ctx.strokeStyle = 'rgba(56,189,248,0.35)';
    ctx.lineWidth = 7 * scale;
    ctx.beginPath(); ctx.arc(vx, vy, 38.8 * scale, 0, Math.PI * 2); ctx.stroke();

    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(vx, vy, 31.5 * scale, 0, Math.PI * 2); ctx.stroke();

    // NPCs
    ctx.fillStyle = '#facc15';
    for (const n of worldBuilder.npcs) {
      const [x, y] = toXY(n.x, n.z);
      ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
    }
    // Monsters
    for (const m of monsterMgr.mobs) {
      if (m.dead) continue;
      if (Math.hypot(m.x - player.x, m.z - player.z) > viewR + 10) continue;
      const [x, y] = toXY(m.x, m.z);
      ctx.fillStyle = m.isBoss ? '#f43f5e' : '#ef4444';
      ctx.beginPath(); ctx.arc(x, y, m.isBoss ? 4.5 : 2.3, 0, Math.PI * 2); ctx.fill();
    }
    // Remote players
    ctx.fillStyle = '#38bdf8';
    for (const [, rp] of remotePlayers) {
      const [x, y] = toXY(rp.x, rp.z);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Self center
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 3.8, 0, Math.PI * 2); ctx.fill();

    // 방위 라벨
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = '#93c5fd'; ctx.fillText('❄️N', W / 2 - 9, 10);
    ctx.fillStyle = '#f9a8d4'; ctx.fillText('🌸S', W / 2 - 9, H - 3);
    ctx.fillStyle = '#fde047'; ctx.fillText('☀️E', W - 20, H / 2 + 3);
    ctx.fillStyle = '#fb923c'; ctx.fillText('🍁W', 3, H / 2 + 3);
    return;
  }

  const z = ZONES[player.zone] || ZONES.mirage;
  const scale = (W * 0.44) / z.radius;
  ctx.strokeStyle = 'rgba(56,189,248,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, z.radius * scale, 0, Math.PI * 2);
  ctx.stroke();

  const toXY = (wx, wz) => [W / 2 + wx * scale, H / 2 + wz * scale];
  for (const p of worldBuilder.portals) {
    const [x, y] = toXY(p.x, p.z);
    ctx.strokeStyle = '#' + p.color.toString(16).padStart(6, '0');
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.stroke();
  }
  for (const m of monsterMgr.mobs) {
    if (m.dead) continue;
    const [x, y] = toXY(m.x, m.z);
    ctx.fillStyle = m.isBoss ? '#f43f5e' : '#ef4444';
    ctx.beginPath(); ctx.arc(x, y, m.isBoss ? 4.5 : 2.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  const [px, py] = toXY(player.x, player.z);
  ctx.beginPath(); ctx.arc(px, py, 3.8, 0, Math.PI * 2); ctx.fill();
}

// ---------------- Input Handling ----------------
const keys = {};
let isDraggingCam = false;
let lastMouseX = 0;
let lastMouseY = 0;
let joyVec = { x: 0, y: 0 };

window.addEventListener('keydown', (e) => {
  if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) {
    if (e.key === 'Enter' && document.activeElement === $('chat-input')) sendChat();
    return;
  }
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === 'enter') { $('chat-input').focus(); return; }
  if (k === ' ') {
    if (player.onGround && !player.dead) { player.vy = 10.5; player.onGround = false; }
  }
  if (k === '1') doSkill(0);
  if (k === '2') doSkill(1);
  if (k === '3') doSkill(2);
  if (k === 'q') doDash();
  if (k === 'f') doGuard();
  if (k === 'r') doHeal();
  if (k === 'e') doInteract();
  if (k === 'z') toggleAutoHunt();
  if (k === 'j') openClassModal();
  if (k === 'u') openUpgradeModal();
  if (k === 'b') openDungeonModal();
  if (k === 'm') openMapModal();
  if (k === 't') openTitleModal();
  if (k === 'k') openMarketModal();
  if (k === 'p') openPartyRankingModal();
  if (k === 'escape') closeModal();
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

renderer.domElement.addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    doAttack();
  } else if (e.button === 2 || e.button === 1) {
    isDraggingCam = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('mousemove', (e) => {
  if (!isDraggingCam) return;
  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  camYaw -= dx * 0.0065;
  camPitch = Math.max(0.18, Math.min(1.25, camPitch + dy * 0.005));
});
window.addEventListener('mouseup', () => { isDraggingCam = false; });
renderer.domElement.addEventListener('wheel', (e) => {
  camDist = Math.max(6, Math.min(24, camDist + e.deltaY * 0.01));
}, { passive: true });

// Skill slot clicks
document.querySelectorAll('.skill-slot.clickable').forEach((el) => {
  el.onclick = () => triggerAct(el.dataset.act);
});
function triggerAct(act) {
  if (act === 'attack') doAttack();
  else if (act === 's1') doSkill(0);
  else if (act === 's2') doSkill(1);
  else if (act === 's3') doSkill(2);
  else if (act === 'dash') doDash();
  else if (act === 'guard') doGuard();
  else if (act === 'heal') doHeal();
  else if (act === 'interact') doInteract();
}

// Mobile joystick & pad
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
  $('mobile-pad').classList.remove('hidden');
}
$('btn-touch-toggle').onclick = () => $('mobile-pad').classList.toggle('hidden');
document.querySelectorAll('.mob-btn').forEach((b) => {
  b.addEventListener('touchstart', (e) => { e.preventDefault(); triggerAct(b.dataset.act); });
  b.addEventListener('click', () => triggerAct(b.dataset.act));
});
const joyBase = $('joy-base');
const joyStick = $('joy-stick');
let joyTouchId = null;
let camTouchId = null;
let camTouchX = 0;
let camTouchY = 0;
renderer.domElement.addEventListener('touchstart', (e) => {
  if (camTouchId === null && e.changedTouches.length) {
    const t = e.changedTouches[0];
    camTouchId = t.identifier;
    camTouchX = t.clientX;
    camTouchY = t.clientY;
  }
}, { passive: true });
joyBase.addEventListener('touchstart', (e) => {
  e.preventDefault();
  joyTouchId = e.changedTouches[0].identifier;
});
window.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === joyTouchId) {
      const r = joyBase.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = t.clientX - cx;
      let dy = t.clientY - cy;
      const maxR = 40;
      const len = Math.hypot(dx, dy);
      if (len > maxR) { dx = (dx / len) * maxR; dy = (dy / len) * maxR; }
      joyStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      joyVec = { x: dx / maxR, y: dy / maxR };
    } else if (t.identifier === camTouchId) {
      camYaw -= (t.clientX - camTouchX) * 0.008;
      camPitch = Math.max(0.18, Math.min(1.25, camPitch + (t.clientY - camTouchY) * 0.006));
      camTouchX = t.clientX;
      camTouchY = t.clientY;
    }
  }
});
window.addEventListener('touchend', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === joyTouchId) {
      joyTouchId = null;
      joyVec = { x: 0, y: 0 };
      joyStick.style.transform = 'translate(-50%, -50%)';
    }
    if (t.identifier === camTouchId) camTouchId = null;
  }
});

// Menu buttons
function toggleAutoHunt() {
  player.autoHunt = !player.autoHunt;
  $('btn-auto').classList.toggle('active', player.autoHunt);
  $('btn-auto').innerHTML = `🤖 자동 ${player.autoHunt ? 'ON' : 'OFF'} <kbd>Z</kbd>`;
  showToast(player.autoHunt ? '🤖 자동 사냥 시작!' : '🤖 자동 사냥 중지');
}
$('btn-auto').onclick = toggleAutoHunt;
$('btn-open-class').onclick = () => openClassModal('all');
$('btn-open-upgrade').onclick = openUpgradeModal;
$('btn-open-dungeon').onclick = openDungeonModal;
$('btn-open-map').onclick = openMapModal;
$('btn-open-title').onclick = openTitleModal;
$('btn-open-market').onclick = openMarketModal;
$('btn-open-party').onclick = openPartyRankingModal;
$('btn-open-coupon').onclick = openCouponModal;
$('btn-logout').onclick = async () => {
  await saveGame(true);
  localStorage.removeItem('ody_token');
  state.token = '';
  if (ws) try { ws.close(); } catch {}
  location.reload();
};
$('interact-prompt').onclick = doInteract;
$('btn-mute').onclick = () => {
  SFX.muted = !SFX.muted;
  $('btn-mute').textContent = SFX.muted ? '🔇' : '🔊';
};
$('btn-pvp-toggle').onclick = () => {
  player.pvpOn = !player.pvpOn;
  const btn = $('btn-pvp-toggle');
  btn.classList.toggle('on', player.pvpOn);
  btn.classList.toggle('off', !player.pvpOn);
  btn.textContent = player.pvpOn ? '⚔️ PvP ON' : '🕊️ 평화';
  showToast(player.pvpOn ? '⚔️ 필드 PvP 모드 활성화!' : '🕊️ 평화 모드로 전환되었습니다.');
};

// ---------------- Chat & WebSocket ----------------
function sendChat() {
  const inp = $('chat-input');
  const text = inp.value.trim();
  inp.value = '';
  inp.blur();
  if (!text) return;
  if (ws && wsConnected) ws.send(JSON.stringify({ type: 'chat', text }));
}
$('btn-chat-send').onclick = sendChat;

function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}`);
  ws.onopen = () => {
    wsConnected = true;
    ws.send(JSON.stringify({ type: 'hello', token: state.token, pin: verifiedEntryPin }));
  };
  ws.onclose = () => {
    wsConnected = false;
    setTimeout(() => { if (state.token && state.nick) connectWS(); }, 2500);
  };
  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }

    if (msg.type === 'welcome') {
      state.isAdmin = !!msg.isAdmin;
      onlineCount = msg.online || 1;
      $('online-badge').textContent = `🌐 ${onlineCount}명 접속`;
      partiesList = msg.parties || [];
      myParty = partiesList.find((pt) => pt.members.includes(state.nick)) || null;
      marketListings = msg.market || [];
      activeWorld = msg.world || null;
      if (msg.pendingGold > 0) {
        state.gold += msg.pendingGold;
        showToast(`💰 오프라인 중 거래소 판매 수익 +${msg.pendingGold}G 수령!`);
      }
      for (const p of msg.players || []) upsertRemotePlayer(p.nick, p.st);
      checkWorldEventSpawn();
      updateHUD();
    } else if (msg.type === 'st') {
      upsertRemotePlayer(msg.nick, msg.st);
    } else if (msg.type === 'leave' || msg.type === 'leave_zone') {
      removeRemotePlayer(msg.nick);
    } else if (msg.type === 'act') {
      const rp = remotePlayers.get(msg.nick);
      if (rp) {
        const col = CLASSES[msg.cls]?.color || 0x38bdf8;
        if (rp.inst) playAnim(rp.inst, [CLASSES[msg.cls]?.animAttack || '1H_Melee_Attack_Chop'], { loop: false });
        if (msg.act === 'atk') vfx.slashArc(rp.x, rp.y, rp.z, rp.ry, col, 3.0);
        else vfx.ringBurst(rp.x, rp.y, rp.z, 4.5, col);
      }
    } else if (msg.type === 'chat') {
      addChatLine(`<b>[Lv.${msg.lv} ${escapeHtml(msg.nick)}]</b> ${escapeHtml(msg.text)}`);
    } else if (msg.type === 'sys') {
      addChatLine(escapeHtml(msg.text), 'sys');
    } else if (msg.type === 'admin_ok') {
      state.isAdmin = true;
      showToast('🔑 운영자 권한이 부여되었습니다! (/world raid winter 85 사용 가능)');
    } else if (msg.type === 'announce') {
      const b = $('announce-banner');
      b.textContent = `📢 ${msg.text}`;
      b.classList.remove('hidden');
      setTimeout(() => b.classList.add('hidden'), 6000);
    } else if (msg.type === 'parties') {
      partiesList = msg.list || [];
      myParty = partiesList.find((pt) => pt.members.includes(state.nick)) || null;
      updateHUD();
    } else if (msg.type === 'market_update') {
      marketListings = msg.listings || [];
    } else if (msg.type === 'market_listed') {
      showToast(`📦 거래소에 [${msg.listing.itemName} × ${msg.listing.qty}] 등록 완료!`);
      if (!$('modal-backdrop').classList.contains('hidden')) openMarketModal();
    } else if (msg.type === 'market_bought') {
      const l = msg.listing;
      state.gold = Math.max(0, state.gold - l.price);
      if (l.itemType === 'stone') state.stone += l.qty;
      else state.crystal += l.qty;
      updateHUD(); saveGame();
      showToast(`✅ [${l.itemName} × ${l.qty}] 구매 완료!`);
      if (!$('modal-backdrop').classList.contains('hidden')) openMarketModal();
    } else if (msg.type === 'market_sold') {
      state.gold += msg.listing.price;
      updateHUD(); saveGame();
      showToast(`💰 ${msg.buyer}님이 [${msg.listing.itemName}]을(를) 구매하여 +${msg.listing.price}G 획득!`);
    } else if (msg.type === 'market_cancelled') {
      const l = msg.listing;
      if (l.itemType === 'stone') state.stone += l.qty;
      else state.crystal += l.qty;
      updateHUD(); saveGame();
      showToast('거래소 등록이 취소되어 아이템을 돌려받았습니다.');
      if (!$('modal-backdrop').classList.contains('hidden')) openMarketModal();
    } else if (msg.type === 'market_err') {
      showToast(msg.reason);
    } else if (msg.type === 'pvp_hit') {
      if (player.dead || player.invulnTimer > 0) return;
      if (player.guardActive && player.parryWindow > 0) {
        SFX.parry();
        vfx.popupText(new THREE.Vector3(player.x, player.y, player.z), '🛡️ PvP 패링!', 'parry', camera);
        return;
      }
      const dmg = Math.max(1, Math.floor(msg.dmg * (player.guardActive ? 0.35 : 1)));
      player.hp = Math.max(0, player.hp - dmg);
      vfx.popupText(new THREE.Vector3(player.x, player.y, player.z), `⚔️ -${dmg}`, 'hurt', camera);
      if (player.hp <= 0) {
        player.dead = true;
        player.respawnTimer = 3.0;
        ws.send(JSON.stringify({ type: 'pvp_kill', killer: msg.from }));
        showToast(`⚔️ ${msg.from}님에게 패배했습니다! 잠시 후 부활합니다.`);
      }
    } else if (msg.type === 'pvp_kill_credit') {
      state.pvpWins++;
      state.gold += 150;
      showToast('🏆 PvP 승리! +150G 획득!');
      updateHUD(); saveGame();
    } else if (msg.type === 'world_start') {
      activeWorld = msg.world;
      worldSpawnedId = null;
      addChatLine(`🚨 ${activeWorld.name} 시작! (${ZONES[activeWorld.zone]?.name || activeWorld.zone})`, 'admin');
      showToast(`🚨 ${activeWorld.name} 발동!`);
      if (wsConnected) ws.send(JSON.stringify({ type: 'wq_touch' }));
      checkWorldEventSpawn();
    } else if (msg.type === 'world_prog') {
      if (activeWorld && activeWorld.id === msg.id) {
        activeWorld.hp = msg.hp;
        activeWorld.count = msg.count;
        const wb = monsterMgr.mobs.find((m) => m.isWorldBoss);
        if (wb && msg.hp !== undefined) wb.hp = msg.hp;
      }
    } else if (msg.type === 'world_end') {
      activeWorld = null;
      worldSpawnedId = null;
      addChatLine(msg.msg, 'admin');
      showToast(msg.msg);
      if (msg.success && msg.contributed) {
        const bonusMult = 0.6 + Math.min(1.5, (msg.share || 0) * 3);
        const rwGold = Math.floor((350 + msg.level * 22) * bonusMult);
        const rwStone = Math.max(3, Math.floor(4 * bonusMult));
        const rwCrystal = Math.max(8, Math.floor(12 * bonusMult));
        grantExpAndLoot(250 + msg.level * 25, rwGold, rwStone, rwCrystal, '__world__');
        showToast(`🎁 월드 이벤트 참여 보상! +${rwGold}G +🔮${rwStone} +💎${rwCrystal}`);
      }
    }
  };
}

// ---------------- Auth & Persistence ----------------
function serializeSave() {
  return {
    cls: state.cls,
    unlockedClasses: state.unlockedClasses,
    level: state.level,
    exp: state.exp,
    gold: state.gold,
    stone: state.stone,
    crystal: state.crystal,
    equipGrade: state.equipGrade,
    enh: state.enh,
    enhFailBonus: state.enhFailBonus,
    title: state.title,
    questIdx: state.questIdx,
    questProg: state.questProg,
    dailyKills: state.dailyKills,
    bossKills: state.bossKills,
    dragonKilled: state.dragonKilled,
    bestWave: state.bestWave,
    abyssFloor: state.abyssFloor,
    pvpWins: state.pvpWins,
    usedCoupons: state.usedCoupons,
  };
}

function applySave(s) {
  if (!s) return;
  Object.assign(state, s);
}

async function saveGame(keepalive = false) {
  const payload = serializeSave();
  try {
    if (state.nick) localStorage.setItem('ody_save_backup_' + state.nick, JSON.stringify(payload));
    localStorage.setItem('ody_save_backup_last', JSON.stringify(payload));
  } catch {}
  if (!state.token) return;
  try {
    await fetch('/api/save', {
      method: 'POST',
      keepalive,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ save: payload }),
    });
  } catch {}
}
window.addEventListener('beforeunload', () => { saveGame(true); });

let authMode = 'login';
$('tab-login').onclick = () => {
  authMode = 'login';
  $('tab-login').classList.add('active');
  $('tab-reg').classList.remove('active');
  $('btn-auth-submit').textContent = '로그인 및 대륙 입장';
};
$('tab-reg').onclick = () => {
  authMode = 'register';
  $('tab-reg').classList.add('active');
  $('tab-login').classList.remove('active');
  $('btn-auth-submit').textContent = '회원가입 후 입장';
};

async function startWithProfile(prof, isAutoLogin = false) {
  if (prof.token) {
    state.token = prof.token;
    localStorage.setItem('ody_token', prof.token);
  }
  state.nick = prof.nick;
  localStorage.setItem('ody_last_nick', prof.nick);
  state.isAdmin = !!prof.isAdmin;
  state.dailyDate = prof.dailyDate;
  state.todayStr = prof.today;
  if (prof.save) {
    applySave(prof.save);
  } else {
    try {
      const rawBak = localStorage.getItem('ody_save_backup_' + prof.nick) || localStorage.getItem('ody_save_backup_last');
      if (rawBak) {
        const bak = JSON.parse(rawBak);
        if (bak && typeof bak === 'object') {
          applySave(bak);
          saveGame();
        }
      }
    } catch {}
  }

  $('start-overlay').classList.add('hidden');
  $('hud').classList.remove('hidden');

  const stats = calcStats();
  player.maxHp = stats.maxHp;
  player.hp = stats.maxHp;

  await rebuildPlayerModel();
  await enterZone('world');
  updateHUD();
  connectWS();
  if (isAutoLogin) showToast(`👋 ${prof.nick}님, 최근 계정으로 자동 로그인되었습니다!`);
}

let verifiedEntryPin = '';
let gateBusy = false;

async function tryAutoLoginAfterGate() {
  if (!state.token) return false;
  try {
    const r = await fetch('/api/me', {
      headers: { Authorization: `Bearer ${state.token}`, 'x-entry-pin': verifiedEntryPin },
    });
    if (r.ok) {
      const prof = await r.json();
      if (prof && prof.nick) {
        await startWithProfile(prof, true);
        return true;
      }
    } else if (r.status === 401) {
      localStorage.removeItem('ody_token');
      state.token = '';
    }
  } catch {}
  return false;
}

async function unlockGate() {
  if (gateBusy) return;
  const pin = $('gate-pin').value.trim();
  $('gate-err').textContent = '';
  if (!/^\d{4}$/.test(pin)) {
    $('gate-err').textContent = '숫자 4자리를 입력해주세요.';
    $('gate-pin').focus();
    return;
  }
  gateBusy = true;
  try {
    const res = await fetch('/api/gate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    if (!res.ok) {
      $('gate-err').textContent = data.error || '비밀번호가 올바르지 않습니다.';
      $('gate-pin').select();
      return;
    }
    verifiedEntryPin = pin;
    const autoLoggedIn = await tryAutoLoginAfterGate();
    if (!autoLoggedIn) {
      $('gate-section').classList.add('hidden');
      $('auth-section').classList.remove('hidden');
      ($('auth-nick').value ? $('auth-pw') : $('auth-nick')).focus();
    }
  } catch {
    $('gate-err').textContent = '서버에 연결할 수 없습니다.';
  } finally {
    gateBusy = false;
  }
}

$('btn-gate-unlock').onclick = unlockGate;
$('gate-pin').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') unlockGate();
});
$('gate-pin').addEventListener('input', () => {
  const cleaned = $('gate-pin').value.replace(/\D/g, '').slice(0, 4);
  if ($('gate-pin').value !== cleaned) $('gate-pin').value = cleaned;
  $('gate-err').textContent = '';
  if (cleaned.length === 4) unlockGate();
});

$('btn-auth-submit').onclick = async () => {
  const nick = $('auth-nick').value.trim();
  const pw = $('auth-pw').value;
  $('auth-err').textContent = '';
  try {
    const res = await fetch(authMode === 'login' ? '/api/login' : '/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-entry-pin': verifiedEntryPin },
      body: JSON.stringify({ nick, pw, pin: verifiedEntryPin }),
    });
    const data = await res.json();
    if (!res.ok) { $('auth-err').textContent = data.error || '오류가 발생했습니다.'; return; }
    startWithProfile(data);
  } catch {
    $('auth-err').textContent = '서버에 연결할 수 없습니다.';
  }
};

$('btn-guest-start').onclick = async () => {
  $('auth-err').textContent = '';
  try {
    const res = await fetch('/api/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-entry-pin': verifiedEntryPin },
      body: JSON.stringify({ pin: verifiedEntryPin }),
    });
    const data = await res.json();
    if (!res.ok) { $('auth-err').textContent = data.error || '오류'; return; }
    startWithProfile(data);
  } catch {
    $('auth-err').textContent = '서버에 연결할 수 없습니다.';
  }
};

// 최근 로그인 닉네임 자동 채움 (자동 로그인은 입장 비밀번호 4자리 확인 후 실행)
const savedLastNick = localStorage.getItem('ody_last_nick');
if (savedLastNick && !$('auth-nick').value) $('auth-nick').value = savedLastNick;

// ---------------- Main Game Loop ----------------
let lastTime = performance.now();
let syncTimer = 0;
let saveTimer = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const t = now / 1000;

  if (!$('hud').classList.contains('hidden')) {
    updatePlayer(dt);
    worldBuilder.update(dt, t, player.x, player.z, player.zone);
    vfx.update(dt, monsterMgr.mobs, player.zone);
    monsterMgr.update(dt, player, player.zone, camera, onPlayerDamaged, (mob, sAtk) => damageMob(mob, sAtk, false));
    updateRemotePlayers(dt);
    updateWorldPlates();
    updateCooldownsUI();
    drawMinimap();

    syncTimer += dt;
    if (syncTimer >= 0.08 && ws && wsConnected) {
      syncTimer = 0;
      ws.send(JSON.stringify({
        type: 'state',
        st: {
          zone: player.zone, x: +player.x.toFixed(2), y: +player.y.toFixed(2), z: +player.z.toFixed(2),
          ry: +player.ry.toFixed(2), an: player.inst?.currentKey || 'Idle',
          lv: state.level, cls: state.cls, title: state.title,
          hp: Math.ceil(player.hp), mhp: player.maxHp,
          grade: state.equipGrade, enh: state.enh, pvpOn: player.pvpOn, dead: player.dead,
        },
      }));
    }

    saveTimer += dt;
    if (saveTimer >= 10) { saveTimer = 0; saveGame(); }
  }

  renderer.render(scene, camera);
}

function updatePlayer(dt) {
  if (player.inst?.mixer) player.inst.mixer.update(dt);
  if (player.atkCd > 0) player.atkCd -= dt;
  for (let i = 0; i < 3; i++) if (player.cds[i] > 0) player.cds[i] -= dt;
  if (player.dashCd > 0) player.dashCd -= dt;
  if (player.healCd > 0) player.healCd -= dt;
  if (player.invulnTimer > 0) player.invulnTimer -= dt;
  if (player.comboTimer > 0) player.comboTimer -= dt;
  else player.combo = 0;

  if (player.guardActive) {
    player.guardTimer -= dt;
    player.parryWindow -= dt;
    if (player.guardTimer <= 0) player.guardActive = false;
  }

  if (player.dead) {
    player.respawnTimer -= dt;
    if (player.respawnTimer <= 0) {
      player.dead = false;
      player.hp = player.maxHp;
      clearZonePlates();
      enterZone('world');
    }
    return;
  }

  // Safe zone bonfire healing
  for (const b of worldBuilder.bonfires) {
    if (Math.hypot(player.x - b.x, player.z - b.z) < b.r && player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.18 * dt);
    }
  }

  // Movement vector
  let ix = (keys['d'] ? 1 : 0) - (keys['a'] ? 1 : 0) + joyVec.x;
  let iz = (keys['s'] ? 1 : 0) - (keys['w'] ? 1 : 0) + joyVec.y;
  const len = Math.hypot(ix, iz);

  const c = currentClass();
  let moving = false;

  if (player.dashTimer > 0) {
    player.dashTimer -= dt;
    const spd = 25;
    player.x += Math.sin(player.ry) * spd * dt;
    player.z += Math.cos(player.ry) * spd * dt;
    moving = true;
  } else if (len > 0.05) {
    ix /= len; iz /= len;
    const sinY = Math.sin(camYaw);
    const cosY = Math.cos(camYaw);
    const vx = ix * cosY + iz * sinY;
    const vz = -ix * sinY + iz * cosY;
    const spd = c.moveSpd * (player.guardActive ? 0.45 : 1);
    player.x += vx * spd * dt;
    player.z += vz * spd * dt;
    player.ry = Math.atan2(vx, vz);
    moving = true;
  } else if (player.autoHunt && !isSafeAt(player.zone, player.x, player.z)) {
    // Auto-hunt AI
    if (player.hp < player.maxHp * 0.45 && player.healCd <= 0) doHeal();
    const target = findNearestMob(55);
    if (target) {
      const dx = target.x - player.x;
      const dz = target.z - player.z;
      const dist = Math.hypot(dx, dz);
      player.ry = Math.atan2(dx, dz);
      const stopDist = c.isRanged ? c.range * 0.78 : Math.max(2.2, c.range * 0.72);
      if (dist > stopDist) {
        player.x += (dx / dist) * c.moveSpd * dt;
        player.z += (dz / dist) * c.moveSpd * dt;
        moving = true;
      } else {
        if (player.cds[2] <= 0) doSkill(2);
        else if (player.cds[1] <= 0) doSkill(1);
        else if (player.cds[0] <= 0) doSkill(0);
        else doAttack();
      }
    }
  }

  // Clamp to zone radius & log fence / moat bridges
  const resolved = resolveWorldCollisions(player.zone, player.x, player.z);
  player.x = resolved.x;
  player.z = resolved.z;
  const maxR = (ZONES[player.zone]?.radius || 70) - 2;
  const distC = Math.hypot(player.x, player.z);
  if (distC > maxR) {
    player.x = (player.x / distC) * maxR;
    player.z = (player.z / distC) * maxR;
  }

  // Dynamic biome banner & sky color transition on seamless continent
  if (player.zone === 'world') {
    const reg = getRegionAt(player.x, player.z);
    if (reg.id !== lastRegionId) {
      lastRegionId = reg.id;
      $('zone-banner').textContent = `${reg.name} · ${reg.tag}`;
      showToast(`📍 ${reg.name} 지역에 진입했습니다!`);
    }
    if (scene.background) scene.background.lerp(new THREE.Color(reg.skyColor), dt * 2.5);
    if (scene.fog) scene.fog.color.lerp(new THREE.Color(reg.fogColor), dt * 2.5);
  }

  // Gravity & Terrain Y
  const groundY = getTerrainY(player.zone, player.x, player.z);
  player.vy -= 26 * dt;
  player.y += player.vy * dt;
  if (player.y <= groundY) {
    player.y = groundY;
    player.vy = 0;
    player.onGround = true;
  }

  player.root.position.set(player.x, player.y, player.z);
  player.root.rotation.y = player.ry;

  if (player.inst && player.atkCd <= 0 && !player.guardActive) {
    if (!player.onGround) playAnim(player.inst, ['jump_idle', 'jump_start']);
    else if (moving) playAnim(player.inst, ['running_a', 'walking_a']);
    else playAnim(player.inst, ['idle']);
  }

  // Camera follow
  const cx = player.x + Math.sin(camYaw) * Math.cos(camPitch) * camDist;
  const cy = player.y + 1.8 + Math.sin(camPitch) * camDist;
  const cz = player.z + Math.cos(camYaw) * Math.cos(camPitch) * camDist;
  camera.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 12));
  camera.lookAt(player.x, player.y + 1.5, player.z);

  // Portal auto-step & Interact prompt
  const inter = getNearestInteractable();
  if (inter) {
    $('interact-prompt').classList.remove('hidden');
    $('interact-prompt').textContent = inter.text;
  } else {
    $('interact-prompt').classList.add('hidden');
  }

  // Update HP bar smoothly
  $('hp-fill').style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
  $('hp-text').textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
}

function updateRemotePlayers(dt) {
  for (const [, rp] of remotePlayers) {
    if (rp.inst?.mixer) rp.inst.mixer.update(dt);
    rp.x += (rp.st.x - rp.x) * Math.min(1, dt * 10);
    rp.y += (rp.st.y - rp.y) * Math.min(1, dt * 10);
    rp.z += (rp.st.z - rp.z) * Math.min(1, dt * 10);
    rp.ry = rp.st.ry;
    rp.root.position.set(rp.x, rp.y, rp.z);
    rp.root.rotation.y = rp.ry;
    if (rp.inst && rp.st.an) playAnim(rp.inst, [rp.st.an, 'idle']);

    const v = new THREE.Vector3(rp.x, rp.y + 2.35, rp.z).project(camera);
    if (v.z > 1) rp.hpEl.style.display = 'none';
    else {
      rp.hpEl.style.display = 'block';
      rp.hpEl.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
      rp.hpEl.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
    }
  }
}

function updateWorldPlates() {
  const projectPlate = (el, x, y, z, maxD = 42) => {
    if (!el) return;
    if (Math.hypot(x - player.x, z - player.z) > maxD) { el.style.display = 'none'; return; }
    const v = new THREE.Vector3(x, y, z).project(camera);
    if (v.z > 1) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
  };
  for (const n of worldBuilder.npcs) projectPlate(n.plateEl, n.x, 2.4, n.z, 38);
  for (const p of worldBuilder.portals) projectPlate(p.plateEl, p.x, p.y + 4.4, p.z, 46);
}

requestAnimationFrame(animate);
