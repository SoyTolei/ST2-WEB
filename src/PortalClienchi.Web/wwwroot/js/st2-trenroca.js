/*!
 * TrenRoca ASCII loader - animacion de ~10 s en puntos LED (Papa Noel muerto de calor en el tren Roca), sin dependencias.
 * Uso: un elemento con atributo data-trenroca (ancho a gusto, mantiene 16:9) y este archivo con una etiqueta script.
 * API: var L = TrenRoca.mount(el, {duration:10, loop:false, timer:true, onDone:fn});
 *      L.restart()  L.destroy()  L.renderAt(t)  (para fotos fijas / pruebas)
 */
(function () {
'use strict';
var GW = 256, GH = 144, TAU = Math.PI * 2;
var FONT = 'ui-monospace,"DejaVu Sans Mono",Menlo,Consolas,monospace';
function hash(n) { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }
function rnd(a, b) { return hash(a * 13.37 + b * 7.77); }
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function lerp(a, b, u) { return a + (b - a) * u; }
function ease(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
function easeOut(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }
var PAL = ['#ff4646', '#ffd23c', '#3cdc6e', '#5aa0ff', '#ff6ede'];
var T_EXIT = 7.9, T_DEER_EXIT = 7.5;
var PRESENTS = [0.9, 2.0, 3.1, 4.2, 5.3];
var FIREWORKS = [{ t: -0.6, x: 70, y: 40, c: [0, 1, 5] }];
(function () {
  var combos = [[0, 1, 5], [2, 3, 5], [4, 1, 3], [0, 2, 5], [1, 4, 3], [3, 5, 0]];
  for (var i = 0; i < 11; i++) FIREWORKS.push({ t: 0.2 + i * 0.78, x: 24 + Math.floor(hash(i * 5.3 + 2) * 208), y: 22 + Math.floor(hash(i * 2.9 + 7) * 44), c: combos[i % 6] });
})();
var FW_COL = [[255, 70, 70], [255, 214, 70], [70, 230, 120], [90, 160, 255], [255, 110, 222], [255, 255, 255]];
var GLYPH = {
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110']
};
var MSG = 'FELIZ NAVIDAD 2026';

/* ---------------- skyline (Buenos Aires con Obelisco), periodo 512 ---------------- */
var SKY = [], SKYP = 512;
(function () {
  var x = 0;
  while (x < SKYP) {
    var w = 5 + Math.floor(hash(x * 3.1 + 1) * 9), h = 5 + Math.floor(hash(x * 1.7 + 5) * 15);
    if (!(x + w > 150 && x < 192)) SKY.push({ x: x, w: w, h: h });
    x += w + (hash(x + 9) < 0.3 ? 1 : 0);
  }
})();

/* ---------------- poses ---------------- */
function trainPose(t) {
  var p = { s: 1, x: 186, y: 92 + Math.sin(t * 2.4) * 1.6, rot: Math.sin(t * 1.7) * 0.008 };
  if (t > T_EXIT) { var a = t - T_EXIT; p.x += a * a * 72; }
  return p;
}
function toWorld(p, lx, ly) {
  var c = Math.cos(p.rot), s = Math.sin(p.rot);
  return { x: p.x + (lx * c - ly * s) * p.s, y: p.y + (lx * s + ly * c) * p.s };
}
function deerPose(t) {
  var p = { x: 213, y: 82 + Math.sin(t * 7 + 1) * 1.8, rot: Math.sin(t * 7) * 0.04, hitched: true, ph: t * 7 };
  if (t > T_DEER_EXIT) { var a = t - T_DEER_EXIT; p.x += a * a * 90; }
  return p;
}

/* ---------------- helpers de dibujo ---------------- */
function px(g, x, y, col, a) { g.globalAlpha = a == null ? 1 : clamp(a, 0, 1); g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), 1, 1); g.globalAlpha = 1; }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function glow(g, x, y, r, rgb, a) {
  var gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawStars(g, t) {
  for (var i = 0; i < 120; i++) {
    var z = 0.3 + rnd(i, 3) * 0.7, sp = 3 + z * 9;
    var x = ((rnd(i, 1) * GW - t * sp) % GW + GW) % GW, y = rnd(i, 2) * 118;
    var tw = 0.45 + 0.55 * Math.sin(t * (1 + rnd(i, 4) * 2.5) + i * 1.7), big = rnd(i, 5) > 0.9;
    px(g, x, y, '#ffffff', tw * (0.35 + 0.65 * z));
    if (big) { px(g, x - 1, y, '#cfe0ff', tw * 0.5); px(g, x + 1, y, '#cfe0ff', tw * 0.5); px(g, x, y - 1, '#cfe0ff', tw * 0.5); px(g, x, y + 1, '#cfe0ff', tw * 0.5); }
  }
}
function drawMoon(g) {
  var mx = 172, my = 22;
  glow(g, mx, my, 26, '220,225,255', 0.20);
  g.fillStyle = '#ebe6d2'; g.beginPath(); g.arc(mx, my, 11, 0, TAU); g.fill();
  g.fillStyle = 'rgba(150,146,128,0.55)';
  [[-4, -3, 3.2], [4, 3, 2.6], [-2, 6, 1.8], [5, -5, 1.6]].forEach(function (c) { g.beginPath(); g.arc(mx + c[0], my + c[1], c[2], 0, TAU); g.fill(); });
}
function drawSkyline(g, t) {
  var off = -((t * 14) % SKYP);
  for (var rep = 0; rep < 2; rep++) {
    var ox = off + rep * SKYP;
    if (ox > GW || ox + SKYP < 0) continue;
    for (var i = 0; i < SKY.length; i++) {
      var b = SKY[i], x = ox + b.x; if (x > GW || x + b.w < 0) continue;
      g.fillStyle = '#242e4c'; g.fillRect(Math.round(x), GH - b.h, b.w, b.h);
      g.fillStyle = '#46568a'; g.fillRect(Math.round(x), GH - b.h, b.w, 1);
      for (var wy = GH - b.h + 2; wy < GH - 2; wy += 3) for (var wx = 1; wx < b.w - 1; wx += 2) {
        var hv = hash(b.x * 7.1 + wx * 3.3 + wy * 1.9);
        if (hv > 0.78) px(g, x + wx, wy, '#e6be64', 0.85);
        else if (hv < 0.05) px(g, x + wx, wy, PAL[Math.floor(hv * 100) % 5], 0.9);
      }
    }
    // Obelisco
    var cx = ox + 170;
    if (cx > -10 && cx < GW + 10) {
      g.fillStyle = '#b4c0e0'; g.beginPath(); g.moveTo(cx - 2.6, GH); g.lineTo(cx - 1.1, GH - 28); g.lineTo(cx, GH - 31); g.lineTo(cx + 1.1, GH - 28); g.lineTo(cx + 2.6, GH); g.closePath(); g.fill();
      g.fillStyle = '#7886b4'; g.beginPath(); g.moveTo(cx + 0.4, GH); g.lineTo(cx + 0.5, GH - 29); g.lineTo(cx + 1.1, GH - 28); g.lineTo(cx + 2.6, GH); g.closePath(); g.fill();
      var bl = Math.sin(t * 5) > 0;
      px(g, cx, GH - 32, bl ? '#ff5a5a' : '#ffd23c', 1); glow(g, cx, GH - 32, 5, bl ? '255,80,80' : '255,210,60', 0.35);
    }
  }
}
function drawFireworks(g, t) {
  FIREWORKS.forEach(function (f, fi) {
    var a = t - f.t;
    if (a < -0.7 || a > 1.9) return;
    if (a < 0) {
      var u = (a + 0.7) / 0.7, ry = lerp(122, f.y, easeOut(u));
      for (var k = 0; k < 7; k++) px(g, f.x + (rnd(fi, k) - 0.5) * 1.5, ry + k * 1.7, '#ffe9a0', (1 - k / 7) * 0.9);
      return;
    }
    if (a < 0.5) glow(g, f.x, f.y, 30, '255,235,190', 0.55 * (1 - a / 0.5));
    for (var i = 0; i < 96; i++) {
      var ang = i * TAU / 96 + rnd(fi, i) * 0.2, sp = (i % 3 === 0 ? 20 : i % 3 === 1 ? 33 : 44) * (0.75 + rnd(fi, i + 50) * 0.4);
      var d = sp * (a - 0.32 * a * a), x = f.x + Math.cos(ang) * d, y = f.y + Math.sin(ang) * d + 22 * a * a;
      var c = FW_COL[f.c[i % f.c.length]], al = Math.min(1, (1 - a / 1.9) * 1.5);
      px(g, x, y, 'rgb(' + c + ')', al);
      px(g, x + 1, y, 'rgb(' + c + ')', al * 0.7); px(g, x, y + 1, 'rgb(' + c + ')', al * 0.7);
      if (a > 0.25) { px(g, x - Math.cos(ang) * 1.8, y - Math.sin(ang) * 1.8 - 0.6, 'rgb(' + c + ')', al * 0.5); px(g, x - Math.cos(ang) * 3.4, y - Math.sin(ang) * 3.4 - 1, 'rgb(' + c + ')', al * 0.25); }
    }
  });
}
function drawPresents(g, t) {
  var cols = ['#3cdc6e', '#ff4646', '#5aa0ff', '#ffd23c', '#ff6ede'];
  PRESENTS.forEach(function (ts, i) {
    var a = t - ts; if (a < 0) return;
    var p0 = trainPose(ts), o = toWorld(p0, -54, -8), x = o.x - 16 * a, y = o.y - 12 * a + 26 * a * a;
    if (y < 124) {
      var c = cols[i % 5];
      g.fillStyle = c; g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
      g.fillStyle = i % 2 ? '#ffffff' : '#ffe9a0'; g.fillRect(Math.round(x), Math.round(y) - 2, 1, 5); g.fillRect(Math.round(x) - 2, Math.round(y), 5, 1);
      px(g, x - 1, y - 3, c, 1); px(g, x + 1, y - 3, c, 1);
      px(g, x + 3 + a * 2, y - 1 - Math.sin(t * 20 + i) * 2, '#ffe9a0', 0.8);
    } else {
      var tl = ts + (12 + Math.sqrt(144 + 4 * 26 * (124 - o.y))) / (2 * 26), b = t - tl;
      if (b > 0 && b < 0.7) for (var k = 0; k < 12; k++) {
        var an = k * TAU / 12, d = 12 * b;
        px(g, o.x - 16 * (tl - ts) + Math.cos(an) * d, 124 + Math.sin(an) * d * 0.7 - 2, k % 2 ? '#ffe9a0' : '#ffffff', 1 - b / 0.7);
      }
    }
  });
}
function drawSparks(g, t) {
  var wl = [-94, -84, -30, -20], cols = ['#ffd23c', '#ff9a28', '#ffffff'];
  for (var i = 0; i < 36; i++) {
    var ts = t - i * 0.05; if (ts > T_EXIT) continue;
    var k = Math.floor(ts * 20), E = toWorld(trainPose(ts), wl[Math.floor(rnd(k, 1) * 4)], 2), age = t - ts;
    px(g, E.x - (26 + rnd(k, 2) * 30) * age, E.y - (8 + rnd(k, 3) * 14) * age + 0.5 * 55 * age * age, cols[k % 3], 1 - age / 1.75);
  }
}
/* ---------------- tren ---------------- */
function drawCar(g, ox, lead, t, idx) {
  // faldon
  g.fillStyle = '#1c202e'; g.fillRect(ox - 116, -6, 110, 3);
  // carroceria blanca
  g.beginPath();
  if (lead) {
    g.moveTo(ox - 118, -6); g.lineTo(ox - 118, -30); g.lineTo(ox - 24, -30);
    g.bezierCurveTo(ox - 12, -30, ox - 3, -22, ox - 1, -13);
    g.bezierCurveTo(ox + 0.5, -10, ox + 0.5, -8, ox - 3, -6);
  } else { g.moveTo(ox - 118, -6); g.lineTo(ox - 118, -30); g.lineTo(ox, -30); g.lineTo(ox, -6); }
  g.closePath(); g.fillStyle = '#eef2fa'; g.fill();
  g.save(); g.clip();
  g.fillStyle = '#c9d2e6'; g.fillRect(ox - 120, -30, 124, 3);
  g.fillStyle = '#1676ec'; g.fillRect(ox - 120, -27, lead ? 94 : 124, 14.5);
  if (lead) g.fillRect(ox - 26, -31, 30, 18.5);
  g.restore();
  // pods de aire
  g.fillStyle = '#929cb8';
  [-100, -72, -44].forEach(function (d) { if (!lead || d < -40) { rr(g, ox + d, -34, 16, 4, 1.2); g.fill(); } });
  g.fillStyle = '#b8c2dc';
  [-100, -72, -44].forEach(function (d) { if (!lead || d < -40) g.fillRect(ox + d + 1, -34, 14, 1); });
  // ventanas
  g.fillStyle = '#080e22';
  [[-114, 20], [-79, 17], [-47, 17]].forEach(function (w) { rr(g, ox + w[0], -25, w[1], 9, 1.6); g.fill(); });
  g.fillStyle = 'rgba(255,214,130,0.55)';
  [[-114, 20], [-79, 17], [-47, 17]].forEach(function (w) { g.fillRect(ox + w[0] + 1.5, -17, w[1] - 3, 1); });
  g.fillStyle = 'rgba(120,170,255,0.35)';
  [[-114, 20], [-79, 17], [-47, 17]].forEach(function (w) { g.fillRect(ox + w[0] + 4, -24, 1.4, 7); });
  // puertas
  [[-92, 11, 0], [-60, 11, 1]].forEach(function (d) {
    if (lead && d[2]) return;
    g.fillStyle = '#1262c8'; g.fillRect(ox + d[0], -26, d[1], 20);
    g.fillStyle = '#080e22'; rr(g, ox + d[0] + 2, -24, d[1] - 4, 9, 1.2); g.fill();
    g.fillStyle = '#0b4aa0'; g.fillRect(ox + d[0] + d[1] / 2 - 0.4, -26, 0.8, 20);
  });
  if (lead) {
    // puerta abierta de Papa Noel
    g.fillStyle = '#241a24'; g.fillRect(ox - 60, -26, 11, 20);
    var gr = g.createLinearGradient(0, -26, 0, -6); gr.addColorStop(0, 'rgba(255,205,120,0.55)'); gr.addColorStop(1, 'rgba(255,150,70,0.25)');
    g.fillStyle = gr; g.fillRect(ox - 60, -26, 11, 20);
    g.fillStyle = '#0b4aa0'; g.fillRect(ox - 61, -26, 1, 20); g.fillRect(ox - 49, -26, 1, 20);
    // cabina
    g.fillStyle = '#080e22'; g.beginPath();
    g.moveTo(ox - 24, -26); g.lineTo(ox - 13, -25); g.lineTo(ox - 5, -18); g.lineTo(ox - 4.5, -13.5); g.lineTo(ox - 24, -13.5); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(130,185,255,0.8)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(ox - 22, -25); g.lineTo(ox - 13, -24.2); g.lineTo(ox - 6, -18); g.stroke();
  }
  // logo naranja
  g.fillStyle = '#ff7d1e'; g.fillRect(ox - (lead ? 40 : 52), -26, 3, 3);
  // franja blanca inferior + trazos azules
  g.fillStyle = '#1676ec';
  g.fillRect(ox - 116, -10.4, lead ? 84 : 112, 1.1); g.fillRect(ox - 116, -8.4, lead ? 84 : 112, 1.1);
  if (lead) {
    g.strokeStyle = '#1676ec'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(ox - 32, -10); g.quadraticCurveTo(ox - 20, -10, ox - 12, -12.4); g.stroke();
    g.beginPath(); g.moveTo(ox - 32, -8); g.quadraticCurveTo(ox - 18, -8, ox - 10, -10.4); g.stroke();
  }
  // bogies y ruedas
  var ang = t * 9;
  [-94, -84, -30, -20].forEach(function (d) {
    if (lead && d > -40 && false) return;
    var cx = ox + d;
    g.fillStyle = '#343c56'; g.fillRect(cx - 5, -4, 10, 3);
    g.fillStyle = '#5a6482'; g.beginPath(); g.arc(cx, -0.5, 3, 0, TAU); g.fill();
    px(g, cx + Math.cos(ang) * 1.5, -0.5 + Math.sin(ang) * 1.5, '#d0d6e6', 1);
  });
  // guirnalda navidena en el techo
  for (var i = 0; i < 18; i++) {
    var x = ox - 116 + i * 5.2; if (lead && x > ox - 28) break;
    var a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 3.4 + i * 1.9 + idx * 2)), c = PAL[(i + idx) % 5];
    g.globalAlpha = a * 0.3; g.fillStyle = c; g.beginPath(); g.arc(x, -31.5, 2.4, 0, TAU); g.fill(); g.globalAlpha = 1;
    px(g, x, -32 + Math.sin(i * 1.2) * 0.5, c, a);
  }
  // vapor de los equipos
  [-92, -64, -36].forEach(function (d, p) {
    if (lead && d > -40) return;
    for (var j = 0; j < 3; j++) {
      var age = ((t * 0.9 + j * 0.33 + p * 0.21) % 1);
      g.globalAlpha = (1 - age) * 0.32; g.fillStyle = '#e8eefc';
      g.beginPath(); g.arc(ox + d + 8 + Math.sin(age * 5 + j) * 2, -36 - age * 11, 1 + age * 1.7, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
  });
}
function drawNoseExtras(g, t) {
  // faro + haz
  var gr = g.createLinearGradient(0, 0, 36, 0); gr.addColorStop(0, 'rgba(255,240,170,0.20)'); gr.addColorStop(1, 'rgba(255,240,170,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(-1, -10); g.lineTo(36, -21); g.lineTo(36, 1); g.lineTo(-1, -8); g.closePath(); g.fill();
  glow(g, -2, -9, 8, '255,245,170', 0.65);
  g.fillStyle = '#fff6b0'; g.beginPath(); g.arc(-2.4, -9, 1.5, 0, TAU); g.fill();
  // corona navidena en la trompa
  g.strokeStyle = '#1ea03c'; g.lineWidth = 1.9; g.beginPath(); g.arc(-8, -9.5, 3.3, 0, TAU); g.stroke();
  px(g, -10.5, -11.5, '#ff3240', 1); px(g, -5.5, -7.5, '#ff3240', 1); px(g, -5.5, -11.5, '#ffd23c', 1);
  g.fillStyle = '#ff4650'; g.fillRect(-9.5, -14, 3, 1.5); px(g, -10, -13, '#ff4650', 1); px(g, -6, -13, '#ff4650', 1);
}
function drawSanta(g, t) {
  var cx = -54.5;
  // cuerpo
  g.fillStyle = '#dc1e28'; g.fillRect(cx - 4, -18, 8, 12);
  g.fillStyle = '#111'; g.fillRect(cx - 4, -11, 8, 1.3); px(g, cx, -10.6, '#ffd23c', 1);
  // brazo que se agarra
  g.strokeStyle = '#dc1e28'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 3, -16); g.lineTo(cx - 5.5, -19); g.stroke();
  px(g, cx - 5.5, -20, '#ffffff', 1);
  // brazo con abanico
  g.beginPath(); g.moveTo(cx + 3, -16); g.lineTo(cx + 7.5, -18.5); g.stroke();
  var hx = cx + 8.5, hy = -19, th = -1.0 + Math.sin(t * 14) * 0.55;
  px(g, hx, hy, '#ffffff', 1);
  for (var i = 0; i < 6; i++) {
    g.fillStyle = i % 2 ? '#ffffff' : '#ff3c46';
    g.beginPath(); g.moveTo(hx, hy); g.arc(hx, hy, 7, th + i * 0.26, th + (i + 1) * 0.26); g.closePath(); g.fill();
  }
  // cabeza
  g.fillStyle = '#f6c3a4'; g.beginPath(); g.arc(cx, -22, 3.1, 0, TAU); g.fill();
  px(g, cx - 2, -21, '#ff7a7a', 0.9); px(g, cx + 2, -21, '#ff7a7a', 0.9);
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx, -19.4, 3.5, 3.1, 0, 0, TAU); g.fill();
  px(g, cx, -20, '#7a1010', 1);
  px(g, cx - 1.4, -22.6, '#2a1a1a', 1); px(g, cx - 0.6, -22.2, '#2a1a1a', 1);
  px(g, cx + 1.4, -22.6, '#2a1a1a', 1); px(g, cx + 0.6, -22.2, '#2a1a1a', 1);
  // gorro
  g.fillStyle = '#e1202b'; g.beginPath(); g.moveTo(cx - 3.6, -24); g.lineTo(cx + 3.4, -24); g.lineTo(cx + 5.5, -29); g.lineTo(cx + 0.5, -31); g.closePath(); g.fill();
  g.fillStyle = '#ffffff'; g.fillRect(cx - 4, -25, 8, 1.6); g.beginPath(); g.arc(cx + 6, -29, 1.7, 0, TAU); g.fill();
}
function drawTrain(g, t) {
  var p = trainPose(t); if (!p) return;
  g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(p.s, p.s);
  drawCar(g, -121, false, t, 1);
  g.fillStyle = '#1c202e'; g.fillRect(-122, -20, 3, 4);
  drawCar(g, 0, true, t, 0);
  drawNoseExtras(g, t);
  drawSanta(g, t);
  g.restore();
}

/* ---------------- reno ---------------- */
function drawDeer(g, t) {
  var p = deerPose(t); if (!p) return;
  g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
  var ph = p.ph;
  function leg(hx, hy, phase, col) {
    var a = Math.sin(phase) * 0.9, k = Math.max(0, Math.sin(phase + 1.2)) * 0.9;
    var x1 = hx + Math.sin(a) * 6, y1 = hy + Math.cos(a) * 5.5, x2 = x1 + Math.sin(a - k) * 5.5, y2 = y1 + Math.cos(a - k) * 5;
    g.strokeStyle = col; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx, hy); g.lineTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.fillStyle = '#3c281e'; g.beginPath(); g.arc(x2, y2, 1.2, 0, TAU); g.fill();
  }
  leg(8, 3, ph + 0.6, '#6e4624'); leg(-8, 3, ph + Math.PI + 0.6, '#6e4624');
  g.fillStyle = '#a06434'; g.beginPath(); g.ellipse(0, 0, 12, 5.5, 0, 0, TAU); g.fill();
  g.fillStyle = '#cd965f'; g.beginPath(); g.ellipse(0, 2.2, 9, 2.5, 0, 0, TAU); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-12, -3, 2, 0, TAU); g.fill();
  g.fillStyle = '#a06434'; g.beginPath(); g.moveTo(8, -3); g.lineTo(14, -12); g.lineTo(17.5, -9); g.lineTo(11, 2); g.closePath(); g.fill();
  leg(8, 3, ph, '#825028'); leg(-8, 3, ph + Math.PI, '#825028');
  // arnes
  g.strokeStyle = '#e02830'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(8, -4); g.lineTo(6, 4.5); g.stroke();
  px(g, 7, 4, '#ffd23c', 1);
  // cabeza
  g.fillStyle = '#aa6c3a'; g.beginPath(); g.ellipse(19, -12, 5, 3.2, 0.3, 0, TAU); g.fill();
  g.fillStyle = '#d29a64'; g.beginPath(); g.ellipse(23.5, -10.4, 2.7, 2.1, 0.3, 0, TAU); g.fill();
  glow(g, 26.2, -10.2, 6, '255,50,50', 0.4);
  g.fillStyle = '#ff3232'; g.beginPath(); g.arc(26.2, -10.2, 1.6, 0, TAU); g.fill();
  g.fillStyle = '#aa6c3a'; g.beginPath(); g.moveTo(16, -14); g.lineTo(14, -18); g.lineTo(18, -15.5); g.closePath(); g.fill();
  // ojo entrecerrado (calor)
  px(g, 20, -13, '#1c1010', 1); px(g, 21, -13, '#1c1010', 1);
  // lengua afuera
  var tl = 2 + 1.2 * Math.sin(t * 12);
  g.fillStyle = '#ff7890'; g.fillRect(23.4, -8.6, 1.6, tl);
  // astas
  g.strokeStyle = '#f2f0e2'; g.lineWidth = 1.2; g.lineCap = 'round';
  [[0, 1], [-3.5, 0.55]].forEach(function (a) {
    var ox = a[0], al = a[1]; g.globalAlpha = al; g.beginPath();
    g.moveTo(18 + ox, -15); g.lineTo(17 + ox, -21); g.lineTo(14 + ox, -27);
    g.moveTo(17 + ox, -21); g.lineTo(20 + ox, -27); g.moveTo(18 + ox, -17); g.lineTo(23 + ox, -21); g.stroke();
  });
  g.globalAlpha = 1;
  g.restore();
}
function drawReins(g, t) {
  var p = deerPose(t), tp = trainPose(t); if (!p || !tp || !p.hitched || p.x > 262) return;
  var a = toWorld(tp, -1, -12.5), b = { x: p.x + 7, y: p.y - 1 };
  g.strokeStyle = '#e02830'; g.lineWidth = 0.9;
  [0, 2.2].forEach(function (d) {
    g.beginPath(); g.moveTo(a.x, a.y + d); g.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 3 + d + Math.sin(t * 7) * 0.8, b.x, b.y + d); g.stroke();
  });
}
function drawSweat(g, t) {
  var tp = trainPose(t); if (!tp) return;
  var i, age, cyc, o, s;
  for (i = 0; i < 6; i++) {            // Papa Noel
    cyc = t * 2.6 + i * 0.17; age = cyc - Math.floor(cyc); s = Math.floor(cyc) * 11 + i;
    o = toWorld(tp, -54.5 + (rnd(s, 1) - 0.5) * 5, -24 + rnd(s, 2) * 3);
    px(g, o.x + (-5 - rnd(s, 3) * 8) * age, o.y + (-9 + rnd(s, 4) * 5) * age + 0.5 * 42 * age * age, '#8ce1ff', 1 - age);
  }
  var dp = deerPose(t); if (!dp || !dp.hitched) return;
  for (i = 0; i < 6; i++) {             // reno
    cyc = t * 2.2 + i * 0.19; age = cyc - Math.floor(cyc); s = Math.floor(cyc) * 7 + i + 40;
    var lx = i % 2 ? 17 : -2, ly = i % 2 ? -14 : -4;
    px(g, dp.x + lx + (rnd(s, 1) - 0.5) * 6 - 6 * age, dp.y + ly + (-8 + rnd(s, 2) * 4) * age + 0.5 * 42 * age * age, '#8ce1ff', 1 - age);
  }
}
/* ---------------- escena ---------------- */
function drawScene(g, t) {
  g.globalAlpha = 1; g.clearRect(0, 0, GW, GH);
  g.fillStyle = '#04060f'; g.fillRect(0, 0, GW, GH);
  var gr = g.createLinearGradient(0, 70, 0, GH); gr.addColorStop(0, 'rgba(30,50,110,0)'); gr.addColorStop(1, 'rgba(40,60,120,0.25)');
  g.fillStyle = gr; g.fillRect(0, 70, GW, GH - 70);
  drawStars(g, t); drawMoon(g); drawFireworks(g, t); drawSkyline(g, t);
  drawSparks(g, t);
  drawTrain(g, t); drawReins(g, t); drawDeer(g, t); drawPresents(g, t); drawSweat(g, t);
}

/* ---------------- montaje ---------------- */
function mount(el, opts) {
  opts = opts || {};
  var DUR = opts.duration || 10, showTimer = opts.timer !== false;
  var wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:100%;aspect-ratio:16/9;background:#04060f;overflow:hidden;line-height:0';
  var cv = document.createElement('canvas'); cv.style.cssText = 'width:100%;height:100%;display:block';
  cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Papá Noel viaja en el tren Roca tirado por un reno, muerto de calor, con fuegos artificiales de fondo.');
  wrap.appendChild(cv); el.appendChild(wrap);
  var ctx = cv.getContext('2d');
  var lo = document.createElement('canvas'); lo.width = GW; lo.height = GH;
  var g = lo.getContext('2d', { willReadFrequently: true });
  var raf = 0, t0 = 0, done = false, visible = true, lastT = 0, freeze = null;
  var DPR = Math.min(2, window.devicePixelRatio || 1);
  function size() {
    var w = Math.max(320, Math.round(wrap.clientWidth * DPR));
    if (cv.width !== w) { cv.width = w; cv.height = Math.round(w * 9 / 16); }
  }
  function present(t) {
    size();
    var W = cv.width, H = cv.height, pitch = W / GW;
    drawScene(g, t);
    var img = g.getImageData(0, 0, GW, GH).data;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = '#04060f'; ctx.fillRect(0, 0, W, H);
    // brillo suave
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5;
    if (typeof ctx.filter === 'string') ctx.filter = 'blur(' + (pitch * 1.3).toFixed(1) + 'px)';
    ctx.drawImage(lo, 0, 0, W, H);
    ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // puntos LED
    var buckets = {}, lit = 0, y, x, i, off;
    for (y = 0; y < GH; y++) {
      var sh = y >= 118 ? Math.round(Math.sin(y * 0.9 + t * 6) * 1.0) : 0;
      for (x = 0; x < GW; x++) {
        var sx = clamp(x + sh, 0, GW - 1); i = (y * GW + sx) * 4;
        var r = img[i], gg = img[i + 1], b = img[i + 2];
        if (r + gg + b < 54) continue;
        lit++;
        var key = ((r >> 3) << 10) | ((gg >> 3) << 5) | (b >> 3);
        (buckets[key] || (buckets[key] = [])).push(x, y);
      }
    }
    var rad = pitch * 0.40;
    for (var k in buckets) {
      var kk = +k, arr = buckets[k];
      ctx.fillStyle = 'rgb(' + (((kk >> 10) & 31) * 8 + 4) + ',' + (((kk >> 5) & 31) * 8 + 4) + ',' + ((kk & 31) * 8 + 4) + ')';
      ctx.beginPath();
      for (var j = 0; j < arr.length; j += 2) { var cx = (arr[j] + 0.5) * pitch, cy = (arr[j + 1] + 0.5) * pitch; ctx.moveTo(cx + rad, cy); ctx.arc(cx, cy, rad, 0, TAU); }
      ctx.fill();
    }
    if (showTimer) {
      var fs = Math.max(9, Math.round(W * 0.0092)); ctx.font = fs + 'px ' + FONT; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'right';
      ctx.fillStyle = '#ffc043'; ctx.fillText('\u25cf', W - pitch * 8 - fs * 5.2, pitch * 8 + fs);
      ctx.fillStyle = 'rgba(255,200,120,0.9)'; ctx.fillText('t ' + (t < 10 ? '0' : '') + Math.min(t, DUR).toFixed(2) + 's', W - pitch * 8, pitch * 8 + fs);
    }
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible) { t0 += now - lastT; lastT = now; return; }
    lastT = now; var t = (now - t0) / 1000;
    present(Math.min(t, DUR));
    if (t >= DUR && !done) {
      done = true;
      if (opts.loop) { done = false; t0 = now; } else if (opts.onDone) opts.onDone();
    }
  }
  function start() { t0 = performance.now(); lastT = t0; done = false; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  var io = null;
  if ('IntersectionObserver' in window) { io = new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }, { threshold: 0 }); io.observe(wrap); }
  if (opts.freeze != null) { present(opts.freeze); } else start();
  return {
    restart: function () { start(); },
    destroy: function () { cancelAnimationFrame(raf); if (io) io.disconnect(); wrap.remove(); },
    renderAt: function (t) { present(t); }
  };
}
window.TrenRoca = { mount: mount };
function auto() {
  var els = document.querySelectorAll('[data-trenroca]');
  for (var i = 0; i < els.length; i++) if (!els[i].__tr) els[i].__tr = mount(els[i], { loop: els[i].hasAttribute('data-loop') });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})();
