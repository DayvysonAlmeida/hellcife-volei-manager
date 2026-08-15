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
          className="relative bg-surface/30 backdrop-blur-md border border-white/5 rounded-2xl p-6 overflow-hidden group hover:border-white/10 transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.03)]"
        >
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue/5 blur-[50px] rounded-full pointer-events-none -z-10 group-hover:bg-blue/10 transition-all" />
          
          <h3 className="font-display text-lg text-text-primary tracking-wider mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue/10 flex items-center justify-center border border-blue/20">
              <TrendingUp size={16} className="text-blue" />
            </div>
            TAXA DE LOTAÇÃO
          </h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#A1A1AA', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fill: '#71717A', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} dx={-10} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                <Line type="monotone" dataKey="rate" stroke="#2563EB" strokeWidth={3} dot={{ r: 4, fill: '#2563EB', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#60A5FA', stroke: '#2563EB', strokeWidth: 2 }} name="Lotação %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
  );
}
