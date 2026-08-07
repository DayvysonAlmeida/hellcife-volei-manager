import { forwardRef } from 'react';
import { Flame, Zap, ShieldAlert } from 'lucide-react';
import { getOverallColor } from '@/lib/utils';

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
        crossOrigin="anonymous"
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
      const isTop2 = winRank === 2;
      const isTop3 = winRank === 3;
      const isPodium = isTop1 || isTop2 || isTop3;
      
      const overallColor = overall ? getOverallColor(overall) : '#525252';

      let rankTheme = {
        glow: 'rgba(249,115,22,0.5)',
        textBg: 'none',
        textFill: 'initial',
        nameBanner: 'linear-gradient(90deg, #262626, #404040, #262626)',
        nameBannerBorder: '#171717',
        nameBannerTopBorder: '#737373',
        avatarBorder: '#111',
        avatarRing: 'rgba(249,115,22,0.5)',
        badgeBg: 'linear-gradient(180deg, #404040, #262626)',
        badgeTextGradient: 'none',
        badgeBorder: '#a3a3a3',
        cardBorder: 'linear-gradient(135deg, #404040, #171717)',
        cardBg: 'radial-gradient(circle at 50% 40%, #1a0000 0%, #050000 60%, #000000 100%)'
      };

      if (isTop1) {
        rankTheme = {
          ...rankTheme,
          glow: 'rgba(220,38,38,0.8)',
          textBg: 'linear-gradient(180deg, #fef08a, #eab308, #854d0e)',
          textFill: 'transparent',
          nameBanner: 'linear-gradient(90deg, #991b1b, #dc2626, #991b1b)',
          nameBannerBorder: '#7f1d1d',
          nameBannerTopBorder: '#fca5a5',
          avatarBorder: 'linear-gradient(135deg, #f97316, #dc2626)',
          avatarRing: 'conic-gradient(from 0deg, #dc2626, #f97316, #dc2626, #f97316, #dc2626)',
          badgeBg: 'linear-gradient(180deg, #991b1b, #450a0a)',
          badgeTextGradient: 'linear-gradient(180deg, #fef08a, #eab308, #854d0e)',
          badgeBorder: '#fca5a5',
          cardBorder: 'linear-gradient(135deg, #fef08a, #eab308, #854d0e)',
          cardBg: 'radial-gradient(circle at 50% 40%, #450a0a 0%, #170505 50%, #000000 100%)'
        };
      } else if (isTop2) {
        rankTheme = {
          ...rankTheme,
          glow: 'rgba(156,163,175,0.8)',
          textBg: 'linear-gradient(180deg, #f3f4f6, #9ca3af, #4b5563)',
          textFill: 'transparent',
          nameBanner: 'linear-gradient(90deg, #374151, #6b7280, #374151)',
          nameBannerBorder: '#1f2937',
          nameBannerTopBorder: '#e5e7eb',
          avatarBorder: 'linear-gradient(135deg, #d1d5db, #6b7280)',
          avatarRing: 'conic-gradient(from 0deg, #9ca3af, #f3f4f6, #9ca3af, #f3f4f6, #9ca3af)',
          badgeBg: 'linear-gradient(180deg, #4b5563, #1f2937)',
          badgeTextGradient: 'linear-gradient(180deg, #f3f4f6, #9ca3af, #4b5563)',
          badgeBorder: '#e5e7eb',
          cardBorder: 'linear-gradient(135deg, #f3f4f6, #6b7280)',
        };
      } else if (isTop3) {
        rankTheme = {
          ...rankTheme,
          glow: 'rgba(180,83,9,0.8)',
          textBg: 'linear-gradient(180deg, #fcd34d, #b45309, #78350f)',
          textFill: 'transparent',
          nameBanner: 'linear-gradient(90deg, #78350f, #b45309, #78350f)',
          nameBannerBorder: '#451a03',
          nameBannerTopBorder: '#fde68a',
          avatarBorder: 'linear-gradient(135deg, #f59e0b, #b45309)',
          avatarRing: 'conic-gradient(from 0deg, #b45309, #fcd34d, #b45309, #fcd34d, #b45309)',
          badgeBg: 'linear-gradient(180deg, #78350f, #451a03)',
          badgeTextGradient: 'linear-gradient(180deg, #fcd34d, #b45309, #78350f)',
          badgeBorder: '#fde68a',
          cardBorder: 'linear-gradient(135deg, #fcd34d, #b45309)',
        };
      }

      return (
        <div ref={ref} style={{ width: 600, height: 900, position: 'relative', overflow: 'hidden', fontFamily: "'Inter', sans-serif", padding: 18, background: 'transparent' }}>
          
          {/* Card Border / Frame (estilo Game Card) */}
          <div style={{ position: 'absolute', inset: 12, background: rankTheme.cardBorder, borderRadius: 32, zIndex: 1, boxShadow: '0 15px 40px rgba(0,0,0,0.9)' }}>
            <div style={{ position: 'absolute', inset: 6, background: rankTheme.cardBg, borderRadius: 26, overflow: 'hidden' }}>
              
              {/* Textura de Quadra/Grid */}
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '30px 30px', opacity: 0.5 }} />

              {/* Labaredas de Fogo para Top 1 */}
              {isTop1 && (
                <>
                  <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: 500, height: 500, background: 'radial-gradient(circle, rgba(239,68,68,0.25) 0%, rgba(249,115,22,0.1) 40%, transparent 70%)', filter: 'blur(40px)', zIndex: 1 }} />
                  <div style={{ position: 'absolute', bottom: '0%', left: -50, width: 350, height: 500, background: 'radial-gradient(ellipse, rgba(249,115,22,0.15) 0%, transparent 60%)', transform: 'rotate(25deg)', filter: 'blur(35px)', zIndex: 2 }} />
                  <div style={{ position: 'absolute', bottom: '0%', right: -50, width: 350, height: 500, background: 'radial-gradient(ellipse, rgba(239,68,68,0.15) 0%, transparent 60%)', transform: 'rotate(-25deg)', filter: 'blur(35px)', zIndex: 2 }} />
                </>
              )}

              {/* Fundo Fire Shark & Tubarão Fúria */}
              {firesharkDataUrl && (
                <img src={firesharkDataUrl} alt="" style={{ position: 'absolute', top: '5%', left: '5%', width: '90%', height: '70%', objectFit: 'contain', opacity: 0.05, mixBlendMode: 'screen' }} />
              )}
              {tubaraoFuriaDataUrl && (
                <img src={tubaraoFuriaDataUrl} alt="" style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 650, height: 650, objectFit: 'contain', objectPosition: 'top center', opacity: isTop1 ? 1 : 0.6, zIndex: 5 }} />
              )}

              {/* TOP LEFT OVERALL SHIELD (Fifa Style) */}
              <div style={{ position: 'absolute', top: 40, left: 30, zIndex: 30, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 0.9, letterSpacing: -3, color: '#fff', textShadow: '0 4px 10px rgba(0,0,0,0.8)', fontStyle: 'italic' }}>
                  {overall ?? '--'}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 2, color: overallColor, textTransform: 'uppercase', textShadow: '0 2px 5px rgba(0,0,0,0.8)' }}>
                  {position || 'JOGADOR'}
                </div>
                
                {/* Linha divisória */}
                <div style={{ width: 60, height: 2, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)', margin: '10px 0' }} />
                
                {/* Estrelas */}
                {((bigStarsTotal || 0) > 0 || (miniStarsCount || 0) > 0) && (
                  <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', width: 60 }}>
                    {Array.from({ length: bigStarsTotal || 0 }).map((_, i) => (
                      <span key={`big-${i}`} style={{ fontSize: 14, color: '#facc15', filter: 'drop-shadow(0 0 5px rgba(250,204,21,0.6))' }}>⭐</span>
                    ))}
                  </div>
                )}
                
                {/* Escudo Menor na esquerda abaixo do Overall */}
                {escudoDataUrl && (
                  <img src={escudoDataUrl} alt="Hellcife" style={{ width: 60, height: 60, objectFit: 'contain', marginTop: 15, filter: 'drop-shadow(0 5px 15px rgba(0,0,0,0.8))' }} />
                )}
              </div>

              {/* Logo Hellcife / Rank Direito superior */}
              <div style={{ position: 'absolute', top: 40, right: 30, zIndex: 30, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                 <div style={{ background: rankTheme.badgeBg, padding: '10px 24px', borderRadius: 8, boxShadow: `0 10px 30px ${rankTheme.glow}`, border: `2px solid ${rankTheme.badgeBorder}` }}>
                  <span style={{ 
                    color: isPodium ? '#fff' : '#d4d4d8', 
                    fontSize: 24, fontWeight: 900, letterSpacing: 3, 
                    textTransform: 'uppercase', 
                    background: rankTheme.badgeTextGradient,
                    WebkitBackgroundClip: isPodium ? 'text' : 'border-box',
                    WebkitTextFillColor: rankTheme.textFill,
                    filter: isPodium ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.9))' : 'none',
                    fontStyle: 'italic',
                  }}>
                    TOP {winRank ?? '--'}
                  </span>
                </div>
              </div>

              {/* AVATAR */}
              <div style={{ position: 'absolute', top: 220, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 330, height: 330, borderRadius: '50%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isPodium ? (
                    <div style={{ position: 'absolute', inset: -20, borderRadius: '50%', background: rankTheme.avatarRing, filter: 'blur(20px)', opacity: 0.85, mixBlendMode: 'screen', animation: 'spin 10s linear infinite' }} />
                  ) : (
                    <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: 'transparent', border: `2px solid ${rankTheme.avatarRing}`, boxShadow: `0 0 15px ${rankTheme.glow}` }} />
                  )}
                  <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', background: isPodium ? rankTheme.avatarBorder : '#111', border: isPodium ? 'none' : `2px solid ${rankTheme.glow}`, boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)' }} />
                  <div style={{ position: 'relative', zIndex: 2, borderRadius: '50%', overflow: 'hidden', width: 320, height: 320 }}>
                    <CardAvatar avatarUrl={avatarUrl} name={athleteName} size={320} />
                  </div>
                </div>
              </div>

              {/* NOME DO ATLETA */}
              <div style={{ position: 'absolute', top: 560, left: '50%', transform: 'translateX(-50%)', zIndex: 25, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <span style={{ color: '#fff', fontSize: 60, fontWeight: 900, fontStyle: 'italic', letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 5px 25px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.5)', lineHeight: 1 }}>
                  {firstName}
                </span>
                
                <div style={{ marginTop: 8, background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.8), transparent)', padding: '4px 60px', borderTop: '1px solid rgba(234,179,8,0.5)', borderBottom: '1px solid rgba(234,179,8,0.5)' }}>
                  <span style={{ color: '#facc15', fontSize: 14, fontWeight: 900, letterSpacing: 8, textTransform: 'uppercase', fontStyle: 'italic', textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>
                    O Tubarão da Quadra!
                  </span>
                </div>
                
                <div style={{ width: '80%', height: 2, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)', margin: '15px 0' }} />
              </div>

              {/* ATRIBUTOS GAME STYLE (Grid 2 colunas) */}
              <div style={{ position: 'absolute', bottom: 50, left: 40, right: 40, zIndex: 30 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 40px', background: 'rgba(0,0,0,0.4)', padding: '20px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
                  
                  {/* Vitórias */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 12 }}>
                    <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <span style={{ fontSize: 20 }}>🏆</span>
                    </div>
                    <div>
                      <div style={{ color: '#fff', fontSize: 24, fontWeight: 900 }}>{wins ?? '--'}</div>
                      <div style={{ color: '#a3a3a3', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>VITÓRIAS</div>
                    </div>
                  </div>

                  {/* Taxa de Vitória */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 12 }}>
                    <div style={{ width: 40, height: 40, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <span style={{ fontSize: 20 }}>🔥</span>
                    </div>
                    <div>
                      <div style={{ color: '#fff', fontSize: 24, fontWeight: 900 }}>{winRate ?? '--'}%</div>
                      <div style={{ color: '#a3a3a3', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>TAXA (WIN)</div>
                    </div>
                  </div>

                  {/* Partidas */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 12 }}>
                    <div style={{ width: 40, height: 40, background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.3)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <span style={{ fontSize: 20 }}>⚡</span>
                    </div>
                    <div>
                      <div style={{ color: '#fff', fontSize: 24, fontWeight: 900 }}>{totalMatches ?? '--'}</div>
                      <div style={{ color: '#a3a3a3', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>PARTIDAS</div>
                    </div>
                  </div>

                  {/* Ranking */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 12 }}>
                    <div style={{ width: 40, height: 40, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <span style={{ fontSize: 20 }}>🦈</span>
                    </div>
                    <div>
                      <div style={{ color: '#fff', fontSize: 24, fontWeight: 900 }}>#{winRank ?? '--'}</div>
                      <div style={{ color: '#a3a3a3', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>RANKING</div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Tagline Final */}
              <div style={{ position: 'absolute', bottom: 15, left: 0, right: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 4, fontWeight: 700, textTransform: 'uppercase' }}>
                  HELLCIFE VÔLEI MANAGER
                </span>
              </div>
            </div>
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
        bg: isTop1 ? 'linear-gradient(160deg, #1c1917 0%, #292524 50%, #0c0a09 100%)' : 'linear-gradient(160deg, #111827 0%, #1f2937 50%, #030712 100%)',
        border: isTop1 ? 'linear-gradient(135deg, #FACC15, #b45309)' : 'linear-gradient(135deg, #f3f4f6, #4b5563)'
      };

      return (
        <div ref={ref} style={{ width: 600, height: 900, position: 'relative', overflow: 'hidden', fontFamily: "'Inter', sans-serif", padding: 18, background: 'transparent' }}>
          
          {/* Card Border / Frame (estilo Game Card) */}
          <div style={{ position: 'absolute', inset: 12, background: themeColors.border, borderRadius: 32, zIndex: 1, boxShadow: '0 15px 40px rgba(0,0,0,0.9)' }}>
            <div style={{ position: 'absolute', inset: 6, background: themeColors.bg, borderRadius: 26, overflow: 'hidden' }}>
              
              {/* Textura */}
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
              
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 500, height: 400, background: `radial-gradient(circle, ${themeColors.primary}30 0%, transparent 70%)`, zIndex: 2 }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 100%)', zIndex: 2 }} />

              {/* Logo Hellcife Central Fundo */}
              {escudoDataUrl && (
                <div style={{ position: 'absolute', top: '25%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1, opacity: 0.05 }}>
                  <img src={escudoDataUrl} alt="Hellcife" style={{ width: 450, height: 450, objectFit: 'contain' }} />
                </div>
              )}

              {/* TOP LEFT OVERALL SHIELD */}
              <div style={{ position: 'absolute', top: 30, left: 30, zIndex: 30, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: 60, fontWeight: 900, lineHeight: 0.9, color: '#fff', textShadow: '0 4px 10px rgba(0,0,0,0.8)' }}>
                  {overall ?? '--'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: themeColors.primary, textTransform: 'uppercase' }}>
                  {position || 'GLADIADOR'}
                </div>
                <div style={{ width: 50, height: 2, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)', margin: '10px 0' }} />
                {escudoDataUrl && (
                  <img src={escudoDataUrl} alt="Hellcife" style={{ width: 50, height: 50, objectFit: 'contain', marginTop: 10, filter: 'drop-shadow(0 5px 15px rgba(0,0,0,0.8))' }} />
                )}
              </div>

              {/* RANK TOP RIGHT */}
              <div style={{ position: 'absolute', top: 30, right: 30, zIndex: 30 }}>
                <div style={{ background: 'rgba(0,0,0,0.5)', border: `2px solid ${themeColors.primary}`, padding: '8px 20px', borderRadius: '12px', backdropFilter: 'blur(10px)', boxShadow: `0 10px 20px rgba(0,0,0,0.5)` }}>
                   <span style={{ color: themeColors.primary, fontSize: 20, fontWeight: 900, textTransform: 'uppercase' }}>TOP {rankValue}</span>
                </div>
              </div>

              {/* AVATAR */}
              <div style={{ position: 'absolute', top: 200, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                <ColorRing size={320} innerSize={295} colors={[themeColors.primary, themeColors.dark]}>
                  <CardAvatar avatarUrl={avatarUrl} name={athleteName} size={300} />
                </ColorRing>
              </div>

              {/* NOME & TITULO */}
              <div style={{ position: 'absolute', top: 540, left: '50%', transform: 'translateX(-50%)', zIndex: 25, width: '100%', textAlign: 'center' }}>
                <div style={{ fontSize: 55, fontWeight: 900, letterSpacing: 2, color: '#fff', textTransform: 'uppercase', lineHeight: 1, textShadow: '0 5px 25px rgba(0,0,0,0.9)' }}>
                  {athleteName.split(' ')[0] || athleteName}
                </div>
                <div style={{ marginTop: 5 }}>
                  <span style={{ color: themeColors.primary, fontSize: 16, fontWeight: 900, letterSpacing: 8, textTransform: 'uppercase', textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>
                    MAIS VITÓRIAS
                  </span>
                </div>
                <div style={{ width: '80%', height: 2, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)', margin: '15px auto' }} />
              </div>

              {/* ATRIBUTOS */}
              <div style={{ position: 'absolute', bottom: 50, left: 40, right: 40, zIndex: 30 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 40px', background: 'rgba(0,0,0,0.6)', padding: '20px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                  
                  {/* Vitórias */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 12 }}>
                    <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <span style={{ fontSize: 20 }}>🏅</span>
                    </div>
                    <div>
                      <div style={{ color: '#fff', fontSize: 24, fontWeight: 900 }}>{wins ?? '--'}</div>
                      <div style={{ color: '#a3a3a3', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>VITÓRIAS</div>
                    </div>
                  </div>

                  {/* Taxa de Vitória */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 12 }}>
                    <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <span style={{ fontSize: 20 }}>📊</span>
                    </div>
                    <div>
                      <div style={{ color: '#fff', fontSize: 24, fontWeight: 900 }}>{winRate ?? '--'}%</div>
                      <div style={{ color: '#a3a3a3', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>TAXA (WIN)</div>
                    </div>
                  </div>

                  {/* Partidas */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 12 }}>
                    <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <span style={{ fontSize: 20 }}>⚔️</span>
                    </div>
                    <div>
                      <div style={{ color: '#fff', fontSize: 24, fontWeight: 900 }}>{totalMatches ?? '--'}</div>
                      <div style={{ color: '#a3a3a3', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>PARTIDAS</div>
                    </div>
                  </div>

                  {/* Ranking Global */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 12 }}>
                    <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <span style={{ fontSize: 20 }}>🌍</span>
                    </div>
                    <div>
                      <div style={{ color: '#fff', fontSize: 24, fontWeight: 900 }}>#{overallRank ?? '--'}</div>
                      <div style={{ color: '#a3a3a3', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>RANK GERAL</div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </div>
      );
    }

    return null;
  }
);

AchievementShareCard.displayName = 'AchievementShareCard';
