import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CHART_COLORS, CustomTooltip } from './chart-utils';

export function PositionDistribution({ distribution }: { distribution: any[] }) {
  if (!distribution) return null;
  return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="card p-6"
      >
        <h2 className="font-display text-lg text-text-primary tracking-wider mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-red" />
          DISTRIBUIÇÃO POR POSIÇÃO
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={distribution || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
            <XAxis dataKey="position" tick={{ fill: '#71717A', fontSize: 11 }} />
            <YAxis tick={{ fill: '#71717A', fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {(distribution || []).map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
  );
}
