// Élémento Defense : Dessin des sprites : tours, ennemis, décors, obstacles, portail et maison.
'use strict';
// ================= Primitives de dessin =================
function fs(c, fill, lw) { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); }
function fsp(c, p, fill, lw) { c.fillStyle = fill; c.fill(p); c.lineWidth = lw; c.strokeStyle = INK; c.stroke(p); }
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function star(c, x, y, R, ri, n = 5, rot = 0) { c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + rot + i * Math.PI / n, q = i % 2 ? ri : R; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); }
function heart(c, x, y, s) { c.beginPath(); c.moveTo(x, y + s * 0.9); c.bezierCurveTo(x - s * 1.4, y, x - s * 0.9, y - s * 0.95, x, y - s * 0.35); c.bezierCurveTo(x + s * 0.9, y - s * 0.95, x + s * 1.4, y, x, y + s * 0.9); c.closePath(); }
function prepMini(cv, w, h) { const d = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(w * d); cv.height = Math.round(h * d); const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); return c; }

function face(c, x, y, r, lx, ly, mood, blink, angry) {
  const ex = r * 0.38, ew = r * 0.17, eh = r * 0.25, ox = lx * r * 0.1, oy = ly * r * 0.08;
  for (const sg of [-1, 1]) {
    const cx = x + sg * ex + ox, cy = y + oy;
    if (blink) {
      c.beginPath(); c.moveTo(cx - ew, cy); c.quadraticCurveTo(cx, cy + eh * 0.7, cx + ew, cy);
      c.lineWidth = r * 0.1; c.strokeStyle = INK; c.stroke();
    } else {
      c.beginPath(); c.ellipse(cx, cy, ew, eh, 0, 0, TAU); c.fillStyle = INK; c.fill();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(cx - ew * 0.25 + lx * ew * 0.2, cy - eh * 0.38, ew * 0.46, 0, TAU); c.fill();
      c.beginPath(); c.arc(cx + ew * 0.32, cy + eh * 0.36, ew * 0.2, 0, TAU); c.fill();
    }
    if (angry) {
      c.beginPath(); c.moveTo(cx - sg * ew * 1.4, cy - eh * 1.55); c.lineTo(cx + sg * ew * 1.2, cy - eh * 0.95);
      c.lineWidth = r * 0.13; c.strokeStyle = INK; c.stroke();
    }
  }
  c.fillStyle = 'rgba(255,105,150,.5)';
  for (const sg of [-1, 1]) { c.beginPath(); c.ellipse(x + sg * r * 0.66 + ox, y + r * 0.3 + oy, r * 0.16, r * 0.09, 0, 0, TAU); c.fill(); }
  const mx = x + ox, my = y + r * 0.34 + oy;
  c.strokeStyle = INK; c.lineWidth = r * 0.09;
  if (mood === 'open') {
    c.beginPath(); c.ellipse(mx, my, r * 0.11, r * 0.13, 0, 0, TAU); c.fillStyle = INK; c.fill();
    c.beginPath(); c.ellipse(mx, my + r * 0.06, r * 0.06, r * 0.04, 0, 0, TAU); c.fillStyle = '#ff7a9a'; c.fill();
  } else if (mood === 'grr') {
    rr(c, mx - r * 0.24, my - r * 0.08, r * 0.48, r * 0.17, r * 0.06); c.fillStyle = '#fff'; c.fill(); c.lineWidth = r * 0.07; c.stroke();
    c.beginPath(); for (let i = 0; i <= 4; i++) c.lineTo(mx - r * 0.24 + i * r * 0.12, my + (i % 2 ? r * 0.07 : -r * 0.06)); c.lineWidth = r * 0.05; c.stroke();
  } else if (mood === 'fang') {
    c.beginPath(); c.moveTo(mx - r * 0.2, my - r * 0.04); c.quadraticCurveTo(mx, my + r * 0.08, mx + r * 0.2, my - r * 0.04); c.stroke();
    c.fillStyle = '#fff'; c.lineWidth = r * 0.05;
    for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(mx + sg * r * 0.14, my - r * 0.02); c.lineTo(mx + sg * r * 0.08, my + r * 0.14); c.lineTo(mx + sg * r * 0.03, my + r * 0.01); c.closePath(); c.fill(); c.stroke(); }
  } else {
    c.beginPath(); c.arc(mx, my - r * 0.07, r * 0.13, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  }
}

// ---------- Tours ----------
function drawTower(c, type, x, y, s, lvl, t, lx, ly, recoil, blink, br) {
  const lw = Math.max(1.4, s * 0.05), r = s * 0.25, D = TOWERS[type];
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  c.fillStyle = 'rgba(42,27,61,.22)'; c.beginPath(); c.ellipse(x, y + s * 0.33, s * 0.36, s * 0.09, 0, 0, TAU); c.fill();
  if (lvl >= 3) { c.save(); c.globalAlpha *= 0.28 + 0.14 * Math.sin(t * 4); c.fillStyle = br ? BRANCH[br].color : D.color; c.beginPath(); c.arc(x, y - s * 0.12, s * 0.47, 0, TAU); c.fill(); c.restore(); }
  rr(c, x - s * 0.3, y + s * 0.08, s * 0.6, s * 0.24, s * 0.08); fs(c, '#cdbfe0', lw);
  c.beginPath(); c.ellipse(x, y + s * 0.1, s * 0.3, s * 0.075, 0, 0, TAU); fs(c, '#f4eefb', lw);
  for (let i = 0; i < lvl; i++) { star(c, x + (i - (lvl - 1) / 2) * s * 0.17, y + s * 0.215, s * 0.066, s * 0.03); fs(c, '#ffd23f', lw * 0.6); }
  const bob = Math.sin(t * 3 + x * 0.07) * s * 0.02;
  c.translate(x, y - s * 0.1 + bob);
  c.translate(0, r * 0.9); c.scale(1 + recoil * 0.1, 1 - recoil * 0.12); c.translate(0, -r * 0.9);
  let fy = r * 0.2, g;
  switch (type) {
    case 'feu': {
      const fl = Math.sin(t * 11) * r * 0.14;
      c.beginPath(); c.moveTo(fl, -r * 1.5); c.quadraticCurveTo(r * 1.2, -r * 0.55, r * 0.95, r * 0.3);
      c.arc(0, r * 0.3, r * 0.95, 0, Math.PI); c.quadraticCurveTo(-r * 1.2, -r * 0.55, fl, -r * 1.5); c.closePath();
      g = c.createLinearGradient(0, -r * 1.5, 0, r * 1.25); g.addColorStop(0, '#ffe066'); g.addColorStop(0.45, '#ff9a3d'); g.addColorStop(1, '#ff4f4f');
      fs(c, g, lw);
      c.beginPath(); c.moveTo(-fl * 0.5, -r * 0.62); c.quadraticCurveTo(r * 0.65, -r * 0.05, r * 0.55, r * 0.5);
      c.arc(0, r * 0.5, r * 0.55, 0, Math.PI); c.quadraticCurveTo(-r * 0.65, -r * 0.05, -fl * 0.5, -r * 0.62);
      c.fillStyle = 'rgba(255,240,150,.8)'; c.fill();
      fy = r * 0.38; break;
    }
    case 'eau': {
      c.beginPath(); c.moveTo(0, -r * 1.42); c.bezierCurveTo(r * 0.35, -r * 0.85, r, -r * 0.35, r, r * 0.2);
      c.arc(0, r * 0.2, r, 0, Math.PI); c.bezierCurveTo(-r, -r * 0.35, -r * 0.35, -r * 0.85, 0, -r * 1.42); c.closePath();
      g = c.createLinearGradient(0, -r * 1.4, 0, r * 1.2); g.addColorStop(0, '#a8ecff'); g.addColorStop(1, '#3a95ff');
      fs(c, g, lw);
      c.save(); c.translate(-r * 0.48, -r * 0.3); c.rotate(-0.5); c.beginPath(); c.ellipse(0, 0, r * 0.14, r * 0.3, 0, 0, TAU); c.fillStyle = 'rgba(255,255,255,.85)'; c.fill(); c.restore();
      fy = r * 0.28; break;
    }
    case 'terre': {
      const P = [[-1, 0.8], [-1.05, -0.12], [-0.6, -0.88], [0.15, -1.05], [0.85, -0.65], [1.05, 0.2], [0.85, 0.85]];
      c.beginPath(); P.forEach(([a, b], i) => i ? c.lineTo(a * r, b * r) : c.moveTo(a * r, b * r)); c.closePath();
      g = c.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#d9a574'); g.addColorStop(1, '#a8703f'); fs(c, g, lw);
      c.beginPath(); c.moveTo(r * 0.62, -r * 0.5); c.lineTo(r * 0.42, -r * 0.2); c.lineTo(r * 0.58, r * 0.02); c.lineWidth = lw * 0.7; c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.ellipse(-r * 0.25, -r * 0.86, r * 0.55, r * 0.22, -0.25, 0, TAU); fs(c, '#6fd35a', lw * 0.8);
      c.beginPath(); c.arc(-r * 0.05, -r * 1.12, r * 0.1, 0, TAU); fs(c, '#ffffff', lw * 0.5);
      fy = r * 0.1; break;
    }
    case 'vent': {
      c.beginPath(); c.arc(0, 0, r * 0.95, 0, TAU);
      g = c.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.1); g.addColorStop(0, '#f0fffa'); g.addColorStop(1, '#6fe0c0'); fs(c, g, lw);
      c.beginPath(); c.moveTo(-r * 0.1, -r * 0.92); c.quadraticCurveTo(r * 0.1, -r * 1.35, r * 0.4, -r * 1.2); c.quadraticCurveTo(r * 0.2, -r * 1.05, r * 0.25, -r * 0.9); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + i * TAU / 3;
        c.beginPath(); c.arc(0, 0, r * 1.3, a, a + 1.1); c.lineWidth = lw * 2.1; c.strokeStyle = INK; c.stroke();
        c.lineWidth = lw * 0.9; c.strokeStyle = '#ffffff'; c.stroke();
      }
      fy = r * 0.08; break;
    }
    case 'foudre': {
      const fl = Math.sin(t * 20) > 0.3;
      for (const sg of [-1, 1]) {
        c.beginPath(); const bx = sg * r * 1.0;
        c.moveTo(bx, -r * 0.2); c.lineTo(bx + sg * r * 0.45, r * 0.05); c.lineTo(bx + sg * r * 0.2, r * 0.12); c.lineTo(bx + sg * r * 0.55, r * 0.5);
        c.lineTo(bx + sg * r * 0.05, r * 0.2); c.lineTo(bx + sg * r * 0.25, r * 0.12); c.closePath(); fs(c, fl ? '#fff7b0' : '#ffd23f', lw * 0.7);
      }
      const C = [[-0.55, 0.15, 0.55], [0.55, 0.15, 0.55], [0, -0.28, 0.72], [-0.15, 0.38, 0.58], [0.25, 0.34, 0.55]];
      c.lineWidth = lw * 2; c.strokeStyle = INK;
      for (const [a, b, q] of C) { c.beginPath(); c.arc(a * r, b * r, q * r, 0, TAU); c.stroke(); }
      for (const [a, b, q] of C) { c.beginPath(); c.arc(a * r, b * r, q * r, 0, TAU); c.fillStyle = '#ffe766'; c.fill(); }
      c.beginPath(); c.arc(-r * 0.25, -r * 0.5, r * 0.22, 0, TAU); c.fillStyle = 'rgba(255,255,255,.75)'; c.fill();
      fy = r * 0.12; break;
    }
    case 'glace': {
      const P = [[0, -1.38], [0.85, -0.55], [0.85, 0.55], [0, 1.02], [-0.85, 0.55], [-0.85, -0.55]];
      c.beginPath(); P.forEach(([a, b], i) => i ? c.lineTo(a * r, b * r) : c.moveTo(a * r, b * r)); c.closePath();
      g = c.createLinearGradient(-r, -r, r, r); g.addColorStop(0, '#f2feff'); g.addColorStop(1, '#7fd6ff'); fs(c, g, lw);
      c.beginPath(); c.moveTo(-r * 0.85, -r * 0.55); c.lineTo(0, -r * 0.25); c.lineTo(r * 0.85, -r * 0.55); c.moveTo(0, -r * 0.25); c.lineTo(0, -r * 1.38);
      c.lineWidth = lw * 0.6; c.strokeStyle = 'rgba(255,255,255,.95)'; c.stroke();
      c.save(); c.translate(r * 1.05, -r * 1.0); c.rotate(t * 1.5); star(c, 0, 0, r * 0.22, r * 0.07, 4); fs(c, '#ffffff', lw * 0.5); c.restore();
      fy = r * 0.22; break;
    }
    case 'tornade': {
      c.beginPath(); c.moveTo(-r * 1.1, -r * 1.2); c.quadraticCurveTo(0, -r * 1.5, r * 1.1, -r * 1.2); c.quadraticCurveTo(r * 0.5, 0, r * 0.35, r * 0.95);
      c.lineTo(-r * 0.35, r * 0.95); c.quadraticCurveTo(-r * 0.5, 0, -r * 1.1, -r * 1.2); c.closePath();
      g = c.createLinearGradient(0, -r * 1.3, 0, r); g.addColorStop(0, '#ffe066'); g.addColorStop(0.5, '#ff8a3d'); g.addColorStop(1, '#ff4f4f'); fs(c, g, lw);
      for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(Math.sin(t * 6 + k) * r * 0.1, -r * 0.85 + k * r * 0.55, r * (0.9 - k * 0.22), r * 0.14, 0, 0.25, Math.PI - 0.25); c.lineWidth = lw * 0.8; c.strokeStyle = 'rgba(255,255,255,.9)'; c.stroke(); }
      fy = -r * 0.25; break;
    }
    case 'orage': {
      for (const i of [-0.55, 0, 0.55]) { const k = (t * 2.5 + i + 1) % 1; c.beginPath(); c.moveTo(i * r, r * 0.55 + k * r * 0.5); c.lineTo(i * r - r * 0.08, r * 0.8 + k * r * 0.5); c.lineWidth = lw; c.strokeStyle = '#6cc6ff'; c.stroke(); }
      c.beginPath(); c.moveTo(r * 0.05, r * 0.4); c.lineTo(-r * 0.2, r * 0.85); c.lineTo(r * 0.05, r * 0.8); c.lineTo(-r * 0.1, r * 1.2); c.lineTo(r * 0.3, r * 0.7); c.lineTo(r * 0.05, r * 0.72); c.closePath(); fs(c, Math.sin(t * 20) > 0.3 ? '#fff7b0' : '#ffd23f', lw * 0.7);
      const C = [[-0.55, 0.1, 0.55], [0.55, 0.1, 0.55], [0, -0.3, 0.72], [-0.15, 0.32, 0.58], [0.25, 0.3, 0.55]];
      c.lineWidth = lw * 2; c.strokeStyle = INK; for (const [a, b, q] of C) { c.beginPath(); c.arc(a * r, b * r, q * r, 0, TAU); c.stroke(); }
      for (const [a, b, q] of C) { c.beginPath(); c.arc(a * r, b * r, q * r, 0, TAU); c.fillStyle = '#8a8fd6'; c.fill(); }
      c.beginPath(); c.arc(-r * 0.25, -r * 0.5, r * 0.22, 0, TAU); c.fillStyle = 'rgba(255,255,255,.45)'; c.fill();
      fy = r * 0.08; break;
    }
    case 'volcan': {
      c.beginPath(); c.moveTo(-r * 1.15, r * 0.95); c.lineTo(-r * 0.45, -r * 0.9); c.lineTo(r * 0.45, -r * 0.9); c.lineTo(r * 1.15, r * 0.95); c.closePath();
      g = c.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#b87a4e'); g.addColorStop(1, '#6e4630'); fs(c, g, lw);
      c.beginPath(); c.ellipse(0, -r * 0.9, r * 0.45, r * 0.15, 0, 0, TAU); fs(c, '#ff6a2b', lw * 0.8);
      c.beginPath(); c.moveTo(-r * 0.32, -r * 0.85); c.quadraticCurveTo(-r * 0.4, -r * 0.4, -r * 0.22, -r * 0.28); c.quadraticCurveTo(-r * 0.1, -r * 0.5, -r * 0.05, -r * 0.85); c.closePath(); c.fillStyle = '#ff8a3d'; c.fill();
      const k = (t * 0.8) % 1; c.save(); c.globalAlpha *= 1 - k; c.beginPath(); c.arc(r * 0.15, -r * 1.25 - k * r * 0.4, r * (0.16 + k * 0.1), 0, TAU); fs(c, '#ffffff', lw * 0.6); c.restore();
      fy = r * 0.28; break;
    }
    case 'geyser': {
      c.beginPath(); c.moveTo(0, -r * 1.3); c.bezierCurveTo(r * 0.35, -r * 0.8, r, -r * 0.35, r, r * 0.2);
      c.arc(0, r * 0.2, r, 0, Math.PI); c.bezierCurveTo(-r, -r * 0.35, -r * 0.35, -r * 0.8, 0, -r * 1.3); c.closePath();
      g = c.createLinearGradient(0, -r * 1.3, 0, r * 1.2); g.addColorStop(0, '#f2fcff'); g.addColorStop(1, '#6fc8ff'); fs(c, g, lw);
      const P = [[-0.32, -1.22, 0.22], [0.32, -1.28, 0.22], [0, -1.48 - Math.sin(t * 4) * 0.05, 0.25]];
      c.lineWidth = lw * 2; c.strokeStyle = INK; for (const [a, b, q] of P) { c.beginPath(); c.arc(a * r, b * r, q * r, 0, TAU); c.stroke(); }
      for (const [a, b, q] of P) { c.beginPath(); c.arc(a * r, b * r, q * r, 0, TAU); c.fillStyle = '#ffffff'; c.fill(); }
      fy = r * 0.3; break;
    }
    case 'marais': {
      c.beginPath(); c.moveTo(r * 0.75, r * 0.1); c.lineTo(r * 0.95, -r * 1.15); c.lineWidth = lw * 1.2; c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.ellipse(r * 0.97, -r * 1.2, r * 0.1, r * 0.25, 0.15, 0, TAU); fs(c, '#8a5a3c', lw * 0.6);
      c.beginPath(); c.ellipse(0, r * 0.25, r * 1.1, r * 0.78, 0, 0, TAU);
      g = c.createLinearGradient(0, -r * 0.5, 0, r); g.addColorStop(0, '#b3a45e'); g.addColorStop(1, '#6f6533'); fs(c, g, lw);
      c.beginPath(); c.ellipse(-r * 0.45, -r * 0.2, r * 0.35, r * 0.13, -0.2, 0, TAU); c.fillStyle = '#6fd35a'; c.fill();
      const k = (t * 0.9) % 1; c.beginPath(); c.arc(r * 0.45, -r * 0.3 - k * r * 0.5, r * 0.1 * (1 - k * 0.5), 0, TAU); c.lineWidth = lw * 0.6; c.strokeStyle = '#ffffff'; c.stroke();
      fy = r * 0.32; break;
    }
    case 'blizzard': {
      for (let i = 0; i < 2; i++) { const a = t * 3 + i * Math.PI; c.beginPath(); c.arc(0, 0, r * 1.3, a, a + 1.2); c.lineWidth = lw * 2; c.strokeStyle = INK; c.stroke(); c.lineWidth = lw; c.strokeStyle = '#bfeeff'; c.stroke(); }
      const C = [[-0.5, 0.15, 0.55], [0.5, 0.15, 0.55], [0, -0.25, 0.7], [0, 0.35, 0.6]];
      c.lineWidth = lw * 2; c.strokeStyle = INK; for (const [a, b, q] of C) { c.beginPath(); c.arc(a * r, b * r, q * r, 0, TAU); c.stroke(); }
      for (const [a, b, q] of C) { c.beginPath(); c.arc(a * r, b * r, q * r, 0, TAU); c.fillStyle = '#f4fcff'; c.fill(); }
      c.save(); c.translate(r * 0.95, -r * 0.95); c.rotate(t * 1.2); star(c, 0, 0, r * 0.3, r * 0.1, 6); fs(c, '#bfeeff', lw * 0.5); c.restore();
      fy = r * 0.12; break;
    }
    case 'sable': {
      c.beginPath(); c.arc(0, 0, r * 0.95, 0, TAU);
      g = c.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.1); g.addColorStop(0, '#fff3d0'); g.addColorStop(1, '#d9ac62'); fs(c, g, lw);
      for (let i = 0; i < 3; i++) { const a = -t * 4 + i * TAU / 3; c.beginPath(); c.arc(0, 0, r * 1.28, a, a + 1.0); c.lineWidth = lw * 2; c.strokeStyle = INK; c.stroke(); c.lineWidth = lw; c.strokeStyle = '#e8c784'; c.stroke(); }
      c.fillStyle = '#a07a3c'; for (const [a, b] of [[-0.6, -0.55], [0.65, -0.4], [0.55, 0.6]]) { c.beginPath(); c.arc(a * r, b * r, r * 0.07, 0, TAU); c.fill(); }
      fy = r * 0.1; break;
    }
    case 'plasma': {
      c.beginPath(); c.arc(0, 0, r * 1.3, 0, TAU); c.fillStyle = 'rgba(255,106,213,' + (0.25 + 0.12 * Math.sin(t * 6)) + ')'; c.fill();
      c.beginPath(); c.arc(0, 0, r * 0.95, 0, TAU);
      g = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r); g.addColorStop(0, '#fff0fb'); g.addColorStop(0.55, '#ff6ad5'); g.addColorStop(1, '#b03aa0'); fs(c, g, lw);
      c.save(); c.rotate(-0.4 + Math.sin(t) * 0.2); c.beginPath(); c.ellipse(0, 0, r * 1.35, r * 0.4, 0, Math.PI * 1.05, Math.PI * 1.95); c.lineWidth = lw * 1.8; c.strokeStyle = INK; c.stroke(); c.lineWidth = lw * 0.8; c.strokeStyle = '#ffd23f'; c.stroke(); c.restore();
      fy = r * 0.1; break;
    }
  }
  face(c, 0, fy, r, lx || 0, ly || 0, recoil > 0.45 ? 'open' : 'happy', blink, false);
  const ev = evt(); if (ev) (ev === 'halloween' ? costume : evCostume)(c, type, r, lw, t, fy, ev);
  c.restore();
  if (br) drawEmblem(c, br, x + s * 0.3, y + s * 0.1, s * 0.12);
}
// ---------- Déguisements des tours pendant les événements ----------
const HTOP = { feu: -1.3, eau: -1.32, terre: -0.98, vent: -0.92, foudre: -0.98, glace: -1.3, tornade: -1.32, orage: -1.0, volcan: -0.92, geyser: -1.6, marais: -0.5, blizzard: -0.92, sable: -0.92, plasma: -0.92 };
function witchHat(c, y, r, lw, band) {
  c.beginPath(); c.ellipse(0, y, r * 0.78, r * 0.17, -0.08, 0, TAU); fs(c, '#3b2458', lw);
  c.beginPath(); c.moveTo(-r * 0.46, y - r * 0.04); c.quadraticCurveTo(-r * 0.2, y - r * 0.6, r * 0.05, y - r * 1.05);
  c.quadraticCurveTo(r * 0.35, y - r * 1.2, r * 0.62, y - r * 0.95); c.quadraticCurveTo(r * 0.3, y - r * 0.85, r * 0.2, y - r * 0.6);
  c.quadraticCurveTo(r * 0.3, y - r * 0.3, r * 0.46, y - r * 0.04); c.closePath(); fs(c, '#4a2d6e', lw);
  c.beginPath(); c.moveTo(-r * 0.4, y - r * 0.16); c.quadraticCurveTo(0, y - r * 0.26, r * 0.4, y - r * 0.16); c.lineWidth = lw * 1.6; c.strokeStyle = band; c.stroke();
}
function pumpkin(c, x, y, w, h, lw, carved) {
  c.beginPath(); c.moveTo(x, y - h * 0.9); c.lineTo(x + w * 0.12, y - h * 1.25); c.lineWidth = lw * 1.5; c.strokeStyle = '#3f7f34'; c.stroke();
  for (const k of [-0.5, 0.5, 0]) { c.beginPath(); c.ellipse(x + k * w * 0.55, y, w * (k ? 0.55 : 0.6), h, 0, 0, TAU); fs(c, k ? '#f08a24' : '#ff9f3a', lw); }
  if (carved) {
    c.fillStyle = '#ffe066';
    for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(x + sg * w * 0.42, y - h * 0.05); c.lineTo(x + sg * w * 0.2, y - h * 0.05); c.lineTo(x + sg * w * 0.31, y - h * 0.42); c.closePath(); c.fill(); }
    c.beginPath(); c.moveTo(x - w * 0.4, y + h * 0.25); c.lineTo(x - w * 0.2, y + h * 0.42); c.lineTo(x, y + h * 0.28); c.lineTo(x + w * 0.2, y + h * 0.42); c.lineTo(x + w * 0.4, y + h * 0.25); c.lineTo(x, y + h * 0.62); c.closePath(); c.fill();
  }
}
function batWing(c, sg, x, y, r, lw, f) {
  c.beginPath(); c.moveTo(x, y - r * 0.2);
  c.quadraticCurveTo(x + sg * r * 0.6, y - r * (0.75 + f * 0.3), x + sg * r * 1.05, y - r * (0.45 + f * 0.35));
  c.quadraticCurveTo(x + sg * r * 0.9, y - r * 0.05, x + sg * r * 0.95, y + r * 0.2);
  c.quadraticCurveTo(x + sg * r * 0.7, y + r * 0.02, x + sg * r * 0.55, y + r * 0.22);
  c.quadraticCurveTo(x + sg * r * 0.4, y + r * 0.02, x, y + r * 0.2); c.closePath(); fs(c, '#3a2a55', lw);
}
function costume(c, type, r, lw, t, fy) {
  const top = (HTOP[type] || -1) * r;
  if (TOWERS[type].fusion) {
    // Fusions : petites cornes de diablotin et une queue fourchue
    for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * r * 0.22, top + r * 0.22); c.quadraticCurveTo(sg * r * 0.3, top - r * 0.2, sg * r * 0.52, top - r * 0.32); c.quadraticCurveTo(sg * r * 0.48, top + r * 0.05, sg * r * 0.5, top + r * 0.3); c.closePath(); fs(c, '#e8344e', lw * 0.8); }
    const k = Math.sin(t * 3) * r * 0.08;
    c.beginPath(); c.moveTo(r * 0.85, r * 0.55); c.quadraticCurveTo(r * 1.35, r * 0.6 + k, r * 1.3, r * 0.05); c.lineWidth = lw * 1.2; c.strokeStyle = '#e8344e'; c.stroke();
    c.beginPath(); c.moveTo(r * 1.3, -r * 0.12); c.lineTo(r * 1.18, r * 0.12); c.lineTo(r * 1.44, r * 0.1); c.closePath(); fs(c, '#e8344e', lw * 0.6);
    return;
  }
  switch (type) {
    case 'feu': witchHat(c, top + r * 0.2, r * 1.45, lw, '#ff9f3a'); break;
    case 'eau': pumpkin(c, 0, top - r * 0.3, r * 0.92, r * 0.6, lw * 0.9, true); break;
    case 'terre': {
      const cx0 = r * 0.25, b0 = top + r * 0.2;
      rr(c, cx0 - r * 0.2, b0 - r * 0.85, r * 0.4, r * 0.9, r * 0.08); fs(c, '#fff3d6', lw * 0.9);
      c.beginPath(); c.moveTo(cx0 - r * 0.2, b0 - r * 0.66); c.quadraticCurveTo(cx0 - r * 0.1, b0 - r * 0.3, cx0 + r * 0.02, b0 - r * 0.66); c.lineWidth = lw * 0.7; c.strokeStyle = 'rgba(42,27,61,.4)'; c.stroke();
      const fl = Math.sin(t * 13) * r * 0.07;
      c.beginPath(); c.moveTo(cx0, b0 - r * 0.9); c.quadraticCurveTo(cx0 + r * 0.2, b0 - r * 1.12, cx0 + fl, b0 - r * 1.45); c.quadraticCurveTo(cx0 - r * 0.2, b0 - r * 1.12, cx0, b0 - r * 0.9); fs(c, '#ffb03d', lw * 0.7);
      c.beginPath(); c.ellipse(cx0 + fl * 0.5, b0 - r * 1.08, r * 0.06, r * 0.1, 0, 0, TAU); c.fillStyle = '#fff7b0'; c.fill();
      break;
    }
    case 'vent': {
      // Un petit fantôme qui tourne autour de la tour
      const a = t * 2.2, gx = Math.cos(a) * r * 1.35, gy = Math.sin(a) * r * 0.55 - r * 0.2, w = r * 0.26;
      c.save(); c.translate(gx, gy + Math.sin(t * 6) * r * 0.05);
      c.beginPath(); c.moveTo(-w, w * 0.9); c.lineTo(-w, 0); c.arc(0, 0, w, Math.PI, TAU); c.lineTo(w, w * 0.9);
      for (let i = 0; i < 3; i++) c.quadraticCurveTo(w - (i + 0.5) * w * 2 / 3, w * 0.55, w - (i + 1) * w * 2 / 3, w * 0.9);
      c.closePath(); fs(c, '#ffffff', lw * 0.7);
      c.fillStyle = INK; for (const sg of [-1, 1]) { c.beginPath(); c.ellipse(sg * w * 0.38, -w * 0.05, w * 0.15, w * 0.22, 0, 0, TAU); c.fill(); }
      c.restore(); break;
    }
    case 'foudre': { const f = Math.sin(t * 10); for (const sg of [-1, 1]) batWing(c, sg, sg * r * 0.95, -r * 0.35, r, lw * 0.8, f); break; }
    case 'glace': {
      // Col de vampire et crocs
      for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * r * 0.45, r * 0.7); c.lineTo(sg * r * 1.15, -r * 0.05); c.lineTo(sg * r * 0.95, r * 0.75); c.closePath(); fs(c, '#b0203a', lw * 0.8); }
      c.fillStyle = '#ffffff'; c.strokeStyle = INK; c.lineWidth = lw * 0.5;
      for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * r * 0.15, fy + r * 0.38); c.lineTo(sg * r * 0.08, fy + r * 0.56); c.lineTo(sg * r * 0.02, fy + r * 0.4); c.closePath(); c.fill(); c.stroke(); }
      break;
    }
  }
}
function santaHat(c, y, r, lw, col) {
  c.beginPath(); c.moveTo(-r * 0.5, y); c.quadraticCurveTo(-r * 0.25, y - r * 0.85, r * 0.25, y - r * 0.95); c.quadraticCurveTo(r * 0.6, y - r * 0.9, r * 0.75, y - r * 0.45);
  c.quadraticCurveTo(r * 0.45, y - r * 0.55, r * 0.5, y); c.closePath(); fs(c, col, lw);
  rr(c, -r * 0.58, y - r * 0.12, r * 1.16, r * 0.26, r * 0.13); fs(c, '#ffffff', lw);
  c.beginPath(); c.arc(r * 0.75, y - r * 0.42, r * 0.14, 0, TAU); fs(c, '#ffffff', lw * 0.8);
}
function bow(c, x, y, w, lw, col) {
  for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + sg * w * 0.9, y - w * 0.75, x + sg * w, y); c.quadraticCurveTo(x + sg * w * 0.9, y + w * 0.6, x, y); fs(c, col, lw); }
  c.beginPath(); c.arc(x, y, w * 0.2, 0, TAU); fs(c, col, lw);
}
function bunnyEars(c, y, r, lw, col, inner, t) {
  for (const sg of [-1, 1]) {
    c.save(); c.translate(sg * r * 0.32, y); c.rotate(sg * (0.22 + Math.sin(t * 2 + sg) * 0.06));
    c.beginPath(); c.ellipse(0, -r * 0.5, r * 0.17, r * 0.55, 0, 0, TAU); fs(c, col, lw);
    c.beginPath(); c.ellipse(0, -r * 0.48, r * 0.08, r * 0.38, 0, 0, TAU); c.fillStyle = inner; c.fill(); c.restore();
  }
}
function flowerAt(c, x, y, q, col, lw) {
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5; c.beginPath(); c.arc(x + Math.cos(a) * q, y + Math.sin(a) * q, q * 0.75, 0, TAU); fs(c, col, lw); }
  c.beginPath(); c.arc(x, y, q * 0.55, 0, TAU); fs(c, '#ffd23f', lw);
}
function orbit(c, t, r, fn) { const a = t * 2.2; c.save(); c.translate(Math.cos(a) * r * 1.35, Math.sin(a) * r * 0.55 - r * 0.2 + Math.sin(t * 6) * r * 0.05); fn(); c.restore(); }
function lantern(c, x, y, w, lw) {
  c.beginPath(); c.moveTo(x, y - w * 1.25); c.lineTo(x, y - w * 0.85); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
  rr(c, x - w * 0.45, y - w * 0.95, w * 0.9, w * 0.18, w * 0.05); fs(c, '#ffd23f', lw * 0.7);
  c.beginPath(); c.ellipse(x, y - w * 0.35, w * 0.72, w * 0.55, 0, 0, TAU); fs(c, '#e8344e', lw);
  c.beginPath(); c.ellipse(x, y - w * 0.35, w * 0.3, w * 0.55, 0, 0, TAU); c.lineWidth = lw * 0.6; c.strokeStyle = 'rgba(120,10,20,.6)'; c.stroke();
  rr(c, x - w * 0.45, y + w * 0.12, w * 0.9, w * 0.16, w * 0.05); fs(c, '#ffd23f', lw * 0.7);
  c.beginPath(); c.moveTo(x, y + w * 0.28); c.lineTo(x, y + w * 0.62); c.lineWidth = lw * 1.4; c.strokeStyle = '#ffd23f'; c.stroke();
}
function evCostume(c, type, r, lw, t, fy, ev) {
  const top = (HTOP[type] || -1) * r, fus = TOWERS[type].fusion;
  if (ev === 'noel') {
    if (fus) { bow(c, 0, top + r * 0.05, r * 0.5, lw * 0.8, '#e8344e'); return; }
    switch (type) {
      case 'feu': santaHat(c, top + r * 0.2, r * 1.2, lw, '#e8344e'); break;
      case 'vent': santaHat(c, top + r * 0.12, r * 1.05, lw, '#3fae55'); break;
      case 'eau': {
        rr(c, -r * 0.95, r * 0.42, r * 1.9, r * 0.3, r * 0.14); fs(c, '#e8344e', lw * 0.9);
        c.fillStyle = '#ffffff'; for (const k of [-0.55, 0, 0.55]) c.fillRect(k * r - r * 0.07, r * 0.45, r * 0.14, r * 0.24);
        rr(c, r * 0.35, r * 0.55, r * 0.28, r * 0.6, r * 0.1); fs(c, '#e8344e', lw * 0.9); break;
      }
      case 'terre': {
        c.lineWidth = lw * 1.6;
        for (const sg of [-1, 1]) {
          c.beginPath(); c.moveTo(sg * r * 0.35, top + r * 0.3); c.lineTo(sg * r * 0.6, top - r * 0.55); c.moveTo(sg * r * 0.47, top - r * 0.12); c.lineTo(sg * r * 0.9, top - r * 0.3);
          c.moveTo(sg * r * 0.56, top - r * 0.4); c.lineTo(sg * r * 0.35, top - r * 0.7); c.strokeStyle = INK; c.lineWidth = lw * 2.4; c.stroke(); c.strokeStyle = '#a8703f'; c.lineWidth = lw * 1.3; c.stroke();
        }
        c.beginPath(); c.arc(0, fy + r * 0.17, r * 0.13, 0, TAU); fs(c, '#ff3b4f', lw * 0.6); break;
      }
      case 'foudre': {
        c.beginPath(); c.moveTo(-r * 1.1, -r * 0.3); c.quadraticCurveTo(0, r * 0.25, r * 1.1, -r * 0.3); c.lineWidth = lw * 0.8; c.strokeStyle = '#2f6b3a'; c.stroke();
        const cols = ['#ff4f6e', '#7fd6ff', '#5cd86a', '#ffd23f', '#c79bff'];
        for (let i = 0; i < 5; i++) { const k = (i + 0.5) / 5, x = -r * 1.1 + k * r * 2.2, y = -r * 0.3 + 4 * k * (1 - k) * r * 0.28; c.beginPath(); c.ellipse(x, y + r * 0.08, r * 0.08, r * 0.12, 0, 0, TAU); fs(c, Math.sin(t * 6 + i * 2) > 0 ? cols[i] : '#ffffff', lw * 0.5); }
        break;
      }
      case 'glace': {
        rr(c, -r * 0.42, top - r * 0.55, r * 0.84, r * 0.6, r * 0.06); fs(c, '#2a2438', lw);
        c.fillStyle = '#e8344e'; c.fillRect(-r * 0.42, top - r * 0.12, r * 0.84, r * 0.12);
        rr(c, -r * 0.7, top, r * 1.4, r * 0.14, r * 0.07); fs(c, '#2a2438', lw);
        c.beginPath(); c.moveTo(-r * 0.02, fy + r * 0.12); c.lineTo(r * 0.45, fy + r * 0.2); c.lineTo(-r * 0.02, fy + r * 0.28); c.closePath(); fs(c, '#ff8a2b', lw * 0.6); break;
      }
    }
  } else if (ev === 'paques') {
    if (fus || type === 'feu') { bunnyEars(c, top + r * 0.25, r * 1.1, lw * 0.8, fus ? '#ffd6ec' : '#ffffff', '#ffb3cf', t); return; }
    switch (type) {
      case 'eau': {
        c.beginPath(); c.moveTo(-r * 0.6, top + r * 0.1); c.quadraticCurveTo(-r * 0.6, top - r * 0.5, 0, top - r * 0.55); c.quadraticCurveTo(r * 0.6, top - r * 0.5, r * 0.6, top + r * 0.1);
        for (let i = 0; i < 6; i++) c.lineTo(r * 0.6 - (i + 0.5) * r * 0.2, top + (i % 2 ? r * 0.1 : -r * 0.1));
        c.closePath(); fs(c, '#fffaf0', lw * 0.8);
        c.fillStyle = '#ffb3cf'; for (const k of [-0.25, 0.25]) { c.beginPath(); c.arc(k * r, top - r * 0.28, r * 0.06, 0, TAU); c.fill(); } break;
      }
      case 'terre': {
        for (const a of [-0.5, 0, 0.5]) { c.save(); c.translate(0, top - r * 0.35); c.rotate(a); c.beginPath(); c.ellipse(0, -r * 0.2, r * 0.07, r * 0.22, 0, 0, TAU); fs(c, '#4fbf52', lw * 0.6); c.restore(); }
        c.beginPath(); c.moveTo(-r * 0.2, top - r * 0.3); c.lineTo(r * 0.2, top - r * 0.3); c.lineTo(0, top + r * 0.35); c.closePath(); fs(c, '#ff8a2b', lw * 0.8); break;
      }
      case 'vent': orbit(c, t, r, () => { const f = Math.abs(Math.sin(t * 14)); for (const sg of [-1, 1]) { c.beginPath(); c.ellipse(sg * r * 0.15 * (0.4 + f), -r * 0.05, r * 0.16 * (0.4 + f), r * 0.2, sg * 0.4, 0, TAU); fs(c, '#ff9ad0', lw * 0.5); } c.beginPath(); c.ellipse(0, 0, r * 0.04, r * 0.16, 0, 0, TAU); c.fillStyle = INK; c.fill(); }); break;
      case 'foudre': for (let i = 0; i < 5; i++) { const a = Math.PI * (1.1 + i * 0.2); flowerAt(c, Math.cos(a) * r * 0.85, -r * 0.2 + Math.sin(a) * r * 0.8, r * 0.14, ['#ff9ad0', '#ffffff', '#b8a2ff'][i % 3], lw * 0.4); } break;
      case 'glace': bow(c, r * 0.35, top + r * 0.05, r * 0.55, lw * 0.8, '#b8a2ff'); break;
    }
  } else if (ev === 'valentin') {
    const hband = () => { c.beginPath(); c.arc(0, top + r * 0.55, r * 0.75, Math.PI * 1.15, Math.PI * 1.85); c.lineWidth = lw * 1.4; c.strokeStyle = '#ff4f81'; c.stroke();
      for (const sg of [-1, 1]) { const bx = sg * r * 0.5, by = top - r * 0.45 + Math.sin(t * 5 + sg) * r * 0.06; c.beginPath(); c.moveTo(sg * r * 0.42, top + r * 0.05); c.lineTo(bx, by); c.lineWidth = lw * 0.8; c.strokeStyle = INK; c.stroke(); heart(c, bx, by, r * 0.34); fs(c, '#ff4f81', lw * 0.6); } };
    if (fus || type === 'feu') { hband(); return; }
    switch (type) {
      case 'eau': bow(c, r * 0.3, top + r * 0.1, r * 0.6, lw * 0.8, '#ff7eb6'); break;
      case 'terre': {
        c.beginPath(); c.moveTo(r * 0.1, top + r * 0.2); c.quadraticCurveTo(r * 0.2, top - r * 0.2, r * 0.05, top - r * 0.45); c.lineWidth = lw * 1.1; c.strokeStyle = '#3f9a3c'; c.stroke();
        c.beginPath(); c.ellipse(r * 0.22, top - r * 0.1, r * 0.12, r * 0.06, -0.5, 0, TAU); c.fillStyle = '#4fbf52'; c.fill();
        c.beginPath(); c.arc(r * 0.05, top - r * 0.6, r * 0.28, 0, TAU); fs(c, '#e8344e', lw * 0.7);
        c.beginPath(); c.arc(r * 0.05, top - r * 0.6, r * 0.14, 0.5, 5); c.lineWidth = lw * 0.6; c.strokeStyle = '#a01e36'; c.stroke(); break;
      }
      case 'vent': orbit(c, t, r, () => { const f = Math.sin(t * 14) * 0.3; for (const sg of [-1, 1]) { c.beginPath(); c.ellipse(sg * r * 0.25, -r * 0.12, r * 0.18, r * 0.09, sg * (0.5 + f), 0, TAU); fs(c, '#ffffff', lw * 0.5); } heart(c, 0, 0, r * 0.28); fs(c, '#ff4f81', lw * 0.6); }); break;
      case 'foudre': {
        const f = Math.sin(t * 8) * 0.15;
        for (const sg of [-1, 1]) { c.save(); c.translate(sg * r * 0.85, -r * 0.3); c.rotate(sg * (0.3 + f)); for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(sg * r * (0.15 + i * 0.12), -r * (0.1 + i * 0.12), r * 0.12, r * 0.28, sg * 0.6, 0, TAU); fs(c, '#ffffff', lw * 0.5); } c.restore(); }
        break;
      }
      case 'glace': { c.save(); c.globalAlpha *= 0.85; for (const sg of [-1, 1]) { heart(c, sg * r * 0.38, fy + r * 0.04, r * 0.36); fs(c, '#ff7eb6', lw * 0.7); } c.restore(); c.beginPath(); c.moveTo(-r * 0.1, fy); c.lineTo(r * 0.1, fy); c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); break; }
    }
  } else if (ev === 'nouvelan') {
    if (fus) { lantern(c, 0, top - r * 0.25, r * 0.65, lw * 0.8); return; }
    switch (type) {
      case 'feu': {
        c.beginPath(); c.moveTo(-r * 0.95, top + r * 0.3); c.lineTo(0, top - r * 0.4); c.lineTo(r * 0.95, top + r * 0.3); c.quadraticCurveTo(0, top + r * 0.1, -r * 0.95, top + r * 0.3); fs(c, '#e8c47a', lw);
        c.beginPath(); c.moveTo(-r * 0.45, top + r * 0.05); c.lineTo(0, top - r * 0.4); c.lineTo(r * 0.45, top + r * 0.05); c.lineWidth = lw * 0.6; c.strokeStyle = 'rgba(120,80,30,.5)'; c.stroke(); break;
      }
      case 'eau': lantern(c, 0, top - r * 0.35, r * 0.75, lw * 0.8); break;
      case 'terre': {
        c.beginPath(); c.arc(-r * 0.05, top - r * 0.25, r * 0.42, 0, TAU); fs(c, '#ff9a2b', lw * 0.8);
        c.beginPath(); c.ellipse(r * 0.2, top - r * 0.7, r * 0.22, r * 0.09, -0.5, 0, TAU); fs(c, '#4fbf52', lw * 0.6); break;
      }
      case 'vent': orbit(c, t, r, () => {
        c.beginPath(); c.moveTo(0, -r * 0.3); c.lineTo(r * 0.22, 0); c.lineTo(0, r * 0.3); c.lineTo(-r * 0.22, 0); c.closePath(); fs(c, '#e8344e', lw * 0.6);
        c.beginPath(); c.moveTo(0, r * 0.3); c.quadraticCurveTo(r * 0.15, r * 0.5, -r * 0.05, r * 0.7); c.lineWidth = lw * 0.6; c.strokeStyle = '#ffd23f'; c.stroke(); }); break;
      case 'foudre': {
        for (const sg of [-1, 1]) {
          c.beginPath(); c.moveTo(sg * r * 0.3, top + r * 0.25); c.lineTo(sg * r * 0.45, top - r * 0.4); c.moveTo(sg * r * 0.38, top - r * 0.1); c.lineTo(sg * r * 0.65, top - r * 0.25);
          c.lineWidth = lw * 2.2; c.strokeStyle = INK; c.stroke(); c.lineWidth = lw * 1.1; c.strokeStyle = '#ffd23f'; c.stroke();
          c.beginPath(); c.moveTo(sg * r * 0.5, fy + r * 0.25); c.quadraticCurveTo(sg * r * 0.95, fy + r * 0.2, sg * r * 1.15, fy + r * 0.45 + Math.sin(t * 4) * r * 0.05); c.lineWidth = lw * 0.8; c.strokeStyle = INK; c.stroke();
        }
        break;
      }
      case 'glace': {
        c.beginPath(); c.moveTo(r * 0.75, -r * 0.1); c.lineTo(r * 0.95, r * 0.1); c.lineTo(r * 0.75, r * 0.3); c.lineTo(r * 0.55, r * 0.1); c.closePath(); fs(c, '#e8344e', lw * 0.7);
        c.beginPath(); c.moveTo(r * 0.75, r * 0.3); c.lineTo(r * 0.75, r * 0.7); c.lineWidth = lw * 1.3; c.strokeStyle = '#e8344e'; c.stroke(); break;
      }
    }
  }
}
function drawEmblem(c, key, x, y, r) {
  const lw = Math.max(1.2, r * 0.2);
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath(); c.arc(x, y, r, 0, TAU); fs(c, BRANCH[key].color, lw);
  c.beginPath();
  if (key === 'sol') {
    c.moveTo(x - r * 0.62, y + r * 0.42); c.lineTo(x - r * 0.15, y - r * 0.48); c.lineTo(x + r * 0.12, y - r * 0.02); c.lineTo(x + r * 0.3, y - r * 0.24); c.lineTo(x + r * 0.62, y + r * 0.42); c.closePath();
    c.fillStyle = INK; c.fill();
  } else if (key === 'air') {
    c.moveTo(x - r * 0.55, y + r * 0.4); c.quadraticCurveTo(x - r * 0.1, y - r * 0.75, x + r * 0.62, y - r * 0.45);
    c.quadraticCurveTo(x + r * 0.2, y - r * 0.1, x + r * 0.35, y + r * 0.08); c.quadraticCurveTo(x, y + r * 0.05, x - r * 0.55, y + r * 0.4); c.closePath();
    c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = lw * 0.7; c.strokeStyle = INK; c.stroke();
  } else {
    c.moveTo(x - r * 0.55, y + r * 0.42); c.lineTo(x - r * 0.62, y - r * 0.38); c.lineTo(x - r * 0.25, y - r * 0.02); c.lineTo(x, y - r * 0.55);
    c.lineTo(x + r * 0.25, y - r * 0.02); c.lineTo(x + r * 0.62, y - r * 0.38); c.lineTo(x + r * 0.55, y + r * 0.42); c.closePath();
    c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = lw * 0.7; c.strokeStyle = INK; c.stroke();
  }
  c.restore();
}

// ---------- Ennemis ----------
function bodyPath(type, r, ghost) {
  const p = new Path2D();
  if (type === 'cadeau' || type === 'hongbao') {
    const w = type === 'cadeau' ? r : r * 0.8, h = r, k = r * 0.25;
    p.moveTo(-w + k, -h); p.arcTo(w, -h, w, h, k); p.arcTo(w, h, -w, h, k); p.arcTo(-w, h, -w, -h, k); p.arcTo(-w, -h, w, -h, k); p.closePath(); return p;
  }
  if (type === 'calinou') { for (let i = 0; i < 10; i++) { const a = i * TAU / 10, b = (i + 1) * TAU / 10; if (!i) p.moveTo(Math.cos(a) * r, Math.sin(a) * r); p.quadraticCurveTo(Math.cos((a + b) / 2) * r * 1.22, Math.sin((a + b) / 2) * r * 1.22, Math.cos(b) * r, Math.sin(b) * r); } p.closePath(); return p; }
  if (type === 'lapin') { p.arc(0, 0, r, 0, TAU); return p; }
  if (ghost) {
    p.moveTo(-r, r * 0.8); p.lineTo(-r, -r * 0.1); p.bezierCurveTo(-r, -r * 1.25, r, -r * 1.25, r, -r * 0.1); p.lineTo(r, r * 0.8);
    for (let i = 0; i < 4; i++) p.quadraticCurveTo(r - (i + 0.5) * r * 0.5, r * 0.45, r - (i + 1) * r * 0.5, r * 0.8);
    p.closePath(); return p;
  }
  if (type === 'tonk' || type === 'potiron') p.ellipse(0, 0, r * 1.05, r * 0.85, 0, 0, TAU);
  else if (type === 'flappy') p.arc(0, 0, r, 0, TAU);
  else {
    p.moveTo(-r, r * 0.75); p.bezierCurveTo(-r * 1.15, -r * 0.35, -r * 0.55, -r * 1.1, 0, -r * 1.08);
    p.bezierCurveTo(r * 0.55, -r * 1.1, r * 1.15, -r * 0.35, r, r * 0.75); p.quadraticCurveTo(0, r * 0.95, -r, r * 0.75); p.closePath();
  }
  return p;
}
// Accessoires des monstres pendant les événements : derrière le corps…
function evBehind(c, ev, type, r, lw, t, col) {
  if (type === 'lapin' || (ev === 'paques' && type === 'boss')) { bunnyEars(c, -r * 0.7, r * 1.05, lw, col, '#ffb3cf', t); return; }
  if (ev === 'valentin' && type === 'zip') for (const sg of [-1, 1]) { c.beginPath(); c.ellipse(sg * r * 0.95, -r * 0.45, r * 0.45, r * 0.22, sg * -0.6, 0, TAU); fs(c, '#ffffff', lw * 0.8); }
  if ((ev === 'valentin' && type === 'tonk') || (ev === 'nouvelan' && type === 'zip')) for (const sg of [-1, 1]) { c.beginPath(); c.arc(sg * r * 0.68, -r * 0.7, r * 0.3, 0, TAU); fs(c, col, lw); c.beginPath(); c.arc(sg * r * 0.68, -r * 0.7, r * 0.15, 0, TAU); c.fillStyle = '#ffb3cf'; c.fill(); }
  if (ev === 'nouvelan' && type === 'tonk') for (let i = 0; i < 12; i++) { const a = i * TAU / 12; c.beginPath(); c.arc(Math.cos(a) * r * 1.05, Math.sin(a) * r * 0.9 - r * 0.1, r * 0.3, 0, TAU); fs(c, i % 2 ? '#e8344e' : '#ff9a2b', lw * 0.8); }
  if (ev === 'nouvelan' && type === 'malefik') for (const a of [-0.9, -0.5, -0.1]) { c.save(); c.rotate(a + Math.sin(t * 3 + a) * 0.1); c.beginPath(); c.ellipse(r * 1.1, 0, r * 0.55, r * 0.2, 0, 0, TAU); fs(c, '#ff9a4d', lw * 0.8); c.beginPath(); c.ellipse(r * 1.5, 0, r * 0.16, r * 0.12, 0, 0, TAU); c.fillStyle = '#ffffff'; c.fill(); c.restore(); }
}
// … et devant (après le visage) ; les monstres propres aux événements y reçoivent aussi leurs détails
function evFront(c, ev, type, r, lw, t, sdx, e) {
  const nx = sdx * r * 0.16, ny = r * 0.05;
  if (type === 'cadeau') {
    c.fillStyle = '#ffd23f'; c.fillRect(-r * 0.14, -r, r * 0.28, r * 2); c.fillRect(-r, -r * 0.14, r * 2, r * 0.28);
    c.lineWidth = lw * 0.6; c.strokeStyle = INK; c.strokeRect(-r * 0.14, -r, r * 0.28, r * 2); bow(c, 0, -r * 1.02, r * 0.45, lw * 0.8, '#ffd23f'); return;
  }
  if (type === 'calinou') { heart(c, 0, r * 0.62, r * 0.3); fs(c, '#ff4f81', lw * 0.6); return; }
  if (type === 'hongbao') { c.beginPath(); c.arc(0, r * 0.55, r * 0.28, 0, TAU); fs(c, '#ffd23f', lw * 0.7); c.fillStyle = '#e8344e'; c.fillRect(-r * 0.08, r * 0.47, r * 0.16, r * 0.16); return; }
  if (type === 'lapin') { c.beginPath(); c.arc(-sdx * r * 0.9, r * 0.45, r * 0.22, 0, TAU); fs(c, '#ffffff', lw * 0.7); return; }
  if (!ev) return;
  const crown = (y, w, gem) => { c.beginPath(); c.moveTo(-w, y); c.lineTo(-w * 1.1, y - w * 0.9); c.lineTo(-w * 0.5, y - w * 0.4); c.lineTo(0, y - w * 1.15); c.lineTo(w * 0.5, y - w * 0.4); c.lineTo(w * 1.1, y - w * 0.9); c.lineTo(w, y); c.closePath(); fs(c, '#ffd23f', lw); if (gem) { heart(c, 0, y - w * 0.45, w * 0.35); fs(c, gem, lw * 0.5); } };
  if (ev === 'noel') {
    if (type === 'gloop') { c.beginPath(); c.moveTo(nx, ny + r * 0.12); c.lineTo(nx + sdx * r * 0.45 + (sdx ? 0 : r * 0.3), ny + r * 0.2); c.lineTo(nx, ny + r * 0.28); c.closePath(); fs(c, '#ff8a2b', lw * 0.6); rr(c, -r * 0.95, r * 0.5, r * 1.9, r * 0.24, r * 0.12); fs(c, '#e8344e', lw * 0.8); }
    else if (type === 'zip') santaHat(c, -r * 0.75, r * 1.1, lw, '#3fae55');
    else if (type === 'flappy') { c.beginPath(); c.moveTo(nx - r * 0.1, ny + r * 0.15); c.lineTo(nx + r * 0.1, ny + r * 0.15); c.lineTo(nx, ny + r * 0.32); c.closePath(); fs(c, '#ffb03d', lw * 0.5); }
    else if (type === 'tonk') { rr(c, -r * 0.5, -r * 1.55, r, r * 0.8, r * 0.1); fs(c, '#2a2438', lw); c.fillStyle = '#ffd23f'; c.fillRect(-r * 0.5, -r * 0.95, r, r * 0.14); c.beginPath(); c.ellipse(r * 0.1, -r * 1.65, r * 0.12, r * 0.25, 0.3, 0, TAU); fs(c, '#e8344e', lw * 0.7); }
    else if (type === 'magma') { c.beginPath(); c.moveTo(-r * 0.85, -r * 0.45); for (let i = 0; i <= 6; i++) c.quadraticCurveTo(-r * 0.85 + (i - 0.5) * r * 0.28, -r * (i % 2 ? 0.2 : 0.35), -r * 0.85 + i * r * 0.28, -r * 0.45); c.quadraticCurveTo(0, -r * 1.35, -r * 0.85, -r * 0.45); fs(c, '#ffffff', lw * 0.8); for (const sg of [-1, 1]) { c.beginPath(); c.ellipse(sg * r * 0.18, -r * 1.05, r * 0.18, r * 0.08, sg * 0.5, 0, TAU); fs(c, '#3fae55', lw * 0.6); } c.beginPath(); c.arc(0, -r * 1.02, r * 0.1, 0, TAU); fs(c, '#e8344e', lw * 0.5); }
    else if (type === 'gresil') { rr(c, -r * 0.35, -r * 1.35, r * 0.7, r * 0.42, r * 0.08); fs(c, '#a8b0c0', lw); c.beginPath(); for (const k of [-1.25, -1.13, -1.01]) { c.moveTo(-r * 0.35, r * k); c.lineTo(r * 0.35, r * k + r * 0.04); } c.lineWidth = lw * 0.6; c.strokeStyle = INK; c.stroke(); }
    else if (type === 'crachou') { c.lineWidth = lw * 1.5; for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * r * 0.3, -r * 0.9); c.lineTo(sg * r * 0.55, -r * 1.6); c.moveTo(sg * r * 0.42, -r * 1.25); c.lineTo(sg * r * 0.85, -r * 1.4); c.strokeStyle = INK; c.lineWidth = lw * 2.4; c.stroke(); c.strokeStyle = '#8a5a3c'; c.lineWidth = lw * 1.2; c.stroke(); } c.beginPath(); c.arc(nx, ny + r * 0.2, r * 0.14, 0, TAU); fs(c, '#ff3b4f', lw * 0.6); }
  } else if (ev === 'paques') {
    if (type === 'gloop') { c.beginPath(); c.moveTo(nx - r * 0.13, ny + r * 0.18); c.lineTo(nx, ny + r * 0.1); c.lineTo(nx + r * 0.13, ny + r * 0.18); c.lineTo(nx, ny + r * 0.3); c.closePath(); fs(c, '#ff9a2b', lw * 0.6); c.beginPath(); for (const a of [-0.4, 0, 0.4]) { c.moveTo(0, -r * 1.0); c.quadraticCurveTo(a * r, -r * 1.35, a * r * 1.4, -r * 1.3); } c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); }
    else if (type === 'zip') { c.beginPath(); c.moveTo(0, -r * 1.05); c.lineTo(0, r * 0.85); c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); c.fillStyle = INK; for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [-0.6, 0.3], [0.6, 0.3]]) { c.beginPath(); c.arc(a * r, b * r, r * 0.13, 0, TAU); c.fill(); } }
    else if (type === 'tonk') { c.beginPath(); c.moveTo(-r * 1.02, -r * 0.2); for (let i = 1; i <= 8; i++) c.lineTo(-r * 1.02 + i * r * 0.255, -r * 0.2 + (i % 2 ? -r * 0.18 : 0)); c.lineWidth = lw * 1.6; c.strokeStyle = '#ff7eb6'; c.stroke(); c.fillStyle = '#ffd23f'; for (const k of [-0.5, 0, 0.5]) { c.beginPath(); c.arc(k * r, -r * 0.6, r * 0.08, 0, TAU); c.fill(); } }
    else if (type === 'magma') { c.beginPath(); c.moveTo(-r * 0.9, -r * 0.35); for (let i = 0; i <= 6; i++) c.quadraticCurveTo(-r * 0.9 + (i - 0.5) * r * 0.3, -r * (i % 2 ? 0.05 : 0.3), -r * 0.9 + i * r * 0.3, -r * 0.35); c.quadraticCurveTo(0, -r * 1.3, -r * 0.9, -r * 0.35); fs(c, '#5e3a24', lw * 0.8); c.beginPath(); c.arc(0, -r * 1.0, r * 0.14, 0, TAU); fs(c, '#ffffff', lw * 0.5); }
    else if (type === 'gresil') { c.save(); c.clip(bodyPath(type, r)); c.fillStyle = 'rgba(42,27,61,.85)'; for (const k of [-0.35, 0.25]) c.fillRect(-r * 1.2, k * r, r * 2.4, r * 0.22); c.restore(); for (const sg of [-1, 1]) { c.beginPath(); c.ellipse(sg * r * 0.6, -r * 1.0, r * 0.4, r * 0.22, sg * -0.5, 0, TAU); c.fillStyle = 'rgba(255,255,255,.75)'; c.fill(); c.lineWidth = lw * 0.7; c.strokeStyle = INK; c.stroke(); } }
    else if (type === 'crachou') for (const sg of [-1, 1]) { c.beginPath(); c.arc(sg * r * 0.45, -r * 0.95, r * 0.25, 0, TAU); fs(c, '#6fcf6a', lw); c.beginPath(); c.arc(sg * r * 0.45, -r * 0.97, r * 0.12, 0, TAU); c.fillStyle = INK; c.fill(); }
    else if (type === 'boss') bow(c, 0, r * 0.75, r * 0.4, lw, '#ff7eb6');
  } else if (ev === 'valentin') {
    if (type === 'gloop') { heart(c, r * 0.55, -r * 0.5, r * 0.25); fs(c, '#ff4f81', lw * 0.5); }
    else if (type === 'zip') { c.beginPath(); c.ellipse(0, -r * 1.3, r * 0.5, r * 0.14, 0, 0, TAU); c.lineWidth = lw * 1.4; c.strokeStyle = '#ffd23f'; c.stroke(); }
    else if (type === 'tonk') { c.beginPath(); c.ellipse(nx, ny + r * 0.32, r * 0.35, r * 0.24, 0, 0, TAU); c.fillStyle = 'rgba(255,240,220,.7)'; c.fill(); }
    else if (type === 'magma') { heart(c, 0, -r * 1.15, r * 0.55); fs(c, '#ff2f6a', lw * 0.8); }
    else if (type === 'gresil') { const g = c.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 1.6); g.addColorStop(0, 'rgba(240,255,120,0)'); g.addColorStop(1, 'rgba(240,255,120,' + (0.25 + 0.15 * Math.sin(t * 5)) + ')'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 1.6, 0, TAU); c.fill(); }
    else if (type === 'crachou' || type === 'boss') crown(-r * 0.85, r * 0.45, type === 'boss' ? '#ff4f81' : null);
    else if (type === 'malefik') { c.beginPath(); c.moveTo(r * 0.1, -r * 0.7); c.lineTo(-r * 0.15, -r * 0.3); c.lineTo(r * 0.12, 0); c.lineTo(-r * 0.1, r * 0.4); c.lineWidth = lw * 1.4; c.strokeStyle = INK; c.stroke(); }
  } else if (ev === 'nouvelan') {
    if (type === 'gloop') { c.beginPath(); c.moveTo(-r * 0.7, -r * 0.75); for (let i = 1; i <= 7; i++) c.quadraticCurveTo(-r * 0.7 + (i - 0.5) * r * 0.2, -r * (i % 2 ? 1.2 : 0.85), -r * 0.7 + i * r * 0.2, -r * 0.75 - Math.sin(i / 7 * Math.PI) * r * 0.3); c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); }
    else if (type === 'zip') { c.beginPath(); c.moveTo(-sdx * r, r * 0.4); c.quadraticCurveTo(-sdx * r * 1.6, r * 0.1, -sdx * r * 1.7, r * 0.7); c.lineWidth = lw; c.strokeStyle = '#ff9ad0'; c.stroke(); }
    else if (type === 'tonk') { c.beginPath(); c.moveTo(-r * 0.12, -r * 0.8); c.lineTo(0, -r * 1.35); c.lineTo(r * 0.12, -r * 0.8); c.closePath(); fs(c, '#ffd23f', lw * 0.7); }
    else if (type === 'magma') { c.fillStyle = '#ffd23f'; c.fillRect(-r * 0.95, -r * 0.1, r * 1.9, r * 0.2); c.beginPath(); c.moveTo(0, -r * 1.0); c.quadraticCurveTo(r * 0.2, -r * 1.35, r * 0.05, -r * 1.55); c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); star(c, r * 0.05, -r * 1.6, r * 0.18 * (1 + 0.3 * Math.sin(t * 20)), r * 0.07); fs(c, '#ffd23f', lw * 0.5); }
    else if (type === 'gresil') { c.save(); c.clip(bodyPath(type, r)); c.lineWidth = lw * 0.7; c.strokeStyle = 'rgba(140,30,10,.55)'; for (const k of [-0.5, 0.5]) { c.beginPath(); c.ellipse(k * r * 0.6, 0, r * 0.35, r * 1.1, 0, 0, TAU); c.stroke(); } c.restore(); rr(c, -r * 0.5, -r * 1.12, r, r * 0.2, r * 0.06); fs(c, '#ffd23f', lw * 0.7); c.beginPath(); c.moveTo(0, r * 0.8); c.lineTo(0, r * 1.2); c.lineWidth = lw * 1.5; c.strokeStyle = '#ffd23f'; c.stroke(); }
    else if (type === 'crachou') { c.beginPath(); c.arc(nx, ny + r * 0.5, r * 0.22, 0, TAU); fs(c, '#ffd23f', lw * 0.7); c.lineWidth = lw * 0.6; c.strokeRect(nx - r * 0.06, ny + r * 0.44, r * 0.12, r * 0.12); }
    else if (type === 'malefik') for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * r * 0.25, -r * 0.9); c.lineTo(sg * r * 0.6, -r * 1.55); c.lineTo(sg * r * 0.85, -r * 0.6); c.closePath(); fs(c, '#ff9a4d', lw); c.beginPath(); c.moveTo(sg * r * 0.4, -r * 0.9); c.lineTo(sg * r * 0.6, -r * 1.3); c.lineTo(sg * r * 0.72, -r * 0.8); c.closePath(); c.fillStyle = '#ffffff'; c.fill(); }
    else if (type === 'boss') { c.lineWidth = lw * 1.6; for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * r * 0.3, -r * 0.9); c.lineTo(sg * r * 0.55, -r * 1.6); c.moveTo(sg * r * 0.43, -r * 1.25); c.lineTo(sg * r * 0.85, -r * 1.4); c.strokeStyle = INK; c.lineWidth = lw * 2.6; c.stroke(); c.strokeStyle = '#ffd23f'; c.lineWidth = lw * 1.3; c.stroke(); c.beginPath(); c.moveTo(nx + sg * r * 0.3, ny + r * 0.3); c.quadraticCurveTo(nx + sg * r * 1.0, ny + r * 0.1, nx + sg * r * 1.35, ny + r * 0.5 + Math.sin(t * 3 + sg) * r * 0.1); c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); } }
  }
}
function drawEnemy(c, type, x, y, s, t, e) {
  const D = ETYPES[type], r = s * D.size, lw = Math.max(1.4, s * 0.045), ev = evt(), SK = skinOf(type), HS = ev === 'halloween' ? SK : null, XS = SK && !HS ? ev : null;
  const ghost = type === 'spectre' || (HS && type === 'gloop'), col = SK ? SK.color : D.color, lig = SK ? SK.light : D.light;
  const fly = !!D.flying, sdx = e ? e.sdx : 1, sdy = e ? e.sdy : 0, id = e ? e.id : 0;
  const still = e && (e.frozen > 0 || e.stun > 0);
  const ph = e ? e.phase : t * 6;
  const hopA = fly || still ? 0 : Math.abs(Math.sin(ph));
  const up = (fly ? s * FLY + Math.sin(t * 5 + id) * s * 0.04 : hopA * s * 0.08) + (e && e.hopT > 0 ? Math.sin(e.hopT / 0.35 * Math.PI) * s * 0.35 : 0);
  const sq = fly || still ? 0 : (1 - hopA) * 0.14;
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  const shk = fly ? 0.6 : 1 - hopA * 0.2;
  c.fillStyle = 'rgba(42,27,61,.25)'; c.beginPath(); c.ellipse(x, y, r * 0.95 * shk, r * 0.3 * shk, 0, 0, TAU); c.fill();
  if (e && e.slowA > 0 && !still) { c.beginPath(); c.ellipse(x, y, r * 1.2, r * 0.4, 0, 0, TAU); c.lineWidth = lw; c.strokeStyle = 'rgba(110,200,255,.95)'; c.stroke(); }
  const cy = y - r * 0.85 - up;
  c.translate(x, cy);
  c.save();
  if (e && e.ghost > 0) c.globalAlpha *= 0.32;
  c.translate(0, r * 0.85); c.scale(1 + sq, 1 - sq); c.translate(0, -r * 0.85);
  // Éléments derrière le corps
  if (type === 'flappy') {
    const f = Math.sin(t * 18 + id);
    for (const sg of [-1, 1]) {
      c.beginPath(); c.moveTo(sg * r * 0.5, -r * 0.25);
      c.quadraticCurveTo(sg * r * 1.3, -r * (0.9 + f * 0.6), sg * r * 2.0, -r * (0.3 + f * 0.7));
      c.quadraticCurveTo(sg * r * 1.65, -r * 0.05, sg * r * 1.5, r * 0.25);
      c.quadraticCurveTo(sg * r * 1.15, r * 0.05, sg * r * 0.6, r * 0.35); c.closePath(); fs(c, ({ halloween: '#2b2140', noel: '#c9d8ec', paques: '#ffd23f', valentin: '#ffffff', nouvelan: '#ffd23f' })[ev] || '#4a3aa6', lw);
      c.beginPath(); c.moveTo(sg * r * 0.3, -r * 0.8); c.lineTo(sg * r * 0.6, -r * 1.35); c.lineTo(sg * r * 0.75, -r * 0.6); c.closePath(); fs(c, col, lw);
    }
  } else if (type === 'boss' && (!SK || ev === 'noel')) {
    for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * r * 0.25, -r * 0.9); c.quadraticCurveTo(sg * r * 0.55, -r * 1.35, sg * r * 0.85, -r * 1.55); c.quadraticCurveTo(sg * r * 0.75, -r * 1.05, sg * r * 0.7, -r * 0.7); c.closePath(); fs(c, '#fff1d0', lw); }
  } else if (type === 'gresil' && HS) {
    // Araignée : huit pattes
    const k = Math.sin(ph * 2) * r * 0.08; c.lineWidth = lw * 1.1; c.strokeStyle = INK;
    for (const sg of [-1, 1]) for (let i = 0; i < 4; i++) { const yy = -r * 0.35 + i * r * 0.3; c.beginPath(); c.moveTo(sg * r * 0.5, yy); c.quadraticCurveTo(sg * r * 1.25, yy - r * 0.55 + (i % 2 ? k : -k), sg * r * 1.45, yy + r * 0.45); c.stroke(); }
  } else if (type === 'gresil' && XS !== 'noel' && XS !== 'nouvelan') {
    for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * r * 0.3, -r * 0.9); c.quadraticCurveTo(sg * r * 0.5, -r * 1.5, sg * r * 0.8, -r * 1.55); c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); c.beginPath(); c.arc(sg * r * 0.8, -r * 1.55, r * 0.14, 0, TAU); fs(c, '#ffe34d', lw * 0.7); }
  } else if (type === 'crachou') {
    for (const sg of [-1, 1]) { c.beginPath(); c.arc(sg * r * 1.15, -r * 0.05, r * 0.3, 0, TAU); fs(c, col, lw); c.beginPath(); c.moveTo(sg * r * 1.15, -r * 0.05); c.lineTo(sg * r * 1.45, -r * 0.1); c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); }
  } else if (type === 'zip' && !still) {
    const px = -sdy, py = sdx; c.lineWidth = lw; c.strokeStyle = INK;
    for (const k of [-0.45, 0, 0.45]) { const x0 = -sdx * r * 1.25 + px * k * r, y0 = -sdy * r * 1.25 + py * k * r; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 - sdx * r * (0.7 + Math.abs(k)), y0 - sdy * r * (0.7 + Math.abs(k))); c.stroke(); }
  }
  if (XS || type === 'lapin') evBehind(c, XS, type, r, lw, t, col);
  if (HS && type === 'zip') for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * r * 0.25, -r * 0.95); c.lineTo(sg * r * 0.75, -r * 1.45); c.lineTo(sg * r * 0.85, -r * 0.6); c.closePath(); fs(c, col, lw); }
  const body = bodyPath(type, r, ghost);
  const g = c.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r * 1.3); g.addColorStop(0, lig); g.addColorStop(1, col);
  fsp(c, body, g, lw);
  const pumpkinBody = type === 'potiron' || (HS && (type === 'boss' || type === 'tonk'));
  if (pumpkinBody) {
    // Côtes de citrouille
    c.save(); c.clip(body); c.lineWidth = lw * 0.9; c.strokeStyle = 'rgba(160,70,10,.55)';
    for (const k of [-0.5, 0.5]) { c.beginPath(); c.ellipse(k * r * 0.75, 0, r * 0.4, r * 1.1, 0, 0, TAU); c.stroke(); }
    c.restore();
  }
  if (type === 'potiron' || (HS && type === 'boss')) { c.beginPath(); c.moveTo(0, -r * 0.85); c.quadraticCurveTo(r * 0.05, -r * 1.2, r * 0.25, -r * 1.3); c.lineWidth = lw * 2.2; c.strokeStyle = INK; c.stroke(); c.lineWidth = lw * 1.2; c.strokeStyle = '#4f9a3c'; c.stroke(); }
  if (HS && type === 'boss') {
    c.beginPath(); c.moveTo(-r * 0.6, -r * 0.88); c.lineTo(-r * 0.68, -r * 1.45); c.lineTo(-r * 0.32, -r * 1.12); c.lineTo(0, -r * 1.6); c.lineTo(r * 0.32, -r * 1.12); c.lineTo(r * 0.68, -r * 1.45); c.lineTo(r * 0.6, -r * 0.88); c.closePath(); fs(c, '#ffd23f', lw);
    c.fillStyle = '#ff4f81'; for (const k of [-0.68, 0, 0.68]) { c.beginPath(); c.arc(k * r, k ? -r * 1.45 : -r * 1.6, r * 0.08, 0, TAU); c.fill(); }
  }
  if (HS && type === 'crachou') {
    c.lineWidth = lw * 0.8; c.strokeStyle = INK;
    c.beginPath(); c.moveTo(-r * 0.75, -r * 0.45); c.lineTo(-r * 0.15, -r * 0.75); for (let i = 0; i < 3; i++) { const a = -r * 0.65 + i * r * 0.2, b = -r * 0.5 - i * r * 0.1; c.moveTo(a - r * 0.05, b - r * 0.1); c.lineTo(a + r * 0.05, b + r * 0.1); } c.stroke();
  }
  if (type === 'magma' && !XS) {
    c.beginPath(); c.moveTo(-r * 0.7, r * 0.1); c.lineTo(-r * 0.4, r * 0.35); c.lineTo(-r * 0.5, r * 0.6); c.moveTo(r * 0.75, -r * 0.1); c.lineTo(r * 0.45, r * 0.3); c.lineTo(r * 0.6, r * 0.55);
    c.lineWidth = lw * 1.1; c.strokeStyle = '#ffe34d'; c.stroke();
    const fl = Math.sin(t * 12 + id) * r * 0.1;
    c.beginPath(); c.moveTo(-r * 0.3, -r * 0.95); c.quadraticCurveTo(fl, -r * 1.6, r * 0.3, -r * 0.95); c.closePath(); fs(c, HS ? '#c8ff6a' : '#ffb03d', lw * 0.8);
  } else if (type === 'tonk' && !XS) {
    c.beginPath(); c.ellipse(0, -r * 0.15, r * 0.98, r * 0.72, 0, Math.PI, TAU); c.closePath(); fs(c, HS ? '#6d6f80' : '#9aa6b8', lw);
    if (HS) { c.beginPath(); c.moveTo(0, -r * 0.85); c.quadraticCurveTo(r * 0.3, -r * 1.3, -r * 0.1, -r * 1.45); c.lineWidth = lw * 2; c.strokeStyle = '#a8344e'; c.stroke(); }
    c.beginPath(); c.moveTo(-r * 0.98, -r * 0.15); c.lineTo(r * 0.98, -r * 0.15); c.lineWidth = lw * 1.4; c.strokeStyle = INK; c.stroke();
    c.fillStyle = '#e8eef6'; for (const k of [-0.55, 0, 0.55]) { c.beginPath(); c.arc(k * r, -r * 0.45 - (k ? 0 : r * 0.12), r * 0.07, 0, TAU); c.fill(); }
  } else if (type === 'malefik' && XS !== 'nouvelan') {
    c.beginPath(); c.moveTo(-r * 0.7, -r * 0.72); c.quadraticCurveTo(-r * 0.1, -r * 1.3, r * 0.35, -r * 1.95); c.quadraticCurveTo(r * 0.45, -r * 1.2, r * 0.72, -r * 0.72); c.closePath(); fs(c, '#3b2458', lw);
    c.beginPath(); c.ellipse(0, -r * 0.72, r * 1.0, r * 0.2, 0, 0, TAU); fs(c, '#3b2458', lw);
    c.beginPath(); c.moveTo(-r * 0.52, -r * 0.95); c.quadraticCurveTo(0, -r * 1.05, r * 0.56, -r * 0.95); c.lineWidth = lw * 1.4; c.strokeStyle = '#ffd23f'; c.stroke();
  } else if (type !== 'boss' && !pumpkinBody && !(XS && (type === 'magma' || type === 'tonk'))) {
    c.save(); c.translate(-r * 0.42, -r * 0.5); c.rotate(-0.6); c.beginPath(); c.ellipse(0, 0, r * 0.1, r * 0.2, 0, 0, TAU); c.fillStyle = 'rgba(255,255,255,.8)'; c.fill(); c.restore();
  }
  const blink = ((t + id * 0.37) % 3.4) < 0.12 && !still;
  const mood = e && e.flash > 0 ? 'open' : D.mood;
  face(c, sdx * r * 0.16, (type === 'tonk' ? r * 0.2 : r * 0.05) + sdy * r * 0.08, r * 0.95, sdx, sdy, mood, blink, D.angry);
  if (XS || D.season) evFront(c, XS, type, r, lw, t, sdx, e);
  if (HS && type === 'zip') { c.lineWidth = lw * 0.6; c.strokeStyle = '#d8d0ec'; c.beginPath(); for (const sg of [-1, 1]) for (const k of [-0.06, 0.08]) { c.moveTo(sg * r * 0.55, r * 0.3 + k * r); c.lineTo(sg * r * 1.05, r * 0.22 + k * r * 2); } c.stroke(); }
  if (e) {
    if (e.wet > 0) {
      c.fillStyle = 'rgba(60,150,255,.28)'; c.fill(body);
      const k = (t * 1.6 + id) % 1;
      for (const sg of [-1, 1]) { c.beginPath(); const dx = sg * r * 0.85, dy = r * 0.1 + k * r * 0.7; c.moveTo(dx, dy - r * 0.16); c.quadraticCurveTo(dx + r * 0.1, dy, dx, dy + r * 0.06); c.quadraticCurveTo(dx - r * 0.1, dy, dx, dy - r * 0.16); fs(c, '#6cc6ff', lw * 0.5); }
    }
    if (e.flash > 0) { c.fillStyle = 'rgba(255,255,255,' + Math.min(0.85, e.flash * 7) + ')'; c.fill(body); }
    if (e.burnT > 0) {
      for (const k of [-0.5, 0.05, 0.55]) {
        const fl = Math.sin(t * 14 + k * 9 + id) * r * 0.08, bx = k * r, by = -r * 0.95 + Math.abs(k) * r * 0.3;
        c.beginPath(); c.moveTo(bx - r * 0.17, by); c.quadraticCurveTo(bx + fl, by - r * 0.6, bx + r * 0.17, by); c.closePath(); fs(c, '#ff9a3d', lw * 0.6);
      }
    }
    if (e.frozen > 0) {
      rr(c, -r * 1.25, -r * 1.3, r * 2.5, r * 2.3, r * 0.3); c.fillStyle = 'rgba(195,240,255,.6)'; c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.moveTo(-r * 0.9, -r * 0.6); c.lineTo(-r * 0.5, -r * 1.0); c.moveTo(-r * 0.9, -r * 0.2); c.lineTo(-r * 0.2, -r * 0.95); c.lineWidth = lw; c.strokeStyle = '#ffffff'; c.stroke();
    }
    if (e.stun > 0 && e.frozen <= 0) {
      for (let i = 0; i < 3; i++) { const a = t * 5 + i * TAU / 3; star(c, Math.cos(a) * r * 0.8, -r * 1.25 + Math.sin(a) * r * 0.25, r * 0.2, r * 0.09); fs(c, '#ffd23f', lw * 0.5); }
    }
  }
  c.restore();
  c.restore();
  if (e && e.hp < e.maxHp) {
    const bw = Math.max(s * 0.5, r * 1.7), bh = Math.max(4, s * 0.08), bx = x - bw / 2, by = cy - r * 1.2 - bh - (D.boss ? s * 0.12 : s * 0.04);
    const k = clamp(e.hp / e.maxHp, 0, 1);
    rr(c, bx, by, bw, bh, bh / 2); c.fillStyle = INK; c.fill();
    if (k > 0) { rr(c, bx + 1.5, by + 1.5, Math.max(bh - 3, (bw - 3) * k), bh - 3, (bh - 3) / 2); c.fillStyle = k > 0.5 ? '#5cd86a' : k > 0.25 ? '#ffd23f' : '#ff4f6e'; c.fill(); }
  }
}

// ---------- Décor, portail, maison ----------
function drawDeco(c, d, cs) {
  const [x0, y0] = toScreen(d.c + 0.5 + d.ox, d.r + 0.5 + d.oy), s = cs * d.s, lw = Math.max(1, cs * 0.035);
  c.save(); c.translate(x0, y0); c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = lw;
  switch (d.type) {
    case 'fleur': {
      c.beginPath(); c.moveTo(0, s * 0.05); c.lineTo(0, s * 0.25); c.strokeStyle = '#2f7a2c'; c.stroke();
      const col = ['#ff9ad0', '#ffffff', '#b8a2ff'][(d.c * 7 + d.r * 3) % 3];
      for (let i = 0; i < 5; i++) { const a = i * TAU / 5; c.beginPath(); c.arc(Math.cos(a) * s * 0.1, Math.sin(a) * s * 0.1 - s * 0.02, s * 0.075, 0, TAU); fs(c, col, lw); }
      c.beginPath(); c.arc(0, -s * 0.02, s * 0.06, 0, TAU); fs(c, '#ffd23f', lw); break;
    }
    case 'buisson': {
      const C = [[-0.13, 0.03, 0.13], [0.13, 0.03, 0.13], [0, -0.08, 0.15]];
      c.lineWidth = lw * 2; for (const [a, b, q] of C) { c.beginPath(); c.arc(a * s, b * s, q * s, 0, TAU); c.stroke(); }
      for (const [a, b, q] of C) { c.beginPath(); c.arc(a * s, b * s, q * s, 0, TAU); c.fillStyle = '#4fbf52'; c.fill(); }
      c.beginPath(); c.arc(-s * 0.05, -s * 0.13, s * 0.045, 0, TAU); c.fillStyle = 'rgba(255,255,255,.6)'; c.fill(); break;
    }
    case 'herbe': {
      c.strokeStyle = '#3d9a3a'; c.lineWidth = lw * 1.3; c.beginPath();
      c.moveTo(-s * 0.08, s * 0.1); c.lineTo(-s * 0.13, -s * 0.05); c.moveTo(0, s * 0.1); c.lineTo(0, -s * 0.1); c.moveTo(s * 0.08, s * 0.1); c.lineTo(s * 0.14, -s * 0.04); c.stroke(); break;
    }
    case 'champi': {
      rr(c, -s * 0.05, -s * 0.02, s * 0.1, s * 0.14, s * 0.03); fs(c, '#fff4e0', lw);
      c.beginPath(); c.arc(0, 0, s * 0.15, Math.PI, TAU); c.closePath(); fs(c, '#ff5a5a', lw);
      c.fillStyle = '#fff'; for (const [a, b] of [[-0.07, -0.06], [0.06, -0.09], [0.02, -0.03]]) { c.beginPath(); c.arc(a * s, b * s, s * 0.025, 0, TAU); c.fill(); } break;
    }
    case 'coquillage': {
      c.beginPath(); c.moveTo(0, s * 0.1); c.arc(0, s * 0.1, s * 0.17, Math.PI * 1.12, Math.PI * 1.88); c.closePath(); fs(c, '#ffb3c7', lw);
      c.beginPath(); for (const a of [1.3, 1.5, 1.7]) { c.moveTo(0, s * 0.1); c.lineTo(Math.cos(a * Math.PI) * s * 0.15, s * 0.1 + Math.sin(a * Math.PI) * s * 0.15); } c.lineWidth = lw * 0.7; c.stroke(); break;
    }
    case 'palmier': {
      c.beginPath(); c.moveTo(0, s * 0.22); c.quadraticCurveTo(-s * 0.02, 0, s * 0.06, -s * 0.18);
      c.lineWidth = lw * 4.5; c.strokeStyle = INK; c.stroke(); c.lineWidth = lw * 2.6; c.strokeStyle = '#b07a4a'; c.stroke();
      for (const a of [-2.6, -1.9, -1.2, -0.5]) { c.save(); c.translate(s * 0.06, -s * 0.18); c.rotate(a); c.beginPath(); c.ellipse(s * 0.13, 0, s * 0.14, s * 0.05, 0, 0, TAU); fs(c, '#3fbf5f', lw); c.restore(); } break;
    }
    case 'etoile': { star(c, 0, 0, s * 0.16, s * 0.07, 5, 0.3); fs(c, '#ff9a4d', lw); break; }
    case 'roche': {
      c.beginPath(); c.moveTo(-s * 0.18, s * 0.1); c.lineTo(-s * 0.14, -s * 0.06); c.lineTo(-s * 0.02, -s * 0.14); c.lineTo(s * 0.14, -s * 0.08); c.lineTo(s * 0.19, s * 0.1); c.closePath(); fs(c, '#9b8aa6', lw);
      c.beginPath(); c.moveTo(-s * 0.08, -s * 0.06); c.lineTo(s * 0.02, -s * 0.09); c.strokeStyle = 'rgba(255,255,255,.6)'; c.stroke(); break;
    }
    case 'lave': {
      c.beginPath(); c.ellipse(0, s * 0.03, s * 0.2, s * 0.1, 0, 0, TAU); fs(c, '#ff7a3d', lw);
      c.beginPath(); c.ellipse(-s * 0.03, s * 0.02, s * 0.1, s * 0.045, 0, 0, TAU); c.fillStyle = '#ffd23f'; c.fill(); break;
    }
    case 'flocon': { c.save(); c.rotate(d.c + d.r); star(c, 0, 0, s * 0.15, s * 0.05, 6); fs(c, '#ffffff', lw * 0.8); c.restore(); break; }
    case 'sapinet': { drawSapin(c, 0, s * 0.12, s * 0.55, lw); break; }
    case 'citrouille': { pumpkin(c, 0, s * 0.04, s * 0.17, s * 0.12, lw, (d.c + d.r) % 3 === 0); break; }
    case 'bougie': {
      for (const [a, h] of [[-0.06, 0.2], [0.07, 0.13]]) { rr(c, a * s - s * 0.035, s * 0.12 - h * s, s * 0.07, h * s, s * 0.02); fs(c, '#fff3d6', lw * 0.8); c.beginPath(); c.ellipse(a * s, s * 0.12 - h * s - s * 0.045, s * 0.022, s * 0.045, 0, 0, TAU); c.fillStyle = '#ffb03d'; c.fill(); }
      const g = c.createRadialGradient(0, -s * 0.05, 1, 0, -s * 0.05, s * 0.28); g.addColorStop(0, 'rgba(255,210,100,.35)'); g.addColorStop(1, 'rgba(255,210,100,0)'); c.fillStyle = g; c.fillRect(-s * 0.3, -s * 0.35, s * 0.6, s * 0.6); break;
    }
    case 'champinuit': {
      rr(c, -s * 0.04, -s * 0.02, s * 0.08, s * 0.13, s * 0.03); fs(c, '#e8e0f5', lw);
      c.beginPath(); c.arc(0, 0, s * 0.13, Math.PI, TAU); c.closePath(); fs(c, '#a65cf0', lw);
      c.fillStyle = '#d8ff8a'; for (const [a, b] of [[-0.06, -0.05], [0.05, -0.08]]) { c.beginPath(); c.arc(a * s, b * s, s * 0.022, 0, TAU); c.fill(); } break;
    }
    case 'sucredorge': {
      c.save(); c.rotate(0.2); c.beginPath(); c.moveTo(0, s * 0.18); c.lineTo(0, -s * 0.08); c.arc(-s * 0.07, -s * 0.08, s * 0.07, 0, Math.PI, true);
      c.lineWidth = lw * 3.4; c.strokeStyle = INK; c.stroke(); c.lineWidth = lw * 2.2; c.strokeStyle = '#ffffff'; c.stroke();
      c.setLineDash([s * 0.04, s * 0.04]); c.strokeStyle = '#e8344e'; c.stroke(); c.setLineDash([]); c.restore(); break;
    }
    case 'boule': { const col = ['#e8344e', '#ffd23f', '#6cc6ff', '#5cd86a'][(d.c + d.r) % 4]; c.beginPath(); c.arc(0, 0, s * 0.11, 0, TAU); fs(c, col, lw); c.fillStyle = '#c9c0d8'; c.fillRect(-s * 0.03, -s * 0.15, s * 0.06, s * 0.05); c.beginPath(); c.arc(-s * 0.04, -s * 0.04, s * 0.03, 0, TAU); c.fillStyle = 'rgba(255,255,255,.7)'; c.fill(); break; }
    case 'bonhomme': {
      c.beginPath(); c.arc(0, s * 0.08, s * 0.12, 0, TAU); fs(c, '#ffffff', lw); c.beginPath(); c.arc(0, -s * 0.09, s * 0.085, 0, TAU); fs(c, '#ffffff', lw);
      c.fillStyle = INK; for (const sg of [-1, 1]) { c.beginPath(); c.arc(sg * s * 0.03, -s * 0.1, s * 0.012, 0, TAU); c.fill(); }
      c.beginPath(); c.moveTo(0, -s * 0.08); c.lineTo(s * 0.07, -s * 0.07); c.lineTo(0, -s * 0.06); c.fillStyle = '#ff8a2b'; c.fill();
      c.fillStyle = '#e8344e'; c.fillRect(-s * 0.08, -s * 0.03, s * 0.16, s * 0.03); break;
    }
    case 'cadeaumini': { const col = ['#e8344e', '#5cd86a', '#6cc6ff'][(d.c * 3 + d.r) % 3]; rr(c, -s * 0.11, -s * 0.06, s * 0.22, s * 0.17, s * 0.03); fs(c, col, lw); c.fillStyle = '#ffd23f'; c.fillRect(-s * 0.02, -s * 0.06, s * 0.04, s * 0.17); bow(c, 0, -s * 0.07, s * 0.06, lw * 0.6, '#ffd23f'); break; }
    case 'tulipe': {
      const col = ['#ff6f9a', '#ffd23f', '#b8a2ff', '#ff8a5c'][(d.c * 5 + d.r) % 4];
      c.beginPath(); c.moveTo(0, s * 0.2); c.lineTo(0, 0); c.strokeStyle = '#3d9a3a'; c.lineWidth = lw * 1.2; c.stroke();
      c.beginPath(); c.ellipse(s * 0.05, s * 0.12, s * 0.05, s * 0.02, -0.6, 0, TAU); c.fillStyle = '#4fbf52'; c.fill();
      c.beginPath(); c.moveTo(-s * 0.07, -s * 0.02); c.lineTo(-s * 0.07, -s * 0.12); c.lineTo(-s * 0.035, -s * 0.07); c.lineTo(0, -s * 0.13); c.lineTo(s * 0.035, -s * 0.07); c.lineTo(s * 0.07, -s * 0.12); c.lineTo(s * 0.07, -s * 0.02); c.quadraticCurveTo(0, s * 0.05, -s * 0.07, -s * 0.02); fs(c, col, lw * 0.8); break;
    }
    case 'oeufmini': {
      const col = ['#9fd8ff', '#ffb3cf', '#ffe066', '#c8f0a0'][(d.c + d.r * 3) % 4];
      c.beginPath(); c.ellipse(0, 0, s * 0.08, s * 0.11, 0, 0, TAU); fs(c, col, lw);
      c.beginPath(); c.moveTo(-s * 0.075, 0); for (let i = 1; i <= 4; i++) c.lineTo(-s * 0.075 + i * s * 0.0375, i % 2 ? -s * 0.03 : 0); c.lineWidth = lw * 0.8; c.strokeStyle = '#ffffff'; c.stroke(); break;
    }
    case 'carotte': {
      c.beginPath(); c.moveTo(-s * 0.05, -s * 0.04); c.lineTo(s * 0.05, -s * 0.04); c.lineTo(0, s * 0.14); c.closePath(); fs(c, '#ff8a2b', lw * 0.8);
      c.beginPath(); for (const a of [-0.5, 0, 0.5]) { c.moveTo(0, -s * 0.04); c.lineTo(Math.sin(a) * s * 0.08, -s * 0.13); } c.strokeStyle = '#3d9a3a'; c.lineWidth = lw * 1.2; c.stroke(); break;
    }
    case 'coeurmini': { heart(c, 0, 0, s * 0.18); fs(c, ['#ff4f81', '#ff9ac6', '#e8344e'][(d.c + d.r) % 3], lw * 0.8); break; }
    case 'rose': {
      c.beginPath(); c.moveTo(0, s * 0.2); c.lineTo(0, 0); c.strokeStyle = '#3d9a3a'; c.lineWidth = lw * 1.2; c.stroke();
      c.beginPath(); c.arc(0, -s * 0.03, s * 0.08, 0, TAU); fs(c, '#e8344e', lw * 0.8); c.beginPath(); c.arc(0, -s * 0.03, s * 0.04, 0.4, 5); c.strokeStyle = '#a01e36'; c.lineWidth = lw * 0.7; c.stroke(); break;
    }
    case 'lanternemini': { lantern(c, 0, s * 0.05, s * 0.13, lw * 0.6); break; }
    case 'petard': { for (const k of [-1, 1]) { rr(c, k * s * 0.05 - s * 0.035, -s * 0.05, s * 0.07, s * 0.16, s * 0.02); fs(c, '#e8344e', lw * 0.7); } c.fillStyle = '#ffd23f'; c.fillRect(-s * 0.09, s * 0.03, s * 0.18, s * 0.025); break; }
    case 'bambou': { for (const k of [-0.05, 0.05]) { rr(c, k * s - s * 0.025, -s * 0.15 - k * s, s * 0.05, s * 0.3 + k * s, s * 0.02); fs(c, '#7fbf5a', lw * 0.7); c.fillStyle = '#4f8a3a'; c.fillRect(k * s - s * 0.025, -s * 0.02, s * 0.05, s * 0.015); } break; }
    case 'mandarine': { c.beginPath(); c.arc(0, s * 0.02, s * 0.09, 0, TAU); fs(c, '#ff9a2b', lw); c.beginPath(); c.ellipse(s * 0.05, -s * 0.08, s * 0.05, s * 0.022, -0.5, 0, TAU); c.fillStyle = '#4fbf52'; c.fill(); break; }
    case 'os': {
      c.save(); c.rotate((d.c * 3 + d.r) % 3 - 1);
      rr(c, -s * 0.12, -s * 0.025, s * 0.24, s * 0.05, s * 0.02); fs(c, '#f4eedd', lw * 0.8);
      for (const sg of [-1, 1]) for (const k of [-1, 1]) { c.beginPath(); c.arc(sg * s * 0.12, k * s * 0.03, s * 0.035, 0, TAU); fs(c, '#f4eedd', lw * 0.8); }
      c.restore(); break;
    }
    case 'cristal': {
      for (const [a, h, col] of [[-0.07, 0.24, '#c59bff'], [0.07, 0.17, '#e0c8ff']]) {
        c.beginPath(); c.moveTo(a * s - s * 0.05, s * 0.1); c.lineTo(a * s - s * 0.05, s * 0.1 - h * s * 0.6); c.lineTo(a * s, s * 0.1 - h * s); c.lineTo(a * s + s * 0.05, s * 0.1 - h * s * 0.6); c.lineTo(a * s + s * 0.05, s * 0.1); c.closePath(); fs(c, col, lw);
      } break;
    }
  }
  c.restore();
}
function drawSapin(c, x, y, s, lw) {
  rr(c, x - s * 0.06, y - s * 0.02, s * 0.12, s * 0.18, s * 0.03); fs(c, '#8a5a3c', lw);
  for (let i = 0; i < 3; i++) {
    const yb = y - i * s * 0.2, w = s * (0.36 - i * 0.08);
    c.beginPath(); c.moveTo(x - w, yb); c.lineTo(x + w, yb); c.lineTo(x, yb - s * 0.34); c.closePath(); fs(c, '#3f9e6a', lw);
    c.beginPath(); c.moveTo(x - w * 0.35, yb - s * 0.22); c.lineTo(x, yb - s * 0.34); c.lineTo(x + w * 0.35, yb - s * 0.22); c.quadraticCurveTo(x, yb - s * 0.18, x - w * 0.35, yb - s * 0.22); c.fillStyle = '#ffffff'; c.fill();
  }
}
function drawObstacle(c, kind, x, y, cs) {
  const lw = Math.max(1.4, cs * 0.045);
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  c.fillStyle = 'rgba(42,27,61,.22)'; c.beginPath(); c.ellipse(x, y + cs * 0.3, cs * 0.38, cs * 0.1, 0, 0, TAU); c.fill();
  if (kind === 'arbre') {
    rr(c, x - cs * 0.07, y, cs * 0.14, cs * 0.3, cs * 0.04); fs(c, '#8a5a3c', lw);
    const C = [[-0.18, -0.08, 0.2], [0.18, -0.08, 0.2], [0, -0.28, 0.24]];
    c.lineWidth = lw * 2; c.strokeStyle = INK; for (const [a, b, q] of C) { c.beginPath(); c.arc(x + a * cs, y + b * cs, q * cs, 0, TAU); c.stroke(); }
    for (const [a, b, q] of C) { c.beginPath(); c.arc(x + a * cs, y + b * cs, q * cs, 0, TAU); c.fillStyle = '#48b04c'; c.fill(); }
    c.beginPath(); c.arc(x - cs * 0.08, y - cs * 0.34, cs * 0.07, 0, TAU); c.fillStyle = 'rgba(255,255,255,.45)'; c.fill();
  } else if (kind === 'palmier') {
    c.beginPath(); c.moveTo(x - cs * 0.04, y + cs * 0.3); c.quadraticCurveTo(x - cs * 0.08, y, x + cs * 0.08, y - cs * 0.3);
    c.lineWidth = lw * 4; c.strokeStyle = INK; c.stroke(); c.lineWidth = lw * 2.4; c.strokeStyle = '#b07a4a'; c.stroke();
    for (const a of [-2.8, -2.1, -1.4, -0.7, 0]) { c.save(); c.translate(x + cs * 0.08, y - cs * 0.3); c.rotate(a); c.beginPath(); c.ellipse(cs * 0.2, 0, cs * 0.22, cs * 0.07, 0, 0, TAU); fs(c, '#3fbf5f', lw); c.restore(); }
    c.beginPath(); c.arc(x + cs * 0.04, y - cs * 0.24, cs * 0.05, 0, TAU); c.arc(x + cs * 0.14, y - cs * 0.24, cs * 0.05, 0, TAU); c.fillStyle = '#8a5a3c'; c.fill();
  } else if (kind === 'basalte') {
    c.beginPath(); c.moveTo(x - cs * 0.36, y + cs * 0.28); c.lineTo(x - cs * 0.3, y - cs * 0.1); c.lineTo(x - cs * 0.1, y - cs * 0.36); c.lineTo(x + cs * 0.18, y - cs * 0.3); c.lineTo(x + cs * 0.36, y - cs * 0.02); c.lineTo(x + cs * 0.32, y + cs * 0.28); c.closePath();
    const g = c.createLinearGradient(0, y - cs * 0.36, 0, y + cs * 0.3); g.addColorStop(0, '#5e4a68'); g.addColorStop(1, '#3a2c42'); fs(c, g, lw);
    c.beginPath(); c.moveTo(x - cs * 0.08, y - cs * 0.3); c.lineTo(x, y - cs * 0.05); c.lineTo(x - cs * 0.06, y + cs * 0.15); c.lineWidth = lw; c.strokeStyle = '#ff8a3d'; c.stroke();
  } else if (kind === 'cactus') {
    rr(c, x - cs * 0.09, y - cs * 0.32, cs * 0.18, cs * 0.6, cs * 0.09); fs(c, '#5cb85c', lw);
    rr(c, x - cs * 0.28, y - cs * 0.14, cs * 0.1, cs * 0.2, cs * 0.05); fs(c, '#5cb85c', lw);
    rr(c, x - cs * 0.28, y + cs * 0.02, cs * 0.22, cs * 0.08, cs * 0.04); fs(c, '#5cb85c', lw);
    rr(c, x + cs * 0.18, y - cs * 0.24, cs * 0.1, cs * 0.18, cs * 0.05); fs(c, '#5cb85c', lw);
    rr(c, x + cs * 0.06, y - cs * 0.1, cs * 0.22, cs * 0.08, cs * 0.04); fs(c, '#5cb85c', lw);
    c.beginPath(); c.arc(x, y - cs * 0.34, cs * 0.06, 0, TAU); fs(c, '#ff7eb6', lw * 0.7);
  } else if (kind === 'rocher') {
    c.beginPath(); c.moveTo(x - cs * 0.38, y + cs * 0.28); c.quadraticCurveTo(x - cs * 0.42, y - cs * 0.2, x - cs * 0.05, y - cs * 0.3); c.quadraticCurveTo(x + cs * 0.4, y - cs * 0.3, x + cs * 0.38, y + cs * 0.28); c.closePath();
    const g = c.createLinearGradient(0, y - cs * 0.3, 0, y + cs * 0.3); g.addColorStop(0, '#d8ae84'); g.addColorStop(1, '#9c6f4a'); fs(c, g, lw);
    c.beginPath(); c.moveTo(x + cs * 0.1, y - cs * 0.22); c.lineTo(x + cs * 0.02, y); c.lineTo(x + cs * 0.12, y + cs * 0.15); c.lineWidth = lw * 0.8; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.ellipse(x - cs * 0.16, y - cs * 0.14, cs * 0.08, cs * 0.04, -0.4, 0, TAU); c.fillStyle = 'rgba(255,255,255,.5)'; c.fill();
  } else if (kind === 'sapinnoel') {
    if (Math.round(x * 7 + y * 13) % 3 === 0) {
      // Pile de cadeaux
      for (const [a, b, w, h, col] of [[-0.3, 0.02, 0.36, 0.28, '#e8344e'], [0.04, 0.06, 0.3, 0.24, '#5cd86a'], [-0.18, -0.24, 0.3, 0.26, '#6cc6ff']]) {
        rr(c, x + a * cs, y + b * cs, w * cs, h * cs, cs * 0.04); fs(c, col, lw); c.fillStyle = '#ffd23f'; c.fillRect(x + (a + w / 2 - 0.025) * cs, y + b * cs, cs * 0.05, h * cs);
      }
      bow(c, x - cs * 0.03, y - cs * 0.25, cs * 0.08, lw * 0.6, '#ffd23f');
    } else {
      drawSapin(c, x, y + cs * 0.22, cs * 1.05, lw);
      const cols = ['#e8344e', '#ffd23f', '#6cc6ff'];
      for (const [a, b, i] of [[-0.14, 0.1, 0], [0.12, 0.05, 1], [-0.02, -0.12, 2], [0.1, -0.28, 0], [-0.1, -0.3, 1]]) { c.beginPath(); c.arc(x + a * cs, y + b * cs, cs * 0.04, 0, TAU); fs(c, cols[i], lw * 0.5); }
      star(c, x, y - cs * 0.48, cs * 0.09, cs * 0.04); fs(c, '#ffd23f', lw * 0.7);
    }
  } else if (kind === 'oeufgeant') {
    if (Math.round(x * 7 + y * 13) % 3 === 0) {
      const C = [[-0.18, -0.02, 0.2], [0.18, -0.02, 0.2], [0, -0.22, 0.22]];
      c.lineWidth = lw * 2; c.strokeStyle = INK; for (const [a, b, q] of C) { c.beginPath(); c.arc(x + a * cs, y + b * cs, q * cs, 0, TAU); c.stroke(); }
      for (const [a, b, q] of C) { c.beginPath(); c.arc(x + a * cs, y + b * cs, q * cs, 0, TAU); c.fillStyle = '#5cbf5a'; c.fill(); }
      for (const [a, b] of [[-0.2, -0.1], [0.15, -0.05], [0, -0.3], [0.2, -0.25]]) { c.beginPath(); c.arc(x + a * cs, y + b * cs, cs * 0.045, 0, TAU); fs(c, '#ffb3cf', lw * 0.5); }
    } else {
      const cols = [['#9fd8ff', '#ff7eb6'], ['#ffe066', '#7fbf5a'], ['#ffb3cf', '#b8a2ff']][Math.round(x + y) % 3];
      c.beginPath(); c.ellipse(x, y - cs * 0.02, cs * 0.26, cs * 0.34, 0, 0, TAU); fs(c, cols[0], lw);
      c.save(); c.beginPath(); c.ellipse(x, y - cs * 0.02, cs * 0.26, cs * 0.34, 0, 0, TAU); c.clip();
      c.beginPath(); c.moveTo(x - cs * 0.3, y - cs * 0.05); for (let i = 1; i <= 6; i++) c.lineTo(x - cs * 0.3 + i * cs * 0.1, y - cs * (i % 2 ? 0.15 : 0.05)); c.lineWidth = lw * 2; c.strokeStyle = cols[1]; c.stroke();
      c.fillStyle = '#ffffff'; for (const [a, b] of [[-0.1, 0.15], [0.1, 0.18], [0, -0.25]]) { c.beginPath(); c.arc(x + a * cs, y + b * cs, cs * 0.04, 0, TAU); c.fill(); } c.restore();
    }
  } else if (kind === 'coeurbuisson') {
    rr(c, x - cs * 0.05, y + cs * 0.1, cs * 0.1, cs * 0.2, cs * 0.03); fs(c, '#8a5a3c', lw);
    heart(c, x, y - cs * 0.1, cs * 0.55); fs(c, '#4fae55', lw * 1.2);
    for (const [a, b] of [[-0.14, -0.18], [0.12, -0.1], [0, 0.02]]) { c.beginPath(); c.arc(x + a * cs, y + b * cs, cs * 0.045, 0, TAU); fs(c, '#ff4f81', lw * 0.5); }
  } else if (kind === 'pagode') {
    if (Math.round(x * 7 + y * 13) % 3 === 0) {
      for (const [a, h] of [[-0.15, 0.6], [0.02, 0.72], [0.17, 0.52]]) { rr(c, x + a * cs - cs * 0.05, y + cs * 0.3 - h * cs, cs * 0.1, h * cs, cs * 0.03); fs(c, '#7fbf5a', lw); c.fillStyle = '#4f8a3a'; for (let k = 1; k < 3; k++) c.fillRect(x + a * cs - cs * 0.05, y + cs * 0.3 - h * cs * k / 3, cs * 0.1, cs * 0.02); }
    } else {
      rr(c, x - cs * 0.16, y - cs * 0.05, cs * 0.32, cs * 0.35, cs * 0.03); fs(c, '#e8344e', lw);
      for (const [b, w] of [[-0.05, 0.36], [-0.3, 0.28]]) { c.beginPath(); c.moveTo(x - w * cs, y + b * cs); c.quadraticCurveTo(x, y + (b - 0.16) * cs, x + w * cs, y + b * cs); c.lineTo(x + w * 0.6 * cs, y + (b - 0.08) * cs); c.lineTo(x - w * 0.6 * cs, y + (b - 0.08) * cs); c.closePath(); fs(c, '#3a7a5a', lw); }
      rr(c, x - cs * 0.12, y - cs * 0.3, cs * 0.24, cs * 0.18, cs * 0.02); fs(c, '#e8344e', lw * 0.8);
      c.fillStyle = '#ffd23f'; c.fillRect(x - cs * 0.05, y + cs * 0.12, cs * 0.1, cs * 0.18);
    }
  } else if (kind === 'tombe') {
    if (Math.round(x * 7 + y * 13) % 3 === 0) {
      // Arbre mort tordu
      c.beginPath(); c.moveTo(x - cs * 0.08, y + cs * 0.3); c.quadraticCurveTo(x - cs * 0.02, y, x - cs * 0.06, y - cs * 0.2);
      c.moveTo(x - cs * 0.04, y - cs * 0.05); c.quadraticCurveTo(x + cs * 0.18, y - cs * 0.12, x + cs * 0.26, y - cs * 0.32);
      c.moveTo(x - cs * 0.06, y - cs * 0.2); c.quadraticCurveTo(x - cs * 0.2, y - cs * 0.3, x - cs * 0.22, y - cs * 0.4);
      c.moveTo(x + cs * 0.12, y - cs * 0.15); c.lineTo(x + cs * 0.06, y - cs * 0.3);
      c.lineWidth = lw * 4; c.strokeStyle = INK; c.stroke(); c.lineWidth = lw * 2.2; c.strokeStyle = '#6b5446'; c.stroke();
      c.beginPath(); c.arc(x + cs * 0.24, y - cs * 0.34, cs * 0.04, 0, TAU); fs(c, '#ffe066', lw * 0.5);
    } else {
      // Pierre tombale arrondie avec une croix
      c.beginPath(); c.moveTo(x - cs * 0.24, y + cs * 0.3); c.lineTo(x - cs * 0.24, y - cs * 0.12); c.arc(x, y - cs * 0.12, cs * 0.24, Math.PI, TAU); c.lineTo(x + cs * 0.24, y + cs * 0.3); c.closePath();
      const g = c.createLinearGradient(0, y - cs * 0.36, 0, y + cs * 0.3); g.addColorStop(0, '#c3bacf'); g.addColorStop(1, '#8a7f99'); fs(c, g, lw);
      c.beginPath(); c.moveTo(x, y - cs * 0.22); c.lineTo(x, y + cs * 0.06); c.moveTo(x - cs * 0.1, y - cs * 0.12); c.lineTo(x + cs * 0.1, y - cs * 0.12); c.lineWidth = lw * 1.2; c.strokeStyle = '#5d5370'; c.stroke();
      c.beginPath(); c.ellipse(x - cs * 0.18, y + cs * 0.28, cs * 0.1, cs * 0.05, 0, Math.PI, TAU); c.fillStyle = '#4f9a3c'; c.fill();
    }
  } else {
    drawSapin(c, x, y + cs * 0.22, cs * 1.05, lw);
  }
  c.restore();
}
// ---------- Terrains : zones arrondies, relief et décors ----------
const TSTYLE = {
  L: { fill: '#72c8f7', fill2: '#69c0f2', edge: '#3f8fc4', sunk: 1 },
  M: { fill: '#a0aa5c', fill2: '#97a154', edge: '#687034', sunk: 1 },
  S: { fill: '#f6dc9c', fill2: '#f1d48e', edge: '#d3a95e' },
  R: { fill: '#b0a3ba', fill2: '#a79ab2', edge: '#6f607c', raise: '#877a95' },
  V: { fill: '#ef7a3a', fill2: '#e97034', edge: '#8a2f1c', sunk: 1 },
  N: { fill: '#f7fbff', fill2: '#eff6fd', edge: '#a9c6e2', raise: '#c9dcef' },
  W: { fill: '#bfe6dc', fill2: '#b5dfd4', edge: '#6fae9d', raise: '#96cbbb' },
  K: { fill: '#cdb8f2', fill2: '#c4adee', edge: '#8a6fc4', raise: '#a88fdb' },
  C: { fill: '#b6ec8a', fill2: '#ade47f', edge: '#74b04e', raise: '#8cc663' },
  P: { fill: '#b5763e', fill2: '#ad6f38', edge: '#6e4320' },
  H: { fill: '#a99bd6', fill2: '#a294d0', edge: '#6a5a9e' },
  B: { fill: '#79d468', fill2: '#71cc60', edge: '#3c7a32', sunk: 1 },
  G: { fill: '#c9874a', fill2: '#c07f43', edge: '#7a4a24', raise: '#a86b38' },
  J: { fill: '#b4e2f8', fill2: '#abdaf3', edge: '#6aa8d0', sunk: 1 },
  E: { fill: '#3f8a5a', fill2: '#398253', edge: '#245a38' },
  O: { fill: '#8a5a3c', fill2: '#835436', edge: '#4a2c1a', sunk: 1 },
  Y: { fill: '#a6e0ff', fill2: '#9dd8fa', edge: '#5fa6d4', sunk: 1 },
  Z: { fill: '#d6f5a8', fill2: '#cdee9e', edge: '#8cc663' },
  A: { fill: '#e8587e', fill2: '#e05077', edge: '#9a2a48' },
  I: { fill: '#a8dcff', fill2: '#9fd4fa', edge: '#5f9fd0', sunk: 1 },
  Q: { fill: '#f6d6ff', fill2: '#efcbfa', edge: '#c49ad8', raise: '#dcb4ec' },
  D: { fill: '#e8443a', fill2: '#df3c33', edge: '#8a1e1e' },
  T: { fill: '#7fbf5a', fill2: '#77b753', edge: '#4a7a34', raise: '#5f9a44' },
  U: { fill: '#7fd6b4', fill2: '#76ceab', edge: '#3f8a70', raise: '#5fb898' },
};
// Contour d'une case, arrondi aux coins extérieurs de sa zone ; e = marge en pixels, dy = décalage vertical
function cellPath(c, q, r, same, cs, e, dy) {
  const R0 = cs * 0.3, E = e / cs;
  const outer = (a, b) => !same(q + a, r) && !same(q, r + b);
  const rad = [outer(-1, -1), outer(1, -1), outer(1, 1), outer(-1, 1)].map(o => o ? R0 + e : 0);
  const P = [[q - E, r - E], [q + 1 + E, r - E], [q + 1 + E, r + 1 + E], [q - E, r + 1 + E]].map(([a, b]) => { const [x, y] = toScreen(a, b); return [x, y + dy]; });
  c.moveTo((P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2);
  for (let i = 1; i <= 4; i++) { const A = P[i % 4], B = P[(i + 1) % 4]; c.arcTo(A[0], A[1], B[0], B[1], rad[i % 4]); }
  c.closePath();
}
function drawTerrain(c, cs, tch) {
  const by = {};
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) { const ch = tch(q, r); if (ch && ch !== 'X' && TSTYLE[ch]) (by[ch] = by[ch] || []).push([q, r]); }
  const upN = (q, r) => L.portrait ? [q - 1, r] : [q, r - 1];
  for (const ch in by) {
    const St = TSTYLE[ch], cells = by[ch], same = (a, b) => tch(a, b) === ch;
    const path = (list, e, dy) => { c.beginPath(); for (const [q, r] of list) cellPath(c, q, r, same, cs, e, dy); };
    if (St.raise) { path(cells, 1.5, cs * 0.09); c.fillStyle = St.edge; c.fill(); path(cells, 0, cs * 0.07); c.fillStyle = St.raise; c.fill(); }
    path(cells, 2, 0); c.fillStyle = St.edge; c.fill();
    path(cells, 0, 0); c.fillStyle = St.fill; c.fill();
    path(cells.filter(([q, r]) => (q + r) % 2), 0, 0); c.fillStyle = St.fill2; c.fill();
    c.save(); path(cells, 0, 0); c.clip();
    for (const [q, r] of cells) {
      const [uq, ur] = upN(q, r); if (same(uq, ur)) continue;
      const [x, y] = toScreen(q, r);
      c.fillStyle = St.sunk ? 'rgba(20,20,60,.16)' : 'rgba(255,255,255,.4)';
      c.fillRect(x - 1, y, cs + 2, cs * (St.sunk ? 0.17 : 0.1));
    }
    c.restore();
    for (const [q, r] of cells) { const [x, y] = toScreen(q, r); drawTile(c, ch, x, y, cs, q, r); }
  }
}
function drawTile(c, ch, x, y, cs, q, r) {
  const rnd = mulberry(q * 131 + r * 7919 + 1), lw = Math.max(1, cs * 0.035);
  const px = (a = 0.22, b = 0.56) => x + cs * (a + rnd() * b), py = (a = 0.22, b = 0.56) => y + cs * (a + rnd() * b);
  const spark = (sx, sy, k, col) => { star(c, sx, sy, cs * k, cs * k * 0.32, 4); c.fillStyle = col; c.fill(); };
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  if (ch === 'L') {
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = lw * 1.2;
    for (let i = 0; i < 2; i++) { const a = px(), b = py(); c.beginPath(); c.arc(a, b, cs * 0.07, Math.PI * 1.1, Math.PI * 1.9); c.arc(a + cs * 0.14, b, cs * 0.07, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    if (rnd() < 0.32) {
      const a = px(0.25, 0.5), b = py(0.3, 0.45), rr2 = cs * 0.13;
      c.beginPath(); c.moveTo(a, b); c.arc(a, b, rr2, 0.35, TAU - 0.35); c.closePath(); fs(c, '#6fcf6a', lw);
      c.beginPath(); c.moveTo(a - rr2 * 0.45, b - rr2 * 0.1); c.lineTo(a + rr2 * 0.1, b + rr2 * 0.2); c.lineWidth = lw * 0.7; c.strokeStyle = 'rgba(42,27,61,.35)'; c.stroke();
      if (rnd() < 0.4) { c.beginPath(); c.arc(a - rr2 * 0.3, b - rr2 * 0.35, cs * 0.045, 0, TAU); fs(c, '#ff9ad0', lw * 0.7); }
    }
    if (rnd() < 0.3) spark(px(), py(), 0.05, 'rgba(255,255,255,.9)');
  } else if (ch === 'V') {
    const g = c.createRadialGradient(px(), py(), 1, x + cs / 2, y + cs / 2, cs * 0.7); g.addColorStop(0, 'rgba(255,230,120,.55)'); g.addColorStop(1, 'rgba(255,230,120,0)');
    c.fillStyle = g; c.fillRect(x, y, cs, cs);
    let a = x + cs * 0.1, b = py(); c.beginPath(); c.moveTo(a, b);
    for (let i = 0; i < 4; i++) { a += cs * 0.21; b = clamp(b + (rnd() - 0.5) * cs * 0.35, y + cs * 0.12, y + cs * 0.88); c.lineTo(a, b); }
    c.lineWidth = lw * 2.6; c.strokeStyle = 'rgba(255,140,40,.55)'; c.stroke(); c.lineWidth = lw * 1.1; c.strokeStyle = '#ffe066'; c.stroke();
    for (let i = 0; i < 2; i++) { const cx0 = px(), cy0 = py(); c.beginPath(); c.ellipse(cx0, cy0, cs * (0.08 + rnd() * 0.05), cs * 0.06, rnd() * 3, 0, TAU); fs(c, '#6a2e22', lw * 0.8); c.beginPath(); c.ellipse(cx0 - cs * 0.02, cy0 - cs * 0.02, cs * 0.03, cs * 0.015, 0, 0, TAU); c.fillStyle = 'rgba(255,255,255,.35)'; c.fill(); }
    if (rnd() < 0.5) { c.beginPath(); c.arc(px(), py(), cs * 0.045, 0, TAU); fs(c, '#ffd23f', lw * 0.7); }
  } else if (ch === 'M') {
    c.fillStyle = 'rgba(190,210,110,.5)'; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(px(), py(), cs * (0.07 + rnd() * 0.06), cs * 0.04, rnd() * 3, 0, TAU); c.fill(); }
    if (rnd() < 0.45) {
      const a = px(0.3, 0.4), b = py(0.45, 0.3);
      for (const k of [-1, 1]) { const tx = a + k * cs * 0.05, ty = b - cs * (0.26 + (k > 0 ? 0.04 : 0)); c.beginPath(); c.moveTo(a + k * cs * 0.02, b); c.quadraticCurveTo(tx, b - cs * 0.12, tx, ty); c.lineWidth = lw * 1.1; c.strokeStyle = '#3f6b28'; c.stroke(); c.beginPath(); c.ellipse(tx, ty, cs * 0.028, cs * 0.065, 0, 0, TAU); fs(c, '#8a5a3c', lw * 0.6); }
    }
    if (rnd() < 0.35) { c.beginPath(); c.arc(px(), py(), cs * 0.035, 0, TAU); c.lineWidth = lw * 0.8; c.strokeStyle = 'rgba(255,255,255,.75)'; c.stroke(); }
  } else if (ch === 'S') {
    for (let i = 0; i < 2; i++) {
      const b = y + cs * (0.3 + i * 0.36 + rnd() * 0.08), a = x + cs * (0.1 + rnd() * 0.15);
      c.beginPath(); c.moveTo(a, b); c.quadraticCurveTo(a + cs * 0.25, b - cs * 0.1, a + cs * 0.55, b); c.lineWidth = lw * 1.3; c.strokeStyle = '#d9b36b'; c.stroke();
      c.beginPath(); c.moveTo(a + cs * 0.05, b - cs * 0.035); c.quadraticCurveTo(a + cs * 0.25, b - cs * 0.13, a + cs * 0.48, b - cs * 0.04); c.lineWidth = lw * 0.8; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke();
    }
    c.fillStyle = '#c8995a'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(px(), py(), Math.max(0.9, cs * 0.022), 0, TAU); c.fill(); }
    if (rnd() < 0.18) { const a = px(), b = py(); c.beginPath(); c.moveTo(a, b); c.lineTo(a - cs * 0.05, b - cs * 0.09); c.moveTo(a, b); c.lineTo(a + cs * 0.01, b - cs * 0.11); c.moveTo(a, b); c.lineTo(a + cs * 0.06, b - cs * 0.08); c.lineWidth = lw; c.strokeStyle = '#b8894a'; c.stroke(); }
  } else if (ch === 'R') {
    const n = 1 + (rnd() < 0.6 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = px(0.2, 0.5), b = py(0.25, 0.5), w = cs * (0.14 + rnd() * 0.06), h = cs * (0.08 + rnd() * 0.04);
      c.beginPath(); c.moveTo(a - w, b + h * 0.4); c.lineTo(a - w * 0.7, b - h); c.lineTo(a + w * 0.6, b - h * 0.9); c.lineTo(a + w, b + h * 0.2); c.lineTo(a + w * 0.4, b + h); c.lineTo(a - w * 0.6, b + h); c.closePath(); fs(c, '#cbc0d2', lw);
      c.beginPath(); c.moveTo(a - w * 0.55, b - h * 0.55); c.lineTo(a + w * 0.3, b - h * 0.6); c.lineWidth = lw; c.strokeStyle = 'rgba(255,255,255,.8)'; c.stroke();
    }
    if (rnd() < 0.5) { const a = px(), b = py(); c.beginPath(); c.moveTo(a, b); c.lineTo(a + cs * 0.06, b + cs * 0.05); c.lineTo(a + cs * 0.04, b + cs * 0.12); c.lineWidth = lw * 0.9; c.strokeStyle = 'rgba(42,27,61,.35)'; c.stroke(); }
  } else if (ch === 'N') {
    if (rnd() < 0.55) { const a = px(0.25, 0.45), b = py(0.45, 0.3); c.beginPath(); c.ellipse(a, b, cs * 0.17, cs * 0.08, 0, Math.PI, TAU); c.closePath(); c.fillStyle = '#ffffff'; c.fill(); c.beginPath(); c.ellipse(a, b, cs * 0.17, cs * 0.035, 0, 0, Math.PI); c.fillStyle = 'rgba(150,185,225,.55)'; c.fill(); }
    for (let i = 0; i < 2; i++) spark(px(), py(), 0.045, i ? '#ffffff' : '#9fc9ef');
    c.fillStyle = 'rgba(140,180,225,.5)'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(px(), py(), Math.max(0.8, cs * 0.016), 0, TAU); c.fill(); }
  } else if (ch === 'W') {
    for (let i = 0; i < 2; i++) {
      const a = x + cs * (0.12 + rnd() * 0.2), b = y + cs * (0.28 + i * 0.4);
      c.beginPath(); c.moveTo(a, b); c.quadraticCurveTo(a + cs * 0.22, b - cs * 0.1, a + cs * 0.42, b); c.arc(a + cs * 0.42, b - cs * 0.065, cs * 0.065, Math.PI / 2, -Math.PI * 0.85, true);
      c.lineWidth = lw * 2.2; c.strokeStyle = '#6fae9d'; c.stroke(); c.lineWidth = lw * 1.1; c.strokeStyle = '#ffffff'; c.stroke();
    }
    if (rnd() < 0.5) { const a = px(), b = py(0.5, 0.35); c.beginPath(); for (const k of [-0.05, 0, 0.05]) { c.moveTo(a + k * cs, b); c.quadraticCurveTo(a + k * cs + cs * 0.03, b - cs * 0.07, a + k * cs + cs * 0.1, b - cs * 0.09); } c.lineWidth = lw; c.strokeStyle = '#3f9e6a'; c.stroke(); }
  } else if (ch === 'K') {
    const a = px(0.3, 0.4), b = py(0.5, 0.25), cols = ['#a57bf0', '#8fd8ff', '#ff9ad0'];
    for (let i = 0; i < 3; i++) {
      const cx0 = a + (i - 1) * cs * 0.1, h = cs * (0.16 + (i === 1 ? 0.12 : rnd() * 0.06)), w = cs * 0.045, col = cols[(q + r + i) % 3];
      c.beginPath(); c.moveTo(cx0 - w, b); c.lineTo(cx0 - w, b - h * 0.7); c.lineTo(cx0, b - h); c.lineTo(cx0 + w, b - h * 0.7); c.lineTo(cx0 + w, b); c.closePath(); fs(c, col, lw * 0.9);
      c.beginPath(); c.moveTo(cx0 - w * 0.6, b - h * 0.1); c.lineTo(cx0 - w * 0.6, b - h * 0.65); c.lineTo(cx0, b - h * 0.92); c.lineWidth = lw * 0.8; c.strokeStyle = 'rgba(255,255,255,.75)'; c.stroke();
    }
    spark(px(), py(0.15, 0.3), 0.05, '#ffffff');
  } else if (ch === 'P') {
    // Champ de citrouilles : terre retournée, vrilles et une ou deux citrouilles
    c.strokeStyle = 'rgba(42,27,61,.25)'; c.lineWidth = lw; for (let i = 0; i < 2; i++) { const b = y + cs * (0.3 + i * 0.4); c.beginPath(); c.moveTo(x + cs * 0.1, b); c.lineTo(x + cs * 0.9, b); c.stroke(); }
    const a = px(0.25, 0.3), b = py(0.4, 0.25);
    c.beginPath(); c.moveTo(x + cs * 0.1, b + cs * 0.1); c.bezierCurveTo(a - cs * 0.2, b - cs * 0.25, a, b + cs * 0.2, a + cs * 0.3, b - cs * 0.15); c.lineWidth = lw * 1.1; c.strokeStyle = '#4f9a3c'; c.stroke();
    c.beginPath(); c.ellipse(a + cs * 0.22, b - cs * 0.2, cs * 0.07, cs * 0.04, 0.5, 0, TAU); c.fillStyle = '#5cb84a'; c.fill();
    pumpkin(c, a, b, cs * (0.13 + rnd() * 0.04), cs * 0.1, lw, rnd() < 0.3);
    if (rnd() < 0.4) pumpkin(c, px(0.5, 0.25), py(0.15, 0.2), cs * 0.08, cs * 0.06, lw * 0.8, false);
  } else if (ch === 'H') {
    // Brume hantée : volutes blanches et feux follets
    for (let i = 0; i < 2; i++) {
      const a = x + cs * (0.1 + rnd() * 0.25), b = y + cs * (0.32 + i * 0.36);
      c.beginPath(); c.moveTo(a, b); c.bezierCurveTo(a + cs * 0.15, b - cs * 0.12, a + cs * 0.3, b + cs * 0.1, a + cs * 0.5, b - cs * 0.03);
      c.lineWidth = lw * 3; c.strokeStyle = 'rgba(255,255,255,.35)'; c.stroke(); c.lineWidth = lw * 1.1; c.strokeStyle = 'rgba(255,255,255,.75)'; c.stroke();
    }
    if (rnd() < 0.55) { const a = px(), b = py(); const g = c.createRadialGradient(a, b, 1, a, b, cs * 0.12); g.addColorStop(0, 'rgba(190,255,170,.95)'); g.addColorStop(1, 'rgba(190,255,170,0)'); c.fillStyle = g; c.fillRect(a - cs * 0.12, b - cs * 0.12, cs * 0.24, cs * 0.24); }
  } else if (ch === 'B') {
    // Potion bouillonnante : bulles et reflets verts
    const g = c.createRadialGradient(x + cs * 0.5, y + cs * 0.5, 1, x + cs * 0.5, y + cs * 0.5, cs * 0.7); g.addColorStop(0, 'rgba(220,255,140,.45)'); g.addColorStop(1, 'rgba(220,255,140,0)'); c.fillStyle = g; c.fillRect(x, y, cs, cs);
    for (let i = 0; i < 3; i++) { const a = px(), b = py(), q2 = cs * (0.035 + rnd() * 0.05); c.beginPath(); c.arc(a, b, q2, 0, TAU); c.fillStyle = 'rgba(200,255,150,.55)'; c.fill(); c.lineWidth = lw * 0.8; c.strokeStyle = '#3c7a32'; c.stroke(); c.beginPath(); c.arc(a - q2 * 0.35, b - q2 * 0.35, q2 * 0.3, 0, TAU); c.fillStyle = '#ffffff'; c.fill(); }
    if (rnd() < 0.3) spark(px(), py(), 0.045, '#f0ffc0');
  } else if (ch === 'G') {
    // Pain d'épices : glaçage en zigzag et bonbons
    c.beginPath(); c.moveTo(x + cs * 0.15, y + cs * 0.3); for (let i = 1; i <= 7; i++) c.lineTo(x + cs * (0.15 + i * 0.1), y + cs * (i % 2 ? 0.22 : 0.3)); c.lineWidth = lw * 1.3; c.strokeStyle = '#ffffff'; c.stroke();
    for (let i = 0; i < 2; i++) { c.beginPath(); c.arc(px(), py(0.45, 0.3), cs * 0.05, 0, TAU); fs(c, ['#e8344e', '#5cd86a', '#ffd23f'][(q + r + i) % 3], lw * 0.6); }
    if (rnd() < 0.4) { const a = px(), b = py(0.5, 0.3); c.beginPath(); c.arc(a, b, cs * 0.025, 0, TAU); c.fillStyle = '#5e3a24'; c.fill(); }
  } else if (ch === 'J') {
    // Lac gelé : fissures blanches et reflets
    c.beginPath(); let a = px(0.1, 0.3), b = py(); c.moveTo(a, b); for (let i = 0; i < 3; i++) { a += cs * 0.18; b += (rnd() - 0.5) * cs * 0.3; c.lineTo(a, b); }
    c.lineWidth = lw * 0.9; c.strokeStyle = 'rgba(255,255,255,.9)'; c.stroke();
    c.beginPath(); c.moveTo(px(), py()); c.lineTo(px(), py()); c.lineWidth = lw * 1.6; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke();
    spark(px(), py(), 0.05, '#ffffff');
  } else if (ch === 'E') {
    // Guirlandes de sapin avec ampoules
    c.lineWidth = lw * 1.1; c.strokeStyle = '#6fc48a';
    for (let i = 0; i < 3; i++) { const a = px(), b = py(); c.beginPath(); c.moveTo(a - cs * 0.08, b); c.lineTo(a + cs * 0.08, b - cs * 0.05); c.moveTo(a, b - cs * 0.07); c.lineTo(a + cs * 0.02, b + cs * 0.06); c.stroke(); }
    c.beginPath(); const b0 = py(0.3, 0.3); c.moveTo(x + cs * 0.1, b0); c.quadraticCurveTo(x + cs * 0.5, b0 + cs * 0.25, x + cs * 0.9, b0); c.lineWidth = lw * 0.7; c.strokeStyle = 'rgba(255,255,255,.6)'; c.stroke();
    for (let i = 0; i < 3; i++) { const k = 0.25 + i * 0.25; c.beginPath(); c.arc(x + cs * (0.1 + k * 0.8), b0 + 4 * k * (1 - k) * cs * 0.12 + cs * 0.04, cs * 0.04, 0, TAU); fs(c, ['#ff4f6e', '#ffd23f', '#7fd6ff'][(q + i) % 3], lw * 0.5); }
  } else if (ch === 'O') {
    // Fontaine de chocolat : volutes brillantes
    for (let i = 0; i < 2; i++) { const a = px(), b = py(); c.beginPath(); c.arc(a, b, cs * 0.09, 0.2, Math.PI * 1.6); c.lineWidth = lw * 1.2; c.strokeStyle = 'rgba(200,140,100,.8)'; c.stroke(); }
    c.beginPath(); c.ellipse(px(), py(), cs * 0.08, cs * 0.03, -0.4, 0, TAU); c.fillStyle = 'rgba(255,255,255,.45)'; c.fill();
    if (rnd() < 0.35) { const a = px(), b = py(); c.beginPath(); c.ellipse(a, b, cs * 0.07, cs * 0.09, 0, 0, TAU); fs(c, '#ffb3cf', lw * 0.6); }
  } else if (ch === 'Y') {
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = lw * 1.1;
    for (let i = 0; i < 2; i++) { const a = px(), b = py(); c.beginPath(); c.arc(a, b, cs * 0.06, Math.PI * 1.1, Math.PI * 1.9); c.arc(a + cs * 0.12, b, cs * 0.06, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    if (rnd() < 0.3) { const a = px(0.3, 0.4), b = py(0.35, 0.3); c.beginPath(); c.ellipse(a, b, cs * 0.08, cs * 0.05, 0, 0, TAU); fs(c, '#ffe066', lw * 0.7); c.beginPath(); c.arc(a + cs * 0.06, b - cs * 0.05, cs * 0.04, 0, TAU); fs(c, '#ffe066', lw * 0.7); c.beginPath(); c.moveTo(a + cs * 0.09, b - cs * 0.05); c.lineTo(a + cs * 0.13, b - cs * 0.04); c.strokeStyle = '#ff9a2b'; c.lineWidth = lw; c.stroke(); }
  } else if (ch === 'Z') {
    for (let i = 0; i < 3; i++) flowerAt(c, px(), py(), cs * 0.025, ['#ff9ad0', '#ffffff', '#b8a2ff', '#ffd23f'][(q * 3 + r + i) % 4], lw * 0.4);
    c.beginPath(); for (let i = 0; i < 2; i++) { const a = px(), b = py(); c.moveTo(a, b); c.lineTo(a - cs * 0.03, b - cs * 0.07); c.moveTo(a, b); c.lineTo(a + cs * 0.03, b - cs * 0.07); } c.lineWidth = lw; c.strokeStyle = '#6fb84a'; c.stroke();
  } else if (ch === 'A') {
    for (let i = 0; i < 2; i++) { const a = px(), b = py(); c.beginPath(); c.arc(a, b, cs * 0.08, 0, TAU); fs(c, '#ff3b62', lw * 0.7); c.beginPath(); c.arc(a, b, cs * 0.04, 0.4, 5); c.lineWidth = lw * 0.6; c.strokeStyle = '#a01e36'; c.stroke(); c.beginPath(); c.ellipse(a + cs * 0.09, b + cs * 0.05, cs * 0.05, cs * 0.025, 0.5, 0, TAU); c.fillStyle = '#3f9a3c'; c.fill(); }
  } else if (ch === 'I') {
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = lw; const a = px(0.3, 0.4), b = py(0.3, 0.4);
    for (const k of [0.06, 0.12]) { c.beginPath(); c.ellipse(a, b, cs * k * 1.5, cs * k * 0.7, 0, 0, TAU); c.stroke(); }
    if (rnd() < 0.5) { c.beginPath(); c.arc(px(), py(), cs * 0.04, 0, TAU); fs(c, '#ffd23f', lw * 0.6); }
    heart(c, px(), py(), cs * 0.1); c.fillStyle = 'rgba(255,120,170,.6)'; c.fill();
  } else if (ch === 'Q') {
    for (let i = 0; i < 3; i++) { const a = px(), b = py(); c.beginPath(); c.arc(a, b, cs * (0.07 + rnd() * 0.04), 0, TAU); c.fillStyle = ['rgba(255,190,225,.8)', 'rgba(200,220,255,.8)', 'rgba(255,255,255,.8)'][i]; c.fill(); }
    if (rnd() < 0.4) spark(px(), py(), 0.045, '#ffffff');
  } else if (ch === 'D') {
    c.strokeStyle = 'rgba(255,210,63,.6)'; c.lineWidth = lw * 0.8; c.strokeRect(x + cs * 0.12, y + cs * 0.12, cs * 0.76, cs * 0.76);
    lantern(c, px(0.3, 0.4), py(0.45, 0.25), cs * 0.13, lw * 0.6);
  } else if (ch === 'T') {
    for (let i = 0; i < 3; i++) { const a = px(), b = py(); c.beginPath(); c.ellipse(a, b, cs * 0.07, cs * 0.04, rnd() * 3, 0, TAU); fs(c, '#4f9a3c', lw * 0.6); }
    c.beginPath(); for (let i = 0; i < 2; i++) { const b = y + cs * (0.3 + i * 0.4); c.moveTo(x + cs * 0.15, b); c.lineTo(x + cs * 0.85, b); } c.lineWidth = lw * 0.7; c.strokeStyle = 'rgba(42,27,61,.2)'; c.stroke();
  } else if (ch === 'U') {
    const a = px(0.3, 0.4), b = py(0.5, 0.25); c.beginPath(); c.moveTo(a - cs * 0.16, b); c.lineTo(a - cs * 0.05, b - cs * 0.3); c.lineTo(a + cs * 0.03, b - cs * 0.15); c.lineTo(a + cs * 0.1, b - cs * 0.25); c.lineTo(a + cs * 0.18, b); c.closePath(); fs(c, '#5fc8a0', lw * 0.8);
    c.beginPath(); c.moveTo(a - cs * 0.05, b - cs * 0.3); c.lineTo(a - cs * 0.02, b - cs * 0.05); c.lineWidth = lw * 0.7; c.strokeStyle = 'rgba(255,255,255,.7)'; c.stroke();
  } else if (ch === 'C') {
    const g = c.createRadialGradient(x + cs * 0.42, y + cs * 0.38, cs * 0.04, x + cs * 0.5, y + cs * 0.5, cs * 0.62);
    g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x, y, cs, cs);
    for (let i = 0; i < 2; i++) { const a = px(), b = py(0.4, 0.4); c.beginPath(); c.moveTo(a - cs * 0.05, b); c.lineTo(a - cs * 0.07, b - cs * 0.07); c.moveTo(a, b); c.lineTo(a, b - cs * 0.09); c.moveTo(a + cs * 0.05, b); c.lineTo(a + cs * 0.07, b - cs * 0.06); c.lineWidth = lw; c.strokeStyle = '#4fa344'; c.stroke(); }
    if (rnd() < 0.25) { const a = px(), b = py(); for (let i = 0; i < 5; i++) { const an = i * TAU / 5; c.beginPath(); c.arc(a + Math.cos(an) * cs * 0.035, b + Math.sin(an) * cs * 0.035, cs * 0.028, 0, TAU); c.fillStyle = '#ffffff'; c.fill(); } c.beginPath(); c.arc(a, b, cs * 0.022, 0, TAU); c.fillStyle = '#ffd23f'; c.fill(); }
  }
  c.restore();
}
const PORTALC = { halloween: ['#9dff6a', '#2f7a3a'], noel: ['#9fe6ff', '#2f6fa0'], paques: ['#ffd6ec', '#d05fa0'], valentin: ['#ffb3cf', '#c2457a'], nouvelan: ['#ffd23f', '#c0392b'] };
const ROOFC = { halloween: '#ff8a2b', noel: '#e8344e', paques: '#ff9ad0', valentin: '#ff4f81', nouvelan: '#e8344e' };
function drawPortal(c, x, y, s, t) {
  const lw = Math.max(1.5, s * 0.05);
  c.save(); c.translate(x, y);
  c.beginPath(); c.ellipse(0, 0, s * 0.42, s * 0.42, 0, 0, TAU);
  const pc = PORTALC[evt()] || ['#c79bff', '#5b2ca0'], g = c.createRadialGradient(0, 0, s * 0.05, 0, 0, s * 0.42); g.addColorStop(0, '#fff'); g.addColorStop(0.35, pc[0]); g.addColorStop(1, pc[1]); fs(c, g, lw);
  c.lineWidth = lw; c.strokeStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < 3; i++) { const a = -t * 3 + i * TAU / 3; c.beginPath(); c.arc(0, 0, s * (0.14 + i * 0.08), a, a + 2.4); c.stroke(); }
  c.restore();
}
function drawBase(c, x, y, s, t, hit) {
  const lw = Math.max(1.5, s * 0.05), jig = hit > 0 ? Math.sin(t * 60) * s * 0.04 : 0;
  c.save(); c.translate(x + jig, y); c.lineJoin = 'round';
  c.fillStyle = 'rgba(42,27,61,.25)'; c.beginPath(); c.ellipse(0, s * 0.35, s * 0.44, s * 0.1, 0, 0, TAU); c.fill();
  rr(c, -s * 0.33, -s * 0.08, s * 0.66, s * 0.43, s * 0.06); fs(c, '#fff6e6', lw);
  c.beginPath(); c.moveTo(-s * 0.08, s * 0.35); c.lineTo(-s * 0.08, s * 0.16); c.arc(0, s * 0.16, s * 0.08, Math.PI, TAU); c.lineTo(s * 0.08, s * 0.35); c.closePath(); fs(c, '#a86a42', lw * 0.8);
  c.beginPath(); c.moveTo(-s * 0.46, -s * 0.04); c.quadraticCurveTo(0, -s * 0.62, s * 0.46, -s * 0.04); c.quadraticCurveTo(0, -s * 0.2, -s * 0.46, -s * 0.04); c.closePath(); fs(c, ROOFC[evt()] || '#ff4f81', lw);
  const ev = evt();
  if (ev === 'halloween') pumpkin(c, s * 0.38, s * 0.28, s * 0.11, s * 0.08, lw * 0.7, true);
  else if (ev === 'noel') { c.beginPath(); c.moveTo(-s * 0.4, -s * 0.1); c.quadraticCurveTo(0, -s * 0.52, s * 0.4, -s * 0.1); for (let i = 0; i < 5; i++) c.quadraticCurveTo(s * (0.32 - i * 0.16), -s * 0.02, s * (0.24 - i * 0.16), -s * 0.12); c.closePath(); fs(c, '#ffffff', lw * 0.6); }
  else if (ev === 'paques') { c.beginPath(); c.ellipse(s * 0.4, s * 0.25, s * 0.07, s * 0.1, 0, 0, TAU); fs(c, '#9fd8ff', lw * 0.6); }
  else if (ev === 'nouvelan') lantern(c, s * 0.4, s * 0.12, s * 0.12, lw * 0.5);
  c.beginPath(); c.arc(-s * 0.2, s * 0.06, s * 0.055, 0, TAU); c.arc(s * 0.2, s * 0.06, s * 0.055, 0, TAU); c.fillStyle = INK; c.fill();
  const hb = 1 + Math.sin(t * 5) * 0.08 * (hit > 0 ? 3 : 1);
  c.translate(0, -s * 0.52 + Math.sin(t * 3) * s * 0.03); c.scale(hb, hb);
  heart(c, 0, 0, s * 0.13); fs(c, '#ff4f6e', lw * 0.8);
  c.restore();
}

