(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const W = 800, H = 600;
  const keys = new Set();
  let mode = 'ready', previous = 0, elapsed = 0, fireClock = 0, spawnClock = 0;
  let player, enemies = [], lasers = [], particles = [], score = 0, kills = 0, best = 0;
  let soundOn = false, audio, pointer = null, hitFlash = 0;
  try { best = Number(localStorage.getItem('starbound-best')) || 0; } catch {}
  const stars = Array.from({length:150}, () => ({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.35+.3,speed:Math.random()*24+7,a:Math.random()*.6+.15}));
  function resize() { const dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = Math.round(canvas.clientWidth*dpr); canvas.height = Math.round(canvas.clientHeight*dpr); }
  new ResizeObserver(resize).observe(canvas);
  function tone(freq, length, type='sine', volume=.025) {
    if (!soundOn) return;
    try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); if(audio.state === 'suspended') audio.resume(); const o=audio.createOscillator(),g=audio.createGain(); o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.4,audio.currentTime+length);g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+length);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+length); } catch {}
  }
  function formatTime(t) { return `${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`; }
  function syncHUD() {
    $('hp').textContent=player?.hp ?? 15;
    $('health-bar').innerHTML=Array.from({length:15},(_,i)=>`<i class="${i<(player?.hp ?? 15)?'':'empty'}"></i>`).join('');
    $('health-bar').classList.toggle('low',(player?.hp ?? 15)<=5);
    $('score').textContent=String(score).padStart(6,'0');$('kills').innerHTML=`${kills} <small>艘</small>`;
    $('best').textContent=String(Math.max(score,best)).padStart(6,'0');
    $('time').textContent=$('arena-time').textContent=formatTime(elapsed);
  }
  function spawnEnemy(x,y) { enemies.push({x:x??(55+Math.random()*(W-110)),y:y??-40,hp:3,timer:0,speed:35+Math.min(elapsed*.35,30),phase:Math.random()*Math.PI*2,flash:0}); }
  function start() {
    player={x:W/2,y:H-95,hp:15};enemies=[];lasers=[];particles=[];score=0;kills=0;elapsed=0;fireClock=.2;spawnClock=0;hitFlash=0;pointer=null;keys.clear();
    spawnEnemy(180,60);spawnEnemy(400,30);spawnEnemy(620,60);
    mode='playing';$('overlay').classList.add('hidden');$('status').textContent='交战中';$('pause').disabled=false;$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','暂停游戏');syncHUD();tone(550,.25);
  }
  function showOverlay(tag,title,text,button,hint) {
    $('overlay-tag').textContent=tag;$('overlay-title').textContent=title;$('overlay-text').textContent=text;$('start').innerHTML=`${button} <span>↗</span>`;$('overlay-hint').textContent=hint;$('overlay').classList.remove('hidden');
  }
  function pause() {
    if(mode==='playing'){mode='paused';keys.clear();pointer=null;$('status').textContent='已暂停';$('pause').textContent='▷';$('pause').setAttribute('aria-label','继续游戏');showOverlay('TAKE A BREATH, PILOT','星海，稍作停留。','任务已暂停。准备好后，继续你的航行。','继续任务','按空格键或 Enter 继续');}
    else if(mode==='paused'){mode='playing';$('status').textContent='交战中';$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','暂停游戏');$('overlay').classList.add('hidden');}
  }
  function end() {
    mode='over';best=Math.max(score,best);try{localStorage.setItem('starbound-best',String(best));}catch{}
    $('status').textContent='任务结束';$('pause').disabled=true;showOverlay('EVERY END IS A NEW BEGINNING','下一次，飞得更远。',`本次得分 ${score} · 击毁 ${kills} 艘敌舰 · 存活 ${formatTime(elapsed)}`,'再次出击','按 Enter 重新开始');tone(120,.6,'sawtooth',.045);
  }
  function burst(x,y,color,count=20) { for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=35+Math.random()*150;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.25+Math.random()*.5,max:.75,color});} }
  function damage() {player.hp--;hitFlash=.16;burst(player.x,player.y,'#65bdff',9);tone(180,.15,'triangle',.05);syncHUD();if(player.hp<=0){burst(player.x,player.y,'#90d8ff',50);end();}}
  function update(dt) {
    elapsed+=dt;hitFlash=Math.max(0,hitFlash-dt);
    let mx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),my=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
    const len=Math.hypot(mx,my)||1;player.x+=mx/len*300*dt;player.y+=my/len*300*dt;
    if(pointer){const dx=pointer.x-player.x,dy=pointer.y-player.y,d=Math.hypot(dx,dy),step=Math.min(d,550*dt);if(d>1){player.x+=dx/d*step;player.y+=dy/d*step;}}
    player.x=Math.max(24,Math.min(W-24,player.x));player.y=Math.max(40,Math.min(H-38,player.y));
    fireClock+=dt;if(fireClock>=.16){fireClock%=.16;lasers.push({x:player.x,y:player.y-28,vx:0,vy:-610,enemy:false});tone(760,.055,'sine',.012);}
    spawnClock+=dt;if(spawnClock>=Math.max(1.15,2.5-elapsed*.012)){spawnClock=0;if(enemies.length<9)spawnEnemy();}
    for(const e of enemies){e.y+=e.speed*dt;e.x+=Math.sin(elapsed*1.3+e.phase)*23*dt;e.x=Math.max(28,Math.min(W-28,e.x));e.flash=Math.max(0,e.flash-dt);e.timer+=dt;if(e.timer>=2){e.timer-=2;const a=Math.atan2(player.y-e.y,player.x-e.x);lasers.push({x:e.x,y:e.y+26,vx:Math.cos(a)*205,vy:Math.sin(a)*205,enemy:true});}}
    for(const b of lasers){b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.dead)continue;if(b.enemy){if(Math.abs(b.x-player.x)<17&&Math.abs(b.y-player.y)<23){b.dead=true;damage();if(mode!=='playing')break;}}else{for(const e of enemies){if(e.hp>0&&Math.abs(b.x-e.x)<25&&Math.abs(b.y-e.y)<25){b.dead=true;e.hp--;e.flash=.09;burst(b.x,b.y,'#f48196',5);if(e.hp===0){score+=100;kills++;burst(e.x,e.y,'#ff6d88',26);tone(100,.22,'sawtooth',.035);syncHUD();}break;}}}}
    if(mode==='playing')for(const e of enemies){if(e.hp>0&&Math.abs(e.x-player.x)<33&&Math.abs(e.y-player.y)<34){e.hp=0;burst(e.x,e.y,'#ff6d88');damage();if(mode!=='playing')break;}}
    enemies=enemies.filter(e=>e.hp>0&&e.y<H+50);lasers=lasers.filter(b=>!b.dead&&b.y>-40&&b.y<H+40&&b.x>-40&&b.x<W+40);
    $('time').textContent=$('arena-time').textContent=formatTime(elapsed);
  }
  function ship(x,y,enemy=false,flash=0,scale=1) {
    ctx.save();ctx.translate(x,y);if(enemy)ctx.rotate(Math.PI);ctx.scale(scale,scale);
    const c=enemy?'#ff5c7e':'#48a6ff';ctx.shadowColor=c;ctx.shadowBlur=15;
    const flame=11+Math.random()*13;const g=ctx.createLinearGradient(0,17,0,35+flame);g.addColorStop(0,enemy?'#ffab75':'#b2f4ff');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-6,17);ctx.lineTo(0,35+flame);ctx.lineTo(6,17);ctx.fill();
    ctx.fillStyle=flash?'#fff':enemy?'#a92c4b':'#166dd4';ctx.strokeStyle=enemy?'#ff8ca0':'#7bcaff';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(0,-29);ctx.lineTo(11,-3);ctx.lineTo(27,18);ctx.lineTo(8,12);ctx.lineTo(0,22);ctx.lineTo(-8,12);ctx.lineTo(-27,18);ctx.lineTo(-11,-3);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.shadowBlur=5;ctx.fillStyle=enemy?'#ffccd4':'#b8efff';ctx.beginPath();ctx.moveTo(0,-17);ctx.lineTo(4,0);ctx.lineTo(0,7);ctx.lineTo(-4,0);ctx.closePath();ctx.fill();ctx.strokeStyle=enemy?'#ff819a':'#61c4ff';ctx.beginPath();ctx.moveTo(-17,9);ctx.lineTo(-10,5);ctx.moveTo(17,9);ctx.lineTo(10,5);ctx.stroke();ctx.restore();
  }
  function draw(dt) {
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.fillStyle='#050a17';ctx.fillRect(0,0,W,H);
    const nebula=ctx.createRadialGradient(W*.7,H*.33,0,W*.7,H*.33,420);nebula.addColorStop(0,'#14234b55');nebula.addColorStop(.5,'#13172e33');nebula.addColorStop(1,'#050a1700');ctx.fillStyle=nebula;ctx.fillRect(0,0,W,H);
    const blueCloud=ctx.createRadialGradient(100,530,0,100,530,350);blueCloud.addColorStop(0,'#0a315333');blueCloud.addColorStop(1,'transparent');ctx.fillStyle=blueCloud;ctx.fillRect(0,0,W,H);
    for(const s of stars){if(mode!=='paused')s.y=(s.y+s.speed*dt)%H;ctx.globalAlpha=s.a;ctx.fillStyle='#b8d3ff';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();if(s.r>1.4){ctx.fillRect(s.x-3,s.y-.3,6,.6);ctx.fillRect(s.x-.3,s.y-3,.6,6);}}ctx.globalAlpha=1;
    ctx.strokeStyle='#35527b20';ctx.lineWidth=1;ctx.beginPath();ctx.arc(685,160,85,0,Math.PI*2);ctx.stroke();const planet=ctx.createRadialGradient(655,125,0,695,165,83);planet.addColorStop(0,'#17243a');planet.addColorStop(.8,'#0a1223');planet.addColorStop(1,'#060c19');ctx.fillStyle=planet;ctx.beginPath();ctx.arc(685,160,81,0,Math.PI*2);ctx.fill();
    if(mode==='ready'){ship(W/2,H-100,false,0,1.1);}
    else {for(const e of enemies){ship(e.x,e.y,true,e.flash);for(let i=0;i<3;i++){ctx.fillStyle=i<e.hp?'#f27088':'#442739';ctx.fillRect(e.x-17+i*12,e.y-41,9,3);}}
      if(player&&mode!=='over')ship(player.x,player.y,false,hitFlash);
      ctx.lineCap='round';for(const b of lasers){ctx.save();ctx.strokeStyle=b.enemy?'#ff5c7e':'#79ddff';ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=13;ctx.lineWidth=b.enemy?3:3.5;const len=Math.hypot(b.vx,b.vy),tail=15;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-b.vx/len*tail,b.y-b.vy/len*tail);ctx.stroke();ctx.restore();}
    }
    for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,2.5,2.5);}ctx.globalAlpha=1;
    if(hitFlash>0){ctx.fillStyle=`rgba(255,70,100,${hitFlash*.6})`;ctx.fillRect(0,0,W,H);}
  }
  function frame(now){const dt=Math.min((now-previous)/1000||0,.04);previous=now;if(mode==='playing')update(dt);if(mode!=='paused') {for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);}draw(dt);requestAnimationFrame(frame);}
  $('start').addEventListener('click',()=>mode==='paused'?pause():start());$('pause').addEventListener('click',pause);
  $('sound').addEventListener('click',()=>{soundOn=!soundOn;$('sound').innerHTML=`♫<span>音效${soundOn?'开':'关'}</span>`;$('sound').setAttribute('aria-label',soundOn?'关闭音效':'开启音效');$('sound').title=soundOn?'关闭音效':'开启音效';if(soundOn)tone(650,.1);});
  window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='Space'||e.code==='Escape'){pause();return;}if(e.code==='Enter'){if(mode==='ready'||mode==='over')start();else if(mode==='paused')pause();return;}keys.add(e.key.toLowerCase());});
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();if(mode==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pause();});
  function locate(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H};}
  canvas.addEventListener('pointerdown',e=>{if(mode==='playing'){canvas.setPointerCapture(e.pointerId);pointer=locate(e);e.preventDefault();}});canvas.addEventListener('pointermove',e=>{if(pointer)pointer=locate(e);});canvas.addEventListener('pointerup',()=>pointer=null);canvas.addEventListener('pointercancel',()=>pointer=null);
  syncHUD();resize();requestAnimationFrame(frame);
})();
