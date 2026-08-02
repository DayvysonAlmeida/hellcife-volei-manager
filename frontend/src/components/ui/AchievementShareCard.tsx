import { forwardRef } from 'react';
import { Flame, Zap, ShieldAlert } from 'lucide-react';

export type ShareAchievementType =
  | 'big_star'
  | 'fire_shark_top1'
  | 'top_wins'
  | 'mini_star';

export interface AchievementShareCardProps {
  type: ShareAchievementType;
  athleteName: string;
  shirtNumber?: number;
  avatarInitial: string;
  avatarUrl?: string;
  position?: string;
  overall?: number;
  // Imagens pré-carregadas como data URL (necessário para html2canvas)
  firesharkDataUrl?: string;
  escudoDataUrl?: string;
  tubaraoFuriaDataUrl?: string;
  textoHellcifeDataUrl?: string;
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
  rank?: number;
}

const CATEGORY_COLORS: Record<string, { bg: string; accent: string; label: string }> = {
  mvp:       { bg: 'linear-gradient(135deg, #78350f, #451a03)', accent: '#FACC15', label: '🥇' },
  attack:    { bg: 'linear-gradient(135deg, #7f1d1d, #450a0a)', accent: '#F87171', label: '⚔️' },
  defense:   { bg: 'linear-gradient(135deg, #1e3a5f, #0c1a2e)', accent: '#60A5FA', label: '🛡️' },
  setter:    { bg: 'linear-gradient(135deg, #14532d, #052e16)', accent: '#4ADE80', label: '🎯' },
  pass:      { bg: 'linear-gradient(135deg, #164e63, #0c2233)', accent: '#22D3EE', label: '🦅' },
  block:     { bg: 'linear-gradient(135deg, #431407, #1c0a03)', accent: '#FB923C', label: '🧱' },
  promotion: { bg: 'linear-gradient(135deg, #713f12, #3b1f07)', accent: '#FDE047', label: '🌟' },
};

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function CardAvatar({ avatarUrl, name, size }: { avatarUrl?: string; name: string; size: number }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size, objectFit: 'cover', borderRadius: '50%', display: 'block' }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #D90429, #7f1d1d)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ color: '#fff', fontSize: size * 0.38, fontWeight: 900 }}>{getInitials(name)}</span>
    </div>
  );
}

// ─── Anel colorido compatível com html2canvas (sem conic-gradient) ───
function ColorRing({ size, innerSize, colors, children }: {
  size: number;
  innerSize: number;
  colors: [string, string];
  children: React.ReactNode;
}) {
  const pad = (size - innerSize) / 2;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Quadrante superior-esquerdo */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[0]} 100%)`, boxShadow: `0 0 40px ${colors[0]}55, 0 0 80px ${colors[1]}33` }} />
      {/* Inner circle */}
      <div style={{
        position: 'absolute',
        width: innerSize, height: innerSize,
        borderRadius: '50%',
        background: '#0a0000',
        top: pad, left: pad,
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {children}
      </div>
    </div>
  );
}

export const AchievementShareCard = forwardRef<HTMLDivElement, AchievementShareCardProps>(
  (props, ref) => {
    const {
      type, athleteName, shirtNumber, avatarUrl,
      position, overall,
      firesharkDataUrl, escudoDataUrl, tubaraoFuriaDataUrl, textoHellcifeDataUrl,
      starCategory, starCategoryLabel,
      bigStarsTotal, miniStarsCount,
      winRate, wins, totalMatches, rank,
      overallRank, winRank,
    } = props;

    const catData = starCategory ? CATEGORY_COLORS[starCategory] : null;
    const catColors = catData || CATEGORY_COLORS.attack;
    
    const CAT_LABELS: Record<string, string> = {
      mvp: 'MVP',
      attack: 'ATAQUE',
      defense: 'DEFESA',
      setter: 'LEVANTAMENTO',
      pass: 'PASSE',
      block: 'BLOQUEIO',
    };
    const mappedCategoryLabel = starCategoryLabel || (starCategory ? CAT_LABELS[starCategory] : 'ATAQUE');
    const firstName = athleteName.split(' ')[0] || athleteName;

    // ─── FIRE SHARK TOP X ─────────────────────────────────────────────────────
    if (type === 'fire_shark_top1') {
      const isTop1 = winRank === 1;

      return (
        <div ref={ref} style={{ width: 600, height: 900, position: 'relative', overflow: 'hidden', fontFamily: "'Inter', sans-serif", background: '#050000' }}>
          
          {/* BG radial profundo */}
          <div style={{ position: 'absolute', inset: 0, background: isTop1 ? 'radial-gradient(circle at 50% 40%, #450a0a 0%, #170505 50%, #000000 100%)' : 'radial-gradient(circle at 50% 40%, #1a0000 0%, #050000 60%, #000000 100%)' }} />

          {/* Efeitos de Labaredas de Fogo para Top 1 */}
          {isTop1 && (
            <>
              {/* Glow core */}
              <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: 500, height: 500, background: 'radial-gradient(circle, rgba(239,68,68,0.25) 0%, rgba(249,115,22,0.1) 40%, transparent 70%)', filter: 'blur(40px)', zIndex: 1 }} />
              
              {/* Labaredas / Brasas subindo */}
              <div style={{ position: 'absolute', bottom: '0%', left: -50, width: 350, height: 500, background: 'radial-gradient(ellipse, rgba(249,115,22,0.15) 0%, transparent 60%)', transform: 'rotate(25deg)', filter: 'blur(35px)', zIndex: 2 }} />
              <div style={{ position: 'absolute', bottom: '0%', right: -50, width: 350, height: 500, background: 'radial-gradient(ellipse, rgba(239,68,68,0.15) 0%, transparent 60%)', transform: 'rotate(-25deg)', filter: 'blur(35px)', zIndex: 2 }} />
            </>
          )}

          {/* Logo Fire Shark Background Gigante (Opcional) */}
          {firesharkDataUrl && (
            <img
              src={firesharkDataUrl}
              alt=""
              style={{
                position: 'absolute', top: '5%', left: '5%',
                width: '90%', height: '70%',
                objectFit: 'contain', objectPosition: 'center',
                opacity: 0.05,
                mixBlendMode: 'screen',
              }}
            />
          )}

          {/* Tubarão Fúria Gigante no Fundo */}
          {tubaraoFuriaDataUrl && (
            <img
              src={tubaraoFuriaDataUrl}
              alt="Tubarão Fúria"
              style={{
                position: 'absolute', top: -50, left: '50%', transform: 'translateX(-50%)',
                width: 750, height: 750,
                objectFit: 'contain', objectPosition: 'top center',
                opacity: isTop1 ? 1 : 0.6,
                zIndex: 5, // No fundo, atrás do avatar
              }}
            />
          )}

          {/* Logo Hellcife mais aparente no Topo Direito (Sem círculo de fundo) */}
          {escudoDataUrl && (
            <div style={{ position: 'absolute', top: 30, right: 30, zIndex: 40 }}>
              <img src={escudoDataUrl} alt="Hellcife" style={{ width: 150, height: 150, objectFit: 'contain', filter: 'drop-shadow(0 5px 15px rgba(0,0,0,0.8)) drop-shadow(0 0 15px rgba(239,68,68,0.4))' }} />
            </div>
          )}

          {/* ── Avatar central com super aura ── */}
          <div style={{
            position: 'absolute', top: 220, left: '50%', transform: 'translateX(-50%)',
            zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <div style={{
              width: 360, height: 360, borderRadius: '50%', position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {/* Aura de Fogo (Conic + Blur) para Top 1, ou anel simples para outros */}
              {isTop1 ? (
                <div style={{
                  position: 'absolute', inset: -25, borderRadius: '50%',
                  background: 'conic-gradient(from 0deg, #dc2626, #f97316, #dc2626, #f97316, #dc2626)',
                  filter: 'blur(25px)', opacity: 0.85, mixBlendMode: 'screen',
                  animation: 'spin 10s linear infinite',
                }} />
              ) : (
                <div style={{
                  position: 'absolute', inset: -10, borderRadius: '50%',
                  background: 'transparent',
                  border: '2px solid rgba(249,115,22,0.5)',
                  boxShadow: '0 0 15px rgba(249,115,22,0.2)',
                }} />
              )}
              {/* Borda interna sólida para destacar o avatar */}
              <div style={{
                position: 'absolute', inset: -4, borderRadius: '50%',
                background: isTop1 ? 'linear-gradient(135deg, #f97316, #dc2626)' : '#111',
                border: isTop1 ? 'none' : '2px solid rgba(220,38,38,0.5)',
                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)',
              }} />
              <div style={{ position: 'relative', zIndex: 2, borderRadius: '50%', overflow: 'hidden', width: 350, height: 350 }}>
                <CardAvatar avatarUrl={avatarUrl} name={athleteName} size={350} />
              </div>

              {/* Badge TOP {winRank} flutuando no TOPO do avatar */}
              <div style={{
                position: 'absolute', top: -18, zIndex: 20,
                background: isTop1 ? 'linear-gradient(180deg, #991b1b, #450a0a)' : 'linear-gradient(180deg, #404040, #262626)',
                padding: '10px 32px',
                clipPath: 'polygon(15% 0%, 85% 0%, 100% 50%, 85% 100%, 15% 100%, 0% 50%)',
                boxShadow: isTop1 ? '0 10px 30px rgba(220,38,38,0.8)' : '0 5px 15px rgba(0,0,0,0.5)',
                borderTop: isTop1 ? '2px solid #fca5a5' : '2px solid #a3a3a3',
              }}>
                <span style={{ 
                  color: isTop1 ? '#fff' : '#d4d4d8', 
                  fontSize: 26, fontWeight: 900, letterSpacing: 4, 
                  textTransform: 'uppercase', 
                  background: isTop1 ? 'linear-gradient(180deg, #fef08a, #eab308, #854d0e)' : 'none',
                  WebkitBackgroundClip: isTop1 ? 'text' : 'border-box',
                  WebkitTextFillColor: isTop1 ? 'transparent' : 'initial',
                  filter: isTop1 ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.9))' : 'none',
                  fontStyle: 'italic',
                }}>
                  TOP {winRank ?? '--'}
                </span>
              </div>
            </div>
          </div>

          {/* ── Left Badge (Para todos, muda a cor se Top 1) ── */}
          <div style={{
            position: 'absolute', top: 300, left: 24, zIndex: 25,
            width: 140, background: 'linear-gradient(180deg, #171717, #0a0a0a)',
            border: isTop1 ? '2px solid #ca8a04' : '2px solid #525252', borderRadius: '8px 8px 45px 45px',
            padding: '16px 0 20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center',
            boxShadow: isTop1 ? '0 15px 30px rgba(0,0,0,0.9), inset 0 0 15px rgba(202,138,4,0.15)' : '0 10px 20px rgba(0,0,0,0.8)',
          }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: isTop1 ? '#facc15' : '#a3a3a3' }}>★</span>
              <span style={{ fontSize: 12, color: isTop1 ? '#facc15' : '#a3a3a3' }}>★</span>
              <span style={{ fontSize: 12, color: '#525252' }}>★</span>
              <span style={{ fontSize: 12, color: '#525252' }}>★</span>
              <span style={{ fontSize: 12, color: '#525252' }}>★</span>
            </div>
            <span style={{ 
              color: isTop1 ? '#fff' : '#fff', 
              fontSize: 54, fontWeight: 900, lineHeight: 1, letterSpacing: -2,
              background: isTop1 ? 'linear-gradient(180deg, #fca5a5, #ef4444, #7f1d1d)' : 'none',
              WebkitBackgroundClip: isTop1 ? 'text' : 'border-box',
              WebkitTextFillColor: isTop1 ? 'transparent' : 'initial',
              filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.8))',
              fontStyle: 'italic',
              paddingRight: 10, // Evita cortar o final do texto em itálico
            }}>
              {overall ?? '--'}
            </span>
            <span style={{ color: '#a3a3a3', fontSize: 10, letterSpacing: 2, marginTop: 6, textTransform: 'uppercase' }}>
              {position || 'JOGADOR'}
            </span>
            <div style={{ width: '70%', height: 1, background: isTop1 ? 'rgba(202,138,4,0.5)' : 'rgba(163,163,163,0.3)', margin: '14px 0' }} />
            <span style={{ color: isTop1 ? '#facc15' : '#d4d4d8', fontSize: 22, fontWeight: 900, lineHeight: 1 }}>TOP {winRank ?? '--'}</span>
            
            {textoHellcifeDataUrl ? (
              <img src={textoHellcifeDataUrl} alt="Hellcife" style={{ height: 20, marginTop: 15, objectFit: 'contain' }} />
            ) : (
              <span style={{ color: '#fff', fontSize: 9, letterSpacing: 1, marginTop: 4 }}>FIRE SHARK</span>
            )}
            <span style={{ color: isTop1 ? '#ca8a04' : '#525252', fontSize: 10, marginTop: 12 }}>★</span>
          </div>

          {/* ── Nome — banner skew e Subtítulo ── */}
          <div style={{ 
            position: 'absolute', top: 560, left: '50%', transform: 'translateX(-50%)', 
            zIndex: 25, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' 
          }}>
            <div style={{
              background: isTop1 
                ? 'linear-gradient(90deg, #991b1b, #dc2626, #991b1b)' 
                : 'linear-gradient(90deg, #262626, #404040, #262626)',
              padding: '12px 70px',
              transform: 'skew(-15deg)',
              boxShadow: isTop1 ? '0 15px 30px rgba(0,0,0,0.6), inset 0 2px 10px rgba(255,255,255,0.4)' : '0 10px 20px rgba(0,0,0,0.6)',
              borderBottom: isTop1 ? '6px solid #7f1d1d' : '6px solid #171717',
              borderTop: isTop1 ? '1px solid #fca5a5' : '1px solid #737373',
            }}>
              <span style={{
                display: 'block', transform: 'skew(15deg)',
                color: '#fff', fontSize: 56, fontWeight: 900, fontStyle: 'italic', letterSpacing: 4,
                textTransform: 'uppercase',
                textShadow: '3px 3px 0 #000, 5px 5px 15px rgba(0,0,0,0.5)',
                lineHeight: 1,
              }}>
                {firstName}
              </span>
            </div>

            {/* Subtítulo: O Tubarão da Quadra */}
            <div style={{
              marginTop: 10,
              background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.8), transparent)',
              padding: '4px 40px',
              borderTop: '1px solid rgba(234,179,8,0.5)',
              borderBottom: '1px solid rgba(234,179,8,0.5)',
            }}>
              <span style={{
                color: '#facc15', fontSize: 16, fontWeight: 900, letterSpacing: 6,
                textTransform: 'uppercase', fontStyle: 'italic',
                textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 15px rgba(250,204,21,0.5)',
                display: 'block',
              }}>
                O Tubarão da Quadra!
              </span>
            </div>
          </div>



          {/* ── Logo Gigante no fundo (bottom) ── */}
          {escudoDataUrl && (
            <img
              src={escudoDataUrl}
              alt=""
              style={{
                position: 'absolute', bottom: -50, right: -60, zIndex: 10,
                width: 320, height: 320, objectFit: 'contain',
                opacity: 0.15, mixBlendMode: 'overlay',
                transform: 'rotate(-15deg)',
              }}
            />
          )}

          {/* ── Stats base ── */}
          <div style={{
            position: 'absolute', bottom: 45, left: 40, right: 40, zIndex: 30,
            display: 'flex', justifyContent: 'space-around', alignItems: 'center',
          }}>
            {/* Win Rate */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 40, filter: isTop1 ? 'drop-shadow(0 0 15px rgba(239,68,68,0.8))' : 'none' }}>🔥</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ color: '#fff', fontSize: 26, fontWeight: 900, fontStyle: 'italic', lineHeight: 1, textShadow: '0 4px 10px rgba(0,0,0,0.8)' }}>{winRate ?? '--'}%</span>
                <span style={{ color: '#d4d4d8', fontSize: 10, letterSpacing: 2, fontWeight: 800, textTransform: 'uppercase', marginTop: 2 }}>VITÓRIAS</span>
              </div>
            </div>

            {/* Partidas */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 40, color: '#facc15', textShadow: '0 0 15px rgba(250,204,21,0.6)' }}>⚡</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ color: '#fff', fontSize: 26, fontWeight: 900, fontStyle: 'italic', lineHeight: 1, textShadow: '0 4px 10px rgba(0,0,0,0.8)' }}>{totalMatches ?? wins ?? '--'}</span>
                <span style={{ color: '#d4d4d8', fontSize: 10, letterSpacing: 2, fontWeight: 800, textTransform: 'uppercase', marginTop: 2 }}>PARTIDAS</span>
              </div>
            </div>

            {/* Ranking */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 40, filter: isTop1 ? 'drop-shadow(0 0 15px rgba(56,189,248,0.4))' : 'grayscale(100%)' }}>🦈</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ 
                  color: isTop1 ? '#fff' : '#fff', fontSize: 26, fontWeight: 900, fontStyle: 'italic', lineHeight: 1,
                  background: isTop1 ? 'linear-gradient(180deg, #fef08a, #eab308, #854d0e)' : 'none',
                  WebkitBackgroundClip: isTop1 ? 'text' : 'border-box',
                  WebkitTextFillColor: isTop1 ? 'transparent' : 'initial',
                  filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.8))'
                }}>TOP {winRank ?? '--'}</span>
                <span style={{ color: '#d4d4d8', fontSize: 10, letterSpacing: 2, fontWeight: 800, textTransform: 'uppercase', marginTop: 2 }}>RANKING</span>
              </div>
            </div>
          </div>

          {/* ── Tagline final ── */}
          <div style={{
            position: 'absolute', bottom: 10, left: 0, right: 0, zIndex: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
          }}>
            <div style={{ width: '100%', maxWidth: 90, height: 2, background: 'linear-gradient(to right, transparent, rgba(220,38,38,0.5))' }} />
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: 5, fontWeight: 700, textTransform: 'uppercase' }}>
              O TUBARÃO DO <span style={{ color: '#D90429' }}>HELLCIFE</span>
            </span>
            <div style={{ width: '100%', maxWidth: 90, height: 2, background: 'linear-gradient(to left, transparent, rgba(220,38,38,0.5))' }} />
          </div>
        </div>
      );
    }

    // ─── BIG STAR / MINI STAR ─────────────────────────────────────────────────
    if (type === 'big_star' || type === 'mini_star') {
      const isBig = type === 'big_star';
      const bg = catData?.bg || 'linear-gradient(135deg, #1a1a2e, #0d0d1a)';
      const accent = catData?.accent || '#FACC15';
      const emoji = catData?.label || '⭐';

      return (
        <div ref={ref} style={{ width: 600, height: 900, position: 'relative', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
          <div style={{ position: 'absolute', inset: 0, background: bg }} />
          
          {/* Huge Background Watermark */}
          <div style={{ 
            position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', 
            fontSize: 600, color: 'rgba(255,255,255,0.03)', zIndex: 1, lineHeight: 0.8
          }}>
            {isBig ? '🌟' : emoji}
          </div>

          {/* Glow central */}
          <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%', background: `radial-gradient(circle, ${accent}30 0%, transparent 60%)`, zIndex: 2 }} />
          {/* Gradient base */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', background: 'linear-gradient(to top, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.8) 50%, transparent 100%)', zIndex: 2 }} />

          {/* Frame Tecnológico */}
          <div style={{ position: 'absolute', inset: 18, border: `2px solid ${accent}25`, borderRadius: 28, zIndex: 5, boxShadow: `inset 0 0 40px ${accent}10` }} />
          {[
            { top: 26, left: 26, borderTop: `4px solid ${accent}`, borderLeft: `4px solid ${accent}` },
            { top: 26, right: 26, borderTop: `4px solid ${accent}`, borderRight: `4px solid ${accent}` },
            { bottom: 26, left: 26, borderBottom: `4px solid ${accent}`, borderLeft: `4px solid ${accent}` },
            { bottom: 26, right: 26, borderBottom: `4px solid ${accent}`, borderRight: `4px solid ${accent}` },
          ].map((s, i) => (
            <div key={i} style={{ position: 'absolute', width: 40, height: 40, ...s, borderRadius: 6, zIndex: 10, filter: `drop-shadow(0 0 10px ${accent}80)` }} />
          ))}

          {/* Logo Hellcife */}
          {escudoDataUrl && (
            <div style={{ position: 'absolute', top: 30, right: 30, zIndex: 20 }}>
              <img src={escudoDataUrl} alt="Hellcife" style={{ width: 140, height: 140, objectFit: 'contain', filter: `drop-shadow(0 5px 15px rgba(0,0,0,0.8)) drop-shadow(0 0 15px ${accent}40)` }} />
            </div>
          )}

          {/* Emoji central no anel */}
          <div style={{ 
            position: 'absolute', top: 55, left: '50%', transform: 'translateX(-50%)', 
            width: 130, height: 130, borderRadius: '50%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.1), rgba(0,0,0,0.6))',
            border: `3px solid ${accent}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: isBig ? 70 : 60, lineHeight: 1, zIndex: 10,
            boxShadow: `0 10px 30px rgba(0,0,0,0.8), inset 0 0 20px ${accent}40, 0 0 40px ${accent}50`
          }}>
            <span style={{ filter: 'drop-shadow(0 5px 10px rgba(0,0,0,0.5))' }}>{isBig ? '🌟' : emoji}</span>
          </div>

          {/* Título */}
          <div style={{ position: 'absolute', top: 205, left: 0, right: 0, textAlign: 'center', zIndex: 10 }}>
            <div style={{ 
              fontSize: isBig ? 48 : 42, fontWeight: 900, letterSpacing: 4, 
              color: '#fff', textTransform: 'uppercase', lineHeight: 1.1,
              textShadow: `0 5px 15px rgba(0,0,0,0.9), 0 0 30px ${accent}60`
            }}>
              {isBig ? 'GRANDE ESTRELA!' : 'ESTRELA GANHA!'}
            </div>
            <div style={{ 
              fontSize: 16, color: accent, letterSpacing: 8, marginTop: 10, fontWeight: 800, 
              textTransform: 'uppercase', textShadow: '0 2px 5px rgba(0,0,0,0.8)' 
            }}>
              {isBig ? `${bigStarsTotal}ª conquista` : starCategoryLabel}
            </div>
          </div>

          {/* Avatar Shield */}
          <div style={{ position: 'absolute', top: 300, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
            <ColorRing size={230} innerSize={205} colors={[accent, '#000']}>
              <CardAvatar avatarUrl={avatarUrl} name={athleteName} size={200} />
            </ColorRing>
          </div>

          {/* Stars progress */}
          {!isBig && miniStarsCount != null && (
            <div style={{ 
              position: 'absolute', top: 570, left: '50%', transform: 'translateX(-50%)', zIndex: 10, 
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              background: 'rgba(0,0,0,0.5)', padding: '16px 24px', borderRadius: 16, border: `1px solid ${accent}40`,
              boxShadow: `0 10px 20px rgba(0,0,0,0.5), inset 0 0 15px ${accent}20`
            }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 380 }}>
                {Array.from({ length: 15 }).map((_, i) => (
                  <div key={i} style={{ 
                    width: 20, height: 20, 
                    background: i < miniStarsCount ? accent : 'rgba(255,255,255,0.1)', 
                    clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
                    boxShadow: i < miniStarsCount ? `0 0 10px ${accent}` : 'none'
                  }} />
                ))}
              </div>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, letterSpacing: 5, fontWeight: 800 }}>
                {miniStarsCount} DE 15 ESTRELAS
              </span>
            </div>
          )}
          {isBig && bigStarsTotal != null && (
            <div style={{ 
              position: 'absolute', top: 570, left: '50%', transform: 'translateX(-50%)', zIndex: 10, 
              display: 'flex', gap: 12,
              background: 'rgba(0,0,0,0.5)', padding: '16px 32px', borderRadius: 16, border: `1px solid ${accent}40`,
              boxShadow: `0 10px 20px rgba(0,0,0,0.5), inset 0 0 15px ${accent}20`
            }}>
              {Array.from({ length: bigStarsTotal }).map((_, i) => (
                <div key={i} style={{ 
                  width: 36, height: 36, background: '#FACC15', 
                  clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)', 
                  boxShadow: '0 0 15px rgba(250,204,21,0.8)' 
                }} />
              ))}
            </div>
          )}

          {/* Nome */}
          <div style={{ position: 'absolute', bottom: 100, left: 0, right: 0, textAlign: 'center', zIndex: 10 }}>
            <div style={{ fontSize: 50, fontWeight: 900, letterSpacing: 6, color: '#fff', textTransform: 'uppercase', lineHeight: 1, textShadow: '0 5px 15px rgba(0,0,0,0.9)' }}>
              {athleteName.toUpperCase()}
            </div>
            {shirtNumber && (
              <div style={{ display: 'inline-block', marginTop: 14, background: `${accent}20`, border: `1px solid ${accent}60`, padding: '6px 26px', borderRadius: 12, color: '#fff', fontSize: 20, fontWeight: 900, letterSpacing: 5, boxShadow: `0 5px 15px rgba(0,0,0,0.5), inset 0 0 10px ${accent}40` }}>
                CAMISA #{shirtNumber}
              </div>
            )}
          </div>

          {textoHellcifeDataUrl && (
            <div style={{ position: 'absolute', bottom: 25, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
              <img src={textoHellcifeDataUrl} alt="Hellcife" style={{ height: 25, objectFit: 'contain', opacity: 0.6 }} />
            </div>
          )}
        </div>
      );
    }

    // ─── TOP WINS (GLADIADORES) ─────────────────────────────────────────────────────────────
    if (type === 'top_wins') {
      const rankValue = winRank ?? 1;
      const isTop1 = rankValue === 1;
      const rankLabel = rankValue === 1 ? '🥇' : rankValue === 2 ? '🥈' : rankValue === 3 ? '🥉' : `#${rankValue}`;
      
      const themeColors = {
        primary: isTop1 ? '#FACC15' : '#9ca3af', // Gold vs Silver
        dark: isTop1 ? '#713f12' : '#374151',
        bg: isTop1 ? 'linear-gradient(160deg, #1c1917 0%, #292524 50%, #0c0a09 100%)' : 'linear-gradient(160deg, #111827 0%, #1f2937 50%, #030712 100%)'
      };

      return (
        <div ref={ref} style={{ width: 600, height: 900, position: 'relative', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
          <div style={{ position: 'absolute', inset: 0, background: themeColors.bg }} />
          
          {/* Fundo Gigante Rank */}
          <div style={{ 
            position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', 
            fontSize: 450, fontWeight: 900, fontStyle: 'italic', color: 'rgba(255,255,255,0.03)', 
            lineHeight: 0.8, zIndex: 1 
          }}>
            #{rankValue}
          </div>

          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 500, height: 400, background: `radial-gradient(circle, ${themeColors.primary}20 0%, transparent 70%)`, zIndex: 2 }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 100%)', zIndex: 2 }} />
          
          {/* Frame Metálico */}
          <div style={{ position: 'absolute', inset: 18, border: `3px solid ${themeColors.primary}40`, borderRadius: 16, zIndex: 10, boxShadow: `inset 0 0 30px rgba(0,0,0,0.8), 0 0 20px ${themeColors.primary}20` }} />

          {/* Logo Hellcife */}
          {escudoDataUrl && (
            <div style={{ position: 'absolute', top: 32, right: 32, zIndex: 20 }}>
              <img src={escudoDataUrl} alt="Hellcife" style={{ width: 140, height: 140, objectFit: 'contain', filter: `drop-shadow(0 5px 15px rgba(0,0,0,0.8)) drop-shadow(0 0 15px ${themeColors.primary}40)` }} />
            </div>
          )}

          {/* Medalhão Rank */}
          <div style={{ 
            position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)', 
            width: 120, height: 120, borderRadius: '50%', 
            background: 'linear-gradient(135deg, #171717, #000)',
            border: `4px solid ${themeColors.primary}`,
            boxShadow: `0 10px 30px rgba(0,0,0,0.9), inset 0 0 20px ${themeColors.primary}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10
          }}>
            <span style={{ fontSize: 60, filter: `drop-shadow(0 4px 8px rgba(0,0,0,0.8))` }}>{rankLabel}</span>
          </div>

          {/* Título */}
          <div style={{ position: 'absolute', top: 200, left: 0, right: 0, textAlign: 'center', zIndex: 10 }}>
            <div style={{ 
              fontSize: 38, fontWeight: 900, letterSpacing: 4, 
              background: `linear-gradient(180deg, #fff, ${themeColors.primary})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              textTransform: 'uppercase', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.8))'
            }}>
              GLADIADORES
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16, letterSpacing: 8, marginTop: 8, fontWeight: 800 }}>
              TOP {rankValue} · MAIS VITÓRIAS
            </div>
          </div>

          {/* Avatar Shield */}
          <div style={{ position: 'absolute', top: 290, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
            <ColorRing size={230} innerSize={205} colors={[themeColors.primary, themeColors.dark]}>
              <CardAvatar avatarUrl={avatarUrl} name={athleteName} size={200} />
            </ColorRing>
          </div>

          {/* Estatísticas Inferiores em Blocos Metálicos */}
          <div style={{ position: 'absolute', bottom: 130, left: 40, right: 40, display: 'flex', justifyContent: 'center', gap: 20, zIndex: 10 }}>
            <div style={{ width: 140, padding: '16px 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.8))', border: `1px solid ${themeColors.primary}30`, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.5)' }}>
              <span style={{ fontSize: 34, fontWeight: 900, color: themeColors.primary }}>{winRate ?? '--'}%</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: 2, marginTop: 4 }}>TAXA DE VIT.</span>
            </div>
            
            <div style={{ width: 140, padding: '16px 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.8))', border: `1px solid ${themeColors.primary}30`, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.5)' }}>
              <span style={{ fontSize: 34, fontWeight: 900, color: '#fff' }}>{wins ?? '--'}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: 2, marginTop: 4 }}>VITÓRIAS</span>
            </div>
            
            <div style={{ width: 140, padding: '16px 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.8))', border: `1px solid ${themeColors.primary}30`, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.5)' }}>
              <span style={{ fontSize: 34, fontWeight: 900, color: '#fff' }}>{totalMatches ?? '--'}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 800, letterSpacing: 2, marginTop: 4 }}>PARTIDAS</span>
            </div>
          </div>

          {/* Nome */}
          <div style={{ position: 'absolute', bottom: 50, left: 0, right: 0, textAlign: 'center', zIndex: 10 }}>
            <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: 4, color: '#fff', textTransform: 'uppercase', lineHeight: 1, textShadow: '0 5px 15px rgba(0,0,0,0.9)' }}>
              {athleteName.toUpperCase()}
            </div>
          </div>
          
          {textoHellcifeDataUrl && (
            <div style={{ position: 'absolute', bottom: 15, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
              <img src={textoHellcifeDataUrl} alt="Hellcife" style={{ height: 25, objectFit: 'contain', opacity: 0.8 }} />
            </div>
          )}
        </div>
      );
    }

    return null;
  }
);

AchievementShareCard.displayName = 'AchievementShareCard';
