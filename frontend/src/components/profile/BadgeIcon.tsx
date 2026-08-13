import * as Icons from 'lucide-react';
import type { Badge } from '@/types';

interface BadgeIconProps {
  badge: Badge;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  locked?: boolean;
}

export function BadgeIcon({ badge, size = 'md', locked = false }: BadgeIconProps) {
  // @ts-ignore - Dynamic icon rendering
  const Icon = Icons[badge.icon] || Icons.Award;

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32'
  };

  const iconSizes = {
    sm: 16,
    md: 24,
    lg: 40,
    xl: 56
  };

  const tierBorders = {
    bronze: 'border-[#CD7F32] shadow-[#CD7F32]/20',
    silver: 'border-[#C0C0C0] shadow-[#C0C0C0]/20',
    gold: 'border-[#FFD700] shadow-[#FFD700]/30',
    diamond: 'border-[#00FFFF] shadow-[#00FFFF]/40'
  };

  const baseStyle = locked 
    ? 'border-border bg-surface opacity-50 grayscale'
    : `bg-surface border-2 shadow-lg ${tierBorders[badge.tier]} relative overflow-hidden`;

  return (
    <div 
      className={`rounded-xl flex items-center justify-center transition-all ${sizeClasses[size]} ${baseStyle}`}
      title={locked ? `${badge.name} (Bloqueado) - ${badge.description}` : badge.name}
    >
      {!locked && (
        <div className="absolute inset-0 opacity-20" style={{ backgroundColor: badge.color_hex }} />
      )}
      
      <div className={`relative z-10 flex items-center justify-center ${locked ? 'text-text-muted' : ''}`} style={!locked ? { color: badge.color_hex } : {}}>
        <Icon size={iconSizes[size]} strokeWidth={2.5} />
      </div>
      
      {!locked && badge.tier === 'diamond' && (
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent skew-x-12 animate-pulse-slow" />
      )}
    </div>
  );
}
