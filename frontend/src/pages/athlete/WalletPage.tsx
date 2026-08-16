import { motion } from 'framer-motion';
import { Wallet, Activity, ArrowRight, ShieldCheck } from 'lucide-react';
import { SubscriptionWidget } from '@/components/subscriptions/SubscriptionWidget';
import { useNavigate } from 'react-router-dom';

export function WalletPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div className="flex items-center gap-4 mb-8 bg-surface/30 p-5 rounded-2xl border border-white/5 backdrop-blur-md">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-hover to-red flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.3)]">
          <Wallet size={24} className="text-white" />
        </div>
        <div>
          <h1 className="font-display text-2xl tracking-wider text-text-primary uppercase drop-shadow-md">Sua Carteira</h1>
          <p className="text-sm text-text-muted mt-0.5">Gerencie sua assinatura, créditos e faturas do clube.</p>
        </div>
      </div>

      {/* Subscription Widget Principal */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <SubscriptionWidget />
      </motion.div>

      {/* Atalhos Rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => navigate('/athlete/plans')}
          className="bg-surface/50 border border-white/5 p-6 rounded-2xl cursor-pointer hover:border-red/50 hover:bg-surface-highlight transition-all group backdrop-blur-md relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-red/5 rounded-full blur-2xl group-hover:bg-red/10 transition-colors pointer-events-none"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-red/10 rounded-xl text-red border border-red/20 group-hover:scale-110 transition-transform">
              <Activity size={24} />
            </div>
            <ArrowRight size={20} className="text-text-muted group-hover:text-red group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="font-black uppercase tracking-widest text-lg mb-1.5 relative z-10">Explorar Planos</h3>
          <p className="text-sm text-text-muted relative z-10">Conheça os planos disponíveis ou faça um upgrade da sua assinatura.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-surface/30 border border-white/5 p-6 rounded-2xl opacity-60 cursor-not-allowed group relative overflow-hidden backdrop-blur-md"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
              <ShieldCheck size={24} />
            </div>
          </div>
          <h3 className="font-black uppercase tracking-widest text-lg mb-1.5">Histórico</h3>
          <p className="text-sm text-text-muted">Acesso às faturas e recibos antigos.</p>
          <span className="inline-block mt-4 px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-[10px] uppercase font-black tracking-widest text-text-muted">Em breve</span>
        </motion.div>
      </div>
    </div>
  );
}
