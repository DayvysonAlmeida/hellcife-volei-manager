import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  subtitle?: string;
  color?: 'red' | 'blue' | 'green' | 'yellow';
  delay?: number;
}

const colorVariants = {
  red: {
    iconBg: 'bg-red/10 text-red',
    border: 'border-red/20',
    valueCls: 'text-red',
    glow: 'hover:shadow-neon-red-sm',
  },
  blue: {
    iconBg: 'bg-blue/10 text-blue',
    border: 'border-blue/20',
    valueCls: 'text-blue',
    glow: 'hover:shadow-neon-blue-sm',
  },
  green: {
    iconBg: 'bg-green-500/10 text-green-400',
    border: 'border-green-500/20',
    valueCls: 'text-green-400',
    glow: 'hover:shadow-[0_0_10px_rgba(22,163,74,0.3)]',
  },
  yellow: {
    iconBg: 'bg-yellow-500/10 text-yellow-400',
    border: 'border-yellow-500/20',
    valueCls: 'text-yellow-400',
    glow: 'hover:shadow-[0_0_10px_rgba(202,138,4,0.3)]',
  },
};

export function StatCard({ title, value, icon, subtitle, color = 'red', delay = 0 }: StatCardProps) {
  const variant = colorVariants[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={cn(
        'card p-5 flex items-center gap-4 transition-all duration-300',
        variant.border,
        variant.glow
      )}
    >
      <div className={cn('p-3 rounded-xl flex-shrink-0', variant.iconBg)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-text-muted text-xs font-medium uppercase tracking-wider truncate">{title}</p>
        <p className={cn('font-display text-3xl font-bold mt-0.5', variant.valueCls)}>{value}</p>
        {subtitle && <p className="text-text-muted text-xs mt-0.5">{subtitle}</p>}
      </div>
    </motion.div>
  );
}
