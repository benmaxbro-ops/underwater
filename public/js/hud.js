// Undernite - DOM based HUD, lobby and result screen.
import { SUITS, SUIT_ORDER, WEAPONS, RARITY, HALF, FLOORS, floorAt, TANKS, LUNGS, LAMPS, SHOP_WEAPONS, airUse, AQUARIUM, BOSSES, catchFromNet, catchName, catchRate, fishValue, BR_UPGRADES, suitOwned, GADGETS, gadgetOf, BR_WEAPONS, ATTACHMENTS, modDef, ULTIS } from './shared.js';
const perSec = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €/s';
const money = (v) => Math.round(v).toLocaleString('de-DE') + ' €';

const $ = (id) => document.getElementById(id);
const SUIT_COL_HEX = { manta: 0x1fd6b4, triton: 0xf08a24, bulwark: 0x8a2f3a, goliath: 0x5a6a78 };   // Streifenfarbe der alten Taucher (Shop)
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
// Sonar-Radar: range = so viele Meter zeigt es bis zum Rand, period = Sekunden für eine Umdrehung des Strahls,
// fade = so viele Sekunden leuchtet ein Echo nach, hear = so nah müssen Gegner sein, damit das Sonar sie hört
export const SONAR = { range: 90, period: 3, fade: 2.6, hear: 45 };
// Was in der Nähe ist (Radar oben rechts): far = bis so weit (Meter) zeigt ein Pfeil am Rand zum nächsten freien Fahrzeug und zur nächsten Truhe
export const NEAR = { far: 400 };
const NEAR_NAME = { sub: ['U-Boot', 'U-Boote'], scooter: ['Scooter', 'Scooter'], jetski: ['Jetski', 'Jetskis'], ray: ['Rochen', 'Rochen'], crate: ['Truhe', 'Truhen'], w: ['Waffe', 'Waffen'], med: ['Medikit', 'Medikits'], sh: ['Schild', 'Schilde'] };
const VEH_KINDS = ['sub', 'jetski', 'ray', 'scooter'];
// kleines Symbol für jedes Ding auf dem Radar
function nearIcon(c, k, x, y, rar) {
  c.lineWidth = 1; c.strokeStyle = '#2a1a00';
  if (k === 'sub') { c.fillStyle = '#ffc94d'; c.beginPath(); c.ellipse(x, y, 6, 3.4, 0, 0, 7); c.fill(); c.stroke(); c.fillRect(x - 1, y - 6, 3, 3); }
  else if (k === 'jetski') { c.fillStyle = '#ffc94d'; c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x + 4.5, y + 4); c.lineTo(x - 4.5, y + 4); c.closePath(); c.fill(); c.stroke(); }
  else if (k === 'ray') { c.fillStyle = '#ffc94d'; c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x + 5, y); c.lineTo(x, y + 5); c.lineTo(x - 5, y); c.closePath(); c.fill(); c.stroke(); }
  else if (k === 'scooter') { c.fillStyle = '#ffc94d'; c.beginPath(); c.arc(x, y, 3.4, 0, 7); c.fill(); c.stroke(); }
  else if (k === 'crate') { c.fillStyle = '#ff9a3c'; c.fillRect(x - 3.5, y - 3, 7, 6); c.strokeRect(x - 3.5, y - 3, 7, 6); c.fillStyle = '#ffd166'; c.fillRect(x - 3.5, y - 0.5, 7, 1); }
  else if (k === 'w') { c.fillStyle = (RARITY[rar] || RARITY[0]).color; c.strokeStyle = '#fff'; c.beginPath(); c.arc(x, y, 2.6, 0, 7); c.fill(); c.stroke(); }
  else { c.fillStyle = k === 'med' ? '#5dff8a' : '#5ec8ff'; c.fillRect(x - 3, y - 1, 6, 2); c.fillRect(x - 1, y - 3, 2, 6); }
}
// Sonar-Töne: radar = Ping bei jeder Umdrehung, blip = "Ding" pro erwischtem Gegner, sub = Ping im eigenen U-Boot,
// near = Ping fremder U-Boote (so laut ganz nah dran), nearRange = bis so viele Meter hört man ihn
export const SONAR_SND = { radar: 0.22, blip: 0.5, sub: 0.6, near: 0.4, nearRange: 140 };

export class Hud {
  constructor() {
    this.last = {};
    this.mini = $('mini').getContext('2d');
    this.slots = [];
    for (let i = 0; i < 3; i++) {
      const d = document.createElement('div'); d.className = 'slot';
      d.innerHTML = `<div class="k">${i + 1}</div><div class="n">–</div><div class="a"></div><div class="rl"><i></i></div>`;
      $('slots').appendChild(d);
      this.slots.push({ d, n: d.children[1], a: d.children[2], rl: d.children[3].firstChild });
    }
    this.bannerT = 0;
  }
  set(id, prop, v) { const k = id + prop; if (this.last[k] === v) return; this.last[k] = v; const el = $(id); if (prop === 'text') el.textContent = v; else if (prop === 'html') el.innerHTML = v; else el.style[prop] = v; }

  // ----- lobby -----
  buildLobby(cb) {
    const name = $('name');
    name.value = localStorage.getItem('un_name') || '';
    name.addEventListener('input', () => { localStorage.setItem('un_name', name.value); cb({ name: name.value }); });
    const suits = $('suits'); let cur = localStorage.getItem('un_suit'); if (!SUITS[cur]) cur = 'triton';
    for (const id of SUIT_ORDER) {
      const S = SUITS[id], b = document.createElement('button');
      b.className = 'suit' + (id === cur ? ' on' : ''); b.dataset.id = id;
      const st = (l, v) => `<div class="stat">${l}<i><u style="width:${Math.round(Math.min(1, v) * 100)}%"></u></i></div>`;
      b.innerHTML = `<b>${S.name}</b><small>${S.desc}</small>${st('Tempo', S.speed / 15)}${st('Panzer', S.hp / 240)}${st('Wendig', 1 - (S.r - 0.6) / 1.6)}`
        + '<span class="gear">⚙ Ausrüstung</span>';
      b.addEventListener('click', (ev) => {
        if (b.classList.contains('locked')) { $('brShopBtn').click(); return; }   // gesperrt: Shop öffnen
        if (ev.target.classList.contains('gear')) { this.openLoadout(id); }      // Ausrüstungs-Fenster (wählt den Taucher auch aus)
        suits.querySelectorAll('.suit').forEach(x => x.classList.toggle('on', x === b));
        localStorage.setItem('un_suit', id); cb({ suit: id });
      });
      suits.appendChild(b);
    }
    $('bots').addEventListener('input', (e) => { $('botsN').textContent = e.target.value; cb({ bots: +e.target.value }); });
    $('duo').addEventListener('change', (e) => cb({ duo: e.target.checked }));   // Duo-Modus an/aus
    $('go').addEventListener('click', () => cb({ start: true }));
    for (const b of $('modes').children) b.addEventListener('click', () => cb({ mode: b.dataset.mode }));
    return { name: name.value, suit: cur };
  }
  // ----- Ausrüstungs-Fenster pro Taucher (Battle Royale) -----
  // send({ suit, wep, gad }) speichert die Auswahl am Server; Kaufen geht über den Perlen-Shop (brSend)
  initLoadout(send) { this.loadSend = send; $('loadClose').onclick = () => $('loadout').classList.add('hidden'); }
  openLoadout(suit) { this.loadSuit = suit; $('loadout').classList.remove('hidden'); this.loadoutDraw(); }
  loadoutDraw() {
    if ($('loadout').classList.contains('hidden')) return;
    const me = this.brMe || { pearls: 0 }, id = this.loadSuit, S = SUITS[id], L = (me.load || {})[id] || {};
    const pearls = me.pearls || 0, weps = me.weps || [];
    $('loadTitle').innerHTML = `${S.name.toUpperCase()}<span> · AUSRÜSTUNG</span>`;
    $('loadMoney').textContent = `🦪 ${pearls} Perlen`;
    const wname = (wid, rar) => `${WEAPONS[wid].name} <small style="display:inline;color:${RARITY[rar].color}">${RARITY[rar].name}</small>`;
    const wstat = (wid, rar) => { const D = modDef(wid, (L.mods || {})[wid] || []); return `${Math.round(D.dmg * RARITY[rar].mul * D.pellets)} Schaden · ${D.rate}/s · Magazin ${D.mag} · ${Math.round(D.range)} m`; };   // mit Aufsätzen
    // Startwaffe: seine eigene (Standard) oder eine gekaufte
    const [sw, sr] = S.start || ['pistol', 0];
    let h = `<div class="item${!L.wep ? ' chosen' : ''}" style="--rar:${RARITY[sr].color}"><b>${wname(sw, sr)} · Standard</b><small>${wstat(sw, sr)}</small>`
      + (!L.wep ? '<button disabled>Gewählt</button>' : '<button data-load="wep" data-v="">Wählen</button>') + '</div>';
    for (const W of BR_WEAPONS) {
      if (W.wid === sw) continue;   // dieselbe Waffe hat er schon als Standard (gleich gut oder besser)
      const has = !W.price || weps.includes(W.wid), chosen = L.wep === W.wid;
      const btn = chosen ? '<button disabled>Gewählt</button>' : has ? `<button data-load="wep" data-v="${W.wid}">Wählen</button>`
        : `<button data-buy="wep:${W.wid}" ${pearls < W.price ? 'disabled' : ''}>🦪 ${W.price}</button>`;
      h += `<div class="item${chosen ? ' chosen' : ''}" style="--rar:${RARITY[0].color}"><b>${wname(W.wid, 0)}</b><small>${wstat(W.wid, 0)}</small>${btn}</div>`;
    }
    $('loadWeps').innerHTML = h;
    // Gadget dieses Tauchers
    const gi = gadgetOf(id), G = GADGETS[gi];
    if (!G) $('loadGad').innerHTML = '<div class="empty">Dieser Taucher hat kein Gadget.</div>';
    else {
      const has = (me.gads || []).includes(G.k), on = has && L.gad !== false;
      const btn = !has ? `<button data-buy="gad:${G.k}" ${pearls < G.price ? 'disabled' : ''}>🦪 ${G.price}</button>`
        : on ? '<button data-load="gad" data-v="0">Ablegen</button>' : '<button data-load="gad" data-v="1">Mitnehmen</button>';
      $('loadGad').innerHTML = `<div class="item${on ? ' chosen' : ''}" style="--rar:#5ef2e0"><b>${G.name}${on ? ' · dabei ✔' : ''}</b><small>${G.desc} · lädt ${G.cool} s</small>${btn}</div>`;
    }
    // Aufsätze für die gewählte Startwaffe: pro Platz einer
    const wid = L.wep || sw, mods = ((L.mods || {})[wid]) || [], atts = me.atts || [];
    const fits = ATTACHMENTS.filter(A => A.for.includes(wid));
    $('loadAttsFor').textContent = `für: ${WEAPONS[wid].name}`;
    $('loadAtts').innerHTML = fits.length ? fits.map(A => {
      const has = atts.includes(wid + ':' + A.k), on = mods.includes(A.k);
      const btn = !has ? `<button data-buy="att:${wid}:${A.k}" ${pearls < A.price ? 'disabled' : ''}>🦪 ${A.price}</button>`
        : on ? `<button data-att="${A.k}" data-on="0">Abnehmen</button>` : `<button data-att="${A.k}" data-on="1">Anbringen</button>`;
      return `<div class="item${on ? ' chosen' : ''}" style="--rar:#ffd36b"><b>${A.name} <small style="display:inline">· ${A.slot}</small>${on ? ' ✔' : ''}</b><small>${A.desc}</small>${btn}</div>`;
    }).join('') : '<div class="empty">Für diese Waffe gibt es keine Aufsätze.</div>';
    for (const b of document.querySelectorAll('#loadAtts button[data-att]')) b.onclick = () => {
      const A = ATTACHMENTS.find(a => a.k === b.dataset.att);
      // gleicher Platz: der alte Aufsatz kommt runter, der neue drauf
      const next = mods.filter(k => ATTACHMENTS.find(a => a.k === k)?.slot !== A.slot);
      if (b.dataset.on === '1') next.push(A.k);
      this.loadSend && this.loadSend({ suit: id, modsFor: wid, mods: next });
    };
    for (const b of document.querySelectorAll('#loadout button[data-load]')) b.onclick = () => {
      const m = { suit: id }; if (b.dataset.load === 'wep') m.wep = b.dataset.v || null; else m.gad = b.dataset.v === '1';
      this.loadSend && this.loadSend(m);
    };
    for (const b of document.querySelectorAll('#loadout button[data-buy]')) b.onclick = () => this.brSend && this.brSend(b.dataset.buy);
  }
  // ----- Perlen-Shop in der Lobby (Battle Royale) -----
  // send(k) schickt einen Kauf an den Server; der antwortet mit einer neuen Lobby-Nachricht → brShopDraw
  initBrShop(send) {
    $('brShopBtn').onclick = () => { $('brShop').classList.remove('hidden'); this.brShopDraw(); };
    $('brShopClose').onclick = () => $('brShop').classList.add('hidden');
    this.brSend = send;
  }
  brShopDraw() {
    const me = this.brMe || { pearls: 0, up: {} }, up = me.up || {};
    $('brShopBtn').textContent = `🦪 SHOP · ${me.pearls || 0}`;
    if ($('brShop').classList.contains('hidden')) return;
    $('brShopMoney').textContent = `🦪 ${me.pearls || 0} Perlen`;
    $('brShopUps').innerHTML = BR_UPGRADES.map(u => {
      const l = up[u.k] | 0, cur = l ? u.bonus[l - 1] : 0, next = u.bonus[l], price = u.price[l];
      const pips = '●'.repeat(l) + '○'.repeat(u.bonus.length - l);
      const btn = price == null ? '<button disabled>Max</button>'
        : `<button data-k="${u.k}" ${(me.pearls || 0) < price ? 'disabled' : ''}>🦪 ${price}</button>`;
      return `<div class="item" style="--rar:#ffd36b"><b>${u.name}<span class="pips">${pips}</span></b>`
        + `<small>${u.what}: <b>${100 + cur} %</b>${cur ? ` (+${cur} %)` : ''}`
        + `${next != null ? ` → Stufe ${l + 1}: ${100 + next} % (noch +${next - cur} %)` : ' · Maximum erreicht'}</small>${btn}</div>`;
    }).join('');
    // Taucher freischalten
    const owned = me.suits || [];
    $('brShopSuits').innerHTML = SUIT_ORDER.filter(id => SUITS[id].price).map(id => {
      const S = SUITS[id], has = owned.includes(id);
      const btn = has ? '<button disabled>Hast du</button>' : `<button data-k="suit:${id}" ${(me.pearls || 0) < S.price ? 'disabled' : ''}>🦪 ${S.price}</button>`;
      return `<div class="item" style="--rar:#${S.col.toString(16).padStart(6, '0')}"><b>${S.name}</b><small>${S.desc} · ${S.hp} Leben</small>${btn}</div>`;
    }).join('');
    // Gadgets: eins pro Taucher, Taste Q in der Runde
    const gads = me.gads || [];
    $('brShopGads').innerHTML = GADGETS.map(G => {
      const has = gads.includes(G.k), S = SUITS[G.suit];
      const btn = has ? '<button disabled>Hast du</button>' : `<button data-k="gad:${G.k}" ${(me.pearls || 0) < G.price ? 'disabled' : ''}>🦪 ${G.price}</button>`;
      return `<div class="item" style="--rar:#${(S.col || SUIT_COL_HEX[G.suit] || 0x5ef2e0).toString(16).padStart(6, '0')}"><b>${G.name} <small style="display:inline">· für ${S.name}</small></b><small>${G.desc} · lädt ${G.cool} s</small>${btn}</div>`;
    }).join('');
    for (const b of document.querySelectorAll('#brShop button[data-k]')) b.onclick = () => this.brSend && this.brSend(b.dataset.k);
  }
  setLobby(m, myId) {
    this.brMe = m.players.find(p => p.id === myId);
    this.brShopDraw(); this.loadoutDraw();
    // Taucher-Auswahl: gesperrte zeigen Schloss und Preis, der ausgewählte (laut Server) ist markiert
    const owned = this.brMe?.suits || [];
    for (const b of document.querySelectorAll('#suits .suit')) {
      const S = SUITS[b.dataset.id], lock = !suitOwned(owned, b.dataset.id);
      b.classList.toggle('locked', lock);
      b.querySelector('.lock')?.remove();
      if (lock) b.insertAdjacentHTML('afterbegin', `<span class="lock">🔒 🦪 ${S.price}</span>`);
      if (this.brMe) b.classList.toggle('on', b.dataset.id === this.brMe.suit);
    }
    $('plist').innerHTML = m.players.map(p => `<li><span>${esc(p.name)}${p.id === myId ? ' <small>(du)</small>' : ''} <small class="liga">Liga ${p.league || 1}</small></span><small>${p.pearls ? `🦪 ${p.pearls} · ` : ''}${SUITS[p.suit].name}</small></li>`).join('')
      + `<li><span><small>+ ${m.bots} Bots</small></span></li>`;
    if (document.activeElement !== $('bots')) { $('bots').value = m.bots; $('botsN').textContent = m.bots; }
    const exp = m.mode === 'exp';
    for (const b of $('modes').children) b.classList.toggle('on', b.dataset.mode === m.mode);
    const wave = m.mode === 'wave';   // Wellen: immer zu viert, Bots füllen auf – kein Bot-Regler, kein Duo
    $('botsRow').classList.toggle('hidden', exp || wave);
    $('duoRow').classList.toggle('hidden', exp || wave); $('duo').checked = !!m.duo;
    $('plist').lastElementChild.classList.toggle('hidden', exp);
    $('go').textContent = exp ? 'EXPEDITION STARTEN' : 'ABTAUCHEN';
    $('lan').innerHTML = m.urls && m.urls.length
      ? `<b>Mitspieler im Heimnetz</b> öffnen im Browser:<br>${m.urls.map(u => `<code>${esc(u)}</code>`).join('<br>')}`
      : 'Kein Netzwerk gefunden – Solo-Runde gegen Bots.';
  }
  setMode(mode) {
    this.mode = mode; const exp = mode === 'exp';
    $('cntA').textContent = exp ? 'Geld' : 'Überlebende';
    $('cntK').textContent = exp ? 'Fang' : 'Kills';
    $('airBar').classList.toggle('on', exp);
    $('lampBar').classList.toggle('on', exp);
    if (!exp) { this.boss(null); this.closeShop(); }
  }
  boss(b) {
    $('bossBar').classList.toggle('hidden', !b);
    if (b) { this.set('bossName', 'text', '☠ ' + b.name); this.set('bossFill', 'width', b.hp + '%'); }
  }
  // ----- trader boat shop (expedition) -----
  initShop(onBuy, onClose, onQuit) {
    this.onBuy = onBuy;
    $('shopClose').addEventListener('click', onClose);
    $('shopQuit').addEventListener('click', onQuit);
  }
  get shopOpen() { return !$('shop').classList.contains('hidden'); }
  // kind: 'boat' (sell fish, buy gear) or 'base' (underwater base: aquarium)
  openShop(you, kind = 'boat') {
    this.shopKind = kind; $('shop').classList.remove('hidden'); this.shopMsg(''); this.shopKey = '';
    document.querySelector('.shopBox h2').innerHTML = kind === 'base' ? 'UNTERWASSER<span>-BASIS</span>' : 'HÄNDLER<span>-BOOT</span>';
    document.querySelector('.shopGrid').classList.toggle('hidden', kind === 'base');
    $('shopClose').textContent = 'WEITER TAUCHEN (E)';
    this.renderShop(you);
  }
  closeShop() { $('shop').classList.add('hidden'); }
  shopMsg(t, good) { const el = $('shopMsg'); el.textContent = t; el.style.color = good ? 'var(--hp)' : 'var(--warn)'; }
  renderShop(you) {
    if (!you || !you.x || !this.shopOpen) return;
    const base = this.shopKind === 'base';
    const x = you.x, key = [this.shopKind, x.money, x.tank, x.lung, x.lamp, JSON.stringify(x.bagL), JSON.stringify(x.aq), x.aqLvl, you.w.map(w => w && w[0] + w[1]).join()].join('|');
    if (key === this.shopKey) return; this.shopKey = key;
    $('shopMoney').textContent = 'Dein Geld: ' + money(x.money);
    const item = (title, sub, price, can, k, i, rar) => `<div class="item" style="--rar:${rar || '#55626c'}"><b>${title}</b><small>${sub}</small>`
      + (price === null ? `<button disabled>${can}</button>` : `<button data-k="${k}" data-i="${i}" ${x.money < price ? 'disabled' : ''}>${money(price)}</button>`) + '</div>';
    const T = TANKS[x.tank], NT = TANKS[x.tank + 1], L = LUNGS[x.lung], NL = LUNGS[x.lung + 1];
    let gear = item(`Flasche: ${T.name}`, `${T.cap} Luft · sicher bis ${T.maxDepth} m`, null, 'Hast du');
    gear += NT ? item(`▲ ${NT.name}`, `${NT.cap} Luft · sicher bis ${NT.maxDepth} m`, NT.price, '', 'tank', 0, '#3fa9f5') : item('Beste Flasche!', 'Mehr geht nicht', null, 'Max');
    gear += item(`Atmung: ${L.name}`, `Luftverbrauch ${Math.round(L.mul * 100)} %`, null, 'Hast du');
    gear += NL ? item(`▲ ${NL.name}`, `Luftverbrauch nur noch ${Math.round(NL.mul * 100)} %`, NL.price, '', 'lung', 0, '#3fa9f5') : item('Profi-Atmung!', 'Mehr geht nicht', null, 'Max');
    const LA = LAMPS[x.lamp], NLA = LAMPS[x.lamp + 1];
    gear += item(`Lampe: ${LA.name}`, `leuchtet ${LA.range} m · Akku ${LA.battery} s`, null, 'Hast du');
    gear += NLA ? item(`▲ ${NLA.name}`, `leuchtet ${NLA.range} m · Akku ${NLA.battery} s`, NLA.price, '', 'lamp', 0, '#3fa9f5') : item('Hellste Lampe!', 'Mehr geht nicht', null, 'Max');
    $('shopGear').innerHTML = gear;
    // ----- your catch + aquarium -----
    const fname = (f) => catchName(catchFromNet(f)), fval = (f) => fishValue(catchFromNet(f)), frate = (f) => catchRate(catchFromNet(f));
    const cap = AQUARIUM.sizes[x.aqLvl], full = x.aq.length >= cap;
    const bagV = x.bagL.reduce((a, f) => a + fval(f), 0);
    let fish = `<div><h3>Dein Fang · ${x.bagL.length} Fische`
      + (base ? '' : `<button class="smallBtn" data-k="sellall" data-i="0" ${x.bagL.length ? '' : 'disabled'}>Alles verkaufen ${money(bagV)}</button>`) + '</h3><div class="fishList">';
    fish += x.bagL.length ? x.bagL.map((f, i) => `<div class="frow"><span>${fname(f)} <small>· ${base ? '+' + perSec(frate(f)) + ' im Aquarium' : money(fval(f))}</small></span>`
      + (base ? `<button class="aqb" data-k="aq" data-i="${i}" ${full || f[0] === -1 ? 'disabled' : ''}>Ins Aquarium</button>` : `<button data-k="sell" data-i="${i}">Verkaufen +${money(fval(f))}</button>`) + '</div>').join('')
      : '<div class="empty">Noch nichts gefangen – ab ins Wasser!</div>';
    fish += `</div></div><div><h3>Aquarium · ${x.aq.length}/${cap} · +${perSec(x.aqRate)}</h3>`;
    if (base) {
      fish += '<div class="fishList">' + (x.aq.length ? x.aq.map((f, i) => `<div class="frow"><span>${fname(f)} <small>· +${perSec(frate(f))}</small></span><button data-k="aqsell" data-i="${i}">Freilassen</button></div>`).join('')
        : '<div class="empty">Leer. Nimm einen Fang in die Hand (Tasten 4–9 oder Q) und drück hier E – oder klick oben auf „Ins Aquarium“. Jeder Fisch verdient pro Sekunde Geld, Endbosse am meisten!</div>');
      const nextCap = AQUARIUM.sizes[x.aqLvl + 1];
      fish += '</div>' + (nextCap ? item(`▲ Größeres Aquarium`, `${cap} → ${nextCap} Plätze`, AQUARIUM.prices[x.aqLvl + 1], '', 'aqup', 0, '#3fa9f5') : item('Riesen-Aquarium!', 'Mehr Plätze gibt es nicht', null, 'Max'));
    } else fish += '<div class="empty">Fische ins Aquarium setzen kannst du in <b>deiner eigenen Unterwasser-Basis</b>: Etage 1, 50 m tief am Rand – auf der Minikarte gelb als <b>Deine Basis</b>. Jeder Spieler hat seine eigene. Dort kannst du auch Luft tanken.</div>';
    fish += '</div>';
    $('shopFish').innerHTML = fish;
    $('shopWeapons').innerHTML = SHOP_WEAPONS.map((it, i) => {
      const D = WEAPONS[it.wid], R = RARITY[it.rar], own = you.w.some(w => w && w[0] === it.wid && w[1] >= it.rar);
      return item(`${D.name} <small style="display:inline;color:${R.color}">${R.name}</small>`, `${Math.round(D.dmg * R.mul * D.pellets)} Schaden · ${D.rate}/s · Reichweite ${D.range} m`,
        own ? null : it.price, own ? 'Hast du' : '', 'w', i, R.color);
    }).join('');
    for (const b of document.querySelectorAll('#shop button[data-k]')) b.onclick = () => this.onBuy(b.dataset.k, +b.dataset.i);
  }
  show(which) {
    $('lobby').classList.toggle('hidden', which !== 'lobby');
    if (which !== 'lobby') { $('brShop').classList.add('hidden'); $('loadout').classList.add('hidden'); }   // Fenster zu, sobald die Runde startet
    $('hud').classList.toggle('hidden', which !== 'game');
    $('end').classList.toggle('hidden', which !== 'end');
    if (which !== 'game') $('pause').classList.add('hidden');
  }
  end(m, myId) {
    const mine = m.rank.find(r => r.id === myId);
    $('endTitle').innerHTML = mine && mine.place === 1 ? 'SIEG<span>!</span>' : 'AUFGE<span>TAUCHT</span>';
    $('endPlace').textContent = mine ? `PLATZ ${mine.place} VON ${m.total} · ${mine.k} KILLS` : `SIEGER: ${m.rank[0] ? m.rank[0].n : '–'}`;
    const P = mine && mine.pearls;
    $('endPearls').innerHTML = P ? `<b>+${P.sum} 🦪 Perlen</b><small>${mine.k} Kills +${P.k} · überlebt +${P.m}${P.p ? ` · Platz ${mine.place} +${P.p}` : ''}</small><small>Jetzt hast du ${P.total} Perlen</small>` : '';
    $('rank').innerHTML = m.rank.slice(0, 8).map(r => `<div class="${r.id === myId ? 'me' : ''}"><span class="num">${r.place}.</span><span>${esc(r.n)} <small>${SUITS[r.suit].name}${r.bot ? ' · Bot' : ''}</small></span><span class="num">${r.k} Kills</span></div>`).join('');
  }

  // ----- catch bar: caught fish and bosses you can take in your hand (keys 4-9, Q) -----
  catchBar(bag, held) {
    const key = JSON.stringify(bag) + '|' + held;
    if (key === this.catchKey) return; this.catchKey = key;
    const start = held >= 6 ? held - 5 : 0, el = $('catchBar');
    let h = '';
    for (let k = 0; k < 6; k++) {
      const i = start + k, f = bag[i];
      if (!f) { h += `<div class="cslot empty"><div>${k + 4}</div><div class="n">–</div><div>&nbsp;</div></div>`; continue; }
      const e = catchFromNet(f), boss = e.b != null;
      h += `<div class="cslot${i === held ? ' on' : ''}${boss ? ' boss' : e.g ? ' gold' : ''}"><div>${k + 4}${boss ? ' ☠' : e.g ? ' ⭐' : ''}</div>`
        + `<div class="n">${esc(boss ? BOSSES[e.b].name : catchName(e).replace('⭐ Goldener ', ''))}</div><div class="r">+${perSec(catchRate(e)).replace(' €/s', '/s')}</div></div>`;
    }
    if (bag.length > start + 6) h += `<div id="catchMore">+${bag.length - start - 6} mehr [Q]</div>`;
    el.innerHTML = h;
  }

  // ----- in game -----
  update(s) {
    const y = s.you;
    if (y) {
      this.set('hpFill', 'width', Math.max(0, y.hp / y.mhp * 100) + '%'); this.set('hpTxt', 'text', y.hp + ' / ' + y.mhp);
      this.set('shFill', 'width', y.sh + '%'); this.set('shTxt', 'text', y.sh ? String(y.sh) : '');
      this.set('enFill', 'width', s.energy + '%');
      this.set('kills', 'text', String(y.kills));
      this.set('suitName', 'text', SUITS[s.suit].name);
      $('vehBar').classList.toggle('on', !!y.vhp);
      if (y.vhp) { this.set('vhFill', 'width', y.vhp / 450 * 100 + '%'); this.set('vhTxt', 'text', 'Rumpf ' + y.vhp); }
      for (let i = 0; i < 3; i++) {
        const w = y.w[i], sl = this.slots[i], key = w ? w.join() + (y.slot === i) + Math.round(y.rl * 10) : 'x' + (y.slot === i);
        if (sl.key === key) continue; sl.key = key;
        sl.d.classList.toggle('on', y.slot === i);
        if (w) {
          const def = modDef(w[0], w[4]);   // mit Aufsätzen (größeres Magazin)
          sl.n.textContent = def.name; sl.d.style.setProperty('--rar', RARITY[w[1]].color);
          // Nachladen = Magazin wechseln. Daneben die Ersatzmagazine im Rucksack: jedes zeigt, wie voll es ist (der Kompressor füllt nach).
          const reloading = y.slot === i && y.rl > 0;
          const done = reloading ? 1 - y.rl / y.rlT : 0;   // 0 = gerade angefangen, 1 = fertig
          const spares = w[3] || [];
          const mags = `<span class="mags">${spares.map(f => `<i class="${f >= 1 ? 'full' : ''}"><b style="height:${Math.round(f * 100)}%"></b></i>`).join('')}</span>`;
          const waiting = w[2] === 0 && !spares.some(f => f * def.mag >= 1);
          sl.a.innerHTML = def.melee ? `Nahkampf · Reichweite ${def.range} m` : reloading ? '🔄 Magazin wechseln …' : waiting ? `${mags} Kompressor füllt …` : `<b class="num">${w[2]}</b> / ${def.mag} ${mags} · ${def.range} m`;
          sl.rl.style.width = done * 100 + '%';
          sl.rl.style.background = '#3fa9f5';
        } else { sl.n.textContent = '–'; sl.a.textContent = 'leer'; sl.d.style.setProperty('--rar', '#35424b'); sl.rl.style.width = '0'; }
      }
      this.set('ink', 'opacity', y.ink > 0 ? Math.min(1, y.ink / 0.8) : 0);
    }
    this.set('alive', 'text', String(s.alive));
    this.set('depth', 'text', `TIEFE ${Math.round(s.depth)} m`);
    $('catchBar').classList.toggle('on', this.mode === 'exp' && !!(y && y.x && y.x.bagL.length));
    if (this.mode === 'exp' && y && y.x) {
      this.catchBar(y.x.bagL, s.held ?? -1);
      $('slots').classList.toggle('off', (s.held ?? -1) >= 0);   // weapon put away while holding a catch
      const x = y.x, T = TANKS[x.tank], f = floorAt(s.depth), deep = s.depth > T.maxDepth;
      this.set('alive', 'text', money(x.money) + (x.aqRate > 0 ? (x.afk ? ' (AFK – pausiert)' : ` (+${perSec(x.aqRate)})`) : ''));
      this.set('kills', 'text', x.bag ? `${x.bag} · ${money(x.bagV)}` : '0');
      this.set('airFill', 'width', Math.max(0, x.air / T.cap * 100) + '%');
      const secs = s.depth < 2.6 ? '' : ` · ~${Math.floor(x.air / (airUse(s.depth) * LUNGS[x.lung].mul))} s`;
      this.set('airTxt', 'text', `Luft ${Math.round(x.air)}${secs}`);
      $('airBar').classList.toggle('low', x.air < T.cap * 0.25);
      if (s.lamp) {
        this.set('lampFill', 'width', Math.max(0, s.lamp.bat / s.lamp.cap * 100) + '%');
        this.set('lampTxt', 'text', s.lamp.bat <= 0 ? 'Lampe leer – oben aufladen' : `Lampe ${s.lamp.on ? 'AN' : 'aus [L]'} · ${Math.ceil(s.lamp.bat)} s`);
        $('lampBar').classList.toggle('off', !s.lamp.on);
      }
      this.set('depth', 'text', `TIEFE ${Math.round(s.depth)} m · FLASCHE BIS ${T.maxDepth} m${deep ? ' ⚠ DRUCK!' : ''}`);
      this.set('zoneTxt', 'text', s.depth < 2.6 ? 'An der Oberfläche · Luft tanken' : `Etage ${f + 1} · ${FLOORS[f].name}`);
      $('zoneTxt').classList.toggle('hot', deep);
    }
    const z = s.zone;
    if (s.wave) {   // Wellen-Modus: Welle und Haie statt Schwarzwasser
      const [n, v] = s.wave;
      this.set('zoneTxt', 'text', v >= 0 ? (n ? `Welle ${n} geschafft · nächste in ${mmss(v)}` : `Erste Welle in ${mmss(v)}`) : `Welle ${n} · noch ${-v} ${v === -1 ? 'Hai' : 'Haie'}`);
      $('zoneTxt').classList.toggle('hot', v < 0);
    } else if (z) {
      const txt = z[5] <= 0 && !z[8] ? 'Schwarzwasser überall – letzter Kampf!' : z[8] ? `Schwarzwasser rückt vor · ${mmss(z[7])}` : `Schwarzwasser kommt in ${mmss(z[7])}`;
      this.set('zoneTxt', 'text', txt); $('zoneTxt').classList.toggle('hot', !!z[8]);
    }
    this.set('zoneTint', 'opacity', s.outside ? 1 : 0);
    if (this.bannerT > 0 && (this.bannerT -= s.dt) <= 0) $('banner').classList.remove('on');
    this.vign = Math.max(0, (this.vign || 0) - s.dt * 1.6);
    const low = y && y.alive && y.hp < y.mhp * 0.3 ? 0.35 + 0.15 * Math.sin(s.time * 6) : 0;
    $('vign').style.opacity = Math.max(this.vign, low);
  }
  drawMini(base, zone, me, vehicles, pois, marks = []) {
    this.mini.canvas.classList.remove('sonar');
    if (this.nearHtml) { this.nearHtml = ''; $('near').classList.add('hidden'); }
    const c = this.mini, n = 190, k = n / (HALF * 2), px = (x) => (x + HALF) * k;
    c.drawImage(base, 0, 0, n, n);
    c.font = '10px Bahnschrift, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(230,251,255,.75)';
    for (const p of pois) c.fillText(p.n, px(p.x), px(p.z) - 5);
    if (zone) {
      if (zone[5] > 0) { c.strokeStyle = 'rgba(255,255,255,.9)'; c.setLineDash([4, 4]); c.lineWidth = 1.2; c.beginPath(); c.arc(px(zone[3]), px(zone[4]), zone[5] * k, 0, 7); c.stroke(); c.setLineDash([]); }
      c.fillStyle = 'rgba(120,40,220,.42)'; const zr = Math.max(0, zone[2] * k); c.beginPath(); c.rect(0, 0, n, n); c.moveTo(px(zone[0]) + zr, px(zone[1])); c.arc(px(zone[0]), px(zone[1]), zr, 0, Math.PI * 2); c.closePath(); c.fill('evenodd');
      c.strokeStyle = '#c58bff'; c.lineWidth = 1.6; c.beginPath(); c.arc(px(zone[0]), px(zone[1]), Math.max(0, zone[2] * k), 0, 7); c.stroke();
    }
    for (const m of marks) { c.fillStyle = m.c; c.beginPath(); c.arc(px(m.x), px(m.z), m.s, 0, 7); c.fill(); }
    c.fillStyle = '#ffc94d';
    for (const v of vehicles) if (!v.driver) { const s = v.type === 'sub' ? 5 : 3; c.fillRect(px(v.x) - s / 2, px(v.z) - s / 2, s, s); }
    c.save(); c.translate(px(me.x), px(me.z)); c.rotate(-me.yaw);
    c.fillStyle = '#5ef2e0'; c.strokeStyle = '#03222a'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(0, 3); c.lineTo(-5, 6); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }
  // Sonar-Radar (Battle Royale): du bist in der Mitte, vorne ist oben. Ein grüner Strahl dreht sich;
  // wo er drüberstreicht, leuchten Boden und Gegner kurz auf und verblassen dann wieder.
  // blips = Gegner, die das Sonar hören kann ({ id, x, z }), time = Spielzeit in Sekunden
  // live = true (im U-Boot): Gegner werden durchgehend angezeigt, nicht nur kurz beim Überstreichen. Gibt zurück, wie viele Gegner neu erwischt wurden.
  // items = Dinge, die man benutzen kann: { x, z, k: 'sub' | 'scooter' | 'jetski' | 'ray' | 'crate' | 'w' | 'med' | 'sh', rar }
  drawSonar(img, zone, me, items, pois, marks, blips, time, live = false) {
    let newHits = 0;
    this.mini.canvas.classList.add('sonar');
    const c = this.mini, n = 190, h = n / 2, R = SONAR.range, k = (h - 2) / R, cy = Math.cos(me.yaw), sy = Math.sin(me.yaw);
    const scr = (x, z) => { const dx = x - me.x, dz = z - me.z; return [h + (dx * cy - dz * sy) * k, h + (dx * sy + dz * cy) * k]; };
    const TAU = Math.PI * 2, sweep = (time / SONAR.period * TAU) % TAU, last = this.lastSweep ?? sweep; this.lastSweep = sweep;
    const swS = sweep + me.yaw;   // Strahl-Winkel auf dem Bildschirm
    c.clearRect(0, 0, n, n);
    c.save(); c.beginPath(); c.arc(h, h, h - 1, 0, TAU); c.clip();
    c.fillStyle = '#010d08'; c.fillRect(0, 0, n, n);
    // Boden: schwach immer, hell direkt hinter dem Strahl (in Stücken, die immer mehr verblassen)
    const world = () => { c.translate(h, h); c.rotate(me.yaw); c.scale(k, k); c.translate(-me.x, -me.z); c.drawImage(img, -HALF, -HALF, HALF * 2, HALF * 2); };
    c.save(); c.globalAlpha = 0.16; world(); c.restore();
    const K = 32, step = TAU * (SONAR.fade / SONAR.period) / K;
    for (let i = 0; i < K; i++) {
      const a1 = swS - i * step, a0 = a1 - step * 1.02, al = 1 - i / K;
      c.save(); c.beginPath(); c.moveTo(h, h); c.arc(h, h, h, a0, a1); c.closePath(); c.clip();
      c.globalAlpha = 0.84 * al * al; world(); c.restore();
      if (i < 10) { c.fillStyle = `rgba(90,255,150,${0.16 * (1 - i / 10)})`; c.beginPath(); c.moveTo(h, h); c.arc(h, h, h, a0, a1); c.closePath(); c.fill(); }
    }
    // Ringe alle 30 m und der Strahl selbst
    c.strokeStyle = 'rgba(90,255,150,.22)'; c.lineWidth = 1;
    for (let r = 30; r < R; r += 30) { c.beginPath(); c.arc(h, h, r * k, 0, TAU); c.stroke(); }
    c.strokeStyle = 'rgba(160,255,190,.9)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(h, h); c.lineTo(h + Math.cos(swS) * h, h + Math.sin(swS) * h); c.stroke();
    // Zone (lila außen) und nächste Zone (gestrichelt)
    if (zone) {
      const [zx, zy] = scr(zone[0], zone[1]), zr = Math.max(0, zone[2] * k);
      c.fillStyle = 'rgba(120,40,220,.35)'; c.beginPath(); c.rect(0, 0, n, n); c.moveTo(zx + zr, zy); c.arc(zx, zy, zr, 0, TAU); c.closePath(); c.fill('evenodd');
      c.strokeStyle = '#c58bff'; c.lineWidth = 1.6; c.beginPath(); c.arc(zx, zy, zr, 0, TAU); c.stroke();
      if (zone[5] > 0) { const [nx, ny] = scr(zone[3], zone[4]); c.strokeStyle = 'rgba(255,255,255,.8)'; c.setLineDash([4, 4]); c.lineWidth = 1.2; c.beginPath(); c.arc(nx, ny, zone[5] * k, 0, TAU); c.stroke(); c.setLineDash([]); }
    }
    // Orte, freie Fahrzeuge und feste Markierungen
    c.font = '10px Bahnschrift, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(200,255,215,.7)';
    for (const p of pois) { const [x, y] = scr(p.x, p.z); if (Math.hypot(x - h, y - h) < h - 8) c.fillText(p.n, x, y - 4); }
    // Dinge in der Nähe: Fahrzeuge, Truhen, Waffen, Medikits – mit eigenem Symbol. Unten steht, wie viele es sind.
    // Ist kein Fahrzeug (oder keine Truhe) in Reichweite, zeigt ein Pfeil am Rand zum nächsten, mit Entfernung.
    const count = {}, best = {};
    for (const it of items) {
      const d = Math.hypot(it.x - me.x, it.z - me.z), grp = VEH_KINDS.includes(it.k) ? 'veh' : it.k;
      if (d < R) { const [x, y] = scr(it.x, it.z); nearIcon(c, it.k, x, y, it.rar); count[it.k] = (count[it.k] || 0) + 1; }
      if ((grp === 'veh' || grp === 'crate') && (!best[grp] || d < best[grp].d)) best[grp] = { ...it, d };
    }
    for (const g of ['veh', 'crate']) {
      const b = best[g]; if (!b || b.d < R || b.d > NEAR.far) continue;
      const [x, y] = scr(b.x, b.z), a = Math.atan2(y - h, x - h), rx = h + Math.cos(a) * (h - 13), ry = h + Math.sin(a) * (h - 13);
      c.save(); c.translate(rx, ry); c.rotate(a); c.fillStyle = g === 'veh' ? '#ffc94d' : '#ff9a3c'; c.strokeStyle = '#2a1a00';
      c.beginPath(); c.moveTo(7, 0); c.lineTo(-3, -5); c.lineTo(-1, 0); c.lineTo(-3, 5); c.closePath(); c.fill(); c.stroke(); c.restore();
      const tx = h + Math.cos(a) * (h - 30), ty = h + Math.sin(a) * (h - 30);
      c.font = 'bold 10px Bahnschrift, sans-serif'; c.fillStyle = g === 'veh' ? '#ffe39a' : '#ffc08a';
      c.fillText(`${NEAR_NAME[b.k][0]} ${Math.round(b.d)} m`, tx, ty + 3);
    }
    for (const m of marks) { const [x, y] = scr(m.x, m.z); c.fillStyle = m.c; c.beginPath(); c.arc(x, y, m.s, 0, TAU); c.fill(); }
    // Text unter dem Radar
    const parts = [...VEH_KINDS, 'crate', 'w', 'med', 'sh'].filter(k => count[k]).map(k => `<i>${count[k]}</i> ${NEAR_NAME[k][count[k] > 1 ? 1 : 0]}`);
    const html = parts.length ? '<b>In der Nähe:</b> ' + parts.join(' · ') : '';
    if (html !== this.nearHtml) { this.nearHtml = html; const el = $('near'); el.innerHTML = html; el.classList.toggle('hidden', !html); }
    // Gegner: leuchten auf, wenn der Strahl über sie streicht, und bleiben kurz an der Stelle stehen
    const echo = this.echo ||= new Map(), swept = ((sweep - last) % TAU + TAU) % TAU;
    for (const b of blips) {
      const a = Math.atan2(b.z - me.z, b.x - me.x);
      if (live) { echo.set(b.id, { x: b.x, z: b.z, t: time }); continue; }   // U-Boot: immer sichtbar, an der aktuellen Stelle
      if (((sweep - a) % TAU + TAU) % TAU <= swept) { if (!echo.has(b.id)) newHits++; echo.set(b.id, { x: b.x, z: b.z, t: time }); }
    }
    for (const [id, e] of echo) {
      const al = 1 - (time - e.t) / SONAR.fade; if (al <= 0) { echo.delete(id); continue; }
      const [x, y] = scr(e.x, e.z);
      c.fillStyle = `rgba(255,90,80,${al * 0.35})`; c.beginPath(); c.arc(x, y, 7, 0, TAU); c.fill();
      c.fillStyle = `rgba(255,120,100,${al})`; c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill();
    }
    c.restore();
    // Rand, Norden und du selbst (Pfeil zeigt immer nach oben = da wo du hinschaust)
    c.strokeStyle = 'rgba(90,255,150,.6)'; c.lineWidth = 2; c.beginPath(); c.arc(h, h, h - 1, 0, TAU); c.stroke();
    c.fillStyle = 'rgba(200,255,215,.9)'; c.font = 'bold 11px Bahnschrift, sans-serif'; c.fillText('N', h + sy * (h - 9), h - cy * (h - 9) + 4);
    c.fillStyle = '#5ef2e0'; c.strokeStyle = '#03222a'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(h, h - 7); c.lineTo(h + 5, h + 6); c.lineTo(h, h + 3); c.lineTo(h - 5, h + 6); c.closePath(); c.fill(); c.stroke();
    this.sweepWrapped = sweep < last;   // Strahl hat gerade eine ganze Runde gemacht
    return newHits;
  }
  feed(html, me) {
    const d = document.createElement('div'); d.innerHTML = html; if (me) d.className = 'me';
    const f = $('feed'); f.prepend(d); while (f.children.length > 6) f.lastChild.remove();
    setTimeout(() => d.remove(), 6000);
  }
  banner(text, dur = 2.6) { const b = $('banner'); b.textContent = text; b.classList.add('on'); this.bannerT = dur; }
  prompt(p) { const el = $('prompt'), key = p ? p.join() : ''; if (this.pKey === key) return; this.pKey = key; el.classList.toggle('hidden', !p); if (p) el.innerHTML = `<kbd>${p[0]}</kbd>${esc(p[1])}`; }
  // left = wie viel Leben das Ziel noch hat (1 = voll, 0 = tot). Die Zahl geht von grün (voll) über gelb nach rot (fast tot).
  // Fernrohr-Bild beim Zielen ein- und ausblenden (das normale Fadenkreuz verschwindet dann)
  // Rückstoß im Fernrohr: das schwarze Fernrohr-Bild springt kurz nach unten und wird größer (das Auge stößt fast ans Okular)
  scopeKick(k) { const v = Math.round(k * 100) / 100; if (this.sk === v) return; this.sk = v; $('scope').style.transform = v ? `translateY(${v * 4}vh) scale(${1 + v * 0.08})` : ''; }
  // on = durchs Zielfernrohr, ads = über Kimme und Korn zielen: dann verschwindet das normale Fadenkreuz
  // Periskop-Anzeige: Gradzahl der Blickrichtung oben (null = aus)
  periscope(yaw) {
    const el = $('peri'); if (!el) return;
    if (yaw == null) { if (this.periOn) { el.classList.add('hidden'); this.periOn = false; } return; }
    const deg = Math.round(((-yaw * 180 / Math.PI) % 360 + 360) % 360);
    if (!this.periOn) { el.classList.remove('hidden'); this.periOn = true; }
    if (this.periDeg !== deg) { this.periDeg = deg; el.textContent = `PERISKOP · ${String(deg).padStart(3, '0')}°`; }
  }
  scope(on, ads = on) { const k = on + '|' + ads; if (this.scopeKey === k) return; this.scopeKey = k; $('scope').classList.toggle('on', on); $('cross').style.display = on || ads ? 'none' : ''; }
  hitmark(dmg, kill, left) {
    const h = $('hitm'); h.classList.remove('on'); h.classList.toggle('kill', !!kill); void h.offsetWidth; h.classList.add('on');
    const d = $('dmgNum'); d.textContent = dmg; d.classList.remove('on'); void d.offsetWidth; d.classList.add('on');
    // Farbton: 120 = grün, 60 = gelb, 0 = rot
    d.style.color = left == null ? '' : `hsl(${Math.round(Math.max(0, Math.min(1, left)) * 120)}, 95%, 55%)`;
  }
  hurt(rel) {
    this.vign = 0.9;
    if (rel === null) return;
    const i = document.createElement('i'); i.style.transform = `rotate(${rel}rad)`; $('dirs').appendChild(i); setTimeout(() => i.remove(), 1100);
    this.shotDir(rel, true);
  }
  // Schuss-Richtungsanzeige: ein Pfeil am Ring um die Bildmitte zeigt, woher geschossen wurde (rot = du wurdest getroffen)
  shotDir(rel, hit = false) {
    const now = performance.now(), key = Math.round(rel * 6) + (hit ? 'h' : '');
    if (this.lastDir && this.lastDir[key] && now - this.lastDir[key] < 350) return;   // nicht 10 Pfeile für eine Salve
    (this.lastDir ||= {})[key] = now;
    const b = document.createElement('b'); if (hit) b.className = 'hit';
    b.style.transform = `rotate(${rel}rad)`; $('dirs').appendChild(b); setTimeout(() => b.remove(), 1600);
  }
  // Gadget unten rechts: Name und Ladebalken (voll = bereit). gd = [Nummer, Sekunden bis bereit] oder null
  gadget(gd) {
    const key = gd ? gd[0] + ':' + gd[1] : '';
    if (key === this.gadKey) return; this.gadKey = key;
    $('gadBox').classList.toggle('hidden', !gd);
    if (!gd) return;
    const G = GADGETS[gd[0]], ready = gd[1] <= 0;
    $('gadName').textContent = ready ? G.name : `${G.name} ${Math.ceil(gd[1])} s`;
    $('gadFill').style.width = Math.round((1 - gd[1] / G.cool) * 100) + '%';
    $('gadBox').classList.toggle('ready', ready);
  }
  // Ulti-Leiste: ul = [Prozent geladen, Sekunden noch aktiv] oder null (kein Ulti / Expedition)
  ulti(ul, suit) {
    const key = ul ? ul[0] + ':' + ul[1] : '';
    if (key === this.ultKey) return; this.ultKey = key;
    $('ultBox').classList.toggle('hidden', !ul);
    // Bild-Effekt während der Ulti: Manta fast farblos (Matrix), Sepia lila (getarnt), Hammerhai rot (Blutrausch)
    const fx = $('ultFx'); fx.dataset.k = suit; fx.style.opacity = ul && ul[1] > 0 && ['manta', 'sepia', 'hammerhai'].includes(suit) ? 1 : 0;
    if (!ul) return;
    const U = ULTIS[suit], on = ul[1] > 0, ready = !on && ul[0] >= 100;
    $('ultName').textContent = on ? `${U.name} ${Math.ceil(ul[1])} s` : ready ? `${U.name} bereit!` : `${U.name} ${ul[0]} %`;
    $('ultFill').style.width = (on ? Math.round(ul[1] / U.time * 100) : ul[0]) + '%';
    $('ultBox').classList.toggle('ready', ready); $('ultBox').classList.toggle('on', on);
  }
  shock() { const s = $('shockFx'); s.style.opacity = 1; setTimeout(() => { s.style.opacity = 0; }, 180); }
  spec(html) { const el = $('spec'); el.classList.toggle('hidden', !html); if (html && this.sKey !== html) { this.sKey = html; el.innerHTML = html; } }
  pause(on) { $('pause').classList.toggle('hidden', !on); }
  conn(lost) { $('conn').classList.toggle('hidden', !lost); }
}
