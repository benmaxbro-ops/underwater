// Headless smoke test: joins as a client, starts a match and lets bots fight it out.
import WebSocket from 'ws';
const ws = new WebSocket('ws://localhost:' + (process.env.PORT || 8080));
let snaps = 0, kills = [], maxProj = 0, t0 = Date.now(), me, spawn, evCount = {};
ws.on('message', (raw) => {
  const m = JSON.parse(raw);
  if (m.t === 'welcome') { me = m.id; ws.send(JSON.stringify({ t: 'set', name: 'Tester', suit: 'triton', bots: 15 })); setTimeout(() => ws.send(JSON.stringify({ t: 'start' })), 200); }
  if (m.t === 'start') { spawn = m.spawn; console.log('start: players', m.players.length, 'crates', m.crates.length, 'pickups', m.pickups.length); }
  if (m.t === 's') {
    snaps++;
    for (const e of m.c.e) { evCount[e[0]] = (evCount[e[0]] || 0) + 1; if (e[0] === "kill") kills.push(`${Math.round(m.c.tm)}s ${e[1]} -> ${e[2]}`); }
    if (snaps % 40 === 0) console.log(`t=${m.c.tm} alive=${m.c.n} zoneR=${m.c.z[2]} creatures=${m.c.c.length} you=${m.you && m.you.hp}/${m.you && m.you.alive} bytes=${raw.length}`);
    if (spawn && m.you && m.you.alive) ws.send(JSON.stringify({ t: 'm', x: m.c.z[3], y: 100, z: m.c.z[4], yaw: 0, pitch: 0 }));
  }
  if (m.t === 'end') {
    console.log('END after', ((Date.now() - t0) / 1000).toFixed(1), 's real. Top 5:', m.rank.slice(0, 5).map(r => `${r.place}.${r.n}(${r.k})`).join(', '));
    console.log('events', evCount); console.log('kills', kills.length, kills.join(' | '));
    process.exit(0);
  }
});
setTimeout(() => { console.log('TIMEOUT', evCount, kills.length); process.exit(1); }, 100000);
