const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { xpForLevel } = require('./xp-util');
const { framesToGif } = require('./gif-utils');

// ============================================================
// دوال التصميم المشتركة "Onyx & Pearl" (مدمجة داخل هذا الملف مباشرة)
// ============================================================
// ============================================================
// نظام التصميم الموحد "Onyx & Pearl" لكل بطاقات البوت
// (بروفايل، ترحيب، ترقية مستوى، مقارنة) — هوية بصرية واحدة:
// إطار كرومي أسود/أبيض متحرك + نقشة هندسية + شريط سلاسل +
// زخارف زوايا + شعارات درعية + نص بتدرج معدني.
// ============================================================

function roundRect(ctx, x, y, width, height, radius) {
  width = Math.max(width, 0);
  height = Math.max(height, 0);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
}

// ------------------------------------------------------------
// خلفية البطاقة الأساسية: تدرج غامق + توهجات بيضاء خافتة بالزوايا
// ------------------------------------------------------------
function drawCardBackground(ctx, W, H) {
  const grad = ctx.createLinearGradient(0, 0, W * 0.6, H);
  grad.addColorStop(0, '#141414');
  grad.addColorStop(0.5, '#0c0c0c');
  grad.addColorStop(1, '#050505');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const glowTR = ctx.createRadialGradient(W * 0.88, H * -0.15, 0, W * 0.88, H * -0.15, W * 0.5);
  glowTR.addColorStop(0, 'rgba(255,255,255,0.14)');
  glowTR.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glowTR;
  ctx.fillRect(0, 0, W, H);

  const glowBL = ctx.createRadialGradient(W * -0.08, H * 1.18, 0, W * -0.08, H * 1.18, W * 0.45);
  glowBL.addColorStop(0, 'rgba(255,255,255,0.09)');
  glowBL.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glowBL;
  ctx.fillRect(0, 0, W, H);
}

// إطار كرومي أسود/أبيض متحرك حول حواف البطاقة (يحاكي شريط الفويل المتحرك)
function drawChromeFrame(ctx, W, H, radius, t) {
  const stops = [
    [0.00, '#ffffff'], [0.14, '#d8d8d8'], [0.30, '#3a3a3a'], [0.46, '#000000'],
    [0.58, '#1f1f1f'], [0.72, '#3a3a3a'], [0.88, '#d8d8d8'], [1.00, '#ffffff']
  ];
  const grad = ctx.createLinearGradient(0, 0, W, H);
  for (const [pos, color] of stops) {
    grad.addColorStop((pos + t) % 1, color);
  }
  roundRect(ctx, 2.5, 2.5, W - 5, H - 5, radius);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 5;
  ctx.stroke();
}

// نقشة هندسية إسلامية متكررة (لاتيس) خافتة جدًا بخلفية البطاقة
function drawLatticePattern(ctx, x, y, w, h, opacity) {
  const tile = 40;
  ctx.save();
  roundRect(ctx, x, y, w, h, 0);
  ctx.clip();
  ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
  ctx.lineWidth = 1;
  for (let ty = y - tile; ty < y + h + tile; ty += tile) {
    for (let tx = x - tile; tx < x + w + tile; tx += tile) {
      const cx = tx + tile / 2, cy = ty + tile / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - tile / 2);
      ctx.lineTo(cx + tile / 2, cy);
      ctx.lineTo(cx, cy + tile / 2);
      ctx.lineTo(cx - tile / 2, cy);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, tile * 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// شريط سلسلة معينات يحيط بحواف البطاقة من الداخل
function drawChainBorder(ctx, x, y, w, h, opacity) {
  const size = 13, gap = 26;
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
  ctx.lineWidth = 1;
  for (let px = x; px <= x + w; px += gap) {
    drawDiamondOutline(ctx, px, y, size);
    drawDiamondOutline(ctx, px, y + h, size);
  }
  for (let py = y; py <= y + h; py += gap) {
    drawDiamondOutline(ctx, x, py, size);
    drawDiamondOutline(ctx, x + w, py, size);
  }
  ctx.restore();
}
function drawDiamondOutline(ctx, cx, cy, size) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - size / 2);
  ctx.lineTo(cx + size / 2, cy);
  ctx.lineTo(cx, cy + size / 2);
  ctx.lineTo(cx - size / 2, cy);
  ctx.closePath();
  ctx.stroke();
}

// زخرفة سوائل بزوايا البطاقة الأربعة
function drawFlourish(ctx, cx, cy, size, flipX, flipY, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  const s = size / 100;
  ctx.beginPath();
  ctx.moveTo(5 * s, 95 * s);
  ctx.bezierCurveTo(5 * s, 40 * s, 40 * s, 25 * s, 40 * s, 25 * s);
  ctx.quadraticCurveTo(60 * s, 15 * s, 60 * s, 5 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(5 * s, 70 * s);
  ctx.quadraticCurveTo(30 * s, 65 * s, 35 * s, 45 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(5 * s, 45 * s);
  ctx.quadraticCurveTo(20 * s, 42 * s, 22 * s, 28 * s);
  ctx.stroke();
  ctx.restore();
}

// وردة زخرفية صغيرة فوق كل زخرفة سوائل
function drawRosette(ctx, cx, cy, size, color) {
  const s = size / 40;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(cx, cy, 6 * s, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 12 * s, 0, Math.PI * 2); ctx.stroke();
  const ticks = [
    [0, -18, 0, -12], [0, 12, 0, 18], [-18, 0, -12, 0], [12, 0, 18, 0],
    [-14, -14, -10, -10], [10, 10, 14, 14], [10, -14, 14, -10], [-14, 10, -10, 14]
  ];
  for (const [x1, y1, x2, y2] of ticks) {
    ctx.beginPath();
    ctx.moveTo(cx + x1 * s, cy + y1 * s);
    ctx.lineTo(cx + x2 * s, cy + y2 * s);
    ctx.stroke();
  }
  ctx.restore();
}

// حلقات نقش محفورة خلف الختم الدوّار (زي نقش العملة المعدنية)
function drawEngravedRings(ctx, cx, cy, r) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.98, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.96, cy + Math.sin(a) * r * 0.96);
    ctx.lineTo(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82);
    ctx.stroke();
  }
  ctx.restore();
}

// الختم الدوّار (حلقة كرومية تدور حول الصورة الشخصية) — يحتاج createConicGradient
function drawRotatingRibbon(ctx, cx, cy, outerR, innerR, t) {
  const angle = t * Math.PI * 2;
  const grad = ctx.createConicGradient(angle, cx, cy);
  const stops = [
    [0, '#3a3a3a'], [0.16, '#ffffff'], [0.33, '#ffffff'], [0.5, '#3a3a3a'],
    [0.66, '#000000'], [0.83, '#ffffff'], [1, '#3a3a3a']
  ];
  stops.forEach(([pos, color]) => grad.addColorStop(pos, color));
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}

// حلقة تقدم (تستخدم لنقاط الخبرة) بتدرج أبيض-رمادي-أبيض مع توهج
function drawProgressRing(ctx, cx, cy, r, progress, lineWidth) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.5, '#4a4a4a');
  grad.addColorStop(1, '#ffffff');
  ctx.strokeStyle = grad;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(255,255,255,0.55)';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(progress, 0.006));
  ctx.stroke();
  ctx.restore();
}

// مسار شعار درعي (Shield) يُستخدم لشارات الرتبة/المستوى
function shieldPath(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y);
  ctx.lineTo(x + w, y + h * 0.16);
  ctx.lineTo(x + w, y + h * 0.565);
  ctx.bezierCurveTo(x + w, y + h * 0.825, x + w * 0.5, y + h, x + w * 0.5, y + h);
  ctx.bezierCurveTo(x + w * 0.5, y + h, x, y + h * 0.825, x, y + h * 0.565);
  ctx.lineTo(x, y + h * 0.16);
  ctx.closePath();
}

function drawShield(ctx, x, y, w, h, fillStops, strokeColor, strokeWidth = 2) {
  shieldPath(ctx, x, y, w, h);
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  fillStops.forEach(([pos, color]) => grad.addColorStop(pos, color));
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.stroke();
}

// هولوغرام أبيض/أسود متحرك (أشرطة قطرية متكررة)
function drawHolo(ctx, x, y, w, h, t, opacity) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 0);
  ctx.clip();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = opacity;

  const bandWidth = 30;
  const diagonal = Math.sqrt(w * w + h * h);
  const offset = (t * bandWidth * 4) % (bandWidth * 4);

  ctx.translate(x, y);
  ctx.rotate((115 * Math.PI) / 180);
  const colors = ['rgba(0,0,0,0.5)', 'rgba(255,255,255,0.55)', 'rgba(160,160,160,0.4)', 'rgba(0,0,0,0.5)'];
  for (let i = -diagonal; i < diagonal * 2; i += bandWidth) {
    ctx.fillStyle = colors[Math.floor(((i + offset) / bandWidth) % colors.length + colors.length) % colors.length];
    ctx.fillRect(i, -diagonal, bandWidth, diagonal * 3);
  }
  ctx.restore();
}

// شعاع لمعان يمر عبر البطاقة (Sheen sweep)
function drawSheen(ctx, x, y, w, h, t) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 0);
  ctx.clip();
  ctx.globalCompositeOperation = 'screen';

  const sweepPos = ((t * 1.4) % 1.4) - 0.2;
  const sx = x + w * sweepPos;
  const grad = ctx.createLinearGradient(sx - w * 0.18, y, sx + w * 0.18, y + h);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.28)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// فينييت (تظليل داخلي بالحواف)
function drawVignette(ctx, x, y, w, h) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 0);
  ctx.clip();
  const grad = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.35, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// جسيمات متلألئة (شرر) — تظهر وتختفي حسب t
function drawSparkles(ctx, points, t) {
  for (const p of points) {
    const phase = (t + p.delay) % 1;
    const alpha = Math.sin(phase * Math.PI);
    if (alpha <= 0.02) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// أيقونات مرسومة يدويًا (بدون إيموجي أبدًا)
function drawIcon(ctx, type, cx, cy, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (type === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? s : s * 0.45;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  } else if (type === 'chat') {
    roundRect(ctx, cx - s, cy - s * 0.8, s * 2, s * 1.5, 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.3, cy + s * 0.7);
    ctx.lineTo(cx - s * 0.6, cy + s * 1.15);
    ctx.lineTo(cx + s * 0.1, cy + s * 0.7);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'clock') {
    ctx.beginPath();
    ctx.arc(cx, cy, s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - s * 0.55);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + s * 0.4, cy + s * 0.2);
    ctx.stroke();
  } else if (type === 'heart') {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.75);
    ctx.bezierCurveTo(cx - s * 1.3, cy - s * 0.35, cx - s * 0.4, cy - s * 1.1, cx, cy - s * 0.4);
    ctx.bezierCurveTo(cx + s * 0.4, cy - s * 1.1, cx + s * 1.3, cy - s * 0.35, cx, cy + s * 0.75);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'calendar') {
    roundRect(ctx, cx - s, cy - s + 3, s * 2, s * 2 - 3, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s, cy - s * 0.35);
    ctx.lineTo(cx + s, cy - s * 0.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.5, cy - s - 2);
    ctx.lineTo(cx - s * 0.5, cy - s + 5);
    ctx.moveTo(cx + s * 0.5, cy - s - 2);
    ctx.lineTo(cx + s * 0.5, cy - s + 5);
    ctx.stroke();
  } else if (type === 'people') {
    ctx.beginPath();
    ctx.arc(cx - s * 0.35, cy - s * 0.25, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + s * 0.5, cy - s * 0.15, s * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - s * 0.35, cy + s * 0.55, s * 0.62, Math.PI, 0, true);
    ctx.fill();
  } else if (type === 'plus') {
    ctx.beginPath();
    ctx.moveTo(cx - s, cy);
    ctx.lineTo(cx + s, cy);
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx, cy + s);
    ctx.stroke();
  }
  ctx.restore();
}


const FRAME_COUNT = 16;
const FRAME_DELAY_MS = 80;

// فئة العضو حسب المستوى
function getLevelTier(level) {
  if (level >= 30) return 'أسطورة';
  if (level >= 15) return 'خبير';
  if (level >= 5) return 'محترف';
  return 'مبتدئ';
}

async function createProfileCard({ member, memberDoc, rank, roleName }) {
  const W = 1000, H = 520;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
  const avatar = await loadImage(avatarURL);
  const tier = getLevelTier(memberDoc.level);

  // نقاط شرر ثابتة الموضع (تتلألأ بالحركة فقط، ما تتحرك مكانيًا)
  const sparkPoints = [
    { x: W * 0.62, y: H * 0.14, delay: 0 },
    { x: W * 0.74, y: H * 0.28, delay: 0.25 },
    { x: W * 0.85, y: H * 0.09, delay: 0.5 },
    { x: W * 0.91, y: H * 0.68, delay: 0.75 }
  ];

  const frames = [];
  for (let f = 0; f < FRAME_COUNT; f++) {
    const t = f / FRAME_COUNT;
    drawFrame(ctx, { W, H, avatar, member, memberDoc, rank, roleName, tier, t, sparkPoints });
    const imageData = ctx.getImageData(0, 0, W, H);
    frames.push({ data: imageData.data, width: W, height: H });
  }

  return framesToGif(frames, FRAME_DELAY_MS);
}

function drawFrame(ctx, { W, H, avatar, member, memberDoc, rank, roleName, tier, t, sparkPoints }) {
  const cardX = 6, cardY = 6, cardW = W - 12, cardH = H - 12, radius = 26;

  drawCardBackground(ctx, W, H);
  drawLatticePattern(ctx, cardX, cardY, cardW, cardH, 0.05);
  drawHolo(ctx, cardX, cardY, cardW, cardH, t, 0.35);
  drawSheen(ctx, cardX, cardY, cardW, cardH, t);
  drawVignette(ctx, cardX, cardY, cardW, cardH);
  drawSparkles(ctx, sparkPoints, t);
  drawChainBorder(ctx, 22, 22, W - 44, H - 44, 0.5);
  drawChromeFrame(ctx, W, H, radius, t);

  // زخارف الزوايا
  drawFlourish(ctx, 15, 15, 54, false, false, '#8a8a8a');
  drawFlourish(ctx, W - 15, 15, 54, true, false, '#8a8a8a');
  drawFlourish(ctx, 15, H - 15, 54, false, true, '#8a8a8a');
  drawFlourish(ctx, W - 15, H - 15, 54, true, true, '#8a8a8a');
  drawRosette(ctx, 21, 21, 16, 'rgba(255,255,255,0.75)');
  drawRosette(ctx, W - 21, 21, 16, 'rgba(255,255,255,0.75)');
  drawRosette(ctx, 21, H - 21, 16, 'rgba(255,255,255,0.75)');
  drawRosette(ctx, W - 21, H - 21, 16, 'rgba(255,255,255,0.75)');

  // ------- الختم الدوّار + حلقة XP + الصورة -------
  const sealCx = 145, sealCy = 148, sealR = 92;
  drawEngravedRings(ctx, sealCx, sealCy, sealR + 8);
  drawRotatingRibbon(ctx, sealCx, sealCy, sealR, sealR - 8, t);

  const xpNeeded = xpForLevel(memberDoc.level + 1);
  const progress = Math.min(memberDoc.xp / xpNeeded, 1);
  drawProgressRing(ctx, sealCx, sealCy, sealR - 14, progress, 5);

  drawAvatarCircle(ctx, avatar, sealCx, sealCy, sealR - 22);
  drawPresenceDot(ctx, sealCx + (sealR - 22) * 0.62, sealCy - (sealR - 22) * 0.62, 15, t);
  drawCrestBadge(ctx, sealCx, sealCy + sealR - 20, 62, 72, memberDoc.level);

  // ------- عمود المعلومات -------
  const infoX = 277;

  ctx.textAlign = 'left';
  const eyebrowGrad = ctx.createLinearGradient(infoX, 0, infoX + 340, 0);
  eyebrowGrad.addColorStop(0, '#ffffff');
  eyebrowGrad.addColorStop(0.45, '#3a3a3a');
  eyebrowGrad.addColorStop(0.8, '#ffffff');
  ctx.fillStyle = eyebrowGrad;
  ctx.font = 'italic 600 20px Cairo';
  ctx.fillText('شهادة العضوية الأسطورية', infoX, 70);

  const nameGrad = ctx.createLinearGradient(infoX, 78, infoX, 118);
  nameGrad.addColorStop(0, '#ffffff');
  nameGrad.addColorStop(0.5, '#e4e4e4');
  nameGrad.addColorStop(1, '#b8b8b8');
  ctx.fillStyle = nameGrad;
  ctx.font = 'bold 40px Cairo';
  ctx.fillText(fitText(ctx, member.user.username, 360), infoX, 118);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '22px Cairo';
  ctx.fillText(`الرتبة: ${roleName || 'بدون رتبة'}`, infoX, 152);

  // شعار درعي للترتيب (أعلى يمين)
  const shieldX = W - 130, shieldY = 44, shieldW = 78, shieldH = 92;
  drawShield(ctx, shieldX, shieldY, shieldW, shieldH, [[0, '#222222'], [1, '#000000']], '#ffffff', 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f0f0f0';
  ctx.font = 'bold 30px Cairo';
  ctx.fillText(`#${rank}`, shieldX + shieldW / 2, shieldY + shieldH * 0.5 + 10);
  ctx.font = '15px Cairo';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('الترتيب العام', shieldX + shieldW / 2, shieldY + shieldH + 20);

  // خط زخرفي فاصل
  const dividerY = 178;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(infoX, dividerY);
  ctx.lineTo(infoX + 250, dividerY);
  ctx.stroke();
  ctx.save();
  ctx.translate(infoX + 260, dividerY);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(infoX + 270, dividerY);
  ctx.lineTo(W - 52, dividerY);
  ctx.stroke();

  // ------- بطاقات الإحصائيات -------
  const joinedMs = new Date(memberDoc.joinedAt).getTime();
  const seniorityDays = Math.max(0, Math.floor((Date.now() - joinedMs) / 86400000));
  const statY = 196, statH = 92, gap = 14;
  const statW = (W - 52 - infoX - gap * 3) / 4;

  drawStatChip(ctx, infoX, statY, statW, statH, 'star', '#8a8a8a', 'نقاط الخبرة', memberDoc.xp.toLocaleString('en-US'));
  drawStatChip(ctx, infoX + (statW + gap), statY, statW, statH, 'chat', '#ffffff', 'الرسائل', memberDoc.messageCount.toLocaleString('en-US'));
  drawStatChip(ctx, infoX + (statW + gap) * 2, statY, statW, statH, 'clock', '#8a6ad4', 'الأقدمية', `${seniorityDays.toLocaleString('en-US')} يوم`);
  drawStatChip(ctx, infoX + (statW + gap) * 3, statY, statW, statH, 'heart', '#d46a6a', 'الفئة', tier);

  // ------- التذييل -------
  const footY = H - 40;
  drawTierChip(ctx, infoX, footY - 14, 'عضو مؤسس');

  ctx.textAlign = 'right';
  ctx.font = 'italic 400 18px Cairo';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  const guildText = fitText(ctx, member.guild.name, 320);
  ctx.fillText(`سيرفر ${guildText} · No. ${String(rank).padStart(4, '0')}-A`, W - 52, footY);
}

function drawAvatarCircle(ctx, avatar, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(avatar, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawPresenceDot(ctx, cx, cy, r, t) {
  const pulse = 0.7 + 0.3 * Math.sin(t * Math.PI * 2);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#d0d0d0');
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = 10 + pulse * 8;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0c0c0c';
  ctx.stroke();
  ctx.restore();
}

function drawCrestBadge(ctx, cx, topY, w, h, level) {
  const x = cx - w / 2;
  drawShield(ctx, x, topY, w, h, [[0, '#3a3a3a'], [0.55, '#1a1a1a'], [1, '#000000']], '#ffffff', 1.5);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2f2f2';
  ctx.font = 'bold 24px Cairo';
  ctx.fillText(level.toLocaleString('en-US'), cx, topY + h * 0.58);
}

function drawStatChip(ctx, x, y, w, h, iconType, color, label, value) {
  roundRect(ctx, x, y, w, h, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.stroke();

  roundRect(ctx, x + w - 28, y, 28, 28, 8);
  ctx.fillStyle = hexToRgba(color, 0.18);
  ctx.fill();

  const iconCx = x + 26, iconCy = y + 26;
  ctx.beginPath();
  ctx.arc(iconCx, iconCy, 15, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(color, 0.16);
  ctx.fill();
  drawIcon(ctx, iconType, iconCx, iconCy, 8, color);

  ctx.textAlign = 'left';
  ctx.font = 'italic 400 14px Cairo';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(label, x + 14, y + 56);

  ctx.font = 'bold 22px Cairo';
  ctx.fillStyle = '#f2f2f2';
  ctx.fillText(fitText(ctx, value, w - 28), x + 14, y + 80);
}

function drawTierChip(ctx, x, y, text) {
  ctx.font = 'bold 15px Cairo';
  const textWidth = ctx.measureText(text).width;
  const paddingX = 16, height = 30;
  const width = paddingX * 2 + textWidth;

  const grad = ctx.createLinearGradient(x, y, x + width, y);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#c9c9c9');

  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0c0c0c';
  ctx.fillText(text, x + paddingX, y + height / 2 + 5);
}

module.exports = { createProfileCard };
