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
  c.restore();
  if (br) drawEmblem(c, br, x + s * 0.3, y + s * 0.1, s * 0.12);
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
function bodyPath(type, r) {
  const p = new Path2D();
  if (type === 'tonk') p.ellipse(0, 0, r * 1.05, r * 0.85, 0, 0, TAU);
  else if (type === 'flappy') p.arc(0, 0, r, 0, TAU);
  else {
    p.moveTo(-r, r * 0.75); p.bezierCurveTo(-r * 1.15, -r * 0.35, -r * 0.55, -r * 1.1, 0, -r * 1.08);
    p.bezierCurveTo(r * 0.55, -r * 1.1, r * 1.15, -r * 0.35, r, r * 0.75); p.quadraticCurveTo(0, r * 0.95, -r, r * 0.75); p.closePath();
  }
  return p;
}
function drawEnemy(c, type, x, y, s, t, e) {
  const D = ETYPES[type], r = s * D.size, lw = Math.max(1.4, s * 0.045);
  const fly = !!D.flying, sdx = e ? e.sdx : 1, sdy = e ? e.sdy : 0, id = e ? e.id : 0;
  const still = e && (e.frozen > 0 || e.stun > 0);
  const ph = e ? e.phase : t * 6;
  const hopA = fly || still ? 0 : Math.abs(Math.sin(ph));
  const up = fly ? s * FLY + Math.sin(t * 5 + id) * s * 0.04 : hopA * s * 0.08;
  const sq = fly || still ? 0 : (1 - hopA) * 0.14;
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  const shk = fly ? 0.6 : 1 - hopA * 0.2;
  c.fillStyle = 'rgba(42,27,61,.25)'; c.beginPath(); c.ellipse(x, y, r * 0.95 * shk, r * 0.3 * shk, 0, 0, TAU); c.fill();
  if (e && e.slowA > 0 && !still) { c.beginPath(); c.ellipse(x, y, r * 1.2, r * 0.4, 0, 0, TAU); c.lineWidth = lw; c.strokeStyle = 'rgba(110,200,255,.95)'; c.stroke(); }
  const cy = y - r * 0.85 - up;
  c.translate(x, cy);
  c.save();
  c.translate(0, r * 0.85); c.scale(1 + sq, 1 - sq); c.translate(0, -r * 0.85);
  // Éléments derrière le corps
  if (type === 'flappy') {
    const f = Math.sin(t * 18 + id);
    for (const sg of [-1, 1]) {
      c.beginPath(); c.moveTo(sg * r * 0.5, -r * 0.25);
      c.quadraticCurveTo(sg * r * 1.3, -r * (0.9 + f * 0.6), sg * r * 2.0, -r * (0.3 + f * 0.7));
      c.quadraticCurveTo(sg * r * 1.65, -r * 0.05, sg * r * 1.5, r * 0.25);
      c.quadraticCurveTo(sg * r * 1.15, r * 0.05, sg * r * 0.6, r * 0.35); c.closePath(); fs(c, '#4a3aa6', lw);
      c.beginPath(); c.moveTo(sg * r * 0.3, -r * 0.8); c.lineTo(sg * r * 0.6, -r * 1.35); c.lineTo(sg * r * 0.75, -r * 0.6); c.closePath(); fs(c, D.color, lw);
    }
  } else if (type === 'boss') {
    for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * r * 0.25, -r * 0.9); c.quadraticCurveTo(sg * r * 0.55, -r * 1.35, sg * r * 0.85, -r * 1.55); c.quadraticCurveTo(sg * r * 0.75, -r * 1.05, sg * r * 0.7, -r * 0.7); c.closePath(); fs(c, '#fff1d0', lw); }
  } else if (type === 'gresil') {
    for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * r * 0.3, -r * 0.9); c.quadraticCurveTo(sg * r * 0.5, -r * 1.5, sg * r * 0.8, -r * 1.55); c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); c.beginPath(); c.arc(sg * r * 0.8, -r * 1.55, r * 0.14, 0, TAU); fs(c, '#ffe34d', lw * 0.7); }
  } else if (type === 'crachou') {
    for (const sg of [-1, 1]) { c.beginPath(); c.arc(sg * r * 1.15, -r * 0.05, r * 0.3, 0, TAU); fs(c, D.color, lw); c.beginPath(); c.moveTo(sg * r * 1.15, -r * 0.05); c.lineTo(sg * r * 1.45, -r * 0.1); c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); }
  } else if (type === 'zip' && !still) {
    const px = -sdy, py = sdx; c.lineWidth = lw; c.strokeStyle = INK;
    for (const k of [-0.45, 0, 0.45]) { const x0 = -sdx * r * 1.25 + px * k * r, y0 = -sdy * r * 1.25 + py * k * r; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 - sdx * r * (0.7 + Math.abs(k)), y0 - sdy * r * (0.7 + Math.abs(k))); c.stroke(); }
  }
  const body = bodyPath(type, r);
  const g = c.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r * 1.3); g.addColorStop(0, D.light); g.addColorStop(1, D.color);
  fsp(c, body, g, lw);
  if (type === 'magma') {
    c.beginPath(); c.moveTo(-r * 0.7, r * 0.1); c.lineTo(-r * 0.4, r * 0.35); c.lineTo(-r * 0.5, r * 0.6); c.moveTo(r * 0.75, -r * 0.1); c.lineTo(r * 0.45, r * 0.3); c.lineTo(r * 0.6, r * 0.55);
    c.lineWidth = lw * 1.1; c.strokeStyle = '#ffe34d'; c.stroke();
    const fl = Math.sin(t * 12 + id) * r * 0.1;
    c.beginPath(); c.moveTo(-r * 0.3, -r * 0.95); c.quadraticCurveTo(fl, -r * 1.6, r * 0.3, -r * 0.95); c.closePath(); fs(c, '#ffb03d', lw * 0.8);
  } else if (type === 'tonk') {
    c.beginPath(); c.ellipse(0, -r * 0.15, r * 0.98, r * 0.72, 0, Math.PI, TAU); c.closePath(); fs(c, '#9aa6b8', lw);
    c.beginPath(); c.moveTo(-r * 0.98, -r * 0.15); c.lineTo(r * 0.98, -r * 0.15); c.lineWidth = lw * 1.4; c.strokeStyle = INK; c.stroke();
    c.fillStyle = '#e8eef6'; for (const k of [-0.55, 0, 0.55]) { c.beginPath(); c.arc(k * r, -r * 0.45 - (k ? 0 : r * 0.12), r * 0.07, 0, TAU); c.fill(); }
  } else if (type === 'malefik') {
    c.beginPath(); c.moveTo(-r * 0.7, -r * 0.72); c.quadraticCurveTo(-r * 0.1, -r * 1.3, r * 0.35, -r * 1.95); c.quadraticCurveTo(r * 0.45, -r * 1.2, r * 0.72, -r * 0.72); c.closePath(); fs(c, '#3b2458', lw);
    c.beginPath(); c.ellipse(0, -r * 0.72, r * 1.0, r * 0.2, 0, 0, TAU); fs(c, '#3b2458', lw);
    c.beginPath(); c.moveTo(-r * 0.52, -r * 0.95); c.quadraticCurveTo(0, -r * 1.05, r * 0.56, -r * 0.95); c.lineWidth = lw * 1.4; c.strokeStyle = '#ffd23f'; c.stroke();
  } else if (type !== 'boss') {
    c.save(); c.translate(-r * 0.42, -r * 0.5); c.rotate(-0.6); c.beginPath(); c.ellipse(0, 0, r * 0.1, r * 0.2, 0, 0, TAU); c.fillStyle = 'rgba(255,255,255,.8)'; c.fill(); c.restore();
  }
  const blink = ((t + id * 0.37) % 3.4) < 0.12 && !still;
  const mood = e && e.flash > 0 ? 'open' : D.mood;
  face(c, sdx * r * 0.16, (type === 'tonk' ? r * 0.2 : r * 0.05) + sdy * r * 0.08, r * 0.95, sdx, sdy, mood, blink, D.angry);
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
  } else if (ch === 'C') {
    const g = c.createRadialGradient(x + cs * 0.42, y + cs * 0.38, cs * 0.04, x + cs * 0.5, y + cs * 0.5, cs * 0.62);
    g.addColorStop(0, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x, y, cs, cs);
    for (let i = 0; i < 2; i++) { const a = px(), b = py(0.4, 0.4); c.beginPath(); c.moveTo(a - cs * 0.05, b); c.lineTo(a - cs * 0.07, b - cs * 0.07); c.moveTo(a, b); c.lineTo(a, b - cs * 0.09); c.moveTo(a + cs * 0.05, b); c.lineTo(a + cs * 0.07, b - cs * 0.06); c.lineWidth = lw; c.strokeStyle = '#4fa344'; c.stroke(); }
    if (rnd() < 0.25) { const a = px(), b = py(); for (let i = 0; i < 5; i++) { const an = i * TAU / 5; c.beginPath(); c.arc(a + Math.cos(an) * cs * 0.035, b + Math.sin(an) * cs * 0.035, cs * 0.028, 0, TAU); c.fillStyle = '#ffffff'; c.fill(); } c.beginPath(); c.arc(a, b, cs * 0.022, 0, TAU); c.fillStyle = '#ffd23f'; c.fill(); }
  }
  c.restore();
}
function drawPortal(c, x, y, s, t) {
  const lw = Math.max(1.5, s * 0.05);
  c.save(); c.translate(x, y);
  c.beginPath(); c.ellipse(0, 0, s * 0.42, s * 0.42, 0, 0, TAU);
  const g = c.createRadialGradient(0, 0, s * 0.05, 0, 0, s * 0.42); g.addColorStop(0, '#fff'); g.addColorStop(0.35, '#c79bff'); g.addColorStop(1, '#5b2ca0'); fs(c, g, lw);
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
  c.beginPath(); c.moveTo(-s * 0.46, -s * 0.04); c.quadraticCurveTo(0, -s * 0.62, s * 0.46, -s * 0.04); c.quadraticCurveTo(0, -s * 0.2, -s * 0.46, -s * 0.04); c.closePath(); fs(c, '#ff4f81', lw);
  c.beginPath(); c.arc(-s * 0.2, s * 0.06, s * 0.055, 0, TAU); c.arc(s * 0.2, s * 0.06, s * 0.055, 0, TAU); c.fillStyle = INK; c.fill();
  const hb = 1 + Math.sin(t * 5) * 0.08 * (hit > 0 ? 3 : 1);
  c.translate(0, -s * 0.52 + Math.sin(t * 3) * s * 0.03); c.scale(hb, hb);
  heart(c, 0, 0, s * 0.13); fs(c, '#ff4f6e', lw * 0.8);
  c.restore();
}

