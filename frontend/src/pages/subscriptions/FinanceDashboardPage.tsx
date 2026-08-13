import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, TrendingDown, DollarSign, Wallet, ArrowUpRight, ArrowDownRight, Activity
} from 'lucide-react';
import { motion } from 'framer-motion';
import api from '@/lib/api';

const fetchFinanceData = async () => {
  const { data } = await api.get('/subscriptions/finance/');
  return data;
};

export function FinanceDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['financeDashboard'],
    queryFn: fetchFinanceData
  });

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="w-10 h-10 border-4 border-red border-t-transparent rounded-full animate-spin shadow-neon-red-sm" />
      </div>
    );
  }

  const isPositive = data?.balance >= 0;

  return (
    <div className="max-w-6xl mx-auto relative p-4">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-green-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-display uppercase tracking-wide flex items-center gap-3">
          <Activity className="text-red" />
          Painel Financeiro
        </h1>
        <p className="text-text-secondary mt-1">Análise de receitas, despesas e fluxo de caixa.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 relative z-10">
        
        {/* Card 1: Receita Total */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="card p-6 bg-surface/80 border border-border/50 backdrop-blur-md relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={48} className="text-green-500" />
          </div>
          <div className="flex items-center gap-3 text-text-muted text-sm font-bold uppercase tracking-wider mb-2">
            <div className="p-2 bg-green-500/10 text-green-500 rounded-lg"><TrendingUp size={16} /></div>
            Receitas (Mês)
          </div>
          <h2 className="text-3xl font-black text-white">
            R$ {Number(data?.total_revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
          <p className="text-xs text-text-secondary mt-2 flex items-center gap-1">
            <ArrowUpRight size={14} className="text-green-500" /> + Planos e Créditos
          </p>
        </motion.div>

        {/* Card 2: Despesas */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="card p-6 bg-surface/80 border border-border/50 backdrop-blur-md relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingDown size={48} className="text-red" />
          </div>
          <div className="flex items-center gap-3 text-text-muted text-sm font-bold uppercase tracking-wider mb-2">
            <div className="p-2 bg-red/10 text-red rounded-lg"><TrendingDown size={16} /></div>
            Despesas (Estimativa)
          </div>
          <h2 className="text-3xl font-black text-white">
            R$ {Number(data?.total_expenses || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
          <p className="text-xs text-text-secondary mt-2 flex items-center gap-1">
            <ArrowDownRight size={14} className="text-red" /> Custo de Quadras
          </p>
        </motion.div>

        {/* Card 3: Saldo de Caixa */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="card p-6 bg-surface/80 border border-border/50 backdrop-blur-md relative overflow-hidden group lg:col-span-2"
        >
          <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${isPositive ? 'text-green-500' : 'text-red'}`}>
            <Wallet size={80} />
          </div>
          <div className="flex items-center gap-3 text-text-muted text-sm font-bold uppercase tracking-wider mb-2">
            <div className={`p-2 rounded-lg ${isPositive ? 'bg-green-500/10 text-green-500' : 'bg-red/10 text-red'}`}>
              <DollarSign size={16} />
            </div>
            Saldo Operacional (Caixa)
          </div>
          <h2 className={`text-5xl font-black ${isPositive ? 'text-green-400' : 'text-red'}`}>
            R$ {Number(data?.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
          <p className="text-xs text-text-secondary mt-2">
            {isPositive ? 'O Hellcife está lucrando este mês! 🚀' : 'Atenção: Despesas maiores que receitas neste mês. ⚠️'}
          </p>
        </motion.div>

      </div>

      {/* Detalhamento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
        <div className="card p-6 bg-surface/60 border border-border">
          <h3 className="font-bold text-white mb-6 uppercase tracking-wider text-sm">Detalhamento de Receitas</h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-background/50 rounded-xl border border-border/30">
              <div>
                <p className="font-bold text-white">Assinaturas (Ativas)</p>
                <p className="text-xs text-text-secondary">Mensalidades recebidas</p>
              </div>
              <p className="text-xl font-bold text-green-400">
                + R$ {Number(data?.total_plans_revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            <div className="flex justify-between items-center p-4 bg-background/50 rounded-xl border border-border/30">
              <div>
                <p className="font-bold text-white">Créditos Extras</p>
                <p className="text-xs text-text-secondary">Rateios e compras avulsas</p>
              </div>
              <p className="text-xl font-bold text-green-400">
                + R$ {Number(data?.total_extras_revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="flex justify-between items-center p-4 bg-orange-500/5 rounded-xl border border-orange-500/20">
              <div>
                <p className="font-bold text-orange-400">A Receber (Pendentes)</p>
                <p className="text-xs text-orange-400/60">Faturas PIX/Cartão não pagas</p>
              </div>
              <p className="text-lg font-bold text-orange-400">
                R$ {Number(data?.total_pending_revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6 bg-surface/60 border border-border flex flex-col justify-center items-center text-center">
           <div className="w-24 h-24 rounded-full bg-surface-highlight flex items-center justify-center mb-6 border-2 border-red/20">
             <Activity size={40} className="text-red" />
           </div>
           <h3 className="text-xl font-black text-white mb-2">Visão Estratégica</h3>
           <p className="text-text-secondary max-w-sm">
             Acompanhe o crescimento do time. Cada plano assinado e crédito extra comprado garante a saúde financeira do Hellcife Manager!
           </p>
        </div>
      </div>

    </div>
  );
}
