import React, { useState } from 'react';
import { Zap, Crown, Users, AlertCircle, ArrowRight, Wallet, CheckCircle2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { PaymentModal } from './PaymentModal';

export const SubscriptionWidget = () => {
  const [paymentData, setPaymentData] = useState<any>(null);
  const [isBuying, setIsBuying] = useState(false);
  const [cpf, setCpf] = useState('');
  const [error, setError] = useState('');

  const { data: sub, isLoading } = useQuery({
    queryKey: ['my_subscription'],
    queryFn: async () => {
      try {
        const res = await api.get('/subscriptions/user-subscriptions/my_subscription/');
        return res.data;
      } catch (err: any) {
        if (err.response?.status === 404) return null;
        throw err;
      }
    },
    retry: false,
  });

  const handleBuyCredits = async () => {
    setError('');
    if (!sub) return;
    
    const amount = 1;
    const price_paid = 10.00;

    setIsBuying(true);
    try {
      const response = await api.post('/subscriptions/user-subscriptions/buy_extra_credits/', {
        amount,
        price_paid,
        cpf: cpf.replace(/\D/g, '')
      });
      setPaymentData({
        amount: price_paid,
        pixCopyPaste: response.data.pix_copy_paste,
        paymentUrl: response.data.payment_url
      });
    } catch (err: any) {
      if (err.response?.status === 400 && err.response.data?.error?.includes('CPF')) {
        setError('CPF é necessário para a primeira compra avulsa.');
      } else {
        setError(err.response?.data?.error || 'Erro ao gerar cobrança.');
      }
    } finally {
      setIsBuying(false);
    }
  };

  const formatCpf = (val: string) => {
    return val
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  if (isLoading) return <div className="animate-pulse bg-surface/50 border border-border/50 h-64 rounded-2xl"></div>;
  
  if (!sub) {
    return (
      <div className="bg-surface/30 backdrop-blur-md rounded-2xl p-8 border border-border/50 shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-red/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <div className="w-16 h-16 bg-surface border border-border/50 shadow-inner rounded-full flex items-center justify-center mb-4 relative z-10">
          <Crown className="w-8 h-8 text-text-muted" />
        </div>
        <h3 className="text-xl font-black text-white mb-2 uppercase tracking-wide relative z-10">Sem Plano Ativo</h3>
        <p className="text-text-secondary text-sm mb-6 max-w-sm relative z-10">
          Assine um plano e garanta sua vaga nos circuitos com antecedência, receba XP bônus e convidados grátis.
        </p>
        <Link to="/athlete/plans" className="bg-red hover:bg-red-hover text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 relative z-10 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]">
          Conhecer Planos <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const currentCycle = sub.current_cycle;
  const plan = sub.plan;
  
  const creditsAvailable = currentCycle ? Number(currentCycle.credits_balance) : 0;
  const creditsTotal = plan ? plan.credits : 0;
  const creditsUsed = creditsTotal - creditsAvailable >= 0 ? creditsTotal - creditsAvailable : 0;
  const progress = creditsTotal > 0 ? (creditsAvailable / creditsTotal) * 100 : 0;

  const prioritiesUsed = currentCycle ? currentCycle.priorities_used : 0;
  const prioritiesTotal = plan ? plan.priorities : 0;
  const prioritiesAvailable = prioritiesTotal - prioritiesUsed >= 0 ? prioritiesTotal - prioritiesUsed : 0;

  const freeGuestsUsed = currentCycle ? currentCycle.free_guests_used : 0;
  const freeGuestsTotal = plan ? plan.free_guests : 0;
  const guestsAvailable = freeGuestsTotal - freeGuestsUsed >= 0 ? freeGuestsTotal - freeGuestsUsed : 0;

  return (
    <div className="bg-surface/50 backdrop-blur-md rounded-2xl p-6 border border-border/50 shadow-xl relative overflow-hidden">
      {/* Glow Effect if active */}
      {sub.status === 'active' && (
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-red/10 rounded-full blur-3xl pointer-events-none"></div>
      )}

      <div className="flex justify-between items-start mb-6 relative z-10">
        <div>
          <h3 className="text-xl font-black text-white flex items-center gap-2 uppercase tracking-wide">
            <Crown className="w-5 h-5 text-red" />
            {plan?.name || 'Plano Assinado'}
          </h3>
          <p className="text-sm text-text-muted mt-1 font-medium">Renova em {sub.next_billing_date}</p>
        </div>
        <span className={`px-3 py-1 text-[10px] font-black rounded-md uppercase tracking-widest border ${
          sub.status === 'active' 
            ? 'bg-red/10 text-red border-red/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
            : 'bg-orange-500/10 text-orange-500 border-orange-500/20'
        }`}>
          {sub.status === 'active' ? 'Ativo' : 'Pendente'}
        </span>
      </div>

      <div className="space-y-5 relative z-10">
        {/* Barra de Créditos Estilo HP/XP */}
        <div className="bg-background/50 p-4 rounded-xl border border-border/50">
          <div className="flex justify-between text-sm mb-2 items-center">
            <span className="text-text-secondary font-bold uppercase tracking-wider text-xs flex items-center gap-1.5">
              <Wallet size={14} className="text-red" />
              Quadras Disponíveis
            </span>
            <span className="font-black text-white bg-surface px-2 py-0.5 rounded text-xs border border-border/50">
              {creditsAvailable} / {creditsTotal}
            </span>
          </div>
          <div className="h-2.5 bg-surface rounded-full overflow-hidden border border-border/50">
            <div 
              className="h-full bg-gradient-to-r from-red-hover to-red rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          {creditsAvailable === 0 && sub.status === 'active' && (
             <p className="text-[10px] text-orange-400 mt-2 flex items-center gap-1 font-bold">
               <AlertCircle size={12} /> Seus créditos acabaram! Compre avulsos abaixo.
             </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="bg-background/30 p-3 rounded-lg border border-border/30 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-text-muted text-[10px] font-bold uppercase tracking-widest">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Prioridades
            </div>
            <span className="text-white font-black text-sm">
              {plan?.has_unlimited_priority ? 'Ilimitado' : `${prioritiesAvailable} restantes`}
            </span>
          </div>
          
          <div className="bg-background/30 p-3 rounded-lg border border-border/30 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-text-muted text-[10px] font-bold uppercase tracking-widest">
              <Users className="w-3.5 h-3.5 text-blue-400" /> Convidados
            </div>
            <span className="text-white font-black text-sm">{guestsAvailable} grátis</span>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="mt-4 bg-red/10 border border-red/20 rounded-lg p-3 text-red text-sm relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} />
            <span className="font-bold">{error}</span>
          </div>
          {error.includes('CPF') && (
             <input 
               type="text"
               value={cpf}
               onChange={(e) => setCpf(formatCpf(e.target.value))}
               placeholder="Digite seu CPF (11 dígitos)"
               className="w-full bg-surface border border-border/50 rounded-lg px-3 py-2 text-white outline-none focus:border-red focus:ring-1 focus:ring-red transition-all font-mono text-sm"
             />
          )}
        </div>
      )}

      <button 
        onClick={handleBuyCredits}
        disabled={isBuying}
        className="w-full mt-5 py-3.5 bg-surface-hover hover:bg-surface-highlight text-text-primary rounded-xl text-sm font-bold transition-all border border-border/50 flex items-center justify-center gap-2 disabled:opacity-50 relative z-10 group hover:border-red/30"
      >
        <Zap className="w-4 h-4 text-amber-500 group-hover:animate-pulse" />
        {isBuying ? 'Gerando PIX...' : 'Comprar 1 Crédito Extra (R$ 10)'}
      </button>

      {paymentData && (
        <PaymentModal 
          isOpen={!!paymentData}
          onClose={() => setPaymentData(null)}
          pixCopyPaste={paymentData.pixCopyPaste}
          paymentUrl={paymentData.paymentUrl}
          amount={paymentData.amount}
          isProcessing={false}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
};
