(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const W = 800;
  const H = 600;

  // 地面炮台数量原话没有给，每关固定 4 座，和飞机同时出现。
  // 小包子的双发间隔、小Boss 数值原话没有给，集中写在这里。
  const GROUND_PER_LEVEL = 4;
  const BOSS = {
    baozi: { hp: 18, scale: 1.18, shot: 2, shotCount: 2, shotDmg: 2, bomb: 10, bombDmg: 4, spread: 0.24, speed: 250 },
    small: { hp: 36, scale: 1.55, shot: 4, shotCount: 2, shotDmg: 2, bomb: 10, bombDmg: 3, spread: 0.2, speed: 240 },
    big: { hp: 60, scale: 2.25, shot: 4, shotCount: 3, shotDmg: 3, bomb: 10, bombDmg: 4, spread: 0.26, speed: 250 },
  };
  const LEVELS = [
    { name: '第1关', planes: 9, ground: GROUND_PER_LEVEL },
    { name: '第2关', planes: 15, ground: GROUND_PER_LEVEL },
    { name: '第3关', planes: 20, ground: GROUND_PER_LEVEL },
    { name: '第4关', planes: 15, ground: GROUND_PER_LEVEL },
    { name: '第5关', planes: 28, baozi: 1, ground: GROUND_PER_LEVEL },
    { name: '最后一关', bosses: true, ground: GROUND_PER_LEVEL },
  ];
  // 每关道具构成原话没拆比例：一般 5 个、最后一关 12 个。三种球都要出现。
  const ITEM_PLANS = {
    normal: ['blue', 'yellow', 'green', 'red', 'blue'],
    final: ['blue', 'yellow', 'green', 'red', 'blue', 'yellow', 'green', 'red', 'blue', 'yellow', 'green', 'red'],
  };
  const LIGHTNING_TIME = 15;
  const LIGHTNING_DMG = 3;
  const HEAL_AMOUNT = 4;
  const ALLY_SHIP_COUNT = 15;
  const START_BOMBS = 5;
  const PLAYER_BOMB_DMG = 5;
  const PAL = {
    player: { body: '#166dd4', edge: '#7bcaff', core: '#b8efff', flame: '#b2f4ff', wing: '#61c4ff', glow: '#48a6ff' },
    red: { body: '#a92c4b', edge: '#ff8ca0', core: '#ffccd4', flame: '#ffab75', wing: '#ff819a', glow: '#ff5c7e' },
    baozi: { body: '#1d4eab', edge: '#ffd15c', core: '#fff3ae', flame: '#ffe38a', wing: '#7eb6ff', glow: '#ffd15c' },
    small: { body: '#c24b12', edge: '#ffb088', core: '#ffe0c2', flame: '#ffb15a', wing: '#ff8a4a', glow: '#ff7a3c' },
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
  let soundOn = false;
  let audio;
  let moveTarget = null;
  let shipSelected = false;
  let gesture = null;
  let hitFlash = 0;
  let levelIndex = 0;
  let killedPlanes = 0;
  let spawnedPlanes = 0;
  let killedGround = 0;
  let spawnedGround = 0;
  let baoziSpawned = false;
  let baoziDead = false;
  let smallBossDead = false;
  let bigBossDead = false;
  let bannerTimer = 0;
  let items = [];
  let allies = [];
  let itemPlanNow = ITEM_PLANS.normal;
  let spawnedItems = 0;
  let collectedItems = 0;
  let itemClock = 0;
  let lightning = 0;
  let bombStock = START_BOMBS;

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

  function tone(freq, length, type = 'sine', volume = 0.025) {
    if (!soundOn) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, audio.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.4), audio.currentTime + length);
      g.gain.setValueAtTime(volume, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + length);
      o.connect(g);
      g.connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + length);
    } catch {}
  }

  function formatTime(t) {
    return `${Math.floor(t / 60).toString().padStart(2, '0')}:${Math.floor(t % 60).toString().padStart(2, '0')}`;
  }

  function planeTarget(lv = LEVELS[levelIndex]) {
    if (lv.bosses) return 2;
    return lv.planes + (lv.baozi ? 1 : 0);
  }

  function planeKilled(lv = LEVELS[levelIndex]) {
    if (lv.bosses) return (smallBossDead ? 1 : 0) + (bigBossDead ? 1 : 0);
    return killedPlanes + (baoziDead ? 1 : 0);
  }

  function syncHUD() {
    const lv = LEVELS[levelIndex];
    const hp = player?.hp ?? 15;
    $('hp').textContent = hp;
    $('health-bar').innerHTML = Array.from({ length: 15 }, (_, i) => `<i class="${i < hp ? '' : 'empty'}"></i>`).join('');
    $('health-bar').classList.toggle('low', hp <= 5);
    $('score').textContent = String(score).padStart(6, '0');
    $('kills').innerHTML = `${kills} <small>个</small>`;
    $('best').textContent = String(Math.max(score, best)).padStart(6, '0');
    $('time').textContent = $('arena-time').textContent = formatTime(elapsed);
    $('level').textContent = lv.name;
    $('planes').textContent = `${planeKilled(lv)} / ${planeTarget(lv)}`;
    $('ground').textContent = `${killedGround} / ${lv.ground}`;
    $('items').textContent = `${collectedItems} / ${itemPlanNow.length}`;
    $('lightning').textContent = lightning > 0 ? `${lightning.toFixed(1)}s` : '—';
    $('bombs').textContent = String(bombStock);
  }

  function itemCounts(plan) {
    return plan.reduce((n, type) => { n[type] = (n[type] || 0) + 1; return n; }, { blue: 0, yellow: 0, green: 0, red: 0 });
  }

  function renderIntel() {
    const normal = itemCounts(ITEM_PLANS.normal);
    const final = itemCounts(ITEM_PLANS.final);
    $('intel-note').textContent = '普通飞机为红色，3 点生命，每 2 秒发射激光，命中扣 1 血。地面炮台与飞机同时出现。';
    $('level-list').innerHTML = LEVELS.map(lv => `<li>${describeLevel(lv)}</li>`).join('');
    $('item-note').innerHTML = `道具会自动出现。一般每关 <b>${ITEM_PLANS.normal.length}</b> 个：蓝 ${normal.blue}、黄 ${normal.yellow}、绿 ${normal.green}、红 ${normal.red}。最后一关 <b>${ITEM_PLANS.final.length}</b> 个：蓝 ${final.blue}、黄 ${final.yellow}、绿 ${final.green}、红 ${final.red}。蓝球：${LIGHTNING_TIME} 秒内子弹变成雷电，雷电击中扣 ${LIGHTNING_DMG} 血。黄球：召唤 ${ALLY_SHIP_COUNT} 艘我方飞船。绿球：回复 ${HEAL_AMOUNT} 滴血。红球：召唤我方小Boss 和我方大Boss。开局 ${START_BOMBS} 颗追踪炸弹，鼠标点击投出，炸中扣 ${PLAYER_BOMB_DMG} 血。`;
  }

  function describeLevel(lv) {
    if (lv.bosses) {
      const big = BOSS.big;
      const small = BOSS.small;
      return `<b>最后一关</b>：小Boss 与大Boss，同时有地面炮台 ${lv.ground}。大Boss 是红色、体积更大的飞机，每 ${big.shot} 秒发射 ${big.shotCount} 颗子弹，每颗扣 ${big.shotDmg} 血；每 ${big.bomb} 秒发射 1 颗炸弹，炸弹扣 ${big.bombDmg} 血。小Boss 为橙色较小飞机，每 ${small.shot} 秒 ${small.shotCount} 颗子弹，每颗扣 ${small.shotDmg} 血；每 ${small.bomb} 秒 1 颗炸弹，扣 ${small.bombDmg} 血。`;
    }
    if (lv.baozi) {
      const b = BOSS.baozi;
      const total = lv.planes + lv.baozi;
      return `<b>第5关</b>：共 ${total} 个敌人，其中 1 个是小包子（蓝黄色飞机，每 ${b.shot} 秒发射 ${b.shotCount} 颗子弹，每颗扣 ${b.shotDmg} 血；每 ${b.bomb} 秒发射 1 颗炸弹，炸弹扣 ${b.bombDmg} 血），其余 ${lv.planes} 架为普通飞机，同时有地面炮台 ${lv.ground}。`;
    }
    return `<b>${lv.name}</b>：${lv.planes} 架飞机，同时有地面炮台 ${lv.ground}。`;
  }

  function nextBlurb(lv) {
    if (lv.bosses) return '最后一关：小Boss、大Boss，同时有地面炮台';
    if (lv.baozi) return `第5关：共 ${lv.planes + lv.baozi} 个敌人，其中 1 个是小包子，同时有地面炮台`;
    return `${lv.name}：${lv.planes} 架飞机，同时有地面炮台`;
  }

  function bannerText(lv) {
    if (lv.bosses) return '最后一关 · 小Boss与大Boss · 地面炮台';
    if (lv.baozi) return `第5关 · 共${lv.planes + lv.baozi}个敌人 · 含小包子`;
    return `${lv.name} · ${lv.planes}架飞机 · 地面炮台`;
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
      const s = 35 + Math.random() * 150;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.25 + Math.random() * 0.5, max: 0.75, color });
    }
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
      ramCd: 0,
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

  function spawnBaozi() {
    enemies.push(makeCraft('baozi', W / 2, -70, { homeX: W / 2, homeY: 132, phase: 0.4 }));
  }

  function spawnBosses() {
    enemies.push(makeCraft('smallBoss', 210, -80, { homeX: 230, homeY: 168, phase: 0.2 }));
    enemies.push(makeCraft('bigBoss', 560, -110, { homeX: 540, homeY: 118, phase: 1.4 }));
  }

  function resetWaveFlags() {
    killedPlanes = 0;
    spawnedPlanes = 0;
    killedGround = 0;
    spawnedGround = 0;
    baoziSpawned = false;
    baoziDead = false;
    smallBossDead = false;
    bigBossDead = false;
    enemies = [];
    lasers = [];
    particles = [];
    items = [];
    allies = [];
    spawnedItems = 0;
    collectedItems = 0;
    itemClock = 0;
    lightning = 0;
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
    itemPlanNow = lv.bosses ? ITEM_PLANS.final : ITEM_PLANS.normal;
    player.hp = 15;
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
    if (lv.baozi) {
      spawnBaozi();
      baoziSpawned = true;
    }
    if (lv.bosses) spawnBosses();
    mode = 'playing';
    hideOverlay();
    $('status').textContent = `${lv.name} · 交战中`;
    $('pause').disabled = false;
    $('pause').textContent = 'Ⅱ';
    $('pause').setAttribute('aria-label', '暂停游戏');
    syncHUD();
    showBanner(bannerText(lv));
    tone(550, 0.25);
  }

  function start() {
    levelIndex = 0;
    score = 0;
    kills = 0;
    elapsed = 0;
    shipSelected = false;
    moveTarget = null;
    bombStock = START_BOMBS;
    player = { x: W / 2, y: H - 95, hp: 15 };
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
    showOverlay('MISSION COMPLETE', '航线守住了。', `六关通过 · 得分 ${score} · 击毁 ${kills} · 存活 ${formatTime(elapsed)}`, '再飞一次', '按 Enter 重新开始');
    burst(W / 2, H / 2, '#ffd15c', 40);
    burst(W / 3, H / 3, '#79ddff', 24);
    tone(720, 0.35);
  }

  function end() {
    mode = 'over';
    saveBest();
    keys.clear();
    gesture = null;
    shipSelected = false;
    moveTarget = null;
    $('status').textContent = '任务结束';
    $('pause').disabled = true;
    showOverlay('EVERY END IS A NEW BEGINNING', '下一次，飞得更远。', `止步${LEVELS[levelIndex].name} · 得分 ${score} · 击毁 ${kills} · 存活 ${formatTime(elapsed)}`, '再次出击', '按 Enter 重新开始');
    tone(120, 0.6, 'sawtooth', 0.045);
  }

  function damage(amount) {
    if (mode !== 'playing' || !player) return;
    player.hp = Math.max(0, player.hp - amount);
    hitFlash = 0.18;
    burst(player.x, player.y, '#65bdff', 8 + amount * 2);
    tone(180, 0.14, 'triangle', 0.05);
    syncHUD();
    if (player.hp <= 0) {
      burst(player.x, player.y, '#90d8ff', 50);
      end();
    }
  }

  function destroyEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    const points = { plane: 100, ground: 80, baozi: 600, smallBoss: 2000, bigBoss: 4000 };
    score += points[e.kind] || 100;
    kills++;
    if (e.kind === 'plane') killedPlanes++;
    if (e.kind === 'ground') killedGround++;
    if (e.kind === 'baozi') baoziDead = true;
    if (e.kind === 'smallBoss') smallBossDead = true;
    if (e.kind === 'bigBoss') bigBossDead = true;
    const color = e.kind === 'ground' ? '#d6c36a' : e.kind === 'baozi' ? '#ffd15c' : '#ff6d88';
    burst(e.x, e.y, color, e.kind === 'bigBoss' ? 46 : e.kind === 'plane' ? 26 : 34);
    tone(e.kind === 'bigBoss' || e.kind === 'smallBoss' ? 90 : 110, 0.24, 'sawtooth', 0.04);
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
  }

  function weapons(e, dt) {
    if (e.dead || e.y < 8) return;
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
      tone(90, 0.18, 'sawtooth', 0.03);
    }
  }

  function hitRadius(e) {
    if (e.kind === 'ground') return { x: 30, y: 24 };
    const s = e.scale || 1;
    return { x: 22 * s, y: 22 * s };
  }

  function alive(kind) {
    return enemies.filter(e => e.kind === kind && !e.dead).length;
  }

  function moveCraft(e, dt) {
    e.flash = Math.max(0, e.flash - dt);
    e.ramCd = Math.max(0, e.ramCd - dt);
    if (e.kind === 'plane') {
      e.y += (e.speed + Math.min(elapsed * 0.25, 26)) * dt;
      e.x += Math.sin(elapsed * 1.3 + e.phase) * 23 * dt;
      e.x = Math.max(28, Math.min(W - 28, e.x));
      return;
    }
    const tx = e.homeX + Math.sin(elapsed * (e.kind === 'bigBoss' ? 0.7 : 0.9) + e.phase) * (e.kind === 'bigBoss' ? 120 : 70);
    const ty = e.homeY + Math.cos(elapsed * 0.55 + e.phase) * (e.kind === 'ground' ? 16 : 28);
    e.x += (tx - e.x) * Math.min(1, dt * (e.kind === 'ground' ? 0.85 : 1.15));
    e.y += (ty - e.y) * Math.min(1, dt * (e.kind === 'ground' ? 0.85 : 1.15));
    e.x = Math.max(36, Math.min(W - 36, e.x));
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
  }

  function summonShips(count) {
    const start = allies.filter(a => a.kind === 'wing' && !a.dead).length;
    for (let i = 0; i < count; i++) {
      const n = start + i;
      const col = n % 5;
      const row = Math.floor(n / 5) % 4;
      const x = 100 + col * 150;
      const y = 188 + row * 58;
      allies.push(makeCraft('wing', x, -24 - (i % 6) * 16, {
        homeX: x,
        homeY: y,
        friendly: true,
        scale: 0.62,
      }));
    }
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
      burst(it.x, it.y, '#ffd15c', 18);
      tone(640, 0.18);
    } else if (it.type === 'green') {
      if (player) player.hp = Math.min(15, player.hp + HEAL_AMOUNT);
      burst(it.x, it.y, '#5dffa0', 16);
      tone(520, 0.16);
    } else {
      summonOwnBosses();
      burst(it.x, it.y, '#ff5c7e', 22);
      tone(180, 0.22, 'sawtooth', 0.04);
    }
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
    tone(150, 0.12, 'sawtooth', 0.035);
    syncHUD();
  }

  function hurtAlly(a, amount) {
    if (a.dead) return;
    a.hp -= amount;
    a.flash = 0.1;
    if (a.hp <= 0) {
      a.dead = true;
      a.hp = 0;
      burst(a.x, a.y, '#8ecbff', a.kind === 'bigBoss' ? 36 : 14);
    }
  }

  function allyWeapons(a, dt) {
    const target = nearestEnemy(a);
    if (!target || a.y < 8) return;
    if (a.kind === 'wing' || a.kind === 'ground') {
      a.timer += dt;
      const interval = a.kind === 'ground' ? 0.75 : 0.45;
      if (a.timer >= interval) {
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
    if (lv.bosses) return smallBossDead && bigBossDead;
    if (killedPlanes < lv.planes) return false;
    if (lv.baozi && !baoziDead) return false;
    return true;
  }

  function update(dt) {
    elapsed += dt;
    hitFlash = Math.max(0, hitFlash - dt);
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) $('level-banner').classList.remove('show');
    }

    let mx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    let my = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    const usingKeys = mx !== 0 || my !== 0;
    if (usingKeys) {
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
        dead: false,
      });
      tone(bolt ? 980 : 760, 0.05, bolt ? 'square' : 'sine', 0.012);
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
    const itemGap = lv.bosses ? 2.1 : 3.2;
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
      if (b.homing && !b.dead) {
        b.age = (b.age || 0) + dt;
        if (b.age > 8) {
          b.dead = true;
          continue;
        }
        if (!b.target || b.target.dead || b.target.hp <= 0) b.target = nearestEnemy(b);
        if (b.target) {
          const angle = Math.atan2(b.target.y - b.y, b.target.x - b.x);
          b.vx = Math.cos(angle) * 270;
          b.vy = Math.sin(angle) * 270;
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
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
            hurtAlly(a, b.dmg || 1);
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
            burst(b.x, b.y, b.lightning ? '#d7f4ff' : b.bomb ? '#ffb020' : e.kind === 'baozi' ? '#ffe38a' : '#f48196', b.bomb ? 18 : 5);
            if (e.hp <= 0) destroyEnemy(e);
            break;
          }
        }
      }
    }

    if (mode === 'playing') {
      for (const e of enemies) {
        if (e.dead || e.ramCd > 0) continue;
        const r = hitRadius(e);
        if (Math.abs(e.x - player.x) < r.x + 6 && Math.abs(e.y - player.y) < r.y + 8) {
          e.ramCd = 0.7;
          if (e.kind === 'plane' || e.kind === 'ground') destroyEnemy(e);
          else {
            e.hp--;
            e.flash = 0.1;
            if (e.hp <= 0) destroyEnemy(e);
          }
          damage(1);
          if (mode !== 'playing') break;
        }
      }
    }

    allies = allies.filter(a => !a.dead && a.hp > 0);
    enemies = enemies.filter(e => {
      if (e.dead || e.hp <= 0) return false;
      if (e.kind === 'plane' && e.y > H + 50) {
        spawnedPlanes = Math.max(killedPlanes, spawnedPlanes - 1);
        return false;
      }
      return true;
    });
    lasers = lasers.filter(b => !b.dead && (b.homing || (b.y > -50 && b.y < H + 50 && b.x > -50 && b.x < W + 50)));
    $('time').textContent = $('arena-time').textContent = formatTime(elapsed);
    if (mode === 'playing' && quotaMet()) levelClear();
  }

  function ship(x, y, pal, flash, scale, faceDown) {
    ctx.save();
    ctx.translate(x, y);
    if (faceDown) ctx.rotate(Math.PI);
    ctx.scale(scale, scale);
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = 15;
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
    ctx.beginPath();
    ctx.moveTo(-17, 9);
    ctx.lineTo(-10, 5);
    ctx.moveTo(17, 9);
    ctx.lineTo(10, 5);
    ctx.stroke();
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
    if (e.maxHp <= 3) {
      const color = e.kind === 'ground' ? '#e2c86a' : '#f27088';
      for (let i = 0; i < e.maxHp; i++) {
        ctx.fillStyle = i < e.hp ? color : '#2c2433';
        ctx.fillRect(e.x - 17 + i * 12, e.y - 34, 9, 3);
      }
      return;
    }
    const w = 34 * (e.scale || 1);
    const y = e.y - 30 * (e.scale || 1) - 8;
    ctx.fillStyle = '#241821';
    ctx.fillRect(e.x - w / 2, y, w, 4);
    ctx.fillStyle = e.kind === 'baozi' ? '#ffd15c' : e.kind === 'smallBoss' ? '#ff8a4a' : '#ff4d6d';
    ctx.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp) / e.maxHp, 4);
  }

  function drawItem(it) {
    const color = it.type === 'blue' ? '#49b7ff' : it.type === 'yellow' ? '#ffd15c' : it.type === 'green' ? '#3ddc7a' : '#ff5a78';
    const core = it.type === 'blue' ? '#e7f7ff' : it.type === 'yellow' ? '#fff6cc' : it.type === 'green' ? '#e9ffe8' : '#ffe0e6';
    const label = it.type === 'blue' ? '雷电' : it.type === 'yellow' ? '15艘' : it.type === 'green' ? '回血' : 'Boss';
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(it.x, it.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(it.x - 3, it.y - 3, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = '12px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(label, it.x, it.y - 18);
    ctx.restore();
  }

  function drawAllyTag(a) {
    if (a.kind === 'wing') return;
    const text = a.kind === 'smallBoss' ? '我方小Boss' : a.kind === 'bigBoss' ? '我方大Boss' : '我方';
    ctx.save();
    ctx.font = '12px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c7ebff';
    const y = a.y - (a.maxHp > 3 ? 30 * (a.scale || 1) + 18 : 42);
    ctx.fillText(text, a.x, y);
    ctx.restore();
  }

  function drawTag(e) {
    const text = { ground: '地面', baozi: '小包子', smallBoss: '小Boss', bigBoss: '大Boss' }[e.kind];
    if (!text) return;
    ctx.save();
    ctx.font = '12px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = e.kind === 'baozi' ? '#ffe38a' : e.kind === 'ground' ? '#e6d48a' : '#ffd0d6';
    const y = e.y - (e.maxHp > 3 ? 30 * (e.scale || 1) + 18 : 44);
    ctx.fillText(text, e.x, y);
    ctx.restore();
  }

  function drawLaser(b) {
    if (b.lightning) {
      ctx.save();
      ctx.strokeStyle = '#e9f8ff';
      ctx.shadowColor = '#49b7ff';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + 16);
      let x = b.x;
      let y = b.y + 16;
      for (let i = 0; i < 4; i++) {
        x += (i % 2 === 0 ? -7 : 7);
        y -= 8;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (b.bomb) {
      ctx.save();
      ctx.shadowColor = '#ff8a1e';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffb020';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff4d0';
      ctx.beginPath();
      ctx.arc(b.x - 3, b.y - 3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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

  function draw(dt) {
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
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
        ctx.fillRect(s.x - 3, s.y - 0.3, 6, 0.6);
        ctx.fillRect(s.x - 0.3, s.y - 3, 0.6, 6);
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
    ctx.beginPath();
    ctx.arc(685, 160, 81, 0, Math.PI * 2);
    ctx.fill();

    if (mode === 'ready') {
      ship(W / 2, H - 100, PAL.player, 0, 1.1, false);
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
        else if (a.kind === 'smallBoss') ship(a.x, a.y, PAL.player, a.flash, a.scale, false);
        else if (a.kind === 'bigBoss') ship(a.x, a.y, PAL.player, a.flash, a.scale, false);
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
        ship(player.x, player.y, PAL.player, hitFlash, 1, false);
      }
      for (const b of lasers) drawLaser(b);
    }
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 2.5, 2.5);
    }
    ctx.globalAlpha = 1;
    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255,70,100,${hitFlash * 0.6})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function frame(now) {
    const dt = Math.min((now - previous) / 1000 || 0, 0.04);
    previous = now;
    if (mode === 'playing') update(dt);
    if (mode !== 'paused') {
      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
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
  $('sound').addEventListener('click', () => {
    soundOn = !soundOn;
    $('sound').innerHTML = `♫<span>音效${soundOn ? '开' : '关'}</span>`;
    $('sound').setAttribute('aria-label', soundOn ? '关闭音效' : '开启音效');
    $('sound').title = soundOn ? '关闭音效' : '开启音效';
    if (soundOn) tone(650, 0.1);
  });

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
  window.addEventListener('blur', () => {
    keys.clear();
    if (mode === 'playing') togglePause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'playing') togglePause();
  });

  function locate(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  function nearPlayer(p) {
    return !!player && Math.hypot(p.x - player.x, p.y - player.y) < 46;
  }
  canvas.addEventListener('pointerdown', e => {
    if (mode !== 'playing' || !player) return;
    const p = locate(e);
    gesture = { x: p.x, y: p.y, moved: false };
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => {
    if (mode !== 'playing' || !player) return;
    const p = locate(e);
    if (gesture) {
      if (Math.hypot(p.x - gesture.x, p.y - gesture.y) > 8) gesture.moved = true;
      if (shipSelected && gesture.moved) moveTarget = p;
      return;
    }
    if (shipSelected && e.pointerType === 'mouse') moveTarget = p;
  });
  function finishGesture(e) {
    if (!gesture || mode !== 'playing' || !player) {
      gesture = null;
      return;
    }
    const p = locate(e);
    const tap = !gesture.moved && Math.hypot(p.x - gesture.x, p.y - gesture.y) < 16;
    if (tap && !shipSelected && nearPlayer(gesture)) shipSelected = true;
    else if (!tap && shipSelected) moveTarget = p;
    else if (tap && e.pointerType === 'mouse') throwBomb();
    else if (tap && shipSelected) moveTarget = p;
    gesture = null;
  }
  canvas.addEventListener('pointerup', finishGesture);
  canvas.addEventListener('pointercancel', () => { gesture = null; });

  renderIntel();
  syncHUD();
  resize();
  requestAnimationFrame(frame);
})();
