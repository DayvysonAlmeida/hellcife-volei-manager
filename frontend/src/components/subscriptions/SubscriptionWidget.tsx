import React, { useState } from 'react';
import { Zap, Crown, Users, AlertCircle, ArrowRight, Wallet, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { PaymentModal } from './PaymentModal';

export const SubscriptionWidget = () => {
  const queryClient = useQueryClient();
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
        paymentUrl: response.data.payment_url,
        paymentId: response.data.payment_id
      });
    } catch (err: any) {
      const apiError = err.response?.data?.error || 'Erro ao comprar créditos.';
      setError(apiError);
    } finally {
      setIsBuying(false);
    }
  };

  if (isLoading) return <div className="animate-pulse bg-surface/50 border border-border/50 h-64 rounded-2xl"></div>;
  
  if (!sub || !sub.plan) {
    return (
      <div className="bg-surface/30 backdrop-blur-md rounded-2xl p-8 border border-border/50 shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-red/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <div className="w-16 h-16 bg-surface border border-border/50 shadow-inner rounded-full flex items-center justify-center mb-4 relative z-10">
          <Crown className="w-8 h-8 text-text-muted" />
        </div>
        <h3 className="text-xl font-black text-white mb-2 uppercase tracking-wide relative z-10">Sem Plano Ativo</h3>
        
        {sub.standalone_credits > 0 ? (
          <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-xl mb-6 relative z-10 w-full">
            <p className="text-amber-500 text-sm font-bold flex items-center justify-center gap-2">
              <Zap size={16} />
              Você tem {sub.standalone_credits} crédito{sub.standalone_credits > 1 ? 's' : ''} avulso{sub.standalone_credits > 1 ? 's' : ''}
            </p>
          </div>
        ) : (
          <p className="text-text-secondary text-sm mb-6 max-w-sm relative z-10">
            Assine um plano e garanta sua vaga nos circuitos com antecedência, receba XP bônus e convidados grátis.
          </p>
        )}

        <Link to="/athlete/plans" className="bg-red hover:bg-red-hover text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 relative z-10 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]">
          {sub.standalone_credits > 0 ? 'Ver Planos' : 'Conhecer Planos'} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const currentCycle = sub.current_cycle;
  const plan = sub.plan;
  
  const cycleCredits = currentCycle ? Number(currentCycle.credits_balance) : 0;
  const standaloneCredits = Number(sub.standalone_credits) || 0;
  const totalCredits = cycleCredits + standaloneCredits;
  const planCreditsTotal = plan ? Number(plan.credits) : 0;
  const creditsUsed = Math.max(0, planCreditsTotal - cycleCredits);
  const progress = planCreditsTotal > 0 ? (creditsUsed / planCreditsTotal) * 100 : 0;


  const freeGuestsUsed = currentCycle ? currentCycle.free_guests_used : 0;
  const freeGuestsTotal = plan ? plan.free_guests : 0;
  const guestsAvailable = freeGuestsTotal - freeGuestsUsed >= 0 ? freeGuestsTotal - freeGuestsUsed : 0;

  return (
    <div className="bg-surface/50 backdrop-blur-md rounded-2xl p-6 border border-border/50 shadow-xl relative overflow-hidden">
      {/* Glow Effect se ativo */}
      {sub.status === 'active' && (
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-red/10 rounded-full blur-[50px] pointer-events-none"></div>
      )}

      {/* Cabeçalho do Plano */}
      <div className="flex justify-between items-start mb-8 relative z-10">
        <div>
          <h3 className="text-2xl font-black text-white flex items-center gap-2 uppercase tracking-wide drop-shadow-md">
            <Crown className="w-6 h-6 text-red" />
            {plan?.name || 'Plano Assinado'}
          </h3>
          <p className="text-sm text-text-muted mt-1 font-medium bg-black/20 px-2 py-0.5 rounded-md w-fit">
            Próxima Fatura: <span className="text-white/80">{sub.next_billing_date}</span>
          </p>
        </div>
        <span className={`px-3 py-1.5 text-xs font-black rounded-lg uppercase tracking-widest border shadow-lg ${
          sub.status === 'active' 
            ? 'bg-red/10 text-red border-red/30 shadow-red/20' 
            : 'bg-orange-500/10 text-orange-500 border-orange-500/30 shadow-orange-500/20'
        }`}>
          {sub.status === 'active' ? 'Ativo' : 'Pendente'}
        </span>
      </div>

      <div className="space-y-6 relative z-10">
        
        {/* Bloco de Créditos Melhorado */}
        <div className="bg-[#0a0a0a]/80 p-5 rounded-2xl border border-white/5 shadow-inner relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-red"></div>
          
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-text-muted font-bold uppercase tracking-widest text-xs flex items-center gap-1.5 mb-1">
                <Wallet size={14} className="text-red" />
                Saldo Total de Créditos
              </span>
              <div className="flex items-baseline gap-1">
                <span className="font-display text-4xl text-white leading-none">{totalCredits}</span>
                <span className="text-text-muted text-sm font-bold uppercase tracking-widest">disp.</span>
              </div>
            </div>
            
            {standaloneCredits > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase font-black tracking-widest text-text-muted mb-1">Composição</span>
                <span className="text-xs text-white/80 font-bold bg-white/5 px-2 py-1 rounded-md border border-white/10">{cycleCredits} do Plano</span>
                <span className="text-xs text-amber-500 font-bold bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20 mt-1 flex items-center gap-1">
                  <Zap size={10} /> {standaloneCredits} Avulsos
                </span>
              </div>
            )}
          </div>
          
          {/* Barra de Progresso do Plano (apenas se houver créditos do plano) */}
          {planCreditsTotal > 0 && (
             <div className="mt-4 pt-4 border-t border-white/5">
                <div className="flex justify-between text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">
                  <span>Créditos do Plano Utilizados</span>
                  <span>{creditsUsed} de {planCreditsTotal}</span>
                </div>
                <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden border border-white/10 relative shadow-inner">
                  <div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-red to-red-hover rounded-full transition-all duration-700 shadow-[0_0_15px_rgba(239,68,68,0.6)]"
                    style={{ width: `${Math.max(Math.min(progress, 100), progress > 0 ? 4 : 0)}%` }}
                  >
                    {progress > 0 && (
                      <div className="absolute top-0 right-0 w-2 h-full bg-white/40 blur-[2px] rounded-full"></div>
                    )}
                  </div>
                </div>
             </div>
          )}

          {totalCredits === 0 && sub.status === 'active' && (
             <div className="mt-4 bg-orange-500/10 border border-orange-500/20 p-3 rounded-lg text-xs text-orange-400 font-bold flex items-center gap-2">
               <AlertCircle size={16} className="shrink-0" />
               Seus créditos esgotaram! Adquira avulsos para continuar jogando.
             </div>
          )}
        </div>

        {/* Benefícios Menores */}
        <div className="grid grid-cols-1 gap-3">
          <div className="bg-[#0a0a0a]/50 p-4 rounded-xl border border-white/5 flex flex-col gap-1.5 group hover:border-blue-400/30 transition-colors">
            <div className="flex items-center gap-1.5 text-text-muted text-[10px] font-bold uppercase tracking-widest">
              <Users className="w-4 h-4 text-blue-400 group-hover:animate-pulse" /> Convidados Grátis
            </div>
            <span className="text-white font-black text-lg">{guestsAvailable} disp.</span>
          </div>
        </div>
      </div>
      
      {/* Área de Erro do CPF */}
      {error && (
        <div className="mt-6 bg-red/10 border border-red/30 rounded-xl p-4 relative z-10 shadow-lg">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-red shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red text-sm font-bold mb-3">{error}</p>
              {error.toLowerCase().includes('obrigatório') && (
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={cpf}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      setCpf(val.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"));
                    }}
                    placeholder="Seu CPF (000.000.000-00)"
                    className="flex-1 bg-black/40 border border-red/20 rounded-lg px-4 py-2 text-sm text-white focus:border-red outline-none transition-colors"
                  />
                  <button 
                    onClick={handleBuyCredits}
                    disabled={isBuying || cpf.length < 14}
                    className="bg-red hover:bg-red-hover disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md"
                  >
                    Tentar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Botão Comprar Crédito */}
      <button 
        onClick={handleBuyCredits}
        disabled={isBuying}
        className="w-full mt-6 py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-amber-950 rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] flex items-center justify-center gap-2 disabled:opacity-50 relative z-10"
      >
        {isBuying ? (
          <Loader2 size={18} className="animate-spin text-amber-950" />
        ) : (
          <Zap className="w-5 h-5" />
        )}
        {isBuying ? 'Gerando PIX...' : 'Comprar 1 Crédito Avulso (R$ 10)'}
      </button>

      {/* Botão Mudar Plano */}
      <Link 
        to="/athlete/plans" 
        className="mt-3 w-full py-3 bg-surface hover:bg-surface-highlight text-text-secondary hover:text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all border border-border/50 hover:border-border flex items-center justify-center relative z-10"
      >
        Mudar Plano de Assinatura
      </Link>

      {paymentData && (
        <PaymentModal 
          isOpen={!!paymentData}
          onClose={() => setPaymentData(null)}
          pixCopyPaste={paymentData?.pixCopyPaste}
          paymentUrl={paymentData?.paymentUrl}
          amount={paymentData?.amount}
          paymentId={paymentData?.paymentId}
          isProcessing={isBuying}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['my_subscription'] });
            toast.success('PIX gerado! Aguardando compensação.');
          }}
        />
      )}
    </div>
  );
};
