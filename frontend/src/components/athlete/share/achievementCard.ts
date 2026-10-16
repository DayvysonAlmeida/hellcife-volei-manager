/**
 * Gera o card de conquista desenhando direto num <canvas> (1080x1920, formato Stories).
 *
 * Não usamos captura de DOM (html-to-image/html2canvas): no Safari/iOS ela embute as
 * imagens num SVG <foreignObject>, que o WebKit não decodifica de forma confiável e o
 * card saía com as imagens quebradas. Com canvas o resultado é idêntico em qualquer
 * aparelho. Evite `ctx.filter` e `ctx.letterSpacing` — não são suportados no Safari.
 */

export type ShareAchievementType = 'big_star' | 'fire_shark_top1' | 'top_wins' | 'mini_star';

export interface AchievementShareCardProps {
  type: ShareAchievementType;
  athleteName: string;
  shirtNumber?: number;
  avatarInitial: string;
  avatarUrl?: string;
  position?: string;
  overall?: number;
  // big_star / mini_star
  starCategory?: string;
  starCategoryLabel?: string;
  bigStarsTotal?: number;
  miniStarsCount?: number;
  // fire_shark / top_wins
  winRate?: number;
  wins?: number;
  totalMatches?: number;
  overallRank?: number;
  winRank?: number;
}

const W = 1080;
const H = 1920;
const CX = W / 2;
const DISPLAY = "'Bebas Neue', Impact, 'Arial Narrow', sans-serif";
const SANS = "Inter, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MINI_STARS_PER_BIG = 15;

interface Theme {
  accent: string;
  accent2: string;
  bgTop: string;
  bgBottom: string;
}

const PODIUM: Record<number, Omit<Theme, 'bgTop' | 'bgBottom'>> = {
  1: { accent: '#FACC15', accent2: '#F97316' },
  2: { accent: '#F3F4F6', accent2: '#9CA3AF' },
  3: { accent: '#FCD34D', accent2: '#B45309' },
};

const CATEGORY_THEMES: Record<string, Theme & { label: string }> = {
  mvp: { label: 'MVP', accent: '#FACC15', accent2: '#CA8A04', bgTop: '#3b2405', bgBottom: '#070400' },
  attack: { label: 'Ataque', accent: '#F87171', accent2: '#DC2626', bgTop: '#3b0909', bgBottom: '#070101' },
  defense: { label: 'Defesa', accent: '#60A5FA', accent2: '#2563EB', bgTop: '#0c1d36', bgBottom: '#02050c' },
  setter: { label: 'Levantamento', accent: '#4ADE80', accent2: '#16A34A', bgTop: '#062a14', bgBottom: '#010703' },
  pass: { label: 'Passe', accent: '#22D3EE', accent2: '#0891B2', bgTop: '#062a33', bgBottom: '#010608' },
  block: { label: 'Bloqueio', accent: '#FB923C', accent2: '#EA580C', bgTop: '#3a1505', bgBottom: '#080200' },
  promotion: { label: 'Grande Estrela', accent: '#FDE047', accent2: '#F59E0B', bgTop: '#3b2a05', bgBottom: '#070500' },
};

interface CardContent {
  theme: Theme;
  kicker: string;
  title: string;
  badge?: string;
  heroShark?: boolean;
  stats?: { value: string; label: string }[];
  stars?: { filled: number; total: number; caption: string };
}

const fmt = (v: number | undefined | null, suffix = '') => (v == null ? '--' : `${v}${suffix}`);

function buildContent(d: AchievementShareCardProps): CardContent {
  const rank = d.winRank;
  const podium = rank ? PODIUM[rank] : undefined;

  switch (d.type) {
    case 'fire_shark_top1':
      return {
        theme: {
          ...(podium ?? { accent: '#F97316', accent2: '#DC2626' }),
          bgTop: rank === 1 ? '#4a0b0b' : '#1f0606',
          bgBottom: '#050000',
        },
        kicker: rank === 1 ? 'O Tubarão da Quadra' : 'Ranking Fire Shark',
        title: 'FIRE SHARK',
        badge: rank ? `TOP ${rank}` : undefined,
        heroShark: true,
        stats: [
          { value: fmt(d.wins), label: 'Vitórias' },
          { value: fmt(d.winRate, '%'), label: 'Win Rate' },
          { value: fmt(d.totalMatches), label: 'Partidas' },
        ],
      };

    case 'top_wins':
      return {
        theme: {
          ...(podium ?? { accent: '#60A5FA', accent2: '#1D4ED8' }),
          bgTop: podium ? '#2a1d05' : '#0b1a33',
          bgBottom: '#030201',
        },
        kicker: 'Ranking de Vitórias',
        title: 'GLADIADOR',
        badge: rank ? `TOP ${rank}` : undefined,
        stats: [
          { value: fmt(d.wins), label: 'Vitórias' },
          { value: fmt(d.winRate, '%'), label: 'Win Rate' },
          { value: fmt(d.totalMatches), label: 'Partidas' },
          ...(d.overallRank ? [{ value: `#${d.overallRank}`, label: 'Rank Geral' }] : []),
        ],
      };

    case 'big_star': {
      const total = d.bigStarsTotal ?? 0;
      return {
        theme: CATEGORY_THEMES.promotion,
        kicker: 'Conquista Desbloqueada',
        title: 'GRANDE ESTRELA',
        badge: total > 0 ? `${total}ª GRANDE ESTRELA` : undefined,
        stars: {
          filled: Math.max(1, Math.min(total, 10)),
          total: Math.max(1, Math.min(total, 10)),
          caption: total > 1 ? `${total} grandes estrelas na carreira` : 'A primeira de muitas',
        },
      };
    }

    case 'mini_star': {
      const cat = (d.starCategory && CATEGORY_THEMES[d.starCategory]) || CATEGORY_THEMES.mvp;
      const count = Math.min(d.miniStarsCount ?? 0, MINI_STARS_PER_BIG);
      return {
        theme: cat,
        kicker: 'Estrela Conquistada',
        title: 'NOVA ESTRELA',
        badge: (d.starCategoryLabel || cat.label).toUpperCase(),
        stars: {
          filled: count,
          total: MINI_STARS_PER_BIG,
          caption: `${count}/${MINI_STARS_PER_BIG} para a próxima Grande Estrela`,
        },
      };
    }
  }
}

// ─── Carregamento de recursos ────────────────────────────────────────────────

const assetCache = new Map<string, Promise<HTMLImageElement | null>>();

function loadImage(src: string, crossOrigin = false): Promise<HTMLImageElement | null> {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  }).then(async (img) => {
    // Garante a imagem decodificada antes do drawImage (importante no Safari)
    if (img?.decode) await img.decode().catch(() => undefined);
    return img;
  });
}

function loadAsset(src: string) {
  if (!assetCache.has(src)) assetCache.set(src, loadImage(src));
  return assetCache.get(src)!;
}

/**
 * Avatares vêm de outra origem (Cloudinary). Pedimos com CORS para não "sujar" o canvas;
 * o parâmetro extra evita que o Safari reaproveite a versão sem CORS que já está em cache
 * por causa das <img> da página. Se falhar, o card usa as iniciais.
 */
function loadAvatar(url?: string) {
  if (!url) return Promise.resolve(null);
  if (url.startsWith('data:') || url.startsWith('blob:')) return loadImage(url);
  try {
    const u = new URL(url, window.location.href);
    if (u.origin === window.location.origin) return loadImage(u.href);
    u.searchParams.set('hv_share', '1');
    return loadImage(u.href, true);
  } catch {
    return Promise.resolve(null);
  }
}

async function ensureFonts() {
  if (!document.fonts?.load) return;
  const fonts = [`400 100px 'Bebas Neue'`, '700 100px Inter', '800 100px Inter', '900 100px Inter'];
  await Promise.race([
    Promise.all(fonts.map((f) => document.fonts.load(f))).catch(() => undefined),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
}

// ─── Primitivas de desenho ───────────────────────────────────────────────────

type Ctx = CanvasRenderingContext2D;

function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function starPath(ctx: Ctx, cx: number, cy: number, outer: number, inner = outer * 0.45) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
}

/** Texto com espaçamento entre letras (ctx.letterSpacing não existe no Safari). */
function spacedText(ctx: Ctx, text: string, x: number, y: number, spacing: number) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  let cursor = x - total / 2;
  chars.forEach((c, i) => {
    ctx.fillText(c, cursor, y);
    cursor += widths[i] + spacing;
  });
  ctx.textAlign = prevAlign;
}

/** Reduz a fonte até o texto caber na largura (nomes longos não estouram o card). */
function fitFont(ctx: Ctx, text: string, maxWidth: number, start: number, min: number, font: (s: number) => string) {
  let size = start;
  ctx.font = font(size);
  while (size > min && ctx.measureText(text).width > maxWidth) {
    size -= 4;
    ctx.font = font(size);
  }
  return size;
}

function drawCover(ctx: Ctx, img: HTMLImageElement, cx: number, cy: number, size: number, alpha = 1) {
  const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

function drawContain(ctx: Ctx, img: HTMLImageElement, cx: number, top: number, size: number, alpha = 1) {
  const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, cx - w / 2, top, w, h);
  ctx.restore();
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

// ─── Seções do card ──────────────────────────────────────────────────────────

function drawBackground(ctx: Ctx, theme: Theme) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, theme.bgTop);
  bg.addColorStop(1, theme.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Grade sutil (textura de quadra)
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += 60) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  // Brilho atrás do avatar
  const glow = ctx.createRadialGradient(CX, 900, 0, CX, 900, 700);
  glow.addColorStop(0, withAlpha(theme.accent2, 0.45));
  glow.addColorStop(0.5, withAlpha(theme.accent2, 0.12));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

function drawVignette(ctx: Ctx) {
  const v = ctx.createRadialGradient(CX, 900, 500, CX, 900, 1250);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);

  const bottom = ctx.createLinearGradient(0, 1250, 0, H);
  bottom.addColorStop(0, 'rgba(0,0,0,0)');
  bottom.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, 1250, W, H - 1250);
}

function drawHeader(ctx: Ctx, theme: Theme, content: CardContent, escudo: HTMLImageElement | null) {
  if (escudo) drawContain(ctx, escudo, CX, 110, 130);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `800 30px ${SANS}`;
  spacedText(ctx, 'HELLCIFE VÔLEI', CX, 300, 12);

  ctx.fillStyle = theme.accent;
  ctx.font = `800 30px ${SANS}`;
  spacedText(ctx, content.kicker.toUpperCase(), CX, 410, 10);

  // Título com gradiente metálico
  const size = fitFont(ctx, content.title, 880, 210, 120, (s) => `400 ${s}px ${DISPLAY}`);
  const grad = ctx.createLinearGradient(0, 580 - size * 0.8, 0, 580);
  grad.addColorStop(0, '#FFFFFF');
  grad.addColorStop(0.55, theme.accent);
  grad.addColorStop(1, theme.accent2);
  ctx.save();
  ctx.shadowColor = withAlpha(theme.accent2, 0.6);
  ctx.shadowBlur = 40;
  ctx.fillStyle = grad;
  spacedText(ctx, content.title, CX, 580, size * 0.04);
  ctx.restore();
}

function drawAvatar(ctx: Ctx, theme: Theme, avatar: HTMLImageElement | null, name: string) {
  const cy = 900;
  const r = 240;

  // Anel com brilho
  ctx.save();
  ctx.shadowColor = theme.accent2;
  ctx.shadowBlur = 90;
  const ring = ctx.createLinearGradient(CX - r, cy - r, CX + r, cy + r);
  ring.addColorStop(0, theme.accent);
  ring.addColorStop(0.5, theme.accent2);
  ring.addColorStop(1, theme.accent);
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(CX, cy, r + 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.arc(CX, cy, r + 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) {
    drawCover(ctx, avatar, CX, cy, r * 2);
  } else {
    const g = ctx.createRadialGradient(CX, cy - 80, 20, CX, cy, r);
    g.addColorStop(0, theme.accent2);
    g.addColorStop(1, '#111111');
    ctx.fillStyle = g;
    ctx.fillRect(CX - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `900 190px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(name), CX, cy + 8);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}

function drawBadge(ctx: Ctx, theme: Theme, text: string) {
  ctx.font = `400 64px ${DISPLAY}`;
  const spacing = 6;
  const textW = [...text].reduce((a, c) => a + ctx.measureText(c).width, 0) + spacing * (text.length - 1);
  const w = Math.min(textW + 110, 900);
  const h = 92;
  const y = 1112;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  const g = ctx.createLinearGradient(CX - w / 2, 0, CX + w / 2, 0);
  g.addColorStop(0, theme.accent2);
  g.addColorStop(0.5, theme.accent);
  g.addColorStop(1, theme.accent2);
  ctx.fillStyle = g;
  roundRectPath(ctx, CX - w / 2, y, w, h, h / 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#0a0a0a';
  ctx.textAlign = 'center';
  spacedText(ctx, text, CX, y + 70, spacing);
}

function drawIdentity(ctx: Ctx, d: AchievementShareCardProps) {
  const name = d.athleteName.toUpperCase();
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 25;
  ctx.fillStyle = '#FFFFFF';
  fitFont(ctx, name, 960, 112, 56, (s) => `italic 900 ${s}px ${SANS}`);
  ctx.fillText(name, CX, 1325);
  ctx.restore();

  const meta = [
    d.shirtNumber ? `#${d.shirtNumber}` : null,
    d.position?.toUpperCase(),
    d.overall != null ? `OVR ${Number(d.overall).toFixed(1)}` : null,
  ].filter(Boolean).join('  ·  ');
  if (meta) {
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = `700 32px ${SANS}`;
    spacedText(ctx, meta, CX, 1390, 4);
  }
}

function drawPanel(ctx: Ctx, theme: Theme) {
  const x = 70, y = 1440, w = W - 140, h = 230;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRectPath(ctx, x, y, w, h, 36);
  ctx.fill();
  ctx.strokeStyle = withAlpha(theme.accent, 0.35);
  ctx.lineWidth = 2;
  ctx.stroke();
  return { x, y, w, h };
}

function drawStats(ctx: Ctx, theme: Theme, stats: NonNullable<CardContent['stats']>) {
  const p = drawPanel(ctx, theme);
  const colW = p.w / stats.length;
  stats.forEach((s, i) => {
    const cx = p.x + colW * i + colW / 2;
    if (i > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(p.x + colW * i, p.y + 50, 2, p.h - 100);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    fitFont(ctx, s.value, colW - 30, 104, 56, (sz) => `400 ${sz}px ${DISPLAY}`);
    ctx.fillText(s.value, cx, p.y + 130);
    ctx.fillStyle = theme.accent;
    ctx.font = `800 24px ${SANS}`;
    spacedText(ctx, s.label.toUpperCase(), cx, p.y + 182, 4);
  });
}

function drawStars(ctx: Ctx, theme: Theme, stars: NonNullable<CardContent['stars']>) {
  const p = drawPanel(ctx, theme);
  const gap = Math.min(110, (p.w - 80) / stars.total);
  const outer = Math.min(44, gap * 0.42);
  const startX = CX - (gap * (stars.total - 1)) / 2;
  const cy = p.y + 95;

  for (let i = 0; i < stars.total; i++) {
    const filled = i < stars.filled;
    ctx.save();
    if (filled) {
      ctx.shadowColor = theme.accent;
      ctx.shadowBlur = 20;
      const g = ctx.createLinearGradient(0, cy - outer, 0, cy + outer);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(0.4, theme.accent);
      g.addColorStop(1, theme.accent2);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
    }
    starPath(ctx, startX + gap * i, cy, outer);
    ctx.fill();
    ctx.restore();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = `800 26px ${SANS}`;
  spacedText(ctx, stars.caption.toUpperCase(), CX, p.y + 185, 3);
}

function drawFooter(ctx: Ctx) {
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `800 26px ${SANS}`;
  spacedText(ctx, '#HELLCIFEVOLEI', CX, 1770, 8);

  const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = `600 22px ${SANS}`;
  spacedText(ctx, date.toUpperCase(), CX, 1815, 4);
}

// ─── API pública ─────────────────────────────────────────────────────────────

export async function renderAchievementCard(d: AchievementShareCardProps): Promise<Blob> {
  const content = buildContent(d);
  const { theme } = content;

  const [, escudo, shark, avatar] = await Promise.all([
    ensureFonts(),
    loadAsset('/escudo-hellcife-novo.png'),
    content.heroShark ? loadAsset('/tubarao-furia.png') : Promise.resolve(null),
    loadAvatar(d.avatarUrl),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível');

  drawBackground(ctx, theme);
  if (shark) {
    drawContain(ctx, shark, CX, 420, 1080, d.winRank === 1 ? 0.85 : 0.5);
  } else if (escudo) {
    drawContain(ctx, escudo, CX, 470, 900, 0.06);
  }
  drawVignette(ctx);
  drawHeader(ctx, theme, content, escudo);
  drawAvatar(ctx, theme, avatar, d.athleteName);
  if (content.badge) drawBadge(ctx, theme, content.badge);
  drawIdentity(ctx, d);
  if (content.stats) drawStats(ctx, theme, content.stats);
  if (content.stars) drawStars(ctx, theme, content.stars);
  drawFooter(ctx);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem'))), 'image/jpeg', 0.92);
  });
}

export function shareCaption(d: AchievementShareCardProps): string {
  const name = d.athleteName;
  switch (d.type) {
    case 'fire_shark_top1':
      return `🦈🔥 ${name} é TOP ${d.winRank ?? ''} no ranking Fire Shark do Hellcife Vôlei! 🏐 #HellcifeVolei`;
    case 'top_wins':
      return `🏆 ${name} está entre os Gladiadores do Hellcife Vôlei — TOP ${d.winRank ?? ''} em vitórias! 🏐 #HellcifeVolei`;
    case 'big_star':
      return `🌟 ${name} conquistou uma Grande Estrela no Hellcife Vôlei! 🏐 #HellcifeVolei`;
    case 'mini_star':
      return `⭐ ${name} ganhou mais uma estrela${d.starCategoryLabel ? ` em ${d.starCategoryLabel}` : ''} no Hellcife Vôlei! 🏐 #HellcifeVolei`;
  }
}
