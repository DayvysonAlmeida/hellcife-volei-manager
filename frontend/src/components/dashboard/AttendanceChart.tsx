import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CustomTooltip } from './chart-utils';

export function AttendanceChart({ trend }: { trend: any[] }) {
  if (!trend) return null;
  return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="card p-5"
        >
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-blue" /> Taxa de Lotação (Últimos 6)
          </h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#71717A', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717A', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="rate" stroke="#2563EB" strokeWidth={3} dot={{ r: 4, fill: '#2563EB', strokeWidth: 0 }} activeDot={{ r: 6 }} name="Lotação %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
  );
}
