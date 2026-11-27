// =============================================================
//  환장 래거시 (Hwanjang Legacy) 3D MMORPG 독립 서버
//  - Express-free HTTP + Socket.IO (WebSocket + Polling Fallback)
//  - 계정 회원가입/로그인/게스트, JSON 세이브, 일일퀘스트(KST)
//  - 실시간 멀티플레이 동기화, 8인 파티, 거래소, PvP, 월드 보스 이벤트
// =============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { Server } = require('socket.io');

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

const FIXED_ADMIN_KEY = String(process.env.ODY_ADMIN_KEY || 'a1d2m3i4n5');
const cfg = loadJSON(CFG_FILE, null) || {
  adminKey: FIXED_ADMIN_KEY,
  admins: [],
  note: '채팅창에 /admin <adminKey> 입력 시 운영자 권한이 부여됩니다.',
};
cfg.adminKey = FIXED_ADMIN_KEY;
cfg.admins = Array.isArray(cfg.admins) ? cfg.admins : [];
fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2));

const marketData = loadJSON(MKT_FILE, { nextId: 1, listings: [] });
marketData.listings = marketData.listings || [];

let PgPool = null;
try { ({ Pool: PgPool } = require('pg')); } catch {}
const DATABASE_URL = process.env.DATABASE_URL || '';
let pgPool = null;

let saveTimer = null;
let pgWriteQueue = Promise.resolve();
function savePgKey(key, val) {
  if (!pgPool) return;
  pgWriteQueue = pgWriteQueue
    .then(() => pgPool.query(
      'INSERT INTO hwanjang_store (k, v, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = NOW()',
      [key, JSON.stringify(val)]
    ))
    .catch((e) => console.error('PG save error:', key, e.message));
}

function writeAccountsNow() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  const tmp = ACC_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, ACC_FILE);
  savePgKey('accounts_db', db);
}
function persistAccounts(immediate = false) {
  if (immediate) { writeAccountsNow(); return; }
  if (saveTimer) return;
  saveTimer = setTimeout(writeAccountsNow, 500);
}
function persistCfg() {
  fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2));
  savePgKey('cfg', cfg);
}
function persistMarket() {
  fs.writeFileSync(MKT_FILE, JSON.stringify(marketData, null, 2));
  savePgKey('market', marketData);
}

async function initPgStore() {
  if (!DATABASE_URL || !PgPool) return;
  try {
    pgPool = new PgPool({
      connectionString: DATABASE_URL,
      ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
    });
    await pgPool.query('CREATE TABLE IF NOT EXISTS hwanjang_store (k TEXT PRIMARY KEY, v JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW())');
    const res = await pgPool.query('SELECT k, v FROM hwanjang_store');
    for (const row of res.rows) {
      if (row.k === 'accounts_db' && row.v) {
        db.accounts = row.v.accounts || {};
        db.tokens = row.v.tokens || {};
      } else if (row.k === 'cfg' && row.v) {
        if (Array.isArray(row.v.admins)) cfg.admins = row.v.admins;
      } else if (row.k === 'market' && row.v) {
        marketData.nextId = row.v.nextId || 1;
        marketData.listings = Array.isArray(row.v.listings) ? row.v.listings : [];
      }
    }
    console.log(`🗄️  PostgreSQL 영구 저장소 연결 완료 (계정 ${Object.keys(db.accounts).length}개 로드됨)`);
  } catch (e) {
    console.error('⚠️ PostgreSQL 연결 실패 (로컬 파일/자동복구 모드로 동작):', e.message);
    pgPool = null;
  }
}

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

function sanitizeSave(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const s = { ...raw };
  if (typeof s.level === 'number') s.level = Math.max(1, Math.min(99, Math.floor(s.level)));
  return s;
}

function publicProfile(nick) {
  const a = db.accounts[nick];
  if (!a.resumeSecret) {
    a.resumeSecret = crypto.randomBytes(24).toString('hex');
    persistAccounts();
  }
  return {
    nick,
    save: a.save || null,
    isAdmin: isAdmin(nick),
    grantedTitles: Array.isArray(a.grantedTitles) ? a.grantedTitles : [],
    dailyDate: a.dailyDate || null,
    today: todayKST(),
    serverNow: Date.now(),
    pendingGold: a.pendingGold || 0,
    resumeSecret: a.resumeSecret,
    persistentDb: !!pgPool,
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
      const resumeSecret = crypto.randomBytes(24).toString('hex');
      db.accounts[nick] = { salt, hash: hashPw(pw, salt), resumeSecret, created: Date.now(), save: null, dailyDate: null, pendingGold: 0 };
      const token = crypto.randomBytes(24).toString('hex');
      db.tokens[token] = nick;
      persistAccounts(true);
      return json(res, 200, { token, ...publicProfile(nick) });
    }
    if (route === 'login') {
      if (!hasValidPin(req, body)) return json(res, 403, { error: '입장 비밀번호(4자리) 확인이 필요합니다.' });
      const nick = String(body.nick || '').trim();
      const pw = String(body.pw || '');
      let a = db.accounts[nick];
      let restored = false;
      if (!a) {
        const restoreSecret = String(body.restoreSecret || '');
        const restoreSave = sanitizeSave(body.restoreSave);
        if (NICK_RE.test(nick) && pw.length >= 4 && pw.length <= 32 && restoreSecret.length >= 16 && restoreSave) {
          const salt = crypto.randomBytes(16).toString('hex');
          a = {
            salt,
            hash: hashPw(pw, salt),
            resumeSecret: restoreSecret,
            created: Date.now(),
            save: restoreSave,
            grantedTitles: Array.isArray(restoreSave.grantedTitles) ? restoreSave.grantedTitles : [],
            dailyDate: null,
            pendingGold: 0,
            restoredAt: Date.now(),
          };
          db.accounts[nick] = a;
          restored = true;
        } else {
          return json(res, 401, { error: '닉네임 또는 비밀번호가 올바르지 않습니다. (서버 재시작 시 기존 기기에서 자동 복구되거나 재가입이 필요합니다)' });
        }
      } else if (hashPw(pw, a.salt) !== a.hash) {
        return json(res, 401, { error: '닉네임 또는 비밀번호가 올바르지 않습니다.' });
      }
      const token = crypto.randomBytes(24).toString('hex');
      db.tokens[token] = nick;
      a.lastLogin = Date.now();
      persistAccounts(true);
      return json(res, 200, { token, restored, ...publicProfile(nick) });
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
      const resumeSecret = crypto.randomBytes(24).toString('hex');
      db.accounts[nick] = { salt, hash: hashPw(crypto.randomBytes(8).toString('hex'), salt), resumeSecret, created: Date.now(), save: null, dailyDate: null, pendingGold: 0, guest: true };
      const token = crypto.randomBytes(24).toString('hex');
      db.tokens[token] = nick;
      persistAccounts(true);
      return json(res, 200, { token, ...publicProfile(nick) });
    }
    if (route === 'resume') {
      if (!hasValidPin(req, body)) return json(res, 403, { error: '입장 비밀번호(4자리) 확인이 필요합니다.' });
      const nick = String(body.nick || '').trim();
      const resumeSecret = String(body.resumeSecret || '').trim();
      if (!NICK_RE.test(nick) || resumeSecret.length < 16) {
        return json(res, 400, { error: '복구 정보가 올바르지 않습니다.' });
      }
      const bakSave = sanitizeSave(body.save);
      let a = db.accounts[nick];
      let restored = false;
      if (a) {
        if (a.resumeSecret && a.resumeSecret !== resumeSecret) {
          return json(res, 403, { error: '계정 복구 키가 일치하지 않습니다.' });
        }
        if (!a.resumeSecret) a.resumeSecret = resumeSecret;
        if (!a.save && bakSave) a.save = bakSave;
      } else {
        const salt = crypto.randomBytes(16).toString('hex');
        a = {
          salt,
          hash: hashPw(crypto.randomBytes(12).toString('hex'), salt),
          resumeSecret,
          created: Date.now(),
          save: bakSave,
          grantedTitles: Array.isArray(bakSave?.grantedTitles) ? bakSave.grantedTitles : [],
          dailyDate: null,
          pendingGold: 0,
          guest: !!body.isGuest,
          restoredAt: Date.now(),
        };
        db.accounts[nick] = a;
        restored = true;
      }
      const token = crypto.randomBytes(24).toString('hex');
      db.tokens[token] = nick;
      a.lastLogin = Date.now();
      persistAccounts(true);
      return json(res, 200, { token, restored, ...publicProfile(nick) });
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

// ---------------- Socket.IO Real-time Multiplayer ----------------
function sendWS(sock, obj) {
  if (!sock || sock.disconnected) return;
  try { sock.emit('pkt', obj); } catch {}
}

const SAFE_ZONES = new Set(['village', 'mirage', 'abyss']);
const players = new Map(); // socket -> { nick, zone, st, partyId }
const parties = new Map(); // partyId -> { id, leader, name, members: Set<nick> }

function eachPlayer(fn) {
  for (const [sock, p] of players) if (!sock.disconnected && p.nick) fn(sock, p);
}
function broadcast(obj, filter) {
  eachPlayer((sock, p) => { if (!filter || filter(p, sock)) sendWS(sock, obj); });
}
function findWSByNick(nick) {
  for (const [sock, p] of players) if (p.nick === nick && !sock.disconnected) return sock;
  return null;
}
function onlineSummaryList() {
  const out = [];
  eachPlayer((sock, p) => {
    out.push({
      nick: p.nick,
      zone: p.zone || 'world',
      lv: p.st?.lv || db.accounts[p.nick]?.save?.level || 1,
      cls: p.st?.cls || db.accounts[p.nick]?.save?.cls || 'swordman',
      partyId: p.partyId || null,
      x: p.st?.x ?? 0,
      z: p.st?.z ?? 12,
    });
  });
  return out;
}
function broadcastOnlineUpdate() {
  const list = onlineSummaryList();
  broadcast({ type: 'online_update', count: list.length, players: list });
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
    broadcastOnlineUpdate();
  }
}

function resolveTargetAndNum(parts, selfNick) {
  if (parts.length === 1 && /^-?\d+$/.test(parts[0])) {
    return { targetNick: selfNick, num: Number(parts[0]) };
  }
  if (parts.length >= 2 && /^-?\d+$/.test(parts[parts.length - 1])) {
    const num = Number(parts[parts.length - 1]);
    const targetNick = parts.slice(0, -1).join(' ').trim();
    return { targetNick, num };
  }
  return { targetNick: '', num: NaN };
}

function handleAdminChatCommand(ws, p, text) {
  const cmd = text.split(/\s+/)[0].toLowerCase();
  if (cmd === '/admin') {
    const key = text.slice(6).trim();
    if (key.toUpperCase() === String(cfg.adminKey).toUpperCase()) {
      if (!cfg.admins.includes(p.nick)) cfg.admins.push(p.nick);
      persistCfg();
      sendWS(ws, { type: 'admin_ok' });
    } else {
      sendWS(ws, { type: 'sys', text: '운영자 키가 올바르지 않습니다.' });
    }
    return true;
  }

  if (cmd === '/help') {
    if (isAdmin(p.nick)) {
      sendWS(ws, { type: 'sys', text: '👑 운영자 명령어: /gold [닉네임] <금액> | /stone [닉네임] <수량> | /crystal [닉네임] <수량> | /lv [닉네임] <레벨> | /heal [닉네임] | /type beta <닉네임> | /type 운영자의 권한 <닉네임> | /say <공지> | /world <raid|meteor|horde> <지역> <레벨> | /kick <닉네임>' });
    } else {
      sendWS(ws, { type: 'sys', text: '💡 기본 명령어: /admin <운영자키>' });
    }
    return true;
  }

  const adminCmds = ['/type', '/world', '/gold', '/stone', '/crystal', '/gem', '/lv', '/level', '/heal', '/say', '/notice', '/kick'];
  if (!adminCmds.includes(cmd)) return false;
  if (!isAdmin(p.nick)) {
    sendWS(ws, { type: 'sys', text: '⛔ 운영자 권한이 필요합니다. 먼저 /admin <운영자키> 를 입력하세요.' });
    return true;
  }

  const args = text.slice(cmd.length).trim().split(/\s+/).filter(Boolean);

  if (cmd === '/type') {
    const rest = text.slice(5).trim();
    let titleId = '';
    let titleName = '';
    let targetNick = '';
    if (/^운영자의\s*권한\s+(.+)$/.test(rest)) {
      titleId = 't_admin_power';
      titleName = '운영자의 권한';
      targetNick = rest.replace(/^운영자의\s*권한\s+/, '').trim();
    } else if (/^(beta|배타태스터|베타테스터)\s+(.+)$/i.test(rest)) {
      titleId = 't_beta';
      titleName = '배타태스터';
      targetNick = rest.replace(/^(beta|배타태스터|베타테스터)\s+/i, '').trim();
    } else {
      sendWS(ws, { type: 'sys', text: '사용법: /type beta <닉네임> 또는 /type 운영자의 권한 <닉네임>' });
      return true;
    }
    const acc = db.accounts[targetNick];
    if (!acc) { sendWS(ws, { type: 'sys', text: `플레이어 [${targetNick}] 계정을 찾을 수 없습니다.` }); return true; }
    if (!Array.isArray(acc.grantedTitles)) acc.grantedTitles = [];
    if (!acc.grantedTitles.includes(titleId)) acc.grantedTitles.push(titleId);
    if (acc.save && typeof acc.save === 'object') {
      if (!Array.isArray(acc.save.grantedTitles)) acc.save.grantedTitles = [];
      if (!acc.save.grantedTitles.includes(titleId)) acc.save.grantedTitles.push(titleId);
    }
    persistAccounts(true);
    const targetWs = findWSByNick(targetNick);
    if (targetWs) sendWS(targetWs, { type: 'grant_title', titleId, titleName, by: p.nick });
    broadcast({ type: 'sys', text: `👑 운영자 ${p.nick}님이 [${targetNick}]님에게 [${titleName}] 칭호를 부여했습니다!` });
    return true;
  }

  if (cmd === '/world') {
    const err = startWorld(p.nick, args[0] || 'raid', args[1] || p.zone || 'winter', Number(args[2]) || 50);
    if (err) sendWS(ws, { type: 'sys', text: err });
    return true;
  }

  if (cmd === '/say' || cmd === '/notice') {
    const notice = text.slice(cmd.length).trim();
    if (!notice) { sendWS(ws, { type: 'sys', text: '사용법: /say <공지 내용>' }); return true; }
    broadcast({ type: 'announce', text: `[운영자] ${notice}` });
    return true;
  }

  if (cmd === '/kick') {
    const targetNick = args.join(' ').trim();
    const targetWs = targetNick ? findWSByNick(targetNick) : null;
    if (!targetWs) { sendWS(ws, { type: 'sys', text: `접속 중인 플레이어 [${targetNick}]을(를) 찾을 수 없습니다.` }); return true; }
    sendWS(targetWs, { type: 'kicked', reason: '운영자에 의해 접속이 종료되었습니다.' });
    cleanupSocket(targetWs);
    try { targetWs.disconnect(true); } catch {}
    broadcast({ type: 'sys', text: `🔨 운영자가 [${targetNick}]님의 접속을 종료했습니다.` });
    return true;
  }

  if (cmd === '/heal') {
    const targetNick = args.join(' ').trim() || p.nick;
    const targetWs = findWSByNick(targetNick);
    if (!targetWs) { sendWS(ws, { type: 'sys', text: `접속 중인 플레이어 [${targetNick}]을(를) 찾을 수 없습니다.` }); return true; }
    sendWS(targetWs, { type: 'admin_grant', heal: true, by: p.nick });
    sendWS(ws, { type: 'sys', text: `💚 [${targetNick}]님의 체력을 100% 회복시켰습니다.` });
    return true;
  }

  const { targetNick, num } = resolveTargetAndNum(args, p.nick);
  if (!targetNick || !Number.isFinite(num)) {
    sendWS(ws, { type: 'sys', text: `사용법: ${cmd} [닉네임] <숫자> (예: ${cmd} 1000)` });
    return true;
  }
  const acc = db.accounts[targetNick];
  if (!acc) { sendWS(ws, { type: 'sys', text: `플레이어 [${targetNick}] 계정을 찾을 수 없습니다.` }); return true; }

  if (cmd === '/gold') {
    const delta = Math.floor(num);
    if (acc.save && typeof acc.save === 'object') acc.save.gold = Math.max(0, (acc.save.gold || 0) + delta);
    else if (!findWSByNick(targetNick)) acc.pendingGold = Math.max(0, (acc.pendingGold || 0) + delta);
    persistAccounts(true);
    const targetWs = findWSByNick(targetNick);
    if (targetWs) sendWS(targetWs, { type: 'admin_grant', gold: delta, by: p.nick });
    sendWS(ws, { type: 'sys', text: `🪙 [${targetNick}]님에게 골드 ${delta.toLocaleString()}G를 지급했습니다.` });
    return true;
  }

  if (cmd === '/stone') {
    const delta = Math.floor(num);
    if (acc.save && typeof acc.save === 'object') acc.save.stone = Math.max(0, (acc.save.stone || 0) + delta);
    persistAccounts(true);
    const targetWs = findWSByNick(targetNick);
    if (targetWs) sendWS(targetWs, { type: 'admin_grant', stone: delta, by: p.nick });
    sendWS(ws, { type: 'sys', text: `🔮 [${targetNick}]님에게 강화석 ${delta}개를 지급했습니다.` });
    return true;
  }

  if (cmd === '/crystal' || cmd === '/gem') {
    const delta = Math.floor(num);
    if (acc.save && typeof acc.save === 'object') acc.save.crystal = Math.max(0, (acc.save.crystal || 0) + delta);
    persistAccounts(true);
    const targetWs = findWSByNick(targetNick);
    if (targetWs) sendWS(targetWs, { type: 'admin_grant', crystal: delta, by: p.nick });
    sendWS(ws, { type: 'sys', text: `💎 [${targetNick}]님에게 결정 ${delta}개를 지급했습니다.` });
    return true;
  }

  if (cmd === '/lv' || cmd === '/level') {
    const lv = Math.max(1, Math.min(99, Math.floor(num)));
    if (acc.save && typeof acc.save === 'object') { acc.save.level = lv; acc.save.exp = 0; }
    persistAccounts(true);
    const targetWs = findWSByNick(targetNick);
    if (targetWs) sendWS(targetWs, { type: 'admin_grant', level: lv, by: p.nick });
    sendWS(ws, { type: 'sys', text: `⬆️ [${targetNick}]님의 레벨을 Lv.${lv}로 설정했습니다.` });
    return true;
  }

  return false;
}

function handleWSMessage(ws, raw) {
  let msg = raw;
  if (typeof raw === 'string') {
    try { msg = JSON.parse(raw); } catch { return; }
  }
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'hello') {
    if (String(msg.pin || '').trim() !== ENTRY_PIN) {
      sendWS(ws, { type: 'auth_fail', reason: '입장 비밀번호가 일치하지 않습니다.' });
      return;
    }
    const nick = db.tokens[msg.token];
    if (!nick || !db.accounts[nick]) {
      sendWS(ws, { type: 'auth_fail', reason: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.' });
      return;
    }
    const existing = players.get(ws);
    if (existing && existing.nick === nick) return;
    const old = findWSByNick(nick);
    if (old && old !== ws) {
      sendWS(old, { type: 'kicked', reason: '다른 기기 또는 탭에서 같은 계정으로 접속했습니다.' });
      cleanupSocket(old);
      try { old.disconnect(true); } catch {}
    }
    players.set(ws, { nick, zone: 'world', st: null, partyId: null });
    try { ws.join('zone:world'); } catch {}
    const list = [];
    eachPlayer((w2, p2) => {
      if (w2 !== ws && p2.st) list.push({ nick: p2.nick, zone: p2.zone, st: p2.st });
    });
    const onlineList = onlineSummaryList();
    sendWS(ws, {
      type: 'welcome',
      nick,
      isAdmin: isAdmin(nick),
      grantedTitles: Array.isArray(db.accounts[nick].grantedTitles) ? db.accounts[nick].grantedTitles : [],
      players: list,
      onlineList,
      world: worldPublic(),
      parties: partySummaryList(),
      market: marketData.listings,
      serverNow: Date.now(),
      online: onlineList.length,
      pendingGold: db.accounts[nick].pendingGold || 0,
    });
    db.accounts[nick].pendingGold = 0;
    persistAccounts();
    broadcastOnlineUpdate();
    broadcast({ type: 'sys', text: `🌟 ${nick} 님이 환장 래거시에 접속했습니다.` }, (p) => p.nick !== nick);
    return;
  }

  const p = players.get(ws);
  if (!p || !p.nick) return;

  switch (msg.type) {
    case 'state': {
      const st = msg.st || {};
      const prevZone = p.zone;
      p.zone = String(st.zone || 'world').slice(0, 24);
      p.st = {
        zone: p.zone,
        x: +st.x || 0, y: +st.y || 0, z: +st.z || 0, ry: +st.ry || 0,
        an: String(st.an || 'Idle').slice(0, 28),
        lv: Math.floor(+st.lv || 1),
        cls: String(st.cls || 'swordman').slice(0, 20),
        title: String(st.title || 't1').slice(0, 16),
        shopWep: st.shopWep ? String(st.shopWep).slice(0, 32) : null,
        hp: +st.hp || 0, mhp: +st.mhp || 1,
        grade: Math.floor(+st.grade || 0),
        enh: Math.floor(+st.enh || 0),
        pvpOn: !!st.pvpOn,
        dead: !!st.dead,
      };
      if (prevZone && prevZone !== p.zone) {
        try { ws.leave('zone:' + prevZone); ws.join('zone:' + p.zone); } catch {}
        ws.to('zone:' + prevZone).emit('pkt', { type: 'leave_zone', nick: p.nick, zone: prevZone });
        broadcastOnlineUpdate();
      }
      const pkt = { type: 'st', nick: p.nick, st: p.st };
      ws.to('zone:' + p.zone).emit('pkt', pkt);
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
      ws.to('zone:' + p.zone).emit('pkt', pkt);
      break;
    }
    case 'friend_warp': {
      const targetNick = String(msg.targetNick || '').trim();
      const tw = targetNick ? findWSByNick(targetNick) : null;
      const tp = tw && players.get(tw);
      if (!tp) {
        sendWS(ws, { type: 'sys', text: `[${targetNick}] 님을 찾을 수 없습니다.` });
        return;
      }
      sendWS(ws, {
        type: 'warp_to',
        targetNick: tp.nick,
        zone: tp.zone || 'world',
        x: (tp.st?.x ?? 0) + 2,
        z: (tp.st?.z ?? 12) + 2,
      });
      break;
    }
    case 'chat': {
      const text = String(msg.text || '').slice(0, 140).trim();
      if (!text) return;
      if (text.startsWith('/') && handleAdminChatCommand(ws, p, text)) return;
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

const io = new Server(server, {
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
  pingInterval: 15000,
  pingTimeout: 12000,
});

io.on('connection', (socket) => {
  socket.on('pkt', (msg) => handleWSMessage(socket, msg));
  socket.on('ping_rtt', (t, cb) => {
    if (typeof cb === 'function') cb(t, Date.now());
  });
  socket.on('disconnect', () => cleanupSocket(socket));
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`✅ 이미 ${PORT}번 포트에서 게임 서버가 실행 중입니다. 기존 서버를 그대로 사용합니다.`);
    process.exit(0);
  }
  throw err;
});

(async () => {
  await initPgStore();
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
})();
