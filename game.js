(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const W = 800;
  const H = 600;

  // 前六关地面炮台原话没有另给数量，沿用每关 4 座。后四关的 Boss 和地面部队按关卡自己写。
  // 极速飞机的双发间隔、小Boss 数值原话没有给，集中写在这里。
  const GROUND_EARLY = 4;
  const BOSS = {
    baozi: { hp: 18, scale: 1.18, shot: 2, shotCount: 2, shotDmg: 2, bomb: 10, bombDmg: 4, spread: 0.24, speed: 250 },
    small: { hp: 36, scale: 1.55, shot: 4, shotCount: 2, shotDmg: 2, bomb: 10, bombDmg: 3, spread: 0.2, speed: 240 },
    big: { hp: 60, scale: 2.25, shot: 4, shotCount: 3, shotDmg: 3, bomb: 10, bombDmg: 4, spread: 0.26, speed: 250 },
  };
  const LEVELS = [
    { name: '第1关', planes: 16, ground: GROUND_EARLY },
    { name: '第2关', planes: 12, ground: GROUND_EARLY },
    { name: '第3关', planes: 24, ground: GROUND_EARLY },
    { name: '第4关', planes: 28, ground: GROUND_EARLY },
    { name: '第5关', planes: 19, small: 2, ground: GROUND_EARLY },
    { name: '第6关', planes: 28, ground: GROUND_EARLY },
    { name: '第7关', planes: 16, baozi: 1, ground: 4 },
    { name: '第8关', planes: 12, small: 1, ground: 5 },
    { name: '第9关', planes: 10, big: 1, ground: 5 },
    { name: '第10关', planes: 8, small: 1, big: 1, ground: 6 },
  ];
  // 每关道具构成原话没拆比例：一般 5 个、最后一关 12 个。三种球都要出现。
  const ITEM_PLANS = {
    normal: ['blue', 'yellow', 'white', 'green', 'red', 'black', 'bomb', 'pink'],
    final: ['blue', 'yellow', 'white', 'green', 'red', 'black', 'bomb', 'pink', 'blue', 'yellow', 'green', 'red', 'bomb', 'pink', 'blue', 'bomb'],
  };
  const LIGHTNING_TIME = 15;
  const LIGHTNING_DMG = 3;
  const FLAME_TIME = 10;
  const FLAME_DMG = 5;
  const HEAL_AMOUNT = 4;
  const BASE_HEAL = 5;
  const ALLY_SHIP_COUNT = 3;
  const DRONE_COUNT = 4;
  const DRONE_HP = 5;
  const DRONE_DMG = 2;
  const DRONE_INTERVAL = 0.7;
  const ALLY_GROUND_COUNT = 2;
  const ALLY_AA_COUNT = 3;
  const ENEMY_AA_COUNT = 1;
  const ALLY_SHIP_SCALE = 0.55;
  const MORTAR_INTERVAL = 3;
  const MORTAR_DMG = 3;
  const AA_DMG = 4;
  const AA_INTERVAL = 2;
  const AA_HP = 4;
  const HELI_HP = 3;
  const HELI_DMG = 2;
  const HELI_INTERVAL = 2;
  const HELI_ENEMY_COUNT = 2;
  const HELI_ALLY_COUNT = 1;
  const PLAYER_MAX = 26;
  const BASE_MAX = 19;
  const BASE_LINE = H - 100;
  const START_BOMBS = 50;
  const BOMB_ORB = 5;
  const PLAYER_BOMB_DMG = 5;
  const AURORA_COUNT = 30;
  const AURORA_DMG = 3;
  const PINK_AURORA = 5;
  const PAL = {
    player: { body: '#166dd4', edge: '#7bcaff', core: '#b8efff', flame: '#b2f4ff', wing: '#61c4ff', glow: '#48a6ff' },
    red: { body: '#a92c4b', edge: '#ff8ca0', core: '#ffccd4', flame: '#ffab75', wing: '#ff819a', glow: '#ff5c7e' },
    baozi: { body: '#1d4eab', edge: '#ffd15c', core: '#fff3ae', flame: '#ffe38a', wing: '#7eb6ff', glow: '#ffd15c' },
    small: { body: '#c24b12', edge: '#ffb088', core: '#ffe0c2', flame: '#ffb15a', wing: '#ff8a4a', glow: '#ff7a3c' },
    yellowShip: { body: '#e2b423', edge: '#ffe38a', core: '#fff6cc', flame: '#ffe9a0', wing: '#ffd15c', glow: '#ffd15c' },
  };

  const keys = new Set();
  let mode = 'ready';
  let previous = 0;
  let elapsed = 0;
  let fireClock = 0;
  let spawnClock = 0;
  let player;
  let enemies = [];
  let lasers = [];
  let particles = [];
  let score = 0;
  let kills = 0;
  let best = 0;
  let soundOn = true;
  let audio;
  let shake = 0;
  let lastPlayerShot = 0;
  let lastEnemyShot = 0;
  let lastFriendlyShot = 0;
  let moveTarget = null;
  let shipSelected = false;
  let gesture = null;
  let dragging = false;
  let hitFlash = 0;
  let levelIndex = 0;
  let killedPlanes = 0;
  let spawnedPlanes = 0;
  let killedGround = 0;
  let spawnedGround = 0;
  let baoziKilled = 0;
  let smallBossKilled = 0;
  let bigBossKilled = 0;
  let bannerTimer = 0;
  let items = [];
  let allies = [];
  let itemPlanNow = ITEM_PLANS.normal;
  let spawnedItems = 0;
  let collectedItems = 0;
  let itemClock = 0;
  let lightning = 0;
  let flame = 0;
  let flameSerial = 0;
  let firstPerson = false;
  let viewPress = false;
  let bombStock = START_BOMBS;
  let auroraStock = AURORA_COUNT;
  let baseHp = BASE_MAX;
  let baseFlash = 0;

  try { best = Number(localStorage.getItem('starbound-best')) || 0; } catch {}

  const stars = Array.from({ length: 150 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.35 + 0.3,
    speed: Math.random() * 24 + 7,
    a: Math.random() * 0.6 + 0.15,
  }));

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
  }
  new ResizeObserver(resize).observe(canvas);

  function ensureAudio() {
    if (!soundOn) return null;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      return audio;
    } catch {
      return null;
    }
  }

  function tone(freq, length, type = 'sine', volume = 0.025) {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.35), ctx.currentTime + length);
      g.gain.setValueAtTime(volume, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + length);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + length);
    } catch {}
  }

  function noiseBurst(duration, freq, volume) {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(Math.max(90, freq * 0.22), ctx.currentTime + duration);
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      src.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      src.start();
      src.stop(ctx.currentTime + duration);
    } catch {}
  }

  function sfxPlayerShot() {
    const now = performance.now();
    if (now - lastPlayerShot < 60) return;
    lastPlayerShot = now;
    tone(920, 0.045, 'square', 0.02);
    noiseBurst(0.04, 2200, 0.035);
  }

  function sfxEnemyShot() {
    const now = performance.now();
    if (now - lastEnemyShot < 80) return;
    lastEnemyShot = now;
    tone(180, 0.05, 'square', 0.028);
    noiseBurst(0.05, 900, 0.04);
  }

  function sfxFriendlyShot() {
    const now = performance.now();
    if (now - lastFriendlyShot < 90) return;
    lastFriendlyShot = now;
    tone(640, 0.04, 'square', 0.018);
    noiseBurst(0.04, 1600, 0.03);
  }

  function sfxImpact() {
    tone(280, 0.06, 'square', 0.04);
    noiseBurst(0.08, 1500, 0.06);
  }

  function sfxExplosion(big) {
    tone(big ? 55 : 78, big ? 0.48 : 0.32, 'sawtooth', big ? 0.07 : 0.05);
    noiseBurst(big ? 0.5 : 0.34, big ? 320 : 560, big ? 0.11 : 0.08);
  }

  function sfxWhoosh() {
    tone(130, 0.14, 'sawtooth', 0.04);
    noiseBurst(0.14, 480, 0.05);
  }

  function formatTime(t) {
    return `${Math.floor(t / 60).toString().padStart(2, '0')}:${Math.floor(t % 60).toString().padStart(2, '0')}`;
  }

  function planeTarget(lv = LEVELS[levelIndex]) {
    return (lv.planes || 0) + (lv.baozi || 0) + (lv.small || 0) + (lv.big || 0);
  }

  function planeKilled() {
    return killedPlanes + baoziKilled + smallBossKilled + bigBossKilled;
  }

  function syncHUD() {
    const lv = LEVELS[levelIndex];
    const hp = player?.hp ?? PLAYER_MAX;
    $('hp').textContent = hp;
    $('health-bar').innerHTML = Array.from({ length: PLAYER_MAX }, (_, i) => `<i class="${i < hp ? '' : 'empty'}"></i>`).join('');
    $('health-bar').classList.toggle('low', hp <= 5);
    $('score').textContent = String(score).padStart(6, '0');
    $('kills').innerHTML = `${kills} <small>个</small>`;
    $('best').textContent = String(Math.max(score, best)).padStart(6, '0');
    $('time').textContent = $('arena-time').textContent = formatTime(elapsed);
    $('level').textContent = lv.name;
    $('planes').textContent = `${planeKilled()} / ${planeTarget(lv)}`;
    $('ground').textContent = `${killedGround} / ${lv.ground}`;
    $('items').textContent = `${collectedItems} / ${itemPlanNow.length}`;
    $('lightning').textContent = lightning > 0 ? `${lightning.toFixed(1)}s` : '—';
    $('flame').textContent = flame > 0 ? `${flame.toFixed(1)}s` : '—';
    $('bombs').textContent = String(bombStock);
    $('aurora').textContent = String(auroraStock);
    $('base-hp').textContent = baseHp;
    $('base-bar').innerHTML = Array.from({ length: BASE_MAX }, (_, i) => `<i class="${i < baseHp ? '' : 'empty'}"></i>`).join('');
    $('base-bar').classList.toggle('low', baseHp <= 6);
  }

  function itemCounts(plan) {
    return plan.reduce((n, type) => { n[type] = (n[type] || 0) + 1; return n; }, { blue: 0, yellow: 0, green: 0, red: 0, bomb: 0, pink: 0, white: 0, black: 0 });
  }

  function renderIntel() {
    const normal = itemCounts(ITEM_PLANS.normal);
    const final = itemCounts(ITEM_PLANS.final);
    const bz = BOSS.baozi;
    const sm = BOSS.small;
    const bg = BOSS.big;
    $('intel-note').textContent = `普通飞机为红色，3 点生命，每 2 秒发射激光，命中扣 1 血。每关开局有 ${HELI_ENEMY_COUNT + HELI_ALLY_COUNT} 架直升机，敌方 ${HELI_ENEMY_COUNT} 架，我方 ${HELI_ALLY_COUNT} 架，${HELI_HP} 滴血，会发射普通子弹，打中扣 ${HELI_DMG} 血。直升机不计入过关数量。地面炮台与飞机同时出现。极速飞机是蓝黄色飞机，每 ${bz.shot} 秒 ${bz.shotCount} 发，每发扣 ${bz.shotDmg} 血，每 ${bz.bomb} 秒 1 颗炸弹扣 ${bz.bombDmg} 血。小Boss 为橙色较小飞机，每 ${sm.shot} 秒 ${sm.shotCount} 发，每发扣 ${sm.shotDmg} 血，炸弹扣 ${sm.bombDmg} 血。大Boss 是红色、体积更大的飞机，每 ${bg.shot} 秒 ${bg.shotCount} 发，每发扣 ${bg.shotDmg} 血，炸弹扣 ${bg.bombDmg} 血。`;
    $('level-list').innerHTML = LEVELS.map(lv => `<li>${describeLevel(lv)}</li>`).join('');
    $('item-note').innerHTML = `道具会自动出现。一般每关 <b>${ITEM_PLANS.normal.length}</b> 个：蓝 ${normal.blue}、黄 ${normal.yellow}、白 ${normal.white}、绿 ${normal.green}、红 ${normal.red}、黑 ${normal.black}、炸弹 ${normal.bomb}、粉 ${normal.pink}。最后一关 <b>${ITEM_PLANS.final.length}</b> 个：蓝 ${final.blue}、黄 ${final.yellow}、白 ${final.white}、绿 ${final.green}、红 ${final.red}、黑 ${final.black}、炸弹 ${final.bomb}、粉 ${final.pink}。黑球是第 6 个出现的，自己点击或主角碰到后基地回复 ${BASE_HEAL} 滴血。蓝球：${LIGHTNING_TIME} 秒内子弹变成雷电，雷电击中扣 ${LIGHTNING_DMG} 血。黄球：召唤 ${ALLY_SHIP_COUNT} 架小型黄色飞机、${ALLY_GROUND_COUNT} 支我方地面部队、${DRONE_COUNT} 架无人机，再加 ${ALLY_AA_COUNT} 座我方基地防空炮。无人机有 ${DRONE_HP} 滴血，被打中扣 ${DRONE_DMG} 滴，打中敌人也扣 ${DRONE_DMG} 滴。防空炮弹打中飞机或坦克扣 ${AA_DMG} 血。地面部队每 ${MORTAR_INTERVAL} 秒发射 1 发迫击炮，打中扣 ${MORTAR_DMG} 血。每关敌方也有 ${ENEMY_AA_COUNT} 座防空炮，炮台有 ${AA_HP} 滴血，炮弹打中同样扣 ${AA_DMG} 血。我方防空炮同样是 ${AA_HP} 滴血。绿球：回复 ${HEAL_AMOUNT} 滴血。红球：召唤我方小Boss 和我方大Boss。炸弹能量球：再获得 ${BOMB_ORB} 颗自己投出的炸弹。开局 ${START_BOMBS} 颗追踪炸弹，鼠标左键点击投出，炸中扣 ${PLAYER_BOMB_DMG} 血。中子弹每关 ${AURORA_COUNT} 发，鼠标右键射出一小条追踪极光，打中扣 ${AURORA_DMG} 血。粉色小球：极光再加 ${PINK_AURORA} 发。白球：主角碰到后喷出火焰 ${FLAME_TIME} 秒，烧到的敌人扣 ${FLAME_DMG} 血，时间一到火焰消失。`;
  }

  function roster(lv) {
    const bits = [];
    if (lv.planes) bits.push(`${lv.planes} 架普通飞机`);
    if (lv.baozi) bits.push(`${lv.baozi} 架极速飞机`);
    if (lv.small) bits.push(`${lv.small} 架小Boss`);
    if (lv.big) bits.push(`${lv.big} 架大Boss`);
    return bits.join('、');
  }

  function describeLevel(lv) {
    return `<b>${lv.name}</b>：${roster(lv)}，同时有地面炮台 ${lv.ground}，敌方防空炮台 ${ENEMY_AA_COUNT}，敌方直升机 ${HELI_ENEMY_COUNT}，我方直升机 ${HELI_ALLY_COUNT}。`;
  }

  function nextBlurb(lv) {
    return `${lv.name}：${roster(lv)}，地面炮台 ${lv.ground}，敌方防空炮台 ${ENEMY_AA_COUNT}，敌方直升机 ${HELI_ENEMY_COUNT}，我方直升机 ${HELI_ALLY_COUNT}`;
  }

  function bannerText(lv) {
    return `${lv.name} · ${roster(lv)} · 地面炮台 ${lv.ground}`;
  }

  function showBanner(text) {
    const el = $('level-banner');
    el.textContent = text;
    el.classList.add('show');
    bannerTimer = 2.6;
  }

  function showOverlay(tag, title, text, button, hint) {
    $('overlay-tag').textContent = tag;
    $('overlay-title').textContent = title;
    $('overlay-text').textContent = text;
    $('start').innerHTML = `${button} <span>↗</span>`;
    $('overlay-hint').textContent = hint;
    $('overlay').classList.remove('hidden');
  }

  function hideOverlay() {
    $('overlay').classList.add('hidden');
  }

  function burst(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 220;
      particles.push({
        kind: 'spark',
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.28 + Math.random() * 0.42,
        max: 0.7,
        color,
        w: Math.random() < 0.3 ? 4.2 : 2.4,
      });
    }
  }

  function muzzleFlash(x, y, color) {
    particles.push({ kind: 'flash', x, y, vx: 0, vy: 0, life: 0.08, max: 0.08, color, r: 7 });
  }

  function boom(x, y, color, scale = 1) {
    burst(x, y, color, Math.round(16 * scale));
    burst(x, y, '#fff6d8', Math.round(7 * scale));
    particles.push({ kind: 'flash', x, y, vx: 0, vy: 0, life: 0.14, max: 0.14, color: '#fffaf0', r: 18 * scale });
    particles.push({ kind: 'ring', x, y, vx: 0, vy: 0, life: 0.38, max: 0.38, color, r: 6, grow: 170 * scale });
    particles.push({ kind: 'ring', x, y, vx: 0, vy: 0, life: 0.28, max: 0.28, color: '#fff6ea', r: 3, grow: 90 * scale });
    if (scale > 1.3) {
      particles.push({ kind: 'ring', x, y, vx: 0, vy: 0, life: 0.55, max: 0.55, color: '#ffe7b0', r: 4, grow: 250 * scale });
    }
    shake = Math.min(16, shake + 4 * scale);
  }

  function saveBest() {
    best = Math.max(score, best);
    try { localStorage.setItem('starbound-best', String(best)); } catch {}
    syncHUD();
  }

  function makeCraft(kind, x, y, extra) {
    const spec = kind === 'baozi' ? BOSS.baozi : kind === 'smallBoss' ? BOSS.small : kind === 'bigBoss' ? BOSS.big : null;
    return Object.assign({
      kind,
      x,
      y,
      hp: spec ? spec.hp : 3,
      maxHp: spec ? spec.hp : 3,
      timer: kind === 'plane' || kind === 'ground' ? 0.4 + Math.random() * 1.2 : 0,
      bombTimer: 0,
      speed: 36 + Math.min(levelIndex * 5, 18),
      phase: Math.random() * Math.PI * 2,
      flash: 0,
      scale: spec ? spec.scale : 1,
      dead: false,
    }, extra);
  }

  function spawnPlane(x) {
    enemies.push(makeCraft('plane', x ?? (60 + Math.random() * (W - 120)), -40 - Math.random() * 100));
  }

  function spawnGround(index, total) {
    const homeX = 110 + (index + 0.5) * ((W - 220) / total);
    const homeY = 168 + (index % 2) * 78;
    enemies.push(makeCraft('ground', homeX, -60, { homeX, homeY, phase: index * 1.3 }));
  }

  function spawnHelicopters() {
    const enemyHomes = [
      { x: 180, y: 128 },
      { x: 620, y: 168 },
      { x: 400, y: 148 },
    ].slice(0, HELI_ENEMY_COUNT);
    const allyHomes = [
      { x: 150, y: 400 },
      { x: 650, y: 440 },
      { x: 400, y: 420 },
    ].slice(0, HELI_ALLY_COUNT);
    enemyHomes.forEach((home, i) => {
      enemies.push(makeCraft('heli', home.x, -70 - i * 36, {
        homeX: home.x,
        homeY: home.y,
        phase: i * 1.4,
        hp: HELI_HP,
        maxHp: HELI_HP,
      }));
    });
    allyHomes.forEach((home, i) => {
      allies.push(makeCraft('heli', home.x, H + 24 + i * 18, {
        homeX: home.x,
        homeY: home.y,
        phase: 0.8 + i,
        friendly: true,
        timer: 0.4 + i * 0.35,
        hp: HELI_HP,
        maxHp: HELI_HP,
      }));
    });
  }

  function spawnEnemyAa(index) {
    const homeX = ENEMY_AA_COUNT === 1 ? 400 : 180 + index * ((W - 360) / (ENEMY_AA_COUNT - 1));
    const homeY = 292;
    enemies.push(makeCraft('aa', homeX, -90, { homeX, homeY, phase: 0.6 + index, hp: AA_HP, maxHp: AA_HP }));
  }

  function spawnNamed(count, kind, y, homeY, loneX) {
    for (let i = 0; i < count; i++) {
      const homeX = count === 1 ? loneX : 150 + i * ((W - 300) / (count - 1));
      enemies.push(makeCraft(kind, homeX, y - i * 36, {
        homeX,
        homeY,
        phase: i * 1.15 + (kind === 'bigBoss' ? 1.4 : 0.2),
      }));
    }
  }

  function resetWaveFlags() {
    killedPlanes = 0;
    spawnedPlanes = 0;
    killedGround = 0;
    spawnedGround = 0;
    baoziKilled = 0;
    smallBossKilled = 0;
    bigBossKilled = 0;
    enemies = [];
    lasers = [];
    particles = [];
    items = [];
    allies = [];
    spawnedItems = 0;
    collectedItems = 0;
    itemClock = 0;
    lightning = 0;
    flame = 0;
    moveTarget = null;
    gesture = null;
    spawnClock = 0;
    fireClock = 0.2;
    hitFlash = 0;
    keys.clear();
  }

  function beginWave() {
    const lv = LEVELS[levelIndex];
    resetWaveFlags();
    itemPlanNow = levelIndex === LEVELS.length - 1 ? ITEM_PLANS.final : ITEM_PLANS.normal;
    player.hp = PLAYER_MAX;
    player.x = W / 2;
    player.y = H - 95;
    const opening = Math.min(lv.planes || 0, 3);
    for (let i = 0; i < opening; i++) {
      spawnPlane(150 + i * 230);
      spawnedPlanes++;
    }
    for (let i = 0; i < lv.ground; i++) {
      spawnGround(i, lv.ground);
      spawnedGround++;
    }
    for (let i = 0; i < ENEMY_AA_COUNT; i++) spawnEnemyAa(i);
    spawnHelicopters();
    if (lv.baozi) spawnNamed(lv.baozi, 'baozi', -70, 132, W / 2);
    if (lv.small) spawnNamed(lv.small, 'smallBoss', -90, 168, lv.big ? 230 : W / 2);
    if (lv.big) spawnNamed(lv.big, 'bigBoss', -120, 118, lv.small ? 560 : W / 2);
    mode = 'playing';
    hideOverlay();
    $('status').textContent = `${lv.name} · 交战中`;
    $('pause').disabled = false;
    $('pause').textContent = 'Ⅱ';
    $('pause').setAttribute('aria-label', '暂停游戏');
    auroraStock = AURORA_COUNT;
    syncHUD();
    showBanner(bannerText(lv));
    tone(550, 0.25);
  }

  function start() {
    levelIndex = 0;
    score = 0;
    kills = 0;
    elapsed = 0;
    shipSelected = true;
    moveTarget = null;
    bombStock = START_BOMBS;
    auroraStock = AURORA_COUNT;
    baseHp = BASE_MAX;
    baseFlash = 0;
    player = { x: W / 2, y: H - 95, hp: PLAYER_MAX };
    firstPerson = false;
    beginWave();
  }

  function nextLevel() {
    if (levelIndex >= LEVELS.length - 1) {
      victory();
      return;
    }
    levelIndex++;
    beginWave();
  }

  function togglePause() {
    if (mode === 'playing') {
      mode = 'paused';
      keys.clear();
      gesture = null;
      $('status').textContent = '已暂停';
      $('pause').textContent = '▷';
      $('pause').setAttribute('aria-label', '继续游戏');
      showOverlay('TAKE A BREATH, PILOT', '星海，稍作停留。', '任务已暂停。准备好后，继续你的航行。', '继续任务', '按空格键或 Enter 继续');
    } else if (mode === 'paused') {
      mode = 'playing';
      $('status').textContent = `${LEVELS[levelIndex].name} · 交战中`;
      $('pause').textContent = 'Ⅱ';
      $('pause').setAttribute('aria-label', '暂停游戏');
      hideOverlay();
    }
  }

  function levelClear() {
    tone(660, 0.22);
    if (levelIndex >= LEVELS.length - 1) {
      victory();
      return;
    }
    mode = 'levelclear';
    keys.clear();
    gesture = null;
    const next = LEVELS[levelIndex + 1];
    $('status').textContent = '关卡通过';
    $('pause').disabled = true;
    showOverlay('LEVEL CLEAR', `${LEVELS[levelIndex].name} 通过`, `下一关 ${nextBlurb(next)}`, '进入下一关', '按 Enter 继续');
  }

  function victory() {
    mode = 'victory';
    saveBest();
    keys.clear();
    gesture = null;
    shipSelected = false;
    moveTarget = null;
    $('status').textContent = '任务完成';
    $('pause').disabled = true;
    showOverlay('MISSION COMPLETE', '航线守住了。', `${LEVELS.length}关通过 · 得分 ${score} · 击毁 ${kills} · 存活 ${formatTime(elapsed)}`, '再飞一次', '按 Enter 重新开始');
    burst(W / 2, H / 2, '#ffd15c', 40);
    burst(W / 3, H / 3, '#79ddff', 24);
    tone(720, 0.35);
  }

  function end(reason) {
    mode = 'over';
    saveBest();
    keys.clear();
    gesture = null;
    shipSelected = false;
    moveTarget = null;
    $('status').textContent = reason === 'base' ? '基地失守' : '任务结束';
    $('pause').disabled = true;
    const title = reason === 'base' ? '基地失守了。' : '下一次，飞得更远。';
    const text = reason === 'base'
      ? `敌方闯进我方基地，基地血量归零。止步${LEVELS[levelIndex].name} · 得分 ${score} · 击毁 ${kills}`
      : `止步${LEVELS[levelIndex].name} · 得分 ${score} · 击毁 ${kills} · 存活 ${formatTime(elapsed)}`;
    showOverlay('EVERY END IS A NEW BEGINNING', title, text, '再次出击', '按 Enter 重新开始');
    tone(120, 0.6, 'sawtooth', 0.045);
  }

  function baseLeakDamage(kind) {
    if (kind === 'bigBoss') return 4;
    if (kind === 'smallBoss') return 2;
    return 1;
  }

  function hurtBase(e) {
    if (!e || e.breached || e.dead || e.friendly || mode !== 'playing') return;
    e.breached = true;
    const amount = baseLeakDamage(e.kind);
    baseHp = Math.max(0, baseHp - amount);
    baseFlash = 0.45;
    boom(e.x, Math.min(e.y, H - 30), amount >= 4 ? '#ff5a78' : amount >= 2 ? '#ffb15a' : '#8eb6ff', amount >= 2 ? 1.3 : 0.8);
    if (amount >= 2) sfxExplosion(amount >= 4);
    else sfxImpact();
    syncHUD();
    if (baseHp <= 0) end('base');
  }

  function watchBase() {
    if (mode !== 'playing') return;
    for (const e of enemies) {
      if (e.dead || e.friendly || e.breached) continue;
      if (e.y >= BASE_LINE) hurtBase(e);
    }
  }

  function damage(amount) {
    if (mode !== 'playing' || !player) return;
    player.hp = Math.max(0, player.hp - amount);
    hitFlash = 0.18;
    boom(player.x, player.y, '#65bdff', amount >= 3 ? 1.15 : 0.7);
    tone(180, 0.14, 'triangle', 0.05);
    syncHUD();
    if (player.hp <= 0) {
      boom(player.x, player.y, '#90d8ff', 2);
      sfxExplosion(true);
      end();
    }
  }

  function destroyEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    const points = { plane: 100, ground: 80, aa: 140, heli: 120, baozi: 600, smallBoss: 2000, bigBoss: 4000 };
    score += points[e.kind] || 100;
    kills++;
    if (e.kind === 'plane') killedPlanes++;
    if (e.kind === 'ground') killedGround++;
    if (e.kind === 'baozi') baoziKilled++;
    if (e.kind === 'smallBoss') smallBossKilled++;
    if (e.kind === 'bigBoss') bigBossKilled++;
    const color = e.kind === 'ground' ? '#d6c36a' : e.kind === 'aa' ? '#ffb15a' : e.kind === 'baozi' ? '#ffd15c' : '#ff6d88';
    const scale = e.kind === 'bigBoss' ? 2.3 : e.kind === 'smallBoss' || e.kind === 'baozi' ? 1.7 : 1.2;
    boom(e.x, e.y, color, scale);
    sfxExplosion(e.kind === 'bigBoss' || e.kind === 'smallBoss');
    syncHUD();
  }

  function fire(e, dmg, speed, spread, bomb) {
    const a = Math.atan2(player.y - e.y, player.x - e.x) + spread;
    const muzzle = (bomb ? 20 : 12) * (e.scale || 1);
    lasers.push({
      x: e.x + Math.cos(a) * muzzle,
      y: e.y + Math.sin(a) * muzzle,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      enemy: true,
      dmg,
      bomb: !!bomb,
      dead: false,
    });
    if (bomb) {
      sfxWhoosh();
      muzzleFlash(e.x, e.y, '#ffb020');
    } else {
      sfxEnemyShot();
      muzzleFlash(e.x, e.y, '#ff8aa0');
    }
  }

  function weapons(e, dt) {
    if (e.dead || e.y < 8) return;
    if (e.kind === 'aa') {
      e.timer += dt;
      if (e.timer >= AA_INTERVAL) {
        e.timer -= AA_INTERVAL;
        const target = nearestAlly(e) || player;
        fireAa(e, target, true);
      }
      return;
    }
    if (e.kind === 'heli') {
      e.timer += dt;
      if (e.timer >= HELI_INTERVAL) {
        e.timer -= HELI_INTERVAL;
        fire(e, HELI_DMG, 240, 0, false);
      }
      return;
    }
    if (e.kind === 'plane' || e.kind === 'ground') {
      e.timer += dt;
      const interval = e.kind === 'ground' ? 2.4 : 2;
      if (e.timer >= interval) {
        e.timer -= interval;
        fire(e, 1, e.kind === 'ground' ? 220 : 205, 0, false);
      }
      return;
    }
    const spec = e.kind === 'baozi' ? BOSS.baozi : e.kind === 'smallBoss' ? BOSS.small : e.kind === 'bigBoss' ? BOSS.big : null;
    if (!spec) return;
    e.timer += dt;
    if (e.timer >= spec.shot) {
      e.timer -= spec.shot;
      const count = spec.shotCount;
      for (let i = 0; i < count; i++) {
        const spread = count === 1 ? 0 : (i - (count - 1) / 2) * spec.spread;
        fire(e, spec.shotDmg, spec.speed, spread, false);
      }
    }
    e.bombTimer += dt;
    if (e.bombTimer >= spec.bomb) {
      e.bombTimer -= spec.bomb;
      fire(e, spec.bombDmg, 125, 0, true);
    }
  }

  function hitRadius(e) {
    if (e.kind === 'drone') return { x: 16, y: 14 };
    if (e.kind === 'ground' || e.kind === 'aa') return { x: 30, y: 24 };
    const s = e.scale || 1;
    return { x: 22 * s, y: 22 * s };
  }

  function alive(kind) {
    return enemies.filter(e => e.kind === kind && !e.dead).length;
  }

  function moveCraft(e, dt) {
    e.flash = Math.max(0, e.flash - dt);
    if (e.kind === 'plane') {
      e.y += (e.speed + Math.min(elapsed * 0.25, 26)) * dt;
      e.x += Math.sin(elapsed * 1.3 + e.phase) * 23 * dt;
      e.x = Math.max(28, Math.min(W - 28, e.x));
      return;
    }
    if (e.friendly && (e.kind === 'wing' || e.kind === 'drone')) {
      const foe = nearestEnemy(e);
      const orbit = elapsed * (e.kind === 'drone' ? 1.7 : 1.15) + e.phase;
      const ring = e.kind === 'drone' ? 48 : 78;
      const tx = foe ? foe.x + Math.cos(orbit) * ring : e.homeX + Math.sin(orbit) * 170;
      const ty = foe ? Math.max(64, Math.min(H - 150, foe.y + (e.kind === 'drone' ? 70 : 96))) : e.homeY + Math.cos(orbit * 0.8) * 64;
      const dx = tx - e.x;
      const dy = ty - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const step = Math.min(dist, 200 * dt);
      e.x += dx / dist * step;
      e.y += dy / dist * step;
      e.x = Math.max(28, Math.min(W - 28, e.x));
      e.y = Math.max(48, Math.min(H - 80, e.y));
      return;
    }
    if (e.friendly && e.kind === 'ground') {
      const tx = e.homeX + Math.sin(elapsed * 0.8 + e.phase) * 100;
      const dx = tx - e.x;
      const dy = e.homeY - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const step = Math.min(dist, 90 * dt);
      e.x += dx / dist * step;
      e.y += dy / dist * step;
      e.x = Math.max(36, Math.min(W - 36, e.x));
      return;
    }
    if (e.kind === 'heli') {
      const tx = e.homeX + Math.sin(elapsed * 0.7 + e.phase) * 70;
      const ty = e.homeY + Math.cos(elapsed * 0.45 + e.phase) * 22;
      e.x += (tx - e.x) * Math.min(1, dt * 1.1);
      e.y += (ty - e.y) * Math.min(1, dt * 1.1);
      e.x = Math.max(36, Math.min(W - 36, e.x));
      if (e.friendly) e.y = Math.max(80, Math.min(BASE_LINE - 28, e.y));
      else e.y = Math.max(48, Math.min(BASE_LINE - 80, e.y));
      return;
    }
    if (e.kind === 'aa') {
      const tx = e.homeX + Math.sin(elapsed * 0.55 + e.phase) * (e.friendly ? 16 : 28);
      const dx = tx - e.x;
      const dy = e.homeY - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const step = Math.min(dist, 80 * dt);
      e.x += dx / dist * step;
      e.y += dy / dist * step;
      e.x = Math.max(36, Math.min(W - 36, e.x));
      if (e.friendly) e.y = Math.max(BASE_LINE + 8, Math.min(H - 24, e.y));
      else if (e.y < BASE_LINE - 6) e.y += 14 * dt;
      return;
    }
    const tx = e.homeX + Math.sin(elapsed * (e.kind === 'bigBoss' ? 0.7 : 0.9) + e.phase) * (e.kind === 'bigBoss' ? 120 : 70);
    const ty = e.homeY + Math.cos(elapsed * 0.55 + e.phase) * (e.kind === 'ground' ? 16 : 28);
    e.x += (tx - e.x) * Math.min(1, dt * (e.kind === 'ground' ? 0.85 : 1.15));
    e.y += (ty - e.y) * Math.min(1, dt * (e.kind === 'ground' ? 0.85 : 1.15));
    e.x = Math.max(36, Math.min(W - 36, e.x));
    if (!e.friendly && e.kind !== 'plane' && e.y < BASE_LINE - 6) {
      const sink = e.kind === 'bigBoss' ? 22 : e.kind === 'smallBoss' ? 26 : e.kind === 'baozi' ? 18 : 14;
      e.y += sink * dt;
    }
  }

  function spawnItem(type) {
    items.push({
      type,
      x: 80 + Math.random() * (W - 160),
      y: -18,
      phase: Math.random() * Math.PI * 2,
      taken: false,
    });
  }

  function inFlame(e) {
    const ahead = player.y - e.y;
    if (ahead < 6 || ahead > 210) return false;
    return Math.abs(e.x - player.x) < 16 + ahead * 0.36;
  }

  function scorchEnemies() {
    for (let i = 0; i < 5; i++) {
      const spread = (Math.random() - 0.5) * 70;
      particles.push({
        kind: 'flash',
        x: player.x + spread * 0.35,
        y: player.y - 30 - Math.random() * 150,
        vx: spread * 0.6,
        vy: -160 - Math.random() * 80,
        life: 0.16 + Math.random() * 0.12,
        max: 0.28,
        color: Math.random() < 0.35 ? '#fff6d2' : Math.random() < 0.5 ? '#ffb03a' : '#ff5a24',
        r: 4 + Math.random() * 7,
      });
    }
    for (const e of enemies) {
      if (e.dead || e.hp <= 0 || e.scorched === flameSerial || !inFlame(e)) continue;
      e.scorched = flameSerial;
      e.hp -= FLAME_DMG;
      e.flash = 0.14;
      boom(e.x, e.y, '#ffb03a', 0.8);
      sfxImpact();
      if (e.hp <= 0) destroyEnemy(e);
    }
  }

  function nearestEnemy(from) {
    let best = null;
    let bestD = Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = (e.x - from.x) ** 2 + (e.y - from.y) ** 2;
      if (d < bestD) { best = e; bestD = d; }
    }
    return best;
  }

  function fireFriendly(e, target, dmg, speed, spread, bomb) {
    const a = Math.atan2(target.y - e.y, target.x - e.x) + spread;
    const muzzle = (bomb ? 20 : 12) * (e.scale || 1);
    lasers.push({
      x: e.x + Math.cos(a) * muzzle,
      y: e.y + Math.sin(a) * muzzle,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      enemy: false,
      friendly: true,
      dmg,
      bomb: !!bomb,
      dead: false,
    });
    if (bomb) sfxWhoosh();
    else sfxFriendlyShot();
    muzzleFlash(e.x, e.y, bomb ? '#ffb020' : '#9ad7ff');
  }

  function summonDrones(count) {
    const start = allies.filter(a => a.kind === 'drone' && !a.dead).length;
    for (let i = 0; i < count; i++) {
      const n = start + i;
      const x = 180 + (n % 4) * 140;
      const y = 270;
      allies.push(makeCraft('drone', x, -24 - i * 16, {
        homeX: x,
        homeY: y,
        friendly: true,
        hp: DRONE_HP,
        maxHp: DRONE_HP,
        timer: 0.15 * i,
      }));
    }
  }

  function summonShips(count) {
    const start = allies.filter(a => a.kind === 'wing' && !a.dead).length;
    for (let i = 0; i < count; i++) {
      const n = start + i;
      const col = n % 5;
      const x = 120 + col * 140;
      const y = 210 + Math.floor(n / 5) * 64;
      allies.push(makeCraft('wing', x, -30 - i * 14, {
        homeX: x,
        homeY: y,
        friendly: true,
        scale: ALLY_SHIP_SCALE,
      }));
    }
  }

  function nearestAlly(from) {
    let best = null;
    let bestD = Infinity;
    const pool = player ? [{ x: player.x, y: player.y, dead: false }] : [];
    for (const a of allies) if (!a.dead) pool.push(a);
    for (const unit of pool) {
      const d = (unit.x - from.x) ** 2 + (unit.y - from.y) ** 2;
      if (d < bestD) { best = unit; bestD = d; }
    }
    return best;
  }

  function fireAa(from, target, enemy) {
    if (!target) return;
    const angle = Math.atan2(target.y - from.y, target.x - from.x);
    const speed = 460;
    lasers.push({
      x: from.x + Math.cos(angle) * 20,
      y: from.y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      enemy,
      friendly: !enemy,
      dmg: AA_DMG,
      aa: true,
      dead: false,
    });
    sfxWhoosh();
    muzzleFlash(from.x, from.y, enemy ? '#ffb15a' : '#d7ecff');
  }

  function summonAaTurrets(count) {
    const start = allies.filter(a => a.kind === 'aa' && !a.dead).length;
    for (let i = 0; i < count; i++) {
      const n = start + i;
      const x = 150 + (n % 4) * 160;
      const y = BASE_LINE + 38;
      allies.push(makeCraft('aa', x, H + 36, {
        homeX: x,
        homeY: y,
        friendly: true,
        timer: 0.3,
        hp: AA_HP,
        maxHp: AA_HP,
      }));
    }
  }

  function summonGroundTroops(count) {
    const start = allies.filter(a => a.friendly && a.kind === 'ground' && !a.dead).length;
    for (let i = 0; i < count; i++) {
      const n = start + i;
      const x = 110 + (n % 4) * 185;
      const y = 455;
      allies.push(makeCraft('ground', x, H + 28, {
        homeX: x,
        homeY: y,
        friendly: true,
        timer: 0,
      }));
    }
  }

  function fireMortar(from, target) {
    const flight = 0.85;
    const gravity = 520;
    lasers.push({
      x: from.x,
      y: from.y - 8,
      vx: (target.x - from.x) / flight,
      vy: (target.y - (from.y - 8)) / flight - 0.5 * gravity * flight,
      gravity,
      enemy: false,
      friendly: true,
      mortar: true,
      bomb: true,
      dmg: MORTAR_DMG,
      dead: false,
    });
    sfxWhoosh();
    muzzleFlash(from.x, from.y - 8, '#d7ecff');
  }

  function summonOwnBosses() {
    for (const spec of [
      { kind: 'smallBoss', x: 250, y: 230 },
      { kind: 'bigBoss', x: 530, y: 190 },
    ]) {
      const existing = allies.find(a => a.kind === spec.kind && !a.dead);
      if (existing) {
        existing.hp = existing.maxHp;
        continue;
      }
      allies.push(makeCraft(spec.kind, spec.x, -50, { homeX: spec.x, homeY: spec.y, friendly: true }));
    }
  }

  function collectItem(it) {
    if (it.taken) return;
    it.taken = true;
    collectedItems++;
    if (it.type === 'blue') {
      lightning = LIGHTNING_TIME;
      burst(it.x, it.y, '#79ddff', 18);
      tone(880, 0.16, 'square', 0.03);
    } else if (it.type === 'yellow') {
      summonShips(ALLY_SHIP_COUNT);
      summonGroundTroops(ALLY_GROUND_COUNT);
      summonDrones(DRONE_COUNT);
      summonAaTurrets(ALLY_AA_COUNT);
      burst(it.x, it.y, '#ffd15c', 18);
      tone(640, 0.18);
    } else if (it.type === 'green') {
      if (player) player.hp = Math.min(PLAYER_MAX, player.hp + HEAL_AMOUNT);
      burst(it.x, it.y, '#5dffa0', 16);
      tone(520, 0.16);
    } else if (it.type === 'pink') {
      auroraStock += PINK_AURORA;
      burst(it.x, it.y, '#ff8ad4', 16);
      tone(760, 0.14, 'square', 0.03);
    } else if (it.type === 'bomb') {
      bombStock += BOMB_ORB;
      burst(it.x, it.y, '#ff4db8', 22);
      tone(720, 0.16, 'square', 0.03);
    } else if (it.type === 'white') {
      flame = FLAME_TIME;
      flameSerial++;
      burst(it.x, it.y, '#fff6e8', 16);
      burst(it.x, it.y, '#ff9a3c', 10);
      tone(420, 0.2, 'sawtooth', 0.04);
      noiseBurst(0.18, 900, 0.06);
    } else if (it.type === 'black') {
      baseHp = Math.min(BASE_MAX, baseHp + BASE_HEAL);
      burst(it.x, it.y, '#e8e8e8', 18);
      tone(360, 0.16, 'square', 0.03);
    } else if (it.type === 'red') {
      summonOwnBosses();
      burst(it.x, it.y, '#ff5c7e', 22);
      tone(180, 0.22, 'sawtooth', 0.04);
    }
    syncHUD();
  }

  function fireAurora() {
    if (mode !== 'playing' || !player || auroraStock <= 0) return;
    auroraStock--;
    const target = nearestEnemy(player);
    const angle = target ? Math.atan2(target.y - (player.y - 30), target.x - player.x) : -Math.PI / 2;
    lasers.push({
      x: player.x,
      y: player.y - 30,
      vx: Math.cos(angle) * 460,
      vy: Math.sin(angle) * 460,
      enemy: false,
      dmg: AURORA_DMG,
      aurora: true,
      homing: true,
      target,
      age: 0,
      dead: false,
    });
    muzzleFlash(player.x, player.y - 30, '#7dffc4');
    tone(680, 0.09, 'sawtooth', 0.028);
    noiseBurst(0.07, 1600, 0.045);
    syncHUD();
  }

  function throwBomb() {
    if (mode !== 'playing' || !player || bombStock <= 0) return;
    bombStock--;
    const target = nearestEnemy(player);
    const angle = target ? Math.atan2(target.y - (player.y - 18), target.x - player.x) : -Math.PI / 2;
    lasers.push({
      x: player.x,
      y: player.y - 18,
      vx: Math.cos(angle) * 270,
      vy: Math.sin(angle) * 270,
      enemy: false,
      bomb: true,
      homing: true,
      dmg: PLAYER_BOMB_DMG,
      target,
      age: 0,
      dead: false,
    });
    sfxWhoosh();
    muzzleFlash(player.x, player.y - 18, '#ffb020');
    syncHUD();
  }

  function hurtAlly(a, amount) {
    if (a.dead) return;
    a.hp -= amount;
    a.flash = 0.1;
    if (a.hp <= 0) {
      a.dead = true;
      a.hp = 0;
      boom(a.x, a.y, '#8ecbff', a.kind === 'bigBoss' ? 1.8 : 0.9);
      sfxExplosion(a.kind === 'bigBoss' || a.kind === 'smallBoss');
    }
  }

  function allyWeapons(a, dt) {
    const target = nearestEnemy(a);
    if (!target || a.y < 8) return;
    if (a.kind === 'aa') {
      a.timer += dt;
      if (a.timer >= AA_INTERVAL) {
        a.timer -= AA_INTERVAL;
        fireAa(a, target, false);
      }
      return;
    }
    if (a.kind === 'ground') {
      a.timer += dt;
      if (a.timer >= MORTAR_INTERVAL) {
        a.timer -= MORTAR_INTERVAL;
        fireMortar(a, target);
      }
      return;
    }
    if (a.kind === 'heli') {
      a.timer += dt;
      if (a.timer >= HELI_INTERVAL) {
        a.timer -= HELI_INTERVAL;
        fireFriendly(a, target, HELI_DMG, 240, 0, false);
      }
      return;
    }
    if (a.kind === 'drone') {
      a.timer += dt;
      if (a.timer >= DRONE_INTERVAL) {
        a.timer = 0;
        fireFriendly(a, target, DRONE_DMG, 420, 0, false);
      }
      return;
    }
    if (a.kind === 'wing') {
      a.timer += dt;
      if (a.timer >= 0.45) {
        a.timer = 0;
        fireFriendly(a, target, 1, 380, 0, false);
      }
      return;
    }
    const spec = a.kind === 'smallBoss' ? BOSS.small : a.kind === 'bigBoss' ? BOSS.big : null;
    if (!spec) return;
    a.timer += dt;
    if (a.timer >= spec.shot) {
      a.timer -= spec.shot;
      for (let i = 0; i < spec.shotCount; i++) {
        const spread = spec.shotCount === 1 ? 0 : (i - (spec.shotCount - 1) / 2) * spec.spread;
        fireFriendly(a, target, spec.shotDmg, spec.speed, spread, false);
      }
    }
    a.bombTimer += dt;
    if (a.bombTimer >= spec.bomb) {
      a.bombTimer -= spec.bomb;
      fireFriendly(a, target, spec.bombDmg, 140, 0, true);
    }
  }

  function quotaMet() {
    const lv = LEVELS[levelIndex];
    if (killedPlanes < (lv.planes || 0)) return false;
    if (baoziKilled < (lv.baozi || 0)) return false;
    if (smallBossKilled < (lv.small || 0)) return false;
    if (bigBossKilled < (lv.big || 0)) return false;
    return true;
  }

  function update(dt) {
    elapsed += dt;
    hitFlash = Math.max(0, hitFlash - dt);
    baseFlash = Math.max(0, baseFlash - dt);
    shake = Math.max(0, shake - dt * 36);
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) $('level-banner').classList.remove('show');
    }

    let mx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    let my = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    const usingKeys = mx !== 0 || my !== 0;
    if (dragging && gesture?.moved && moveTarget) {
      player.x = moveTarget.x;
      player.y = moveTarget.y;
    } else if (usingKeys) {
      const len = Math.hypot(mx, my) || 1;
      player.x += mx / len * 300 * dt;
      player.y += my / len * 300 * dt;
    } else if (shipSelected && moveTarget) {
      const dx = moveTarget.x - player.x;
      const dy = moveTarget.y - player.y;
      const d = Math.hypot(dx, dy);
      const step = Math.min(d, 520 * dt);
      if (d > 3) {
        player.x += dx / d * step;
        player.y += dy / d * step;
      }
    }
    player.x = Math.max(24, Math.min(W - 24, player.x));
    player.y = Math.max(40, Math.min(H - 38, player.y));

    if (lightning > 0) {
      lightning = Math.max(0, lightning - dt);
      $('lightning').textContent = lightning > 0 ? `${lightning.toFixed(1)}s` : '—';
    }
    if (flame > 0) {
      flame = Math.max(0, flame - dt);
      $('flame').textContent = flame > 0 ? `${flame.toFixed(1)}s` : '—';
      scorchEnemies();
    }

    fireClock += dt;
    if (fireClock >= 0.16) {
      fireClock %= 0.16;
      const bolt = lightning > 0;
      lasers.push({
        x: player.x,
        y: player.y - 28,
        vx: 0,
        vy: -610,
        enemy: false,
        dmg: bolt ? LIGHTNING_DMG : 1,
        lightning: bolt,
        playerShot: !bolt,
        dead: false,
      });
      muzzleFlash(player.x, player.y - 28, bolt ? '#e9f8ff' : '#9af6ff');
      if (!bolt) {
        particles.push({ kind: 'ring', x: player.x, y: player.y - 28, vx: 0, vy: 0, life: 0.12, max: 0.12, color: '#bffbff', r: 2, grow: 46 });
      } else {
        particles.push({ kind: 'ring', x: player.x, y: player.y - 28, vx: 0, vy: 0, life: 0.16, max: 0.16, color: '#d7f6ff', r: 3, grow: 70 });
        particles.push({ kind: 'spark', x: player.x, y: player.y - 36, vx: (Math.random() - 0.5) * 40, vy: -80, life: 0.12, max: 0.12, color: '#ffffff', w: 1.6 });
      }
      if (bolt) tone(980, 0.05, 'square', 0.016);
      else sfxPlayerShot();
    }

    const lv = LEVELS[levelIndex];
    spawnClock += dt;
    const cap = (lv.planes || 0) <= 9 ? (lv.planes || 0) : 6;
    if (lv.planes && spawnedPlanes < lv.planes && alive('plane') < cap && spawnClock >= 0.72) {
      spawnClock = 0;
      spawnPlane();
      spawnedPlanes++;
    }

    itemClock += dt;
    const itemGap = levelIndex === LEVELS.length - 1 ? 2.1 : 3.2;
    if (spawnedItems < itemPlanNow.length && itemClock >= itemGap) {
      itemClock = 0;
      spawnItem(itemPlanNow[spawnedItems]);
      spawnedItems++;
    }
    for (const it of items) {
      if (it.taken) continue;
      it.y += 46 * dt;
      it.x += Math.sin(elapsed * 1.8 + it.phase) * 22 * dt;
      it.x = Math.max(30, Math.min(W - 30, it.x));
      if (it.y > H + 20) it.y = -16;
      if (Math.hypot(it.x - player.x, it.y - player.y) < 34) collectItem(it);
    }
    items = items.filter(it => !it.taken);

    for (const e of enemies) {
      if (e.dead) continue;
      moveCraft(e, dt);
      weapons(e, dt);
    }
    for (const a of allies) {
      if (a.dead) continue;
      moveCraft(a, dt);
      allyWeapons(a, dt);
    }

    for (const b of lasers) {
      if (b.mortar && !b.dead) b.vy += (b.gravity || 520) * dt;
      if (b.homing && !b.dead) {
        b.age = (b.age || 0) + dt;
        if (b.age > 8) {
          b.dead = true;
          continue;
        }
        if (!b.target || b.target.dead || b.target.hp <= 0) b.target = nearestEnemy(b);
        if (b.target) {
          const angle = Math.atan2(b.target.y - b.y, b.target.x - b.x);
          const speed = b.aurora ? 460 : 270;
          b.vx = Math.cos(angle) * speed;
          b.vy = Math.sin(angle) * speed;
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.playerShot && !b.dead && Math.random() < 0.45) {
        const len = Math.hypot(b.vx, b.vy) || 1;
        particles.push({
          kind: 'spark',
          x: b.x - b.vx / len * (4 + Math.random() * 8),
          y: b.y - b.vy / len * (4 + Math.random() * 8),
          vx: (Math.random() - 0.5) * 16,
          vy: 8 + Math.random() * 12,
          life: 0.1 + Math.random() * 0.08,
          max: 0.18,
          color: Math.random() < 0.5 ? '#9af6ff' : '#d7c6ff',
          w: 1.3,
        });
      }
      if (b.bomb && !b.mortar && !b.dead && Math.random() < 0.55) {
        particles.push({
          kind: 'spark',
          x: b.x + 5,
          y: b.y - 26,
          vx: (Math.random() - 0.5) * 18,
          vy: -24 - Math.random() * 36,
          life: 0.16 + Math.random() * 0.1,
          max: 0.26,
          color: Math.random() < 0.45 ? '#fff2c4' : '#ff7a22',
          w: 2.2,
        });
      }
      if (b.dead || mode !== 'playing') continue;
      if (b.enemy) {
        const rx = b.bomb ? 28 : 17;
        const ry = b.bomb ? 28 : 22;
        if (Math.abs(b.x - player.x) < rx && Math.abs(b.y - player.y) < ry) {
          b.dead = true;
          damage(b.dmg || 1);
          if (mode !== 'playing') break;
          continue;
        }
        for (const a of allies) {
          if (a.dead) continue;
          const r = hitRadius(a);
          const ax = b.bomb ? Math.max(r.x, 26) : r.x;
          const ay = b.bomb ? Math.max(r.y, 26) : r.y;
          if (Math.abs(b.x - a.x) < ax && Math.abs(b.y - a.y) < ay) {
            b.dead = true;
            hurtAlly(a, a.kind === 'drone' ? DRONE_DMG : (b.dmg || 1));
            break;
          }
        }
      } else {
        for (const e of enemies) {
          if (e.dead || e.hp <= 0) continue;
          const r = hitRadius(e);
          const ex = b.bomb ? Math.max(r.x, 26) : r.x;
          const ey = b.bomb ? Math.max(r.y, 26) : r.y;
          if (Math.abs(b.x - e.x) < ex && Math.abs(b.y - e.y) < ey) {
            b.dead = true;
            e.hp -= b.dmg || 1;
            e.flash = 0.09;
            const hitColor = b.aurora ? '#7dffc4' : b.lightning ? '#d7f4ff' : b.bomb ? '#ffb020' : e.kind === 'baozi' ? '#ffe38a' : '#f48196';
            if (b.bomb) {
              boom(b.x, b.y, hitColor, 1.5);
              sfxExplosion(false);
            } else if (b.aa) {
              boom(b.x, b.y, '#9ad7ff', 0.9);
              sfxImpact();
            } else if (b.aurora) {
              boom(b.x, b.y, '#7dffc4', 1.05);
              burst(b.x, b.y, '#b388ff', 10);
              sfxImpact();
            } else {
              burst(b.x, b.y, hitColor, b.lightning ? 10 : 6);
              muzzleFlash(b.x, b.y, hitColor);
              sfxImpact();
            }
            if (e.hp <= 0) destroyEnemy(e);
            break;
          }
        }
      }
    }

    watchBase();

    allies = allies.filter(a => !a.dead && a.hp > 0);
    enemies = enemies.filter(e => {
      if (e.dead || e.hp <= 0) return false;
      if (e.kind === 'plane' && e.y > H + 50) {
        spawnedPlanes = Math.max(killedPlanes, spawnedPlanes - 1);
        return false;
      }
      return true;
    });
    lasers = lasers.filter(b => {
      if (b.dead) return false;
      if (b.homing) return true;
      if (b.mortar) return b.y < H + 80 && b.x > -80 && b.x < W + 80;
      return b.y > -50 && b.y < H + 50 && b.x > -50 && b.x < W + 50;
    });
    $('time').textContent = $('arena-time').textContent = formatTime(elapsed);
    if (mode === 'playing' && quotaMet()) levelClear();
  }

  function ship(x, y, pal, flash, scale, faceDown, hero) {
    ctx.save();
    ctx.translate(x, y);
    if (faceDown) ctx.rotate(Math.PI);
    ctx.scale(scale, scale);
    if (hero) {
      ctx.globalAlpha = 0.28 + Math.sin(elapsed * 6) * 0.06;
      ctx.fillStyle = pal.glow;
      ctx.beginPath();
      ctx.ellipse(0, 6, 40, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = hero ? 26 : 20;
    const flame = 11 + Math.random() * 13;
    const g = ctx.createLinearGradient(0, 17, 0, 35 + flame);
    g.addColorStop(0, pal.flame);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-6, 17);
    ctx.lineTo(0, 35 + flame);
    ctx.lineTo(6, 17);
    ctx.fill();
    ctx.fillStyle = flash ? '#fff' : pal.body;
    ctx.strokeStyle = pal.edge;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -29);
    ctx.lineTo(11, -3);
    ctx.lineTo(27, 18);
    ctx.lineTo(8, 12);
    ctx.lineTo(0, 22);
    ctx.lineTo(-8, 12);
    ctx.lineTo(-27, 18);
    ctx.lineTo(-11, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 5;
    ctx.fillStyle = pal.core;
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, 7);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.wing;
    ctx.lineWidth = hero ? 2.2 : 1.6;
    ctx.shadowBlur = hero ? 14 : 8;
    ctx.beginPath();
    ctx.moveTo(-17, 9);
    ctx.lineTo(-10, 5);
    ctx.moveTo(17, 9);
    ctx.lineTo(10, 5);
    ctx.stroke();
    ctx.fillStyle = flash ? '#fff' : pal.edge;
    ctx.shadowBlur = 10;
    for (const tip of [-27, 27]) {
      ctx.beginPath();
      ctx.arc(tip, 18, hero ? 2.4 : 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (hero) {
      const flick = Math.sin(elapsed * 36) * 5;
      const eg = ctx.createLinearGradient(0, 16, 0, 62 + flick);
      eg.addColorStop(0, '#ffffff');
      eg.addColorStop(0.22, '#b9f4ff');
      eg.addColorStop(0.55, pal.flame);
      eg.addColorStop(1, 'transparent');
      ctx.fillStyle = eg;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(-5, 16);
      ctx.lineTo(0, 58 + flick);
      ctx.lineTo(5, 16);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, -24, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGround(e, friendly = false) {
    ctx.save();
    ctx.translate(e.x, e.y);
    if (friendly) ctx.rotate(Math.PI);
    const flash = e.flash > 0;
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 24, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#fff' : friendly ? '#143a66' : '#3a4624';
    ctx.fillRect(-22, -16, 9, 34);
    ctx.fillRect(13, -16, 9, 34);
    ctx.fillStyle = flash ? '#fff' : friendly ? '#2f7de0' : '#7f8c46';
    ctx.strokeStyle = friendly ? '#9ad7ff' : '#e6d48a';
    ctx.lineWidth = 1.4;
    ctx.fillRect(-15, -14, 30, 28);
    ctx.strokeRect(-15, -14, 30, 28);
    ctx.fillStyle = flash ? '#fff' : friendly ? '#8ec8ff' : '#5d6b30';
    ctx.beginPath();
    ctx.arc(0, -1, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = friendly ? '#e7f6ff' : '#f3e7a6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.lineTo(0, 20);
    ctx.stroke();
    ctx.restore();
  }

  function drawHp(e) {
    if (e.maxHp <= 5) {
      const color = e.friendly ? '#8ecbff' : e.kind === 'aa' ? '#ffb15a' : e.kind === 'ground' ? '#e2c86a' : '#f27088';
      const gap = e.maxHp > 4 ? 12 : e.maxHp > 3 ? 14 : 12;
      const pipW = e.maxHp > 4 ? 9 : e.maxHp > 3 ? 11 : 8;
      const pipH = e.maxHp > 3 ? 5 : 4;
      const total = e.maxHp * gap - (gap - pipW);
      const start = e.x - total / 2;
      for (let i = 0; i < e.maxHp; i++) {
        ctx.fillStyle = i < e.hp ? color : '#2c2433';
        ctx.fillRect(start + i * gap, e.y - 38, pipW, pipH);
      }
      return;
    }
    const w = 34 * (e.scale || 1);
    const y = e.y - 30 * (e.scale || 1) - 8;
    ctx.fillStyle = '#241821';
    ctx.fillRect(e.x - w / 2, y, w, 4);
    ctx.fillStyle = e.friendly ? '#7ec8ff' : e.kind === 'baozi' ? '#ffd15c' : e.kind === 'aa' ? '#ffb15a' : e.kind === 'smallBoss' ? '#ff8a4a' : '#ff4d6d';
    ctx.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp) / e.maxHp, 4);
  }

  function drawItem(it) {
    const look = {
      blue: ['#49b7ff', '#e7f7ff', '雷电'],
      yellow: ['#ffd15c', '#fff6cc', '部队'],
      green: ['#3ddc7a', '#e9ffe8', '回血'],
      red: ['#ff5a78', '#ffe0e6', 'Boss'],
      bomb: ['#ff4d9a', '#fff0f8', '炸弹'],
      pink: ['#ff6eb4', '#ffe4f4', '极光'],
      white: ['#f7fbff', '#fff4e4', '火焰'],
      black: ['#161616', '#d5d5d5', '基地'],
    }[it.type] || ['#ff5a78', '#ffe0e6', 'Boss'];
    const [color, core, label] = look;
    const pulse = 0.84 + Math.sin(elapsed * 5 + (it.phase || 0)) * 0.16;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = (it.type === 'bomb' ? 28 : 18) * pulse;
    if (it.type === 'bomb') {
      ctx.globalAlpha = 0.32 * pulse;
      ctx.fillStyle = '#ff7ad4';
      ctx.beginPath();
      ctx.arc(it.x, it.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = '#ff4db8';
      ctx.beginPath();
      ctx.arc(it.x, it.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    const radius = it.type === 'white' || it.type === 'black' ? 8 : it.type === 'pink' ? 9 : 13;
    ctx.arc(it.x, it.y, radius, 0, Math.PI * 2);
    ctx.fill();
    if (it.type === 'black') {
      ctx.strokeStyle = '#f2f2f2';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    if (it.type === 'bomb') {
      ctx.fillStyle = '#fff7fc';
      ctx.beginPath();
      ctx.arc(it.x, it.y, 5.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(it.x - 3, it.y - 3, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.font = '12px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = it.type === 'black' ? '#f4f7ff' : it.type === 'bomb' ? '#ffe6f6' : color;
    ctx.fillText(label, it.x, it.y - (it.type === 'bomb' ? 28 : 18));
    ctx.restore();
  }

  function drawAa(e, friendly) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const target = friendly ? nearestEnemy(e) : nearestAlly(e);
    const aim = target ? Math.atan2(target.y - e.y, target.x - e.x) : (friendly ? -Math.PI / 2 : Math.PI / 2);
    const flash = e.flash > 0;
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath();
    ctx.ellipse(0, 16, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#fff' : friendly ? '#143e74' : '#642833';
    ctx.strokeStyle = friendly ? '#b7e4ff' : '#ffc1c8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-20, 10);
    ctx.lineTo(-13, -8);
    ctx.lineTo(13, -8);
    ctx.lineTo(20, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.rotate(aim);
    ctx.fillStyle = flash ? '#fff' : friendly ? '#e7f4ff' : '#ffd7b0';
    ctx.fillRect(6, -3.2, 28, 6.4);
    ctx.fillStyle = friendly ? '#7ec8ff' : '#ff5d6e';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawHeli(e, friendly) {
    const flash = e.flash > 0;
    const body = flash ? '#ffffff' : friendly ? '#166dd4' : '#a92c4b';
    const edge = friendly ? '#7bcaff' : '#ff8ca0';
    const glass = friendly ? '#b8efff' : '#ffccd4';
    ctx.save();
    ctx.translate(e.x, e.y);
    if (!friendly) ctx.rotate(Math.PI);
    ctx.shadowColor = edge;
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(0, 26);
    ctx.stroke();
    ctx.save();
    ctx.translate(0, 26);
    ctx.rotate(elapsed * 22);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(7, 0);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = body;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, -2, 10, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.ellipse(0, -12, 5.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-12, -8);
    ctx.lineTo(-12, 8);
    ctx.moveTo(12, -8);
    ctx.lineTo(12, 8);
    ctx.stroke();
    ctx.save();
    ctx.translate(0, -2);
    ctx.rotate(elapsed * 16);
    ctx.strokeStyle = friendly ? '#e7f6ff' : '#ffe4ea';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-24, 0);
    ctx.lineTo(24, 0);
    ctx.moveTo(0, -24);
    ctx.lineTo(0, 24);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  function drawDrone(e) {
    const flash = e.flash > 0;
    const body = flash ? '#ffffff' : '#e2b423';
    const edge = '#ffe38a';
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.shadowColor = '#ffe38a';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.lineTo(14, 8);
    ctx.moveTo(14, -8);
    ctx.lineTo(-14, 8);
    ctx.stroke();
    for (const [rx, ry] of [[-14, -8], [14, -8], [-14, 8], [14, 8]]) {
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(elapsed * 22 + rx);
      ctx.strokeStyle = '#fff6cc';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = body;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = flash ? '#ffffff' : '#b8efff';
    ctx.beginPath();
    ctx.arc(0, -3, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawAllyTag(a) {
    if (a.kind === 'wing') return;
    const text = a.kind === 'heli' ? '我方直升机' : a.kind === 'drone' ? '无人机' : a.kind === 'aa' ? '我方防空' : a.kind === 'ground' ? '我方地面' : a.kind === 'smallBoss' ? '我方小Boss' : a.kind === 'bigBoss' ? '我方大Boss' : '我方';
    ctx.save();
    ctx.font = '12px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c7ebff';
    const y = a.y - (a.maxHp > 5 ? 30 * (a.scale || 1) + 18 : a.maxHp > 4 ? 54 : 46);
    ctx.fillText(text, a.x, y);
    ctx.restore();
  }

  function drawTag(e) {
    const text = { ground: '地面', aa: '防空', heli: '直升机', baozi: '极速飞机', smallBoss: '小Boss', bigBoss: '大Boss' }[e.kind];
    if (!text) return;
    ctx.save();
    ctx.font = '12px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = e.kind === 'baozi' ? '#ffe38a' : e.kind === 'aa' ? '#ffd0a4' : e.kind === 'ground' ? '#e6d48a' : '#ffd0d6';
    const y = e.y - (e.maxHp > 4 ? 30 * (e.scale || 1) + 18 : 48);
    ctx.fillText(text, e.x, y);
    ctx.restore();
  }

  function drawRoundBomb(b) {
    const flicker = 0.82 + Math.sin(elapsed * 32 + b.x * 0.2) * 0.18;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = '#141414';
    ctx.strokeStyle = '#3c3c3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 3, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5a5a5a';
    ctx.beginPath();
    ctx.arc(-4, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6a45';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(1, -8);
    ctx.quadraticCurveTo(10, -16, 5, -24);
    ctx.stroke();
    const fx = 5;
    const fy = -26;
    ctx.shadowColor = '#ff9a2a';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffb020';
    ctx.beginPath();
    ctx.ellipse(fx, fy, 5.2 * flicker, 8 * flicker, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff5a12';
    ctx.beginPath();
    ctx.ellipse(fx, fy + 1.5, 2.8 * flicker, 4.6 * flicker, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff2c4';
    ctx.beginPath();
    ctx.arc(fx, fy + 2, 1.5 * flicker, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCoolBolt(b) {
    const len = Math.hypot(b.vx, b.vy) || 1;
    const ux = b.vx / len;
    const uy = b.vy / len;
    const px = -uy;
    const py = ux;
    const tail = 24;
    const tx = b.x - ux * tail;
    const ty = b.y - uy * tail;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#35f0ff';
    ctx.shadowColor = '#35f0ff';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#c9b6ff';
    ctx.shadowColor = '#b388ff';
    ctx.lineWidth = 1.1;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const wave = Math.sin(elapsed * 30 + t * 12) * 2.2;
      const x = b.x - ux * tail * t + px * wave;
      const y = b.y - uy * tail * t + py * wave;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = '#7ef6ff';
    ctx.shadowColor = '#7ef6ff';
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const wave = Math.sin(elapsed * 30 + t * 12 + Math.PI) * 2.2;
      const x = b.x - ux * tail * t + px * wave;
      const y = b.y - uy * tail * t + py * wave;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = '#e9ffff';
    ctx.shadowBlur = 4;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    const pulse = 1.6 + Math.sin(elapsed * 24) * 0.4;
    ctx.strokeStyle = '#bffbff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, pulse + 1.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x - 3, b.y);
    ctx.lineTo(b.x + 3, b.y);
    ctx.moveTo(b.x, b.y - 3);
    ctx.lineTo(b.x, b.y + 3);
    ctx.stroke();
    ctx.restore();
  }

  function drawAurora(b) {
    const len = Math.hypot(b.vx, b.vy) || 1;
    const ux = b.vx / len;
    const uy = b.vy / len;
    const px = -uy;
    const py = ux;
    const length = 34;
    ctx.save();
    const sheets = [
      ['#6a3dff', 0.4, -6],
      ['#39f5a2', 0.46, -1],
      ['#7af7ff', 0.42, 3],
    ];
    for (const [color, alpha, shift] of sheets) {
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const wave = Math.sin(elapsed * 3 + t * 8 + shift) * 2.4;
        const x = b.x - ux * length * t + px * (shift + wave);
        const y = b.y - uy * length * t + py * (shift + wave);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let i = 8; i >= 0; i--) {
        const t = i / 8;
        const wave = Math.sin(elapsed * 3 + t * 8 + shift) * 2.4;
        const x = b.x - ux * length * t + px * (shift + wave + 4);
        const y = b.y - uy * length * t + py * (shift + wave + 4);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#f7fff8';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, 3.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawLightning(b) {
    const tail = 16;
    const reach = 36;
    const forks = [
      { amp: 5.5, step: 8.6, color: '#f4fdff', width: 1.6, alpha: 1, phase: 0 },
      { amp: 8, step: 7.4, color: '#7ecbff', width: 0.9, alpha: 0.75, phase: 1.8 },
    ];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#8ad7ff';
    ctx.shadowBlur = 12;
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = '#49d7ff';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + tail);
    ctx.lineTo(b.x, b.y - reach);
    ctx.stroke();
    for (const fork of forks) {
      ctx.globalAlpha = fork.alpha;
      ctx.strokeStyle = fork.color;
      ctx.lineWidth = fork.width;
      ctx.beginPath();
      let x = b.x;
      let y = b.y + tail;
      ctx.moveTo(x, y);
      for (let i = 0; i < 6; i++) {
        const dir = i % 2 === 0 ? -1 : 1;
        const jag = dir * fork.amp * (0.45 + 0.55 * Math.abs(Math.sin(elapsed * 42 + i + fork.phase)));
        x = b.x + jag;
        y -= fork.step;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(b.x, b.y - reach, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawLaser(b) {
    if (b.lightning) {
      drawLightning(b);
      return;
    }
    if (b.aa) {
      const ang = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(ang);
      ctx.shadowColor = b.enemy ? '#ff5a3c' : '#3d7dff';
      ctx.shadowBlur = 12;
      ctx.fillStyle = b.enemy ? '#ffb15a' : '#f4fbff';
      ctx.strokeStyle = b.enemy ? '#ff5a3c' : '#3d7dff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(-1, 0, 10, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = b.enemy ? '#fff3c4' : '#ffffff';
      ctx.beginPath();
      ctx.arc(7, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    if (b.mortar) {
      ctx.save();
      ctx.shadowColor = '#9ad7ff';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#d7ecff';
      ctx.strokeStyle = '#3d7dff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (b.bomb) {
      drawRoundBomb(b);
      return;
    }
    if (b.aurora) {
      drawAurora(b);
      return;
    }
    if (b.playerShot) {
      drawCoolBolt(b);
      return;
    }
    const heavy = (b.dmg || 1) >= 3;
    const mid = (b.dmg || 1) === 2;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = !b.enemy ? '#79ddff' : heavy ? '#ff3b3b' : mid ? '#ffd15c' : '#ff5c7e';
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 13;
    ctx.lineWidth = !b.enemy ? 3.5 : heavy ? 5 : mid ? 4 : 3;
    const len = Math.hypot(b.vx, b.vy) || 1;
    const tail = b.enemy && (b.dmg || 1) > 1 ? 18 : 15;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx / len * tail, b.y - b.vy / len * tail);
    ctx.stroke();
    ctx.restore();
  }

  function drawFlame() {
    ctx.save();
    ctx.translate(player.x, player.y - 24);
    const flick = Math.sin(elapsed * 28) * 10;
    const grad = ctx.createLinearGradient(0, 0, 0, -196);
    grad.addColorStop(0, 'rgba(255,250,230,0.95)');
    grad.addColorStop(0.18, 'rgba(255,186,60,0.82)');
    grad.addColorStop(0.5, 'rgba(255,78,24,0.42)');
    grad.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.quadraticCurveTo(-82 - flick, -96, -8, -190);
    ctx.quadraticCurveTo(0, -208, 8, -190);
    ctx.quadraticCurveTo(82 + flick, -84, 12, 0);
    ctx.fill();
    ctx.restore();
  }

  function viewButtonRect() {
    if (!player) return null;
    if (firstPerson) return { x: W - 156, y: H - 50, w: 140, h: 34 };
    const w = 96;
    const h = 32;
    const wingTip = 27;
    let x = player.x + wingTip + 46;
    let y = player.y - h / 2;
    x = Math.min(W - 8 - w, Math.max(8, x));
    y = Math.max(8, Math.min(H - h - 8, y));
    return { x, y, w, h };
  }

  function hitViewButton(p) {
    const r = viewButtonRect();
    if (!r) return false;
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  function drawViewButton() {
    if (!player || mode === 'ready' || mode === 'over' || mode === 'victory' || mode === 'levelclear') return;
    const r = viewButtonRect();
    if (!r) return;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 20, 40, 0.92)';
    ctx.strokeStyle = '#9fd4ff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.fill();
    ctx.stroke();
    ctx.font = '14px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e7f6ff';
    ctx.fillText(firstPerson ? '退出第一视角' : '第一视角', r.x + r.w / 2, r.y + r.h / 2 + 0.5);
    ctx.restore();
  }

  const FP_HORIZON = 250;

  function projectWorld(wx, wy) {
    const depth = player.y - wy;
    const lateral = wx - player.x;
    const persp = 220 / (Math.max(16, depth) + 90);
    return {
      x: W / 2 + lateral * persp * 1.15,
      y: FP_HORIZON + persp * 150,
      scale: Math.max(0.28, Math.min(1.7, persp * 0.95)),
      depth,
    };
  }

  function withProjected(entity, drawFn) {
    const p = projectWorld(entity.x, entity.y);
    if (p.depth < -20 || p.depth > 1500) return;
    if (p.y > H - 120) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.scale, p.scale);
    ctx.translate(-entity.x, -entity.y);
    drawFn();
    ctx.restore();
  }

  function paintEnemyWorld(e) {
    if (e.kind === 'bigBoss') {
      ctx.save();
      ctx.fillStyle = '#ff335522';
      ctx.beginPath();
      ctx.arc(e.x, e.y, 58, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (e.kind === 'ground') drawGround(e);
    else if (e.kind === 'aa') drawAa(e, false);
    else if (e.kind === 'heli') drawHeli(e, false);
    else if (e.kind === 'baozi') ship(e.x, e.y, PAL.baozi, e.flash, e.scale, true);
    else if (e.kind === 'smallBoss') ship(e.x, e.y, PAL.small, e.flash, e.scale, true);
    else ship(e.x, e.y, PAL.red, e.flash, e.scale || 1, true);
    drawHp(e);
    drawTag(e);
  }

  function paintAllyWorld(a) {
    if (a.kind === 'bigBoss') {
      ctx.save();
      ctx.fillStyle = '#49b7ff22';
      ctx.beginPath();
      ctx.arc(a.x, a.y, 58, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (a.kind === 'ground') drawGround(a, true);
    else if (a.kind === 'aa') drawAa(a, true);
    else if (a.kind === 'heli') drawHeli(a, true);
    else if (a.kind === 'drone') drawDrone(a);
    else if (a.kind === 'smallBoss') ship(a.x, a.y, PAL.player, a.flash, a.scale, false);
    else if (a.kind === 'bigBoss') ship(a.x, a.y, PAL.player, a.flash, a.scale, false);
    else if (a.kind === 'wing') ship(a.x, a.y, PAL.yellowShip, a.flash, a.scale || ALLY_SHIP_SCALE, false);
    else ship(a.x, a.y, PAL.player, a.flash, a.scale || 0.82, false);
    drawHp(a);
    drawAllyTag(a);
  }

  function drawFirstPerson() {
    const marks = [];
    for (const e of enemies) {
      if (!e.dead) marks.push({ depth: player.y - e.y, draw: () => withProjected(e, () => paintEnemyWorld(e)) });
    }
    for (const a of allies) {
      if (!a.dead) marks.push({ depth: player.y - a.y, draw: () => withProjected(a, () => paintAllyWorld(a)) });
    }
    for (const it of items) marks.push({ depth: player.y - it.y, draw: () => withProjected(it, () => drawItem(it)) });
    for (const b of lasers) marks.push({ depth: player.y - b.y, draw: () => withProjected(b, () => drawLaser(b)) });
    marks.sort((a, b) => b.depth - a.depth);
    for (const m of marks) m.draw();

    if (flame > 0) {
      ctx.save();
      ctx.translate(W / 2, H - 168);
      const flick = Math.sin(elapsed * 28) * 12;
      const grad = ctx.createLinearGradient(0, 20, 0, -220);
      grad.addColorStop(0, 'rgba(255,250,230,0.95)');
      grad.addColorStop(0.25, 'rgba(255,186,60,0.75)');
      grad.addColorStop(0.6, 'rgba(255,78,24,0.28)');
      grad.addColorStop(1, 'rgba(255,40,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-16, 18);
      ctx.quadraticCurveTo(-90 - flick, -80, -8, -190);
      ctx.quadraticCurveTo(0, -210, 8, -190);
      ctx.quadraticCurveTo(90 + flick, -70, 16, 18);
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = 'rgba(90, 170, 255, 0.18)';
    ctx.beginPath();
    ctx.ellipse(W / 2, H - 108, 54, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ship(W / 2, H - 108, PAL.player, hitFlash, 1.65, false, true);
  }

  function draw(dt) {
    const jx = shake > 0.2 ? (Math.random() - 0.5) * shake : 0;
    const jy = shake > 0.2 ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, jx * canvas.width / W, jy * canvas.height / H);
    ctx.fillStyle = '#050a17';
    ctx.fillRect(0, 0, W, H);
    const nebula = ctx.createRadialGradient(W * 0.7, H * 0.33, 0, W * 0.7, H * 0.33, 420);
    nebula.addColorStop(0, '#14234b55');
    nebula.addColorStop(0.5, '#13172e33');
    nebula.addColorStop(1, '#050a1700');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, W, H);
    const blueCloud = ctx.createRadialGradient(100, 530, 0, 100, 530, 350);
    blueCloud.addColorStop(0, '#0a315333');
    blueCloud.addColorStop(1, 'transparent');
    ctx.fillStyle = blueCloud;
    ctx.fillRect(0, 0, W, H);
    for (const s of stars) {
      if (mode !== 'paused') s.y = (s.y + s.speed * dt) % H;
      ctx.globalAlpha = s.a;
      ctx.fillStyle = '#b8d3ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (s.r > 1.4) {
        ctx.shadowColor = '#d7e8ff';
        ctx.shadowBlur = 8;
        ctx.fillRect(s.x - 5, s.y - 0.4, 10, 0.8);
        ctx.fillRect(s.x - 0.4, s.y - 5, 0.8, 10);
        ctx.shadowBlur = 0;
      }
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#35527b20';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(685, 160, 85, 0, Math.PI * 2);
    ctx.stroke();
    const planet = ctx.createRadialGradient(655, 125, 0, 695, 165, 83);
    planet.addColorStop(0, '#17243a');
    planet.addColorStop(0.8, '#0a1223');
    planet.addColorStop(1, '#060c19');
    ctx.fillStyle = planet;
    ctx.shadowColor = '#7eb6ff';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(685, 160, 81, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#9ec4ff55';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(685, 168, 108, 22, -0.35, 0, Math.PI * 2);
    ctx.stroke();

    if (firstPerson && player && mode !== 'ready') {
      drawFirstPerson();
      for (const p of particles) {
        const fade = Math.max(0, p.life / p.max);
        ctx.globalAlpha = fade;
        if (p.kind === 'ring') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.kind === 'flash') {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.w || 2.5, p.w || 2.5);
        }
      }
      ctx.globalAlpha = 1;
      if (hitFlash > 0) {
        ctx.fillStyle = `rgba(255,70,100,${hitFlash * 0.6})`;
        ctx.fillRect(0, 0, W, H);
      }
      drawViewButton();
      return;
    }

    ctx.fillStyle = baseFlash > 0 ? 'rgba(255,72,96,0.16)' : 'rgba(90,140,220,0.10)';
    ctx.fillRect(0, BASE_LINE, W, H - BASE_LINE);
    ctx.strokeStyle = baseFlash > 0 ? '#ff8aa0' : '#7eafff';
    ctx.shadowColor = baseFlash > 0 ? '#ff8aa0' : '#7eafff';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, BASE_LINE);
    ctx.lineTo(W, BASE_LINE);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = '13px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = baseFlash > 0 ? '#ffd0d8' : '#b7d4ff';
    ctx.fillText('我方基地', 18, BASE_LINE + 22);

    if (mode === 'ready') {
      ship(W / 2, H - 100, PAL.player, 0, 1.1, false, true);
    } else {
      for (const e of enemies) {
        if (e.dead) continue;
        if (e.kind === 'bigBoss') {
          ctx.save();
          ctx.fillStyle = '#ff335522';
          ctx.beginPath();
          ctx.arc(e.x, e.y, 58, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        if (e.kind === 'ground') drawGround(e);
        else if (e.kind === 'aa') drawAa(e, false);
        else if (e.kind === 'heli') drawHeli(e, false);
        else if (e.kind === 'baozi') ship(e.x, e.y, PAL.baozi, e.flash, e.scale, true);
        else if (e.kind === 'smallBoss') ship(e.x, e.y, PAL.small, e.flash, e.scale, true);
        else ship(e.x, e.y, PAL.red, e.flash, e.scale || 1, true);
        drawHp(e);
        drawTag(e);
      }
      for (const it of items) drawItem(it);
      for (const a of allies) {
        if (a.dead) continue;
        if (a.kind === 'bigBoss') {
          ctx.save();
          ctx.fillStyle = '#49b7ff22';
          ctx.beginPath();
          ctx.arc(a.x, a.y, 58, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        if (a.kind === 'ground') drawGround(a, true);
        else if (a.kind === 'aa') drawAa(a, true);
        else if (a.kind === 'heli') drawHeli(a, true);
        else if (a.kind === 'drone') drawDrone(a);
        else if (a.kind === 'smallBoss') ship(a.x, a.y, PAL.player, a.flash, a.scale, false);
        else if (a.kind === 'bigBoss') ship(a.x, a.y, PAL.player, a.flash, a.scale, false);
        else if (a.kind === 'wing') ship(a.x, a.y, PAL.yellowShip, a.flash, a.scale || ALLY_SHIP_SCALE, false);
        else ship(a.x, a.y, PAL.player, a.flash, a.scale || 0.82, false);
        drawHp(a);
        drawAllyTag(a);
      }
      if (player && mode !== 'over') {
        if (shipSelected && mode !== 'ready') {
          ctx.save();
          ctx.strokeStyle = '#c7ebff';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(player.x, player.y, 28 + Math.sin(elapsed * 5) * 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.font = '12px "Noto Sans SC", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#e7f6ff';
          ctx.fillText('已选中', player.x, player.y - 40);
          ctx.restore();
        }
        ship(player.x, player.y, PAL.player, hitFlash, 1, false, true);
        if (flame > 0) drawFlame();
      }
      for (const b of lasers) drawLaser(b);
    }
    for (const p of particles) {
      const fade = Math.max(0, p.life / p.max);
      ctx.globalAlpha = fade;
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'flash') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.w || 2.5, p.w || 2.5);
      }
    }
    ctx.globalAlpha = 1;
    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255,70,100,${hitFlash * 0.6})`;
      ctx.fillRect(0, 0, W, H);
    }
    drawViewButton();
  }

  function frame(now) {
    const dt = Math.min((now - previous) / 1000 || 0, 0.04);
    previous = now;
    if (mode === 'playing') update(dt);
    if (mode !== 'paused') {
      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'ring') p.r += p.grow * dt;
        p.life -= dt;
      }
      particles = particles.filter(p => p.life > 0);
    }
    draw(dt);
    requestAnimationFrame(frame);
  }

  function beginFromOverlay() {
    if (mode === 'paused') togglePause();
    else if (mode === 'levelclear') nextLevel();
    else start();
  }

  $('start').addEventListener('click', beginFromOverlay);
  $('pause').addEventListener('click', togglePause);
  function paintSoundButton() {
    $('sound').innerHTML = `♫<span>音效${soundOn ? '开' : '关'}</span>`;
    $('sound').setAttribute('aria-label', soundOn ? '关闭音效' : '开启音效');
    $('sound').title = soundOn ? '关闭音效' : '开启音效';
  }
  paintSoundButton();
  $('sound').addEventListener('click', () => {
    soundOn = !soundOn;
    paintSoundButton();
    if (soundOn) {
      ensureAudio();
      tone(650, 0.1);
    }
  });
  window.addEventListener('pointerdown', () => { if (soundOn) ensureAudio(); });
  window.addEventListener('keydown', () => { if (soundOn) ensureAudio(); });

  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Enter') {
      if (mode === 'ready' || mode === 'over' || mode === 'victory') start();
      else if (mode === 'paused') togglePause();
      else if (mode === 'levelclear') nextLevel();
      return;
    }
    if (e.code === 'Space' || e.code === 'Escape') {
      if (mode === 'playing' || mode === 'paused') togglePause();
      else if (mode === 'levelclear') nextLevel();
      return;
    }
    if (mode === 'playing') keys.add(e.key.toLowerCase());
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'playing') togglePause();
  });

  const arena = $('arena');
  function locate(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / (r.width || 1) * W, y: (e.clientY - r.top) / (r.height || 1) * H };
  }
  function placePlayer(p) {
    player.x = Math.max(24, Math.min(W - 24, p.x));
    player.y = Math.max(40, Math.min(H - 38, p.y));
    moveTarget = { x: player.x, y: player.y };
  }
  function overArena(e) {
    const r = arena.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }
  function onUiControl(e) {
    return !!(e.target && e.target.closest && e.target.closest('button, a, input, textarea, select'));
  }
  function beginPush(e) {
    if (!player || (e.pointerType === 'mouse' && e.button !== 0) || onUiControl(e) || !overArena(e)) return;
    const p = locate(e);
    const blackOrb = items.find(it => {
      if (it.taken || it.type !== 'black') return false;
      if (Math.hypot(it.x - p.x, it.y - p.y) < 20) return true;
      if (firstPerson) {
        const q = projectWorld(it.x, it.y);
        return Math.hypot(q.x - p.x, q.y - p.y) < 22;
      }
      return false;
    });
    if (blackOrb && (mode === 'playing' || mode === 'paused')) {
      collectItem(blackOrb);
      viewPress = true;
      e.preventDefault();
      return;
    }
    if ((mode === 'playing' || mode === 'paused') && hitViewButton(p)) {
      firstPerson = !firstPerson;
      viewPress = true;
      e.preventDefault();
      return;
    }
    if (mode === 'paused') togglePause();
    if (mode !== 'playing') return;
    dragging = true;
    shipSelected = true;
    gesture = { x: p.x, y: p.y, moved: false, originX: player.x, originY: player.y, inArena: true };
    document.body.classList.add('pushing');
    e.preventDefault();
  }
  function movePush(e) {
    if (viewPress) return;
    if (!player) return;
    const held = (e.buttons & 1) === 1;
    if (!held && !dragging) return;
    if (!overArena(e) && !gesture) return;
    if (mode === 'paused') togglePause();
    if (mode !== 'playing') return;
    const p = locate(e);
    if (!gesture) {
      dragging = true;
      shipSelected = true;
      gesture = { x: p.x, y: p.y, moved: false, originX: player.x, originY: player.y, inArena: true };
      document.body.classList.add('pushing');
    }
    const dx = p.x - gesture.x;
    const dy = p.y - gesture.y;
    if (Math.hypot(dx, dy) > 1.5) gesture.moved = true;
    if (gesture.moved) placePlayer({ x: gesture.originX + dx, y: gesture.originY + dy });
  }
  function endPush(e) {
    document.body.classList.remove('pushing');
    if (viewPress) {
      viewPress = false;
      dragging = false;
      gesture = null;
      return;
    }
    if (!gesture || !player) {
      dragging = false;
      gesture = null;
      return;
    }
    const p = locate(e);
    const dx = p.x - gesture.x;
    const dy = p.y - gesture.y;
    const tap = !gesture.moved && Math.hypot(dx, dy) < 8;
    if (!tap) placePlayer({ x: gesture.originX + dx, y: gesture.originY + dy });
    else if (mode === 'playing' && gesture.inArena && e.pointerType === 'mouse') throwBomb();
    dragging = false;
    gesture = null;
  }
  window.addEventListener('pointerdown', beginPush);
  arena.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('pointerdown', e => {
    if (e.button !== 2 || onUiControl(e) || !overArena(e)) return;
    e.preventDefault();
    fireAurora();
  });
  window.addEventListener('pointermove', movePush);
  window.addEventListener('pointerup', endPush);
  window.addEventListener('pointercancel', () => {
    document.body.classList.remove('pushing');
    dragging = false;
    gesture = null;
    viewPress = false;
  });
  window.addEventListener('pointermove', e => {
    if (!player || !overArena(e)) {
      canvas.style.cursor = '';
      return;
    }
    const p = locate(e);
    canvas.style.cursor = hitViewButton(p) && (mode === 'playing' || mode === 'paused') ? 'pointer' : '';
  });

  renderIntel();
  syncHUD();
  resize();
  requestAnimationFrame(frame);
  start();
})();
