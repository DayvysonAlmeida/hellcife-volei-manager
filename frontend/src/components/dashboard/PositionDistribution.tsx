import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CHART_COLORS, CustomTooltip } from './chart-utils';

const POSITION_COLORS: Record<string, string> = {
  'Líbero': '#22d3ee',
  'Levantador': '#c084fc',
  'Oposto': '#f87171',
  'Ponteiro': '#4ade80',
  'Central': '#facc15',
  'Universal': '#fb923c',
  // fallbacks
  'libero': '#22d3ee',
  'setter': '#c084fc',
  'opposite': '#f87171',
  'outside': '#4ade80',
  'middle': '#facc15',
  'universal': '#fb923c',
};

export function PositionDistribution({ distribution }: { distribution: any[] }) {
  if (!distribution || distribution.length === 0) return null;
  return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="relative bg-surface/30 backdrop-blur-md border border-white/5 rounded-2xl p-6 overflow-hidden group hover:border-white/10 transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.03)]"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-[50px] rounded-full pointer-events-none -z-10 group-hover:bg-white/10 transition-all" />
        
        <h2 className="font-display text-lg text-text-primary tracking-wider mb-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            <TrendingUp size={16} className="text-white" />
          </div>
          DISTRIBUIÇÃO POR POSIÇÃO
        </h2>
        
        <div className="w-full h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
              <XAxis dataKey="position" tick={{ fill: '#A1A1AA', fontSize: 11, fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={10} />
              <YAxis tick={{ fill: '#71717A', fontSize: 11 }} axisLine={false} tickLine={false} dx={-10} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={50}>
                {distribution.map((entry, i) => (
                  <Cell key={i} fill={POSITION_COLORS[entry.position] || CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
  );
}
