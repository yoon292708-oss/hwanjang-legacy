// =============================================================
//  data.js - 환장 래거시 게임 데이터 (15종 직업, 숨겨진 전직관 5인, 10개 지역, 강화, 칭호, 퀘스트)
// =============================================================

export const SKILL_REQ_LEVELS = [1, 3, 7, 12];

export const HERO_WEAPON_HIDE = [
  '1H_Sword', '2H_Sword', '1H_Sword_Offhand',
  'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield',
  '1H_Axe', '2H_Axe', '1H_Axe_Offhand', 'Barbarian_Round_Shield', 'Mug',
  'Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff',
  'Knife', 'Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Throwable',
];

export const CLASSES = {
  swordman: {
    id: 'swordman', name: '검사', category: 'melee', icon: '⚔️', tier: 'B티어 · 기본', unlockCost: 0,
    color: 0x38bdf8, hex: '#38bdf8',
    model: 'heroes/Knight.glb', weapon: 'items/Sword.glb', showParts: ['Round_Shield'],
    animAttack: '1H_Melee_Attack_Slice_Diagonal',
    desc: '균형 잡힌 검술과 검기 스킬을 다루는 정통 검사.',
    baseAtk: 20, baseHp: 150, speed: 0.34, range: 3.8, moveSpd: 9.4, critBonus: 0.08, isRanged: false,
    skills: [
      { name: '질풍 검기', cd: 3.2, mult: 2.3, type: 'proj', color: 0x38bdf8, desc: '전방으로 날카로운 푸른 검기를 날립니다.' },
      { name: '검풍 난무', cd: 6.0, mult: 3.2, range: 5.5, type: 'aoe', color: 0x0ea5e9, desc: '주변 적을 회오리 검기로 연속 베어냅니다.' },
      { name: '진·천공참', cd: 10.5, mult: 4.8, dash: 7.0, range: 6.5, type: 'dash_aoe', color: 0x7dd3fc, desc: '전방으로 쾌속 돌진하며 거대한 참격을 가합니다.' },
      { name: '성검 엑스칼리버', cd: 15.0, mult: 7.2, range: 8.0, stun: 1.5, type: 'meteor', color: 0x38bdf8, desc: '하늘에서 거대한 빛의 성검을 떨어뜨려 적을 섬멸합니다.' },
    ],
  },
  warrior: {
    id: 'warrior', name: '전사', category: 'melee', icon: '🪓', tier: 'B티어', unlockCost: 200,
    color: 0xef4444, hex: '#ef4444',
    model: 'heroes/Barbarian.glb', weapon: 'items/Axe_Double.glb',
    animAttack: '2H_Melee_Attack_Chop',
    desc: '강인한 체력과 묵직한 양손도끼로 전장을 짓누르는 광전사.',
    baseAtk: 22, baseHp: 210, speed: 0.42, moveSpd: 9.0, range: 4.2, critBonus: 0.1, isRanged: false,
    skills: [
      { name: '대지 분쇄', cd: 4.0, mult: 2.7, range: 5.2, stun: 1.4, type: 'aoe', color: 0xef4444, desc: '지면 강타로 주변 적을 기절시킵니다.' },
      { name: '광폭의 함성', cd: 7.5, mult: 2.4, range: 5.2, healPct: 0.25, type: 'heal_aoe', color: 0xf97316, desc: '피해를 주며 체력을 25% 회복합니다.' },
      { name: '기간틱 슬램', cd: 11.5, mult: 5.4, range: 7.0, stun: 2.0, type: 'aoe', color: 0xdc2626, desc: '거대한 도약 강타로 넓은 범위를 초토화합니다.' },
      { name: '패왕의 도끼폭풍', cd: 16.0, mult: 7.8, dash: 7.5, range: 8.2, stun: 2.2, type: 'dash_aoe', color: 0xf87171, desc: '적진으로 맹돌진해 대지를 가르는 붉은 회오리를 일으킵니다.' },
    ],
  },
  fighter: {
    id: 'fighter', name: '무투가', category: 'melee', icon: '🥊', tier: 'S티어', unlockCost: 450,
    color: 0xf97316, hex: '#f97316',
    model: 'heroes/Rogue.glb', weapon: 'items/Glove.glb',
    animAttack: 'Unarmed_Melee_Attack_Punch_A',
    desc: '압도적인 연타 속도와 기절(스턴) 스킬을 보유한 근접 최강자.',
    baseAtk: 24, baseHp: 170, speed: 0.21, moveSpd: 10.8, range: 3.3, critBonus: 0.2, isRanged: false,
    skills: [
      { name: '용권 파동', cd: 3.5, mult: 2.6, range: 4.8, stun: 1.6, type: 'aoe', color: 0xf97316, desc: '강력한 기공 충격파로 적을 기절시킵니다.' },
      { name: '금강 쇄격', cd: 6.2, mult: 3.7, dash: 7.5, range: 4.8, type: 'dash_aoe', color: 0xfbbf24, desc: '번개처럼 돌진해 연환 일격을 날립니다.' },
      { name: '패왕 연환격', cd: 10.5, mult: 5.6, range: 6.0, stun: 2.2, type: 'aoe', color: 0xfb923c, desc: '폭발적인 투기를 방출해 주변을 섬멸합니다.' },
      { name: '극·용신승천격', cd: 15.0, mult: 8.0, range: 7.8, stun: 2.6, type: 'aoe', color: 0xf59e0b, desc: '황금 용의 투기를 폭발시켜 주변 모든 적을 기절·섬멸합니다.' },
    ],
  },
  magicknight: {
    id: 'magicknight', name: '마검사', category: 'melee', icon: '⚡', tier: 'S티어', unlockCost: 600,
    color: 0x06b6d4, hex: '#06b6d4',
    model: 'heroes/Knight.glb', weapon: 'items/Claymore.glb', tint: 0x99f6e4,
    animAttack: '2H_Melee_Attack_Spin',
    desc: '검술과 원소 마법을 결합해 모든 사냥터를 지배하는 1티어 올라운더.',
    baseAtk: 26, baseHp: 165, speed: 0.29, moveSpd: 10.0, range: 4.5, critBonus: 0.16, isRanged: false,
    skills: [
      { name: '빙염 검기', cd: 3.2, mult: 2.8, type: 'proj', color: 0x06b6d4, desc: '적들을 관통하는 빙염 마력 검기를 날립니다.' },
      { name: '아케인 노바', cd: 6.5, mult: 4.0, range: 6.8, type: 'aoe', color: 0x22d3ee, desc: '거대한 마력 폭발을 일으켜 광역 피해를 줍니다.' },
      { name: '차원 붕괴참', cd: 11.0, mult: 6.0, dash: 8.0, range: 7.5, type: 'dash_aoe', color: 0x818cf8, desc: '공간을 베어 가르며 폭발적인 마력 참격을 가합니다.' },
      { name: '별빛 천뢰검', cd: 15.5, mult: 8.2, range: 8.5, type: 'meteor', color: 0x22d3ee, desc: '하늘에서 푸른 번개 마검을 쏟아부어 초토화합니다.' },
    ],
  },
  loner: {
    id: 'loner', name: '외톨이', category: 'melee', icon: '🗡️', tier: 'A티어 · 암살', unlockCost: 500,
    color: 0x94a3b8, hex: '#94a3b8',
    model: 'heroes/Rogue_Hooded.glb', weapon: 'items/Dagger.glb', tint: 0xcbd5e1,
    animAttack: 'Dualwield_Melee_Attack_Chop',
    desc: '치명타에 모든 것을 건 고독한 암살자. 폭발적인 순간 단일 딜을 자랑합니다.',
    baseAtk: 25, baseHp: 140, speed: 0.23, moveSpd: 11.0, range: 3.5, critBonus: 0.32, isRanged: false,
    skills: [
      { name: '그림자 습격', cd: 3.2, mult: 2.9, dash: 7.0, range: 4.5, type: 'dash_aoe', color: 0x64748b, desc: '적의 사각으로 순식간에 파고들어 베어냅니다.' },
      { name: '고독한 일섬', cd: 5.8, mult: 3.9, range: 5.2, type: 'aoe', color: 0xe2e8f0, desc: '주변 모든 적에게 치명적 참격을 가합니다.' },
      { name: '무영 난무', cd: 10.5, mult: 5.8, dash: 8.5, range: 6.5, type: 'dash_aoe', color: 0x94a3b8, desc: '잔상을 남기며 연속 암살 일격을 퍼붓습니다.' },
      { name: '절명·월식참', cd: 14.5, mult: 8.4, range: 7.2, stun: 1.5, type: 'aoe', color: 0xf8fafc, desc: '달빛의 그림자로 적의 급소를 한 번에 베어버립니다.' },
    ],
  },
  lancer: {
    id: 'lancer', name: '용기사', category: 'melee', icon: '🔱', tier: 'S티어 · 창술', unlockCost: 750,
    color: 0x3b82f6, hex: '#60a5fa',
    model: 'heroes/Knight.glb', weapon: 'items/Spear.glb', showParts: ['Spike_Shield'], tint: 0x93c5fd,
    animAttack: '1H_Melee_Attack_Chop',
    desc: '긴 용창의 압도적 사거리와 창공 돌진으로 전장을 꿰뚫는 드래곤 나이트.',
    baseAtk: 26, baseHp: 185, speed: 0.31, moveSpd: 10.1, range: 5.2, critBonus: 0.16, isRanged: false,
    skills: [
      { name: '용아 관통', cd: 3.3, mult: 2.7, type: 'proj', color: 0x60a5fa, desc: '전방을 꿰뚫는 푸른 용창 기운을 발사합니다.' },
      { name: '비룡 돌진', cd: 6.2, mult: 3.9, dash: 8.5, range: 5.8, type: 'dash_aoe', color: 0x3b82f6, desc: '먼 거리를 단숨에 꿰뚫고 돌진합니다.' },
      { name: '선풍 창무', cd: 10.5, mult: 5.5, range: 7.2, stun: 1.4, type: 'aoe', color: 0x93c5fd, desc: '창을 거대하게 휘둘러 넓은 범위를 쓸어버립니다.' },
      { name: '드래곤 다이브', cd: 15.5, mult: 8.5, range: 8.5, stun: 2.0, type: 'meteor', color: 0x2563eb, desc: '창공에서 푸른 용의 낙뢰와 함께 대지를 강타합니다.' },
    ],
  },
  paladin: {
    id: 'paladin', name: '성기사', category: 'melee', icon: '🛡️', tier: 'A티어 · 수호', unlockCost: 650,
    color: 0xfbbf24, hex: '#fbbf24',
    model: 'heroes/Knight.glb', weapon: 'items/Hammer_Double.glb', showParts: ['Badge_Shield'], tint: 0xfef08a,
    animAttack: '2H_Melee_Attack_Chop',
    desc: '거대한 성망치의 기절과 신성한 치유 오라를 겸비한 불굴의 수호기사.',
    baseAtk: 23, baseHp: 235, speed: 0.37, moveSpd: 9.2, range: 4.3, critBonus: 0.12, isRanged: false,
    skills: [
      { name: '심판의 망치', cd: 3.6, mult: 2.7, range: 5.0, stun: 1.5, type: 'aoe', color: 0xfbbf24, desc: '빛나는 망치로 적을 내려쳐 기절시킵니다.' },
      { name: '수호의 축복', cd: 6.5, mult: 2.8, range: 6.0, healPct: 0.35, type: 'heal_aoe', color: 0xfde047, desc: '신성 충격파를 일으키고 체력을 35% 회복합니다.' },
      { name: '성광 돌격', cd: 11.0, mult: 5.2, dash: 7.5, range: 6.5, stun: 1.8, type: 'dash_aoe', color: 0xfacc15, desc: '황금빛 방패로 돌진하며 적진을 분쇄합니다.' },
      { name: '신의 철퇴 강림', cd: 15.5, mult: 7.8, range: 8.5, healPct: 0.45, type: 'heal_aoe', color: 0xfef08a, desc: '대규모 빛의 폭발로 적을 심판하고 HP를 45% 회복합니다.' },
    ],
  },
  samurai: {
    id: 'samurai', name: '검성', category: 'melee', icon: '⛩️', tier: 'SS티어 · 초월', unlockCost: 1300,
    color: 0xf43f5e, hex: '#fda4af',
    model: 'heroes/Rogue.glb', weapon: 'items/Sword_Big.glb', tint: 0xfda4af, emissive: 0xbe123c,
    animAttack: '2H_Melee_Attack_Spin',
    desc: '빛의 속도로 거합 발도술을 펼치는 전설의 검사. 최상위 공격 속도와 치명타를 자랑합니다.',
    baseAtk: 31, baseHp: 175, speed: 0.22, moveSpd: 11.2, range: 4.8, critBonus: 0.3, isRanged: false,
    skills: [
      { name: '발도·홍련섬', cd: 2.9, mult: 3.0, type: 'proj', color: 0xf43f5e, desc: '붉은 검풍을 전방으로 순식간에 날립니다.' },
      { name: '일섬 난무', cd: 5.8, mult: 4.4, dash: 8.5, range: 6.2, type: 'dash_aoe', color: 0xfb7185, desc: '적 사이를 질주하며 순식간에 베어 가릅니다.' },
      { name: '벚꽃 만개참', cd: 10.0, mult: 6.4, range: 7.5, stun: 1.6, type: 'aoe', color: 0xfda4af, desc: '사방에 붉은 검기를 흩뿌려 적들을 섬멸합니다.' },
      { name: '오의·무쌍천상베기', cd: 15.0, mult: 9.2, range: 9.0, stun: 2.2, type: 'aoe', color: 0xe11d48, desc: '모든 것을 두 동강 내는 검성의 궁극 발도술입니다.' },
    ],
  },
  necromancer: {
    id: 'necromancer', name: '네크로맨서', category: 'magic', icon: '💀', tier: 'S티어', unlockCost: 800,
    color: 0xa855f7, hex: '#a855f7',
    model: 'heroes/Rogue_Hooded.glb', weapon: 'items/Scythe.glb', tint: 0xd8b4fe,
    animAttack: 'Spellcast_Shoot',
    desc: '해골 전사 소환수와 사신의 낫으로 자동·장기 사냥을 압도하는 사령술사.',
    baseAtk: 25, baseHp: 145, speed: 0.35, moveSpd: 9.4, range: 12.0, critBonus: 0.12, isRanged: true,
    skills: [
      { name: '망자 소환', cd: 7.0, mult: 1.0, type: 'summon', color: 0xa855f7, desc: '해골 전사를 최대 4기 소환해 함께 싸웁니다.' },
      { name: '사신의 낫', cd: 5.0, mult: 3.5, range: 7.0, healPct: 0.18, type: 'heal_aoe', color: 0xc084fc, desc: '주변 영혼을 수확해 큰 피해를 주고 체력을 흡수합니다.' },
      { name: '언데드 군단 강림', cd: 12.0, mult: 5.0, range: 8.5, type: 'summon_aoe', color: 0x7e22ce, desc: '저주의 폭발과 함께 정예 해골을 일제 소환합니다.' },
      { name: '죽음의 대재앙', cd: 16.0, mult: 8.2, range: 9.5, type: 'meteor', color: 0x9333ea, desc: '거대한 암흑 해골 유성을 소환해 전장을 초토화합니다.' },
    ],
  },
  warlock: {
    id: 'warlock', name: '흑마법사', category: 'magic', icon: '☄️', tier: 'S티어', unlockCost: 900,
    color: 0xec4899, hex: '#ec4899',
    model: 'heroes/Mage.glb', weapon: 'items/Book1_Closed.glb', tint: 0xf472b6,
    animAttack: 'Spellcast_Shoot',
    desc: '암흑 연쇄 탄환과 메테오 낙하로 보스를 녹이는 원거리 극딜러.',
    baseAtk: 29, baseHp: 135, speed: 0.38, moveSpd: 9.3, range: 13.5, critBonus: 0.16, isRanged: true,
    skills: [
      { name: '암흑 연쇄', cd: 3.0, mult: 2.7, type: 'proj', color: 0xec4899, desc: '고속 암흑 마력 구체를 발사합니다.' },
      { name: '메테오 폴', cd: 6.8, mult: 4.5, range: 7.5, type: 'meteor', color: 0xf43f5e, desc: '하늘에서 거대한 지옥 운석을 떨어뜨립니다.' },
      { name: '심연의 블랙홀', cd: 12.0, mult: 6.4, range: 8.5, stun: 2.0, type: 'aoe', color: 0xbe185d, desc: '중력 붕괴를 일으켜 적을 묶고 초토화합니다.' },
      { name: '아포칼립스 파멸', cd: 16.5, mult: 9.0, range: 9.5, type: 'barrage', color: 0xf43f5e, desc: '다섯 갈래의 파멸 탄환을 연속 폭발시킵니다.' },
    ],
  },
  mage: {
    id: 'mage', name: '마법사', category: 'magic', icon: '🔮', tier: 'A티어', unlockCost: 350,
    color: 0x60a5fa, hex: '#60a5fa',
    model: 'heroes/Mage.glb', weapon: 'items/Crystal3.glb',
    animAttack: 'Spellcast_Shoot',
    desc: '화염과 빙결 원소 마법으로 안정적인 원거리 광역 사냥을 펼치는 마도사.',
    baseAtk: 24, baseHp: 135, speed: 0.37, moveSpd: 9.3, range: 13.0, critBonus: 0.12, isRanged: true,
    skills: [
      { name: '파이어 볼트', cd: 3.0, mult: 2.5, type: 'proj', color: 0xfb923c, desc: '작열하는 화염 구체를 발사합니다.' },
      { name: '프로스트 노바', cd: 6.0, mult: 3.4, range: 6.5, stun: 1.8, type: 'aoe', color: 0x38bdf8, desc: '빙결 파동으로 주변 적을 얼려버립니다.' },
      { name: '아이스 스톰', cd: 11.0, mult: 5.3, range: 8.0, type: 'meteor', color: 0x60a5fa, desc: '거대한 빙결 폭풍을 쏟아붓습니다.' },
      { name: '엘레멘탈 폭격', cd: 15.0, mult: 7.8, range: 8.5, type: 'barrage', color: 0x38bdf8, desc: '다섯 갈래의 원소 마법 탄환을 일제 발사합니다.' },
    ],
  },
  ranger: {
    id: 'ranger', name: '신궁수', category: 'magic', icon: '🏹', tier: 'A티어 · 원거리', unlockCost: 400,
    color: 0x22c55e, hex: '#4ade80',
    model: 'heroes/Rogue_Hooded.glb', weapon: 'items/Bow_Golden.glb', tint: 0x86efac,
    animAttack: '1H_Ranged_Shoot',
    desc: '황금 활로 먼 거리에서 적을 꿰뚫는 날렵한 엘프 궁수.',
    baseAtk: 25, baseHp: 145, speed: 0.27, moveSpd: 10.6, range: 14.5, critBonus: 0.24, isRanged: true,
    skills: [
      { name: '관통 화살', cd: 2.8, mult: 2.6, type: 'proj', color: 0x4ade80, desc: '빠른 황금 화살 2발을 연속 발사합니다.' },
      { name: '멀티 애로우', cd: 5.6, mult: 4.0, type: 'barrage', color: 0x22c55e, desc: '부채꼴로 5발의 바람 화살을 일제히 쏩니다.' },
      { name: '백스텝 샷', cd: 9.5, mult: 4.6, range: 6.0, stun: 1.5, type: 'aoe', color: 0x86efac, desc: '주변에 폭발 화살비를 내려 적을 묶습니다.' },
      { name: '별빛 화살 폭풍', cd: 14.5, mult: 8.0, range: 8.5, type: 'meteor', color: 0xfacc15, desc: '하늘에서 황금빛 화살 폭풍을 떨어뜨립니다.' },
    ],
  },
  priest: {
    id: 'priest', name: '성직자', category: 'support', icon: '✨', tier: 'C티어 · 지원', unlockCost: 250,
    color: 0xfacc15, hex: '#facc15',
    model: 'heroes/Mage.glb', weapon: 'items/Crown.glb', tint: 0xfef08a,
    animAttack: 'Spellcast_Raise',
    desc: '신성 마법과 강력한 자가 치유로 절대 쓰러지지 않는 파티의 수호자.',
    baseAtk: 19, baseHp: 185, speed: 0.35, moveSpd: 9.3, range: 11.0, critBonus: 0.08, isRanged: true,
    skills: [
      { name: '심판의 창', cd: 3.6, mult: 2.5, type: 'proj', color: 0xfacc15, desc: '성스러운 빛의 창을 투척합니다.' },
      { name: '천상의 빛', cd: 5.5, mult: 2.3, range: 6.5, healPct: 0.42, type: 'heal_aoe', color: 0xfde047, desc: '적에게 피해를 주고 HP를 42% 회복합니다.' },
      { name: '성역 전개', cd: 11.0, mult: 4.2, range: 8.0, healPct: 0.6, type: 'heal_aoe', color: 0xfef08a, desc: '거대한 성역을 펼쳐 체력을 대폭 회복하고 심판합니다.' },
      { name: '아크엔젤 심판', cd: 15.5, mult: 7.4, range: 8.5, healPct: 0.75, type: 'heal_aoe', color: 0xfef9c3, desc: '절대적인 성광으로 적을 섬멸하고 HP를 75% 회복합니다.' },
    ],
  },
  angel: {
    id: 'angel', name: '천사', category: 'support', icon: '🪽', tier: 'A티어 · 특수', unlockCost: 1100,
    color: 0xfde68a, hex: '#fde68a',
    model: 'heroes/Knight.glb', weapon: 'items/Sword_Golden.glb', tint: 0xfef9c3, emissive: 0xf59e0b,
    animAttack: '1H_Melee_Attack_Slice_Diagonal',
    desc: '황금빛 신성 검기와 초고속 비행 기동으로 전장을 정화하는 특수 클래스.',
    baseAtk: 27, baseHp: 180, speed: 0.28, moveSpd: 10.6, range: 5.0, critBonus: 0.16, isRanged: false,
    skills: [
      { name: '천벌의 검기', cd: 3.3, mult: 2.8, type: 'proj', color: 0xfde047, desc: '성스러운 황금 검기를 발사합니다.' },
      { name: '세라핌의 축복', cd: 6.5, mult: 3.6, range: 7.0, healPct: 0.3, type: 'heal_aoe', color: 0xfbbf24, desc: '신성 폭발로 적을 심판하고 체력을 30% 회복합니다.' },
      { name: '천상의 심판', cd: 11.5, mult: 6.0, range: 8.5, type: 'meteor', color: 0xfef08a, desc: '하늘에서 성스러운 빛의 기둥을 내리꽂습니다.' },
      { name: '천국 문 개방', cd: 16.0, mult: 8.8, range: 9.0, type: 'barrage', color: 0xfde047, desc: '하늘의 빛줄기 5갈래를 전방으로 쏟아붓습니다.' },
    ],
  },
  pirate: {
    id: 'pirate', name: '해적', category: 'support', icon: '🏴‍☠️', tier: 'D티어 · 파밍', unlockCost: 150,
    color: 0x10b981, hex: '#10b981',
    model: 'heroes/Rogue.glb', weapon: 'items/Bow_Evil.glb', tint: 0xa7f3d0,
    animAttack: '1H_Ranged_Shoot',
    goldBonus: 0.35,
    desc: '화력은 다소 아쉽지만 몬스터 처치 시 골드 획득량 +35% 패시브를 보유한 낭만 해적!',
    baseAtk: 19, baseHp: 155, speed: 0.36, moveSpd: 9.7, range: 10.5, critBonus: 0.14, isRanged: true,
    skills: [
      { name: '화약탄 사격', cd: 3.5, mult: 2.3, type: 'proj', color: 0x10b981, desc: '폭발하는 화약탄을 발사합니다.' },
      { name: '대포 일제포격', cd: 7.0, mult: 3.4, range: 6.8, type: 'meteor', color: 0x34d399, desc: '하늘에서 함포 포탄을 떨어뜨립니다.' },
      { name: '해적왕의 약탈', cd: 11.0, mult: 4.6, range: 7.0, type: 'aoe', color: 0xfbbf24, desc: '주변을 쓸어버리며 추가 전리품 감각을 깨웁니다.' },
      { name: '크라켄 포격 함대', cd: 15.0, mult: 7.2, range: 8.5, type: 'barrage', color: 0x10b981, desc: '다섯 발의 마법 함포탄을 일제 사격합니다.' },
    ],
  },
};

export const CLASS_ORDER = [
  'swordman', 'warrior', 'fighter', 'magicknight', 'loner', 'lancer', 'paladin', 'samurai',
  'necromancer', 'warlock', 'mage', 'ranger',
  'priest', 'angel', 'pirate',
];

export const TRAINERS = {
  master_knight: {
    id: 'master_knight',
    name: '⚔️ 기사단장 아서',
    model: 'npc_m/King.glb',
    x: -36, z: 74, rotY: 0.7,
    classes: ['swordman', 'lancer', 'paladin'],
    regionName: '🌸 봄: 시작의 꽃밭',
    hint: '🌸 봄의 꽃밭 서쪽 숲길, 울창한 나무 그늘 뒤편 어딘가',
    greeting: '이 먼 숲속까지 나를 찾아내다니 훌륭하군! 기사단의 창술과 성기사의 방패를 배워 보겠나?',
  },
  master_brawler: {
    id: 'master_brawler',
    name: '🥊 투기장 교관 카인',
    model: 'npc_m/Adventurer.glb',
    x: 34, z: 214, rotY: -0.9,
    classes: ['warrior', 'fighter', 'samurai'],
    regionName: '🌾 바람의 대초원',
    hint: '🌾 남쪽 외곽 대초원의 풍차와 농가 건물 뒤편 어딘가',
    greeting: '크하하! 숨은 훈련장까지 찾아왔구나! 진짜 전사와 무투가, 검성의 오의를 전수해 주지!',
  },
  master_rogue: {
    id: 'master_rogue',
    name: '🏹 그림자 선장 로빈',
    model: 'npc_m/Casual2.glb',
    x: 162, z: 229, rotY: -2.2,
    classes: ['pirate', 'loner', 'ranger'],
    regionName: '🌊 에메랄드 바다',
    hint: '🌊 남동쪽 에메랄드 바다, 남서쪽 산호 모래섬 야자수 아래',
    greeting: '어이, 바다를 건너 내 은신처까지 찾아온 녀석은 네가 처음이야! 활과 암살, 해적의 기술을 알려주마!',
  },
  master_holy: {
    id: 'master_holy',
    name: '🪽 천공의 성녀 세레나',
    model: 'npc_f/Formal.glb',
    x: -102, z: -56, rotY: 0.4,
    classes: ['priest', 'angel', 'magicknight'],
    regionName: '🍁 가을: 단풍의 협곡',
    hint: '🍁 서쪽 가을 단풍 협곡의 북쪽 언덕 너머 어딘가',
    greeting: '따스한 빛을 따라 여기까지 오셨군요. 성직자와 천사, 마검사의 신성한 힘을 열어드리겠어요.',
  },
  master_arcane: {
    id: 'master_arcane',
    name: '🔮 심연의 마도사 베라',
    model: 'npc_f/Medieval.glb',
    x: -222, z: -34, rotY: 1.1,
    classes: ['mage', 'warlock', 'necromancer'],
    regionName: '🏛️ 고대 잊혀진 유적지',
    hint: '🏛️ 서쪽 외곽 고대 유적지의 북쪽 거대 석탑 뒤편 어딘가',
    greeting: '유적의 깊은 그림자 속까지 발걸음하다니... 금기의 흑마법과 사령술을 다룰 자격이 있겠군.',
  },
};

export function getTrainerForClass(clsId) {
  return Object.values(TRAINERS).find((t) => t.classes.includes(clsId)) || null;
}

export const EQUIP_GRADES = [
  { grade: 0, name: '일반', mult: 1.0, costGold: 0, costStone: 0, color: '#94a3b8' },
  { grade: 1, name: '희귀', mult: 1.45, costGold: 220, costStone: 3, color: '#38bdf8' },
  { grade: 2, name: '영웅', mult: 2.15, costGold: 650, costStone: 8, color: '#a855f7' },
  { grade: 3, name: '전설', mult: 3.2, costGold: 1600, costStone: 16, color: '#facc15' },
  { grade: 4, name: '신화', mult: 4.8, costGold: 3800, costStone: 32, color: '#f43f5e' },
  { grade: 5, name: '초월', mult: 7.2, costGold: 9000, costStone: 60, color: '#22d3ee' },
];

export const REGIONS = {
  village: {
    id: 'village', name: '🏰 중앙 성채 마을', tag: '안전구역 · 통나무 울타리 · 회복',
    safe: true, minLevel: 1, warp: [0, 12],
    skyColor: 0x87ceeb, fogColor: 0xc8e7f5,
  },
  spring: {
    id: 'spring', name: '🌸 봄: 시작의 꽃밭', tag: '남쪽 대륙 · Lv.1~15',
    safe: false, minLevel: 1, warp: [0, 62], bossPos: [0, 152],
    skyColor: 0xa5e4ff, fogColor: 0xdff5fe,
    monsters: [
      { id: 'spring_slime', name: '꽃잎 슬라임', level: 2, model: 'mobs/Frog.glb', tint: 0x86efac, size: 1.5, hp: 90, atk: 9, spd: 3.4, exp: 35, gold: 24, stone: 0, crystal: 1 },
      { id: 'spring_rat', name: '초원 들쥐', level: 3, model: 'mobs/Rat.glb', size: 1.35, hp: 110, atk: 11, spd: 4.8, exp: 42, gold: 28, stone: 0, crystal: 1 },
      { id: 'spring_bee', name: '꽃밭 꿀벌', level: 5, model: 'mobs/Bee.glb', size: 1.5, hp: 135, atk: 13, spd: 5.2, exp: 55, gold: 36, stone: 1, crystal: 1 },
      { id: 'spring_fox', name: '초원 여우', level: 7, model: 'mobs/Fox.glb', size: 1.45, hp: 175, atk: 16, spd: 4.6, exp: 72, gold: 45, stone: 1, crystal: 1 },
      { id: 'spring_stag', name: '숲의 뿔사슴', level: 9, model: 'mobs/Stag.glb', size: 2.1, hp: 235, atk: 20, spd: 4.4, exp: 92, gold: 58, stone: 1, crystal: 2 },
      { id: 'spring_boar', name: '성난 들소', level: 11, model: 'mobs/Bull.glb', size: 2.0, hp: 310, atk: 25, spd: 4.0, exp: 115, gold: 75, stone: 1, crystal: 2 },
      { id: 'spring_mimic', name: '초원 보물 미믹', level: 12, model: 'mobs/Chest.glb', tint: 0xfde047, size: 1.7, hp: 280, atk: 20, spd: 2.8, exp: 140, gold: 260, stone: 3, crystal: 4 },
    ],
    boss: { id: 'spring_guardian', name: '[보스] 봄의 고대수 스테고르', level: 15, model: 'mobs/Stegosaurus.glb', tint: 0xf9a8d4, size: 4.3, hp: 1450, atk: 44, spd: 3.8, exp: 520, gold: 380, stone: 5, crystal: 10, isBoss: true },
  },
  summer: {
    id: 'summer', name: '☀️ 여름: 작열의 해변', tag: '동쪽 대륙 · Lv.12~35',
    safe: false, minLevel: 12, warp: [62, 0], bossPos: [152, 0],
    skyColor: 0x38bdf8, fogColor: 0xbae6fd,
    monsters: [
      { id: 'sand_crab', name: '모래 집게', level: 15, model: 'mobs/Crab.glb', size: 1.7, hp: 480, atk: 36, spd: 4.2, exp: 180, gold: 110, stone: 2, crystal: 2 },
      { id: 'sand_snake', name: '해변 모래뱀', level: 18, model: 'mobs/Snake.glb', size: 1.55, hp: 590, atk: 42, spd: 4.9, exp: 215, gold: 130, stone: 2, crystal: 3 },
      { id: 'desert_snake', name: '사막 독사', level: 22, model: 'mobs/Snake_angry.glb', size: 1.65, hp: 740, atk: 48, spd: 5.0, exp: 260, gold: 155, stone: 2, crystal: 3 },
      { id: 'sand_wasp', name: '작열 말벌', level: 26, model: 'mobs/Wasp.glb', size: 1.85, hp: 960, atk: 58, spd: 5.6, exp: 340, gold: 205, stone: 3, crystal: 4 },
      { id: 'sand_fiend', name: '모래 정령 괴수', level: 29, model: 'mobs/Enemy.glb', tint: 0xfbbf24, size: 2.1, hp: 1220, atk: 68, spd: 4.4, exp: 420, gold: 245, stone: 3, crystal: 5 },
      { id: 'sun_dino', name: '태양의 파라사우르', level: 32, model: 'mobs/Parasaurolophus.glb', tint: 0xfb923c, size: 2.9, hp: 1580, atk: 78, spd: 4.5, exp: 520, gold: 310, stone: 4, crystal: 6 },
      { id: 'summer_mimic', name: '해변 황금 미믹', level: 30, model: 'mobs/Chest.glb', tint: 0xfbbf24, size: 1.8, hp: 980, atk: 45, spd: 2.8, exp: 450, gold: 680, stone: 5, crystal: 8 },
    ],
    boss: { id: 'summer_boss', name: '[보스] 작열의 거신 아파토', level: 35, model: 'mobs/Apatosaurus.glb', tint: 0xfca5a5, size: 5.4, hp: 4200, atk: 88, spd: 3.9, exp: 1400, gold: 980, stone: 10, crystal: 22, isBoss: true },
  },
  autumn: {
    id: 'autumn', name: '🍁 가을: 단풍의 협곡', tag: '서쪽 대륙 · Lv.28~60',
    safe: false, minLevel: 28, warp: [-62, 0], bossPos: [-152, 0],
    skyColor: 0xfb923c, fogColor: 0xfed7aa,
    monsters: [
      { id: 'dark_wolf', name: '암흑 늑대', level: 34, model: 'mobs/Wolf.glb', tint: 0x94a3b8, size: 1.8, hp: 1450, atk: 78, spd: 5.8, exp: 520, gold: 300, stone: 3, crystal: 5 },
      { id: 'skel_minion', name: '해골 척후병', level: 38, model: 'mobs/Skeleton_Minion.glb', size: 1.9, hp: 1750, atk: 88, spd: 4.8, exp: 610, gold: 350, stone: 3, crystal: 5 },
      { id: 'skel_rogue', name: '해골 그림자 암살자', level: 42, model: 'mobs/Skeleton_Rogue.glb', size: 2.0, hp: 1980, atk: 108, spd: 5.6, exp: 710, gold: 410, stone: 4, crystal: 6 },
      { id: 'skel_warrior', name: '타락한 해골 기사', level: 46, model: 'mobs/Skeleton_Warrior.glb', size: 2.15, hp: 2350, atk: 112, spd: 4.5, exp: 820, gold: 460, stone: 4, crystal: 7 },
      { id: 'skel_mage', name: '황혼의 해골 사술사', level: 51, model: 'mobs/Skeleton_Mage.glb', size: 2.1, hp: 2650, atk: 128, spd: 4.3, exp: 960, gold: 540, stone: 5, crystal: 8 },
      { id: 'autumn_fiend', name: '단풍 악몽수', level: 55, model: 'mobs/Enemy.glb', tint: 0xa855f7, size: 2.4, hp: 3100, atk: 142, spd: 4.8, exp: 1150, gold: 650, stone: 5, crystal: 9 },
      { id: 'autumn_mimic', name: '저주받은 보물 미믹', level: 50, model: 'mobs/Chest.glb', tint: 0xc084fc, size: 1.9, hp: 2100, atk: 90, spd: 2.9, exp: 1000, gold: 1350, stone: 8, crystal: 14 },
    ],
    boss: { id: 'autumn_boss', name: '[보스] 해골 군주 바르곤', level: 60, model: 'mobs/Skeleton_Warrior.glb', tint: 0xc084fc, emissive: 0x7e22ce, size: 4.0, hp: 9800, atk: 165, spd: 4.6, exp: 3200, gold: 2200, stone: 18, crystal: 40, isBoss: true },
  },
  winter: {
    id: 'winter', name: '❄️ 겨울: 설원의 왕국', tag: '북쪽 대륙 · Lv.50~99',
    safe: false, minLevel: 50, warp: [0, -62], bossPos: [0, -255],
    skyColor: 0x1e293b, fogColor: 0x334155,
    monsters: [
      { id: 'snow_husky', name: '설원 서리 늑대', level: 56, model: 'mobs/Husky.glb', tint: 0xbae6fd, size: 1.85, hp: 3300, atk: 145, spd: 6.0, exp: 1250, gold: 690, stone: 5, crystal: 9 },
      { id: 'frost_raptor', name: '서리 랩터', level: 62, model: 'mobs/Velociraptor.glb', tint: 0x93c5fd, size: 2.2, hp: 3900, atk: 160, spd: 6.2, exp: 1480, gold: 790, stone: 6, crystal: 10 },
      { id: 'ice_spider', name: '빙결 거미', level: 69, model: 'mobs/Spider.glb', tint: 0x7dd3fc, size: 2.25, hp: 4800, atk: 185, spd: 5.4, exp: 1900, gold: 980, stone: 7, crystal: 12 },
      { id: 'ice_knight', name: '빙하 해골 기사', level: 76, model: 'mobs/Skeleton_Warrior.glb', tint: 0x38bdf8, size: 2.3, hp: 5600, atk: 205, spd: 4.8, exp: 2200, gold: 1150, stone: 8, crystal: 13 },
      { id: 'ice_para', name: '빙결 파라사우르', level: 82, model: 'mobs/Parasaurolophus.glb', tint: 0x7dd3fc, size: 3.1, hp: 6200, atk: 215, spd: 4.6, exp: 2400, gold: 1250, stone: 8, crystal: 14 },
      { id: 'ice_trike', name: '설원 트리케라톱스', level: 88, model: 'mobs/Triceratops.glb', tint: 0xbae6fd, size: 3.2, hp: 7200, atk: 235, spd: 4.4, exp: 2800, gold: 1450, stone: 10, crystal: 16 },
      { id: 'winter_mimic', name: '빙결 황금 미믹', level: 80, model: 'mobs/Chest.glb', tint: 0x38bdf8, size: 2.0, hp: 4500, atk: 140, spd: 3.0, exp: 2600, gold: 3200, stone: 14, crystal: 24 },
    ],
    boss: { id: 'world_dragon', name: '[월드 보스] 고대 월드 드래곤 티라노스', level: 95, model: 'mobs/Trex.glb', tint: 0x38bdf8, emissive: 0x0284c7, size: 6.2, hp: 26000, atk: 310, spd: 4.8, exp: 8800, gold: 6500, stone: 38, crystal: 90, isBoss: true },
  },
  meadow: {
    id: 'meadow', name: '🌾 바람의 대초원', tag: '남쪽 외곽 · Lv.14~28',
    safe: false, minLevel: 14, warp: [0, 188], bossPos: [0, 275],
    skyColor: 0x7dd3fc, fogColor: 0xdbeafe,
    monsters: [
      { id: 'meadow_alpaca', name: '황금 알파카', level: 15, model: 'mobs/Alpaca.glb', size: 1.85, hp: 380, atk: 28, spd: 4.8, exp: 145, gold: 90, stone: 1, crystal: 2 },
      { id: 'meadow_donkey', name: '들판 야생 당나귀', level: 18, model: 'mobs/Donkey.glb', size: 1.85, hp: 460, atk: 33, spd: 5.0, exp: 175, gold: 105, stone: 1, crystal: 2 },
      { id: 'meadow_horse', name: '질풍의 야생마', level: 21, model: 'mobs/Horse.glb', size: 2.1, hp: 580, atk: 40, spd: 6.0, exp: 220, gold: 135, stone: 2, crystal: 3 },
      { id: 'meadow_cow', name: '초원 거대 황소', level: 24, model: 'mobs/Cow.glb', size: 2.2, hp: 720, atk: 46, spd: 4.2, exp: 265, gold: 165, stone: 2, crystal: 3 },
      { id: 'meadow_stag', name: '바람의 거대 사슴', level: 26, model: 'mobs/Stag.glb', tint: 0xfde047, size: 2.4, hp: 850, atk: 52, spd: 5.2, exp: 310, gold: 190, stone: 3, crystal: 4 },
    ],
    boss: { id: 'meadow_boss', name: '[보스] 대초원의 수호왕 엘크사우르', level: 28, model: 'mobs/Parasaurolophus.glb', tint: 0x86efac, size: 4.8, hp: 2800, atk: 68, spd: 4.3, exp: 950, gold: 680, stone: 8, crystal: 16, isBoss: true },
  },
  ocean: {
    id: 'ocean', name: '🌊 에메랄드 바다 & 산호섬', tag: '남동쪽 해역 · Lv.30~50',
    safe: false, minLevel: 30, warp: [152, 152], bossPos: [215, 215],
    skyColor: 0x0ea5e9, fogColor: 0x7dd3fc,
    monsters: [
      { id: 'ocean_frog', name: '산호 바다 두꺼비', level: 31, model: 'mobs/Frog.glb', tint: 0x22d3ee, size: 1.85, hp: 1180, atk: 66, spd: 4.5, exp: 420, gold: 250, stone: 3, crystal: 4 },
      { id: 'ocean_crab', name: '심해 대왕집게', level: 35, model: 'mobs/Crab.glb', tint: 0x38bdf8, size: 2.3, hp: 1520, atk: 78, spd: 4.4, exp: 540, gold: 320, stone: 3, crystal: 5 },
      { id: 'ocean_snake', name: '에메랄드 바다뱀', level: 39, model: 'mobs/Snake.glb', tint: 0x06b6d4, size: 1.9, hp: 1840, atk: 90, spd: 5.4, exp: 650, gold: 380, stone: 4, crystal: 6 },
      { id: 'ocean_wasp', name: '푸른 산호 날치벌', level: 43, model: 'mobs/Wasp.glb', tint: 0x67e8f9, size: 2.0, hp: 2150, atk: 102, spd: 5.8, exp: 760, gold: 440, stone: 4, crystal: 7 },
      { id: 'ocean_fiend', name: '심연의 바다 괴수', level: 47, model: 'mobs/Enemy.glb', tint: 0x0284c7, size: 2.4, hp: 2650, atk: 118, spd: 4.6, exp: 920, gold: 540, stone: 5, crystal: 8 },
      { id: 'ocean_mimic', name: '침몰선 보물 미믹', level: 45, model: 'mobs/Chest.glb', tint: 0x38bdf8, size: 1.9, hp: 1950, atk: 80, spd: 2.9, exp: 880, gold: 1200, stone: 7, crystal: 12 },
    ],
    boss: { id: 'ocean_boss', name: '[보스] 심해의 거신 레비아탄', level: 50, model: 'mobs/Apatosaurus.glb', tint: 0x22d3ee, emissive: 0x0369a1, size: 5.8, hp: 7400, atk: 138, spd: 4.1, exp: 2400, gold: 1700, stone: 14, crystal: 32, isBoss: true },
  },
  desert: {
    id: 'desert', name: '🏜️ 끝없는 황금 대사막', tag: '동쪽 외곽 · Lv.38~65',
    safe: false, minLevel: 38, warp: [188, 0], bossPos: [275, 0],
    skyColor: 0xf59e0b, fogColor: 0xfde68a,
    monsters: [
      { id: 'desert_cobra', name: '사막 왕코브라', level: 40, model: 'mobs/Snake_angry.glb', tint: 0xf59e0b, size: 1.9, hp: 1950, atk: 96, spd: 5.3, exp: 690, gold: 400, stone: 4, crystal: 6 },
      { id: 'desert_spider', name: '황금 전갈거미', level: 45, model: 'mobs/Spider.glb', tint: 0xd97706, size: 2.1, hp: 2350, atk: 112, spd: 5.5, exp: 830, gold: 470, stone: 4, crystal: 7 },
      { id: 'desert_raptor', name: '모래폭풍 랩터', level: 50, model: 'mobs/Velociraptor.glb', tint: 0xfbbf24, size: 2.3, hp: 2850, atk: 128, spd: 6.1, exp: 1020, gold: 580, stone: 5, crystal: 8 },
      { id: 'desert_fiend', name: '열사의 모래마신', level: 56, model: 'mobs/Enemy.glb', tint: 0xea580c, size: 2.5, hp: 3450, atk: 148, spd: 4.8, exp: 1280, gold: 710, stone: 6, crystal: 10 },
      { id: 'desert_mimic', name: '파라오 황금 미믹', level: 54, model: 'mobs/Chest.glb', tint: 0xfacc15, size: 2.0, hp: 2600, atk: 110, spd: 3.0, exp: 1200, gold: 1850, stone: 9, crystal: 16 },
    ],
    boss: { id: 'desert_boss', name: '[보스] 사막의 폭군 스핑크스 렉스', level: 65, model: 'mobs/Trex.glb', tint: 0xf59e0b, emissive: 0xb45309, size: 5.8, hp: 12500, atk: 195, spd: 4.7, exp: 4200, gold: 2900, stone: 22, crystal: 48, isBoss: true },
  },
  ruins: {
    id: 'ruins', name: '🏛️ 고대 잊혀진 유적지', tag: '서쪽 외곽 · Lv.52~82',
    safe: false, minLevel: 52, warp: [-196, 0], bossPos: [-275, 0],
    skyColor: 0x312e81, fogColor: 0x4338ca,
    monsters: [
      { id: 'ruins_minion', name: '고대 유적 파수병', level: 54, model: 'mobs/Skeleton_Minion.glb', tint: 0x94a3b8, size: 2.1, hp: 3100, atk: 138, spd: 4.9, exp: 1180, gold: 660, stone: 5, crystal: 9 },
      { id: 'ruins_rogue', name: '유적 그림자 암살자', level: 60, model: 'mobs/Skeleton_Rogue.glb', tint: 0xc084fc, size: 2.15, hp: 3650, atk: 158, spd: 5.8, exp: 1420, gold: 780, stone: 6, crystal: 10 },
      { id: 'ruins_skull', name: '저주받은 해골혼', level: 66, model: 'mobs/Skull.glb', tint: 0xa855f7, emissive: 0x6b21a8, size: 2.0, hp: 4200, atk: 175, spd: 5.4, exp: 1680, gold: 900, stone: 7, crystal: 12 },
      { id: 'ruins_mage', name: '고대 유적 대사술사', level: 72, model: 'mobs/Skeleton_Mage.glb', tint: 0x818cf8, size: 2.3, hp: 4900, atk: 195, spd: 4.6, exp: 1950, gold: 1050, stone: 8, crystal: 14 },
      { id: 'ruins_gargoyle', name: '유적 석상 가고일', level: 78, model: 'mobs/Enemy.glb', tint: 0x64748b, size: 2.7, hp: 5800, atk: 215, spd: 4.5, exp: 2300, gold: 1240, stone: 9, crystal: 16 },
    ],
    boss: { id: 'ruins_boss', name: '[보스] 고대 유적의 수호거신', level: 82, model: 'mobs/Triceratops.glb', tint: 0xa855f7, emissive: 0x581c87, size: 5.6, hp: 18500, atk: 245, spd: 4.5, exp: 6200, gold: 4400, stone: 28, crystal: 64, isBoss: true },
  },
  arena: {
    id: 'arena', name: '⚔️ 콜로세움 결투장', tag: '북동쪽 외곽 · 실시간 PvP',
    safe: false, pvpArena: true, minLevel: 1, warp: [115, -100],
    skyColor: 0x450a0a, fogColor: 0x7f1d1d,
  },
};

export function getRegionAt(x, z) {
  const r = Math.hypot(x, z);
  if (r <= 35) return REGIONS.village;
  if (Math.hypot(x - 115, z + 115) <= 35) return REGIONS.arena;
  if (Math.hypot(x - 190, z - 190) <= 95) return REGIONS.ocean;
  if (z >= Math.abs(x)) return r > 170 ? REGIONS.meadow : REGIONS.spring;
  if (x > Math.abs(z)) return r > 170 ? REGIONS.desert : REGIONS.summer;
  if (-x > Math.abs(z)) return r > 170 ? REGIONS.ruins : REGIONS.autumn;
  return REGIONS.winter;
}

export const ZONES = {
  world: {
    id: 'world', name: '🌍 사계절 통합 대륙', tag: '심리스 오픈월드',
    safe: false, minLevel: 1, radius: 335, spawn: [0, 0, 12],
    skyColor: 0x87ceeb, fogColor: 0xc8e7f5, groundColor: 0x4b9459, accentColor: 0xf472b6,
    portals: [],
  },
  mirage: {
    id: 'mirage', name: '🌀 신기루 웨이브 던전', tag: '무한 웨이브 던전',
    safe: true, minLevel: 1, radius: 62, spawn: [0, 0, 20],
    skyColor: 0x2e1065, fogColor: 0x4c1d95, groundColor: 0x312e81, accentColor: 0xa855f7,
    portals: [{ to: 'world', label: '🏰 대륙(마을)으로 귀환', pos: [0, 0, 42], color: 0x38bdf8 }],
  },
  abyss: {
    id: 'abyss', name: '🕳️ 지하 심연 던전', tag: '층별 보스 도전',
    safe: true, minLevel: 1, radius: 58, spawn: [0, 0, 20],
    skyColor: 0x18181b, fogColor: 0x27272a, groundColor: 0x262626, accentColor: 0xec4899,
    portals: [{ to: 'world', label: '🏰 대륙(마을)으로 귀환', pos: [0, 0, 40], color: 0x38bdf8 }],
  },
};

export const TITLES = [
  { id: 't1', name: '초보 모험가', desc: '기본 지급 칭호', atkBonus: 0, hpBonus: 0, cond: () => true },
  { id: 't2', name: '꽃밭의 수호자', desc: 'Lv.5 이상 달성', atkBonus: 12, hpBonus: 60, cond: (s) => s.level >= 5 },
  { id: 't3', name: '사계절의 여행자', desc: 'Lv.20 이상 달성', atkBonus: 35, hpBonus: 180, cond: (s) => s.level >= 20 },
  { id: 't4', name: '보스 헌터', desc: '보스 3회 이상 처치', atkBonus: 65, hpBonus: 320, cond: (s) => s.bossKills >= 3 },
  { id: 't5', name: '신기루 정복자', desc: '신기루 웨이브 5 이상 달성', atkBonus: 90, hpBonus: 420, cond: (s) => s.bestWave >= 5 },
  { id: 't6', name: '심연의 정복자', desc: '지하 심연 5층 이상 돌파', atkBonus: 120, hpBonus: 550, cond: (s) => s.abyssFloor >= 5 },
  { id: 't7', name: '드래곤 슬레이어', desc: '고대 월드 드래곤 토벌', atkBonus: 180, hpBonus: 850, cond: (s) => s.dragonKilled },
  { id: 't8', name: '만렙 초월자', desc: '최고 레벨 Lv.99 달성', atkBonus: 300, hpBonus: 1500, cond: (s) => s.level >= 99 },
  { id: 't9', name: '대륙의 거상', desc: '누적 50,000 골드 이상 보유', atkBonus: 80, hpBonus: 400, cond: (s) => s.gold >= 50000 },
  { id: 't10', name: '결투의 제왕', desc: 'PvP 1승 이상 달성', atkBonus: 110, hpBonus: 500, cond: (s) => s.pvpWins >= 1 },
];

export const QUESTS = [
  { id: 'q1', kind: 'kill', title: '봄의 시작', desc: '🌸 꽃잎 슬라임 4마리 처치', targetId: 'spring_slime', count: 4, gold: 200, stone: 3, crystal: 5, exp: 140 },
  { id: 'q2', kind: 'kill', title: '꽃밭의 날개', desc: '🐝 꽃밭 꿀벌 4마리 처치', targetId: 'spring_bee', count: 4, gold: 280, stone: 4, crystal: 8, exp: 210 },
  { id: 'q3', kind: 'trainer', title: '숨겨진 스승 찾기', desc: '🧭 맵 어딘가에 숨은 전직관 1명 발견', targetId: 'trainer', count: 1, gold: 400, stone: 5, crystal: 10, exp: 280 },
  { id: 'q4', kind: 'level', title: '2번 기술 각성', desc: '⬆️ 캐릭터 Lv.3 달성하기', targetId: 'level', count: 3, gold: 350, stone: 5, crystal: 10, exp: 250 },
  { id: 'q5', kind: 'kill', title: '봄의 수호자 토벌', desc: '🌸 [보스] 스테고르 1회 처치', targetId: 'spring_guardian', count: 1, gold: 600, stone: 8, crystal: 15, exp: 520 },
  { id: 'q6', kind: 'kill', title: '대초원의 알파카', desc: '🌾 황금 알파카 5마리 처치', targetId: 'meadow_alpaca', count: 5, gold: 700, stone: 8, crystal: 15, exp: 680 },
  { id: 'q7', kind: 'kill', title: '수호왕 엘크사우르', desc: '🌾 [보스] 엘크사우르 1회 처치', targetId: 'meadow_boss', count: 1, gold: 1100, stone: 10, crystal: 20, exp: 1100 },
  { id: 'q8', kind: 'kill', title: '작열의 해변 정화', desc: '☀️ 모래 집게 5마리 처치', targetId: 'sand_crab', count: 5, gold: 950, stone: 10, crystal: 20, exp: 950 },
  { id: 'q9', kind: 'kill', title: '여름의 거신', desc: '☀️ [보스] 작열의 거신 아파토 토벌', targetId: 'summer_boss', count: 1, gold: 1600, stone: 14, crystal: 28, exp: 1900 },
  { id: 'q10', kind: 'kill', title: '심해의 거신', desc: '🌊 [보스] 레비아탄 1회 토벌', targetId: 'ocean_boss', count: 1, gold: 2200, stone: 18, crystal: 35, exp: 2700 },
  { id: 'q11', kind: 'kill', title: '사막의 폭군', desc: '🏜️ [보스] 스핑크스 렉스 토벌', targetId: 'desert_boss', count: 1, gold: 3200, stone: 22, crystal: 45, exp: 4200 },
  { id: 'q12', kind: 'kill', title: '단풍 협곡의 저주', desc: '🍁 해골 군주 바르곤 1회 토벌', targetId: 'autumn_boss', count: 1, gold: 3600, stone: 25, crystal: 50, exp: 4500 },
  { id: 'q13', kind: 'kill', title: '고대 유적의 수호자', desc: '🏛️ [보스] 고대 유적의 수호거신 토벌', targetId: 'ruins_boss', count: 1, gold: 5200, stone: 32, crystal: 70, exp: 6500 },
  { id: 'q14', kind: 'kill', title: '최종: 월드 드래곤', desc: '❄️ 고대 월드 드래곤 티라노스 토벌', targetId: 'world_dragon', count: 1, gold: 10000, stone: 50, crystal: 150, exp: 12000 },
];

export const SIDE_QUESTS = [
  { id: 'sq_bee', kind: 'kill', title: '🐝 꿀벌 대소탕', desc: '꽃밭 꿀벌 8마리 처치', targetId: 'spring_bee', count: 8, gold: 420, stone: 5, crystal: 12, exp: 320 },
  { id: 'sq_lv7', kind: 'level', title: '⚡ 3번 기술 해금', desc: '캐릭터 Lv.7 달성하기', targetId: 'level', count: 7, gold: 550, stone: 6, crystal: 15, exp: 400 },
  { id: 'sq_lv12', kind: 'level', title: '🔥 4번 필살기 각성', desc: '캐릭터 Lv.12 달성하기', targetId: 'level', count: 12, gold: 1100, stone: 10, crystal: 25, exp: 800 },
  { id: 'sq_tr3', kind: 'trainer', title: '🧭 숨은 스승 추적자', desc: '숨겨진 전직관 3명 발견하기', targetId: 'trainer', count: 3, gold: 1200, stone: 12, crystal: 25, exp: 900 },
  { id: 'sq_tr5', kind: 'trainer', title: '👑 모든 전직관 제패', desc: '숨겨진 전직관 5명 모두 발견하기', targetId: 'trainer', count: 5, gold: 3000, stone: 24, crystal: 60, exp: 2400 },
  { id: 'sq_wasp', kind: 'kill', title: '🐝 작열 말벌 소탕', desc: '작열 말벌 6마리 처치', targetId: 'sand_wasp', count: 6, gold: 1400, stone: 12, crystal: 28, exp: 1300 },
  { id: 'sq_spider', kind: 'kill', title: '🦂 사막 전갈거미 사냥', desc: '황금 전갈거미 6마리 처치', targetId: 'desert_spider', count: 6, gold: 2600, stone: 18, crystal: 40, exp: 2500 },
];

export const COUPONS = {
  LEGACY2026: { gold: 1200, stone: 12, crystal: 24, desc: '환장 래거시 리브랜딩 기념 패키지!' },
  CRAZY2026: { gold: 1000, stone: 10, crystal: 20, desc: '환장 래거시 오픈 기념 패키지!' },
  ODYSSEY777: { gold: 777, stone: 7, crystal: 15, desc: '럭키 세븐 모험가 지원!' },
  HWANJANG: { gold: 1500, stone: 12, crystal: 25, desc: '환장 RPG 특별 전직 지원금!' },
};
