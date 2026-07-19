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
    iconBg: 'text-red',
    border: 'border-red/20 hover:border-red/50 shadow-sm hover:shadow-neon-red',
    valueCls: 'text-red',
    lineGrad: 'from-red-dark via-red to-red-dark',
  },
  blue: {
    iconBg: 'text-blue',
    border: 'border-blue/20 hover:border-blue/50 shadow-sm hover:shadow-neon-blue',
    valueCls: 'text-blue',
    lineGrad: 'from-blue-dark via-blue to-blue-dark',
  },
  green: {
    iconBg: 'text-green-400',
    border: 'border-green-500/20 hover:border-green-500/50 shadow-sm hover:shadow-neon-green',
    valueCls: 'text-green-400',
    lineGrad: 'from-green-800 via-green-500 to-green-800',
  },
  yellow: {
    iconBg: 'text-yellow-400',
    border: 'border-yellow-500/20 hover:border-yellow-500/50 shadow-sm hover:shadow-neon-yellow',
    valueCls: 'text-yellow-400',
    lineGrad: 'from-yellow-700 via-yellow-400 to-yellow-700',
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
        'card p-6 flex flex-col justify-between transition-all duration-300 min-h-[110px] relative overflow-hidden group',
        variant.border,
        'hover:-translate-y-1'
      )}
    >
      <div className="flex items-center justify-between w-full mb-2">
        <p className="text-text-muted text-xs font-bold uppercase tracking-widest">{title}</p>
        <div className={cn(variant.valueCls, 'opacity-70 group-hover:opacity-100 transition-opacity')}>
          {icon}
        </div>
      </div>
      
      <div className="flex items-end justify-between w-full mt-auto z-10">
        <p className={cn('font-display text-4xl font-bold leading-none tracking-wider', variant.valueCls)}>
          {value}
        </p>
        {subtitle && <p className="text-text-muted text-xs font-medium pb-1 text-right">{subtitle}</p>}
      </div>
      
      {/* Glow gradient bottom line */}
      <div className={cn(
        'absolute bottom-0 left-0 right-0 h-[3px] opacity-60 group-hover:opacity-100 transition-opacity bg-gradient-to-r',
        variant.lineGrad
      )} />
      
      {/* Background glow radial */}
      <div className={cn(
        'absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-[40px] opacity-10 group-hover:opacity-30 transition-opacity pointer-events-none',
        color === 'red' ? 'bg-red' : color === 'blue' ? 'bg-blue' : color === 'green' ? 'bg-green-500' : 'bg-yellow-500'
      )} />
    </motion.div>
  );
}
