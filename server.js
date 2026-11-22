// =============================================================
//  환장 래거시 (Hwanjang Legacy) 3D MMORPG 독립 서버
//  - Zero-dependency HTTP + WebSocket (RFC 6455)
//  - 계정 회원가입/로그인/게스트, JSON 세이브, 일일퀘스트(KST)
//  - 실시간 멀티플레이 동기화, 8인 파티, 거래소, PvP, 월드 보스 이벤트
// =============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = Number(process.env.PORT || 3005);
const ENTRY_PIN = String(process.env.ODY_ENTRY_PIN || '5090');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.ODY_DATA_DIR || path.join(__dirname, 'data');
const ACC_FILE = path.join(DATA_DIR, 'accounts.json');
const CFG_FILE = path.join(DATA_DIR, 'config.json');
const MKT_FILE = path.join(DATA_DIR, 'market.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
};

function loadJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

const db = loadJSON(ACC_FILE, { accounts: {}, tokens: {} });
db.accounts = db.accounts || {};
db.tokens = db.tokens || {};

const cfg = loadJSON(CFG_FILE, null) || {
  adminKey: crypto.randomBytes(4).toString('hex').toUpperCase(),
  admins: [],
  note: '채팅창에 /admin <adminKey> 입력 시 운영자 권한이 부여됩니다.',
};
fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2));

const marketData = loadJSON(MKT_FILE, { nextId: 1, listings: [] });
marketData.listings = marketData.listings || [];

let saveTimer = null;
function writeAccountsNow() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  const tmp = ACC_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, ACC_FILE);
}
function persistAccounts(immediate = false) {
  if (immediate) { writeAccountsNow(); return; }
  if (saveTimer) return;
  saveTimer = setTimeout(writeAccountsNow, 500);
}
function persistCfg() { fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2)); }
function persistMarket() { fs.writeFileSync(MKT_FILE, JSON.stringify(marketData, null, 2)); }

function todayKST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
function hashPw(pw, salt) {
  return crypto.scryptSync(pw, salt, 32).toString('hex');
}
function isAdmin(nick) {
  return cfg.admins.includes(nick);
}
const NICK_RE = /^[가-힣a-zA-Z0-9_]{2,14}$/;

function publicProfile(nick) {
  const a = db.accounts[nick];
  return {
    nick,
    save: a.save || null,
    isAdmin: isAdmin(nick),
    dailyDate: a.dailyDate || null,
    today: todayKST(),
    serverNow: Date.now(),
    pendingGold: a.pendingGold || 0,
  };
}

function readBody(req, limit = 500000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('Payload too large')); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function authNick(req, body) {
  const h = req.headers.authorization || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : (body && body.token);
  if (!tok || !db.tokens[tok]) return null;
  const nick = db.tokens[tok];
  return db.accounts[nick] ? nick : null;
}

function hasValidPin(req, body) {
  const fromBody = body && body.pin != null ? String(body.pin).trim() : '';
  const fromHeader = String(req.headers['x-entry-pin'] || '').trim();
  return fromBody === ENTRY_PIN || fromHeader === ENTRY_PIN;
}

async function handleAPI(req, res) {
  const url = req.url.split('?')[0];
  const route = url.slice('/api/'.length);
  try {
    const body = req.method === 'POST' ? await readBody(req) : {};
    if (route === 'gate') {
      if (!hasValidPin(req, body)) return json(res, 403, { error: '입장 비밀번호 4자리가 올바르지 않습니다.' });
      return json(res, 200, { ok: true });
    }
    if (route === 'register') {
      if (!hasValidPin(req, body)) return json(res, 403, { error: '입장 비밀번호(4자리) 확인이 필요합니다.' });
      const nick = String(body.nick || '').trim();
      const pw = String(body.pw || '');
      if (!NICK_RE.test(nick)) return json(res, 400, { error: '닉네임은 2~14자의 한글/영문/숫자/_ 만 가능합니다.' });
      if (pw.length < 4 || pw.length > 32) return json(res, 400, { error: '비밀번호는 4~32자로 입력해주세요.' });
      if (db.accounts[nick]) return json(res, 409, { error: '이미 사용 중인 닉네임입니다.' });
      const salt = crypto.randomBytes(16).toString('hex');
      db.accounts[nick] = { salt, hash: hashPw(pw, salt), created: Date.now(), save: null, dailyDate: null, pendingGold: 0 };
      const token = crypto.randomBytes(24).toString('hex');
      db.tokens[token] = nick;
      persistAccounts(true);
      return json(res, 200, { token, ...publicProfile(nick) });
    }
    if (route === 'login') {
      if (!hasValidPin(req, body)) return json(res, 403, { error: '입장 비밀번호(4자리) 확인이 필요합니다.' });
      const nick = String(body.nick || '').trim();
      const pw = String(body.pw || '');
      const a = db.accounts[nick];
      if (!a || hashPw(pw, a.salt) !== a.hash) return json(res, 401, { error: '닉네임 또는 비밀번호가 올바르지 않습니다.' });
      const token = crypto.randomBytes(24).toString('hex');
      db.tokens[token] = nick;
      a.lastLogin = Date.now();
      persistAccounts(true);
      return json(res, 200, { token, ...publicProfile(nick) });
    }
    if (route === 'guest') {
      if (!hasValidPin(req, body)) return json(res, 403, { error: '입장 비밀번호(4자리) 확인이 필요합니다.' });
      let nick = '';
      for (let i = 0; i < 20; i++) {
        const candidate = '모험가_' + Math.floor(1000 + Math.random() * 9000);
        if (!db.accounts[candidate]) { nick = candidate; break; }
      }
      if (!nick) nick = '모험가_' + crypto.randomBytes(2).toString('hex').toUpperCase();
      const salt = crypto.randomBytes(16).toString('hex');
      db.accounts[nick] = { salt, hash: hashPw(crypto.randomBytes(8).toString('hex'), salt), created: Date.now(), save: null, dailyDate: null, pendingGold: 0, guest: true };
      const token = crypto.randomBytes(24).toString('hex');
      db.tokens[token] = nick;
      persistAccounts(true);
      return json(res, 200, { token, ...publicProfile(nick) });
    }
    if (route === 'ranking') {
      const list = Object.entries(db.accounts)
        .filter(([, a]) => a.save)
        .map(([n, a]) => ({
          nick: n,
          level: a.save.level || 1,
          cls: a.save.cls || 'swordman',
          title: a.save.title || 't1',
          exp: a.save.exp || 0,
          bossKills: a.save.bossKills || 0,
          abyssFloor: a.save.abyssFloor || 1,
        }))
        .sort((x, y) => y.level - x.level || y.abyssFloor - x.abyssFloor || y.exp - x.exp)
        .slice(0, 30);
      return json(res, 200, { list });
    }
    if (route === 'market') {
      return json(res, 200, { listings: marketData.listings });
    }

    const nick = authNick(req, body);
    if (!nick) return json(res, 401, { error: '로그인이 필요합니다.' });
    const acc = db.accounts[nick];

    if (route === 'me') {
      if (!hasValidPin(req, body)) return json(res, 403, { error: '입장 비밀번호(4자리) 확인이 필요합니다.' });
      const prof = publicProfile(nick);
      return json(res, 200, prof);
    }
    if (route === 'claim_gold') {
      const g = acc.pendingGold || 0;
      acc.pendingGold = 0;
      persistAccounts();
      return json(res, 200, { gold: g });
    }
    if (route === 'save') {
      if (!body.save || typeof body.save !== 'object') return json(res, 400, { error: 'bad save' });
      const s = body.save;
      if (typeof s.level === 'number') s.level = Math.max(1, Math.min(99, Math.floor(s.level)));
      acc.save = s;
      acc.savedAt = Date.now();
      persistAccounts();
      return json(res, 200, { ok: true, savedAt: acc.savedAt });
    }
    if (route === 'daily') {
      const today = todayKST();
      if (body.action === 'claim') {
        if (acc.dailyDate === today) return json(res, 200, { ok: false, error: '오늘의 일일 퀘스트 보상을 이미 수령했습니다!', today });
        acc.dailyDate = today;
        persistAccounts();
        return json(res, 200, { ok: true, today });
      }
      return json(res, 200, { dailyDate: acc.dailyDate, today });
    }
    if (route === 'logout') {
      const h = req.headers.authorization || '';
      delete db.tokens[h.slice(7)];
      persistAccounts();
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: 'unknown route' });
  } catch (e) {
    return json(res, 400, { error: '잘못된 요청: ' + e.message });
  }
}

// ---------------- WebSocket Real-time Multiplayer ----------------
function sendWS(ws, obj) {
  if (!ws || ws.destroyed) return;
  const payload = Buffer.from(JSON.stringify(obj), 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  try { ws.write(Buffer.concat([header, payload])); } catch {}
}

const SAFE_ZONES = new Set(['village', 'mirage', 'abyss']);
const players = new Map(); // ws -> { nick, zone, st, partyId }
const parties = new Map(); // partyId -> { id, leader, name, members: Set<nick> }

function eachPlayer(fn) {
  for (const [ws, p] of players) if (!ws.destroyed && p.nick) fn(ws, p);
}
function broadcast(obj, filter) {
  eachPlayer((ws, p) => { if (!filter || filter(p, ws)) sendWS(ws, obj); });
}
function findWSByNick(nick) {
  for (const [ws, p] of players) if (p.nick === nick && !ws.destroyed) return ws;
  return null;
}

function partySummaryList() {
  const out = [];
  for (const [, pt] of parties) {
    out.push({ id: pt.id, name: pt.name, leader: pt.leader, members: [...pt.members] });
  }
  return out;
}
function broadcastParties() {
  broadcast({ type: 'parties', list: partySummaryList() });
}
function leaveParty(nick) {
  const ws = findWSByNick(nick);
  const p = ws && players.get(ws);
  const pid = p ? p.partyId : null;
  if (!pid) return;
  const pt = parties.get(pid);
  if (p) p.partyId = null;
  if (!pt) return;
  pt.members.delete(nick);
  if (pt.members.size === 0) {
    parties.delete(pid);
  } else if (pt.leader === nick) {
    pt.leader = [...pt.members][0];
  }
  broadcastParties();
}

// ---------------- World Quest / World Boss ----------------
let world = null;
let worldTimer = null;
let lastWorldBroadcast = 0;

const RAID_BOSSES = [
  { key: 'trex', name: '고대 월드 드래곤 티라노스', model: 'mobs/Trex.glb' },
  { key: 'apato', name: '작열의 거신 아파토', model: 'mobs/Apatosaurus.glb' },
  { key: 'stego', name: '봄의 고대수 스테고르', model: 'mobs/Stegosaurus.glb' },
  { key: 'bargon', name: '해골 군주 바르곤', model: 'mobs/Skeleton_Warrior.glb' },
];

function worldPublic() {
  if (!world) return null;
  return {
    id: world.id, kind: world.kind, zone: world.zone, level: world.level,
    name: world.name, boss: world.boss, hp: world.hp, maxHp: world.maxHp,
    goal: world.goal, count: world.count, startAt: world.startAt, endAt: world.endAt,
    seed: world.seed,
  };
}

function startWorld(by, kind, zone, level, bossKey) {
  if (!['raid', 'meteor', 'horde'].includes(kind)) return '알 수 없는 월드 이벤트 종류';
  if (world) endWorld(false, '새 월드 이벤트가 시작되어 이전 이벤트가 종료되었습니다.');
  level = Math.max(10, Math.min(99, Math.floor(Number(level) || 50)));
  zone = ['spring', 'summer', 'autumn', 'winter'].includes(zone) ? zone : 'winter';
  const now = Date.now();
  const online = Math.max(1, [...players.values()].filter((p) => p.nick).length);
  const dur = kind === 'raid' ? 5 * 60 * 1000 : 4 * 60 * 1000;
  world = {
    id: crypto.randomBytes(4).toString('hex'),
    kind, zone, level,
    startAt: now + 5000,
    endAt: now + 5000 + dur,
    seed: Math.floor(Math.random() * 1e9),
    contrib: {},
    count: 0,
    by,
  };
  if (kind === 'raid') {
    const b = RAID_BOSSES.find((x) => x.key === bossKey) || RAID_BOSSES[Math.floor(Math.random() * RAID_BOSSES.length)];
    world.boss = b.key;
    world.name = `[월드 레이드] Lv.${level} ${b.name}`;
    world.maxHp = Math.floor((12000 + level * 950) * Math.max(1, Math.sqrt(online)));
    world.hp = world.maxHp;
  } else if (kind === 'meteor') {
    world.name = `[월드 대재앙] 붉은 유성우 (Lv.${level})`;
    world.goal = 15 + online * 5;
  } else {
    world.name = `[월드 침공] 몬스터 대침공 (Lv.${level})`;
    world.goal = 30 + online * 10;
  }
  broadcast({ type: 'world_start', world: worldPublic(), serverNow: Date.now() });
  clearTimeout(worldTimer);
  worldTimer = setTimeout(() => endWorld(false, '제한 시간이 지나 월드 이벤트가 종료되었습니다.'), world.endAt - now);
  return null;
}

function endWorld(success, msg) {
  if (!world) return;
  clearTimeout(worldTimer);
  const w = world;
  world = null;
  const total = Object.values(w.contrib).reduce((a, b) => a + b, 0) || 1;
  eachPlayer((ws, p) => {
    const c = w.contrib[p.nick] || 0;
    sendWS(ws, {
      type: 'world_end',
      id: w.id,
      success,
      msg,
      level: w.level,
      kind: w.kind,
      share: c / total,
      contributed: c > 0,
    });
  });
}

function worldProgress() {
  if (!world) return;
  const now = Date.now();
  if (now - lastWorldBroadcast < 120) return;
  lastWorldBroadcast = now;
  broadcast({ type: 'world_prog', id: world.id, hp: world.hp, count: world.count });
}

// 주기적 자동 월드 레이드 (12분마다, 접속자가 있을 때)
setInterval(() => {
  if (world) return;
  const online = [...players.values()].filter((p) => p.nick).length;
  if (online === 0) return;
  const zones = ['spring', 'summer', 'autumn', 'winter'];
  const z = zones[Math.floor(Math.random() * zones.length)];
  const lvMap = { spring: 15, summer: 35, autumn: 60, winter: 85 };
  startWorld('SYSTEM', 'raid', z, lvMap[z]);
}, 12 * 60 * 1000);

function cleanupSocket(ws) {
  const p = players.get(ws);
  if (!p) return;
  players.delete(ws);
  if (p.nick) {
    leaveParty(p.nick);
    broadcast({ type: 'leave', nick: p.nick });
  }
}

function handleWSMessage(ws, raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }

  if (msg.type === 'hello') {
    if (String(msg.pin || '').trim() !== ENTRY_PIN) { sendWS(ws, { type: 'auth_fail' }); return; }
    const nick = db.tokens[msg.token];
    if (!nick || !db.accounts[nick]) { sendWS(ws, { type: 'auth_fail' }); return; }
    const old = findWSByNick(nick);
    if (old && old !== ws) {
      sendWS(old, { type: 'kicked', reason: '다른 곳에서 같은 계정으로 접속했습니다.' });
      cleanupSocket(old);
      try { old.end(); } catch {}
    }
    players.set(ws, { nick, zone: 'village', st: null, partyId: null });
    const list = [];
    eachPlayer((w2, p2) => {
      if (w2 !== ws && p2.st) list.push({ nick: p2.nick, zone: p2.zone, st: p2.st });
    });
    sendWS(ws, {
      type: 'welcome',
      nick,
      isAdmin: isAdmin(nick),
      players: list,
      world: worldPublic(),
      parties: partySummaryList(),
      market: marketData.listings,
      serverNow: Date.now(),
      online: players.size,
      pendingGold: db.accounts[nick].pendingGold || 0,
    });
    db.accounts[nick].pendingGold = 0;
    persistAccounts();
    broadcast({ type: 'sys', text: `🌟 ${nick} 님이 환장 래거시에 접속했습니다.` }, (p) => p.nick !== nick);
    return;
  }

  const p = players.get(ws);
  if (!p || !p.nick) return;

  switch (msg.type) {
    case 'state': {
      const st = msg.st || {};
      const prevZone = p.zone;
      p.zone = String(st.zone || 'village').slice(0, 24);
      p.st = {
        zone: p.zone,
        x: +st.x || 0, y: +st.y || 0, z: +st.z || 0, ry: +st.ry || 0,
        an: String(st.an || 'Idle').slice(0, 28),
        lv: Math.floor(+st.lv || 1),
        cls: String(st.cls || 'swordman').slice(0, 20),
        title: String(st.title || 't1').slice(0, 16),
        hp: +st.hp || 0, mhp: +st.mhp || 1,
        grade: Math.floor(+st.grade || 0),
        enh: Math.floor(+st.enh || 0),
        pvpOn: !!st.pvpOn,
        dead: !!st.dead,
      };
      if (prevZone && prevZone !== p.zone) {
        broadcast({ type: 'leave_zone', nick: p.nick, zone: prevZone }, (q) => q.zone === prevZone && q.nick !== p.nick);
      }
      const pkt = { type: 'st', nick: p.nick, st: p.st };
      eachPlayer((w2, q) => { if (w2 !== ws && q.zone === p.zone) sendWS(w2, pkt); });
      break;
    }
    case 'act': {
      const pkt = {
        type: 'act',
        nick: p.nick,
        act: String(msg.act || '').slice(0, 32),
        cls: p.st?.cls || 'swordman',
        tx: +msg.tx || 0, ty: +msg.ty || 0, tz: +msg.tz || 0,
      };
      eachPlayer((w2, q) => { if (w2 !== ws && q.zone === p.zone) sendWS(w2, pkt); });
      break;
    }
    case 'chat': {
      const text = String(msg.text || '').slice(0, 140).trim();
      if (!text) return;
      if (text.startsWith('/admin ')) {
        if (text.slice(7).trim().toUpperCase() === String(cfg.adminKey).toUpperCase()) {
          if (!cfg.admins.includes(p.nick)) cfg.admins.push(p.nick);
          persistCfg();
          sendWS(ws, { type: 'admin_ok' });
        } else {
          sendWS(ws, { type: 'sys', text: '운영자 키가 올바르지 않습니다.' });
        }
        return;
      }
      if (text.startsWith('/world') && isAdmin(p.nick)) {
        const parts = text.split(/\s+/);
        const kind = parts[1] || 'raid';
        const zone = parts[2] || p.zone || 'winter';
        const lv = Number(parts[3]) || 50;
        const err = startWorld(p.nick, kind, zone, lv);
        if (err) sendWS(ws, { type: 'sys', text: err });
        return;
      }
      broadcast({ type: 'chat', nick: p.nick, lv: p.st ? p.st.lv : 1, cls: p.st ? p.st.cls : 'swordman', zone: p.zone, text });
      break;
    }
    case 'party_create': {
      leaveParty(p.nick);
      const pid = crypto.randomBytes(3).toString('hex').toUpperCase();
      const name = String(msg.name || `${p.nick}의 파티`).slice(0, 20);
      parties.set(pid, { id: pid, leader: p.nick, name, members: new Set([p.nick]) });
      p.partyId = pid;
      broadcastParties();
      sendWS(ws, { type: 'sys', text: `🛡️ 파티 [${name}] 을(를) 창설했습니다.` });
      break;
    }
    case 'party_join': {
      const pt = parties.get(String(msg.id || ''));
      if (!pt) { sendWS(ws, { type: 'sys', text: '존재하지 않는 파티입니다.' }); return; }
      if (pt.members.size >= 8) { sendWS(ws, { type: 'sys', text: '파티 정원(8명)이 가득 찼습니다.' }); return; }
      leaveParty(p.nick);
      pt.members.add(p.nick);
      p.partyId = pt.id;
      broadcastParties();
      broadcast({ type: 'sys', text: `🛡️ ${p.nick} 님이 파티 [${pt.name}]에 합류했습니다.` }, (q) => q.partyId === pt.id);
      break;
    }
    case 'party_leave': {
      leaveParty(p.nick);
      sendWS(ws, { type: 'sys', text: '파티에서 탈퇴했습니다.' });
      break;
    }
    case 'pvp_hit': {
      if (!p.zone || SAFE_ZONES.has(p.zone)) return;
      const px = p.st?.x || 0, pz = p.st?.z || 0;
      if (p.zone === 'world' && Math.hypot(px, pz) <= 36) return; // 마을 안전구역
      const tw = findWSByNick(String(msg.target || ''));
      const tp = tw && players.get(tw);
      if (!tp || tp.zone !== p.zone || !tp.st || tp.st.dead) return;
      const inArena = Math.hypot(px - 115, pz + 115) <= 36 && Math.hypot((tp.st.x || 0) - 115, (tp.st.z || 0) + 115) <= 36;
      if (!inArena && (!p.st?.pvpOn || !tp.st?.pvpOn)) return;
      sendWS(tw, {
        type: 'pvp_hit',
        from: p.nick,
        lv: p.st ? p.st.lv : 1,
        dmg: Math.max(1, Math.min(999999, Math.floor(+msg.dmg || 1))),
      });
      break;
    }
    case 'pvp_kill': {
      const killer = String(msg.killer || '???').slice(0, 14);
      broadcast({ type: 'sys', text: `⚔️ [결투] ${killer} 님이 ${p.nick} 님을 제압했습니다!` });
      const kw = findWSByNick(killer);
      if (kw) sendWS(kw, { type: 'pvp_kill_credit' });
      break;
    }
    case 'wq_start_req': {
      // 누구나 보스 제단 또는 월드 이벤트 메뉴에서 월드 레이드를 호출할 수 있게(단, 기존 이벤트 없을 때)
      if (world) { sendWS(ws, { type: 'sys', text: '이미 진행 중인 월드 이벤트가 있습니다.' }); return; }
      const err = startWorld(p.nick, String(msg.kind || 'raid'), String(msg.zone || 'winter'), msg.level || 50, String(msg.boss || ''));
      if (err) sendWS(ws, { type: 'sys', text: err });
      break;
    }
    case 'wq_hit': {
      if (!world || world.kind !== 'raid' || Date.now() < world.startAt) return;
      const d = Math.max(0, Math.min(500000, Math.floor(+msg.dmg || 0)));
      world.hp = Math.max(0, world.hp - d);
      world.contrib[p.nick] = (world.contrib[p.nick] || 0) + d;
      if (world.hp <= 0) endWorld(true, `🎉 ${world.name} 토벌 성공! 기여도에 따라 보상이 지급됩니다!`);
      else worldProgress();
      break;
    }
    case 'wq_count': {
      if (!world || world.kind === 'raid' || Date.now() < world.startAt) return;
      const n = Math.max(0, Math.min(5, Math.floor(+msg.n || 1)));
      world.count += n;
      world.contrib[p.nick] = (world.contrib[p.nick] || 0) + n;
      if (world.count >= world.goal) endWorld(true, `🎉 ${world.name} 클리어! 대륙에 평화가 찾아왔습니다!`);
      else worldProgress();
      break;
    }
    case 'wq_touch': {
      if (world && !(p.nick in world.contrib)) world.contrib[p.nick] = 0;
      break;
    }
    case 'market_list': {
      const itemType = String(msg.itemType || 'stone');
      const qty = Math.max(1, Math.min(999, Math.floor(+msg.qty || 1)));
      const price = Math.max(10, Math.min(9999999, Math.floor(+msg.price || 100)));
      if (!['stone', 'crystal'].includes(itemType)) return;
      const listing = {
        id: String(marketData.nextId++),
        seller: p.nick,
        itemType,
        itemName: itemType === 'stone' ? '🔮 강화석' : '💎 심연의 결정',
        qty,
        price,
        created: Date.now(),
      };
      marketData.listings.unshift(listing);
      if (marketData.listings.length > 60) marketData.listings.pop();
      persistMarket();
      broadcast({ type: 'market_update', listings: marketData.listings });
      sendWS(ws, { type: 'market_listed', listing });
      break;
    }
    case 'market_buy': {
      const idx = marketData.listings.findIndex((l) => l.id === String(msg.id));
      if (idx === -1) { sendWS(ws, { type: 'market_err', reason: '이미 판매되었거나 취소된 물품입니다.' }); return; }
      const [listing] = marketData.listings.splice(idx, 1);
      persistMarket();
      sendWS(ws, { type: 'market_bought', listing });
      const sw = findWSByNick(listing.seller);
      if (sw) {
        sendWS(sw, { type: 'market_sold', listing, buyer: p.nick });
      } else if (db.accounts[listing.seller]) {
        db.accounts[listing.seller].pendingGold = (db.accounts[listing.seller].pendingGold || 0) + listing.price;
        persistAccounts();
      }
      broadcast({ type: 'market_update', listings: marketData.listings });
      break;
    }
    case 'market_cancel': {
      const idx = marketData.listings.findIndex((l) => l.id === String(msg.id) && l.seller === p.nick);
      if (idx !== -1) {
        const [listing] = marketData.listings.splice(idx, 1);
        persistMarket();
        sendWS(ws, { type: 'market_cancelled', listing });
        broadcast({ type: 'market_update', listings: marketData.listings });
      }
      break;
    }
    case 'admin': {
      if (!isAdmin(p.nick)) return;
      if (msg.cmd === 'world_start') {
        const err = startWorld(p.nick, String(msg.kind), String(msg.zone), msg.level, String(msg.boss || ''));
        if (err) sendWS(ws, { type: 'sys', text: err });
      } else if (msg.cmd === 'world_stop') {
        endWorld(false, '운영자가 월드 이벤트를 종료했습니다.');
      } else if (msg.cmd === 'announce') {
        broadcast({ type: 'announce', text: String(msg.text || '').slice(0, 140) });
      }
      break;
    }
    case 'ping':
      sendWS(ws, { type: 'pong', t: msg.t, serverNow: Date.now() });
      break;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    await handleAPI(req, res);
    return;
  }
  let urlPath = req.url.split('?')[0];
  try { urlPath = decodeURIComponent(urlPath); } catch {}
  if (urlPath === '/' || urlPath.endsWith('/')) urlPath += 'index.html';
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500);
      res.end(err.code === 'ENOENT' ? 'Not Found' : 'Server Error');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' };
    if (ext === '.glb' || urlPath.includes('/lib/three/')) headers['Cache-Control'] = 'public, max-age=86400';
    else headers['Cache-Control'] = 'no-cache, must-revalidate';
    res.writeHead(200, headers);
    res.end(content);
  });
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  let buf = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const opcode = buf[0] & 0x0f;
      const masked = (buf[1] & 0x80) !== 0;
      let payloadLen = buf[1] & 0x7f;
      let offset = 2;
      if (payloadLen === 126) {
        if (buf.length < 4) return;
        payloadLen = buf.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (buf.length < 10) return;
        payloadLen = Number(buf.readBigUInt64BE(2));
        offset = 10;
      }
      const maskLen = masked ? 4 : 0;
      if (buf.length < offset + maskLen + payloadLen) return;
      const mask = masked ? buf.subarray(offset, offset + 4) : null;
      const data = Buffer.from(buf.subarray(offset + maskLen, offset + maskLen + payloadLen));
      buf = buf.subarray(offset + maskLen + payloadLen);

      if (opcode === 0x8) { cleanupSocket(socket); socket.end(); return; }
      if (opcode === 0x9) { socket.write(Buffer.from([0x8a, 0x00])); continue; }
      if (opcode === 0x1) {
        if (mask) for (let i = 0; i < data.length; i++) data[i] ^= mask[i % 4];
        handleWSMessage(socket, data.toString('utf8'));
      }
    }
  });
  socket.on('close', () => cleanupSocket(socket));
  socket.on('error', () => cleanupSocket(socket));
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`✅ 이미 ${PORT}번 포트에서 게임 서버가 실행 중입니다. 기존 서버를 그대로 사용합니다.`);
    process.exit(0);
  }
  throw err;
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n⚔️  [환장 래거시] 서버 실행 중: http://localhost:${PORT}`);
  console.log(`🔑 운영자 키: ${cfg.adminKey} (채팅에 /admin ${cfg.adminKey} 입력)`);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`🌐 로컬 네트워크 접속 주소: http://${net.address}:${PORT}`);
      }
    }
  }
});
