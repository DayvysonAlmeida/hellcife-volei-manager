import React, { useState } from 'react';
import { CreditCard, CheckCircle2, AlertCircle, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PaymentModal } from '@/components/subscriptions/PaymentModal';
import { useAuth } from '@/store/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const generateFeatures = (plan: any) => {
  const feats = [];
  feats.push(`${plan.credits} Crédito(s) mensal(is)`);
  if (plan.has_unlimited_priority) {
    feats.push(`Acesso Prioritário Ilimitado`);
  } else if (plan.priorities > 0) {
    feats.push(`${plan.priorities} Acesso(s) Prioritário(s) (24h)`);
  }
  if (plan.free_guests > 0) {
    feats.push(`Até ${plan.free_guests} Convidado(s) gratuito(s)`);
  }
  if (plan.paid_guests_allowed > 0) {
    feats.push(`Convite extra por R$ ${Number(plan.paid_guest_price).toFixed(2).replace('.', ',')}`);
  }
  return feats;
};

export const PlansPage = () => {
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [cpf, setCpf] = useState('');
  const [error, setError] = useState('');
  const [paymentData, setPaymentData] = useState<any>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.get('/subscriptions/plans/').then(res => res.data.results || res.data)
  });

  const { data: userSubs = [], isLoading: subsLoading } = useQuery({
    queryKey: ['my_subscriptions'],
    queryFn: () => api.get('/subscriptions/user-subscriptions/').then(res => res.data.results || res.data)
  });

  const activeSub = userSubs.find((sub: any) => sub.status === 'active' || sub.status === 'PENDING_PAYMENT');

  const handleSubscribe = async () => {
    setError('');
    if (!cpf || cpf.replace(/\D/g, '').length !== 11) {
      setError('Por favor, informe um CPF válido (11 dígitos).');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(`/subscriptions/plans/${selectedPlan.id}/subscribe/`, {
        cpf: cpf.replace(/\D/g, '')
      });
      
      setPaymentData({
        amount: selectedPlan.price,
        pixCopyPaste: response.data.pix_copy_paste || response.data.payment_url || '',
        paymentUrl: response.data.payment_url
      });
      setSelectedPlan(null); // Close checkout modal
    } catch (err: any) {
      console.error("DEBUG ERROR API", err.response?.data || err);
      setError(err.response?.data?.error || `Erro desconhecido: ${JSON.stringify(err.response?.data || err.message)}`);
    } finally {
      setLoading(false);
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

  if (isLoading || subsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-red border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto relative">
      {/* Círculo de fundo brilhante para dar clima Neon */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-red/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="text-center mb-12 relative z-10">
        <h1 className="text-4xl md:text-5xl font-black mb-4 text-white uppercase tracking-tight">
          Nossos <span className="text-red">Planos</span>
        </h1>
        <p className="text-text-secondary text-lg max-w-2xl mx-auto">
          {activeSub 
            ? 'Você já é um assinante VIP! Confira seu plano atual abaixo.' 
            : 'Escolha seu plano e garanta sua vaga nos circuitos com antecedência. Aumente seu XP com as vantagens do Hellcife Manager.'}
        </p>
      </div>

      {activeSub && (
        <div className="mb-12 relative z-10 max-w-3xl mx-auto">
          <div className="bg-gradient-to-br from-red/20 to-surface border-2 border-red/30 rounded-2xl p-8 shadow-[0_0_40px_rgba(217,4,41,0.15)] flex flex-col md:flex-row gap-8 items-center">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red/10 border border-red/20 text-red text-sm font-bold uppercase tracking-widest rounded-full mb-4">
                Seu Plano Atual
              </div>
              <h2 className="text-3xl font-black text-white uppercase tracking-wide mb-2">{activeSub.plan?.name}</h2>
              <p className="text-text-secondary font-medium">Próxima Fatura: {new Date(activeSub.next_billing_date).toLocaleDateString('pt-BR')}</p>
              
              {activeSub.status === 'PENDING_PAYMENT' && (
                <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg flex items-start gap-3">
                  <AlertCircle className="text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-orange-500 font-bold uppercase text-sm mb-1">Pagamento Pendente</p>
                    <p className="text-orange-200/70 text-sm">Seu plano está aguardando confirmação de pagamento para ser liberado.</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="w-full md:w-auto bg-black/30 rounded-xl p-6 border border-white/5 space-y-4">
               <div className="flex justify-between gap-6">
                 <span className="text-text-muted uppercase text-xs font-bold tracking-widest">Créditos Disponíveis</span>
                 <span className="text-white font-black text-xl">{activeSub.current_cycle?.credits_balance || 0}</span>
               </div>
               <div className="flex justify-between gap-6 border-t border-white/10 pt-4">
                 <span className="text-text-muted uppercase text-xs font-bold tracking-widest">Prioridades Restantes</span>
                 <span className="text-white font-black text-xl">
                   {activeSub.plan?.has_unlimited_priority ? '∞' : (activeSub.plan?.priorities || 0) - (activeSub.current_cycle?.priorities_used || 0)}
                 </span>
               </div>
            </div>
          </div>
        </div>
      )}

      {!activeSub && (plans.length === 0 ? (
        <div className="text-center p-12 bg-surface/50 backdrop-blur-sm border border-border/50 rounded-2xl">
          <p className="text-text-muted text-lg">Nenhum plano disponível no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
          {plans.map((plan: any) => (
            <div 
              key={plan.id} 
              className="group relative bg-surface/40 backdrop-blur-md rounded-2xl p-8 border border-border/50 transition-all duration-300 hover:border-red/50 hover:shadow-[0_0_30px_rgba(239,68,68,0.15)] flex flex-col overflow-hidden"
            >
              {/* Highlight superior quando houver hover */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-wide">{plan.name}</h3>
              
              <div className="flex items-baseline gap-1 mb-6 pb-6 border-b border-border/50">
                <span className="text-4xl font-black text-red">R$ {Number(plan.price).toFixed(2).replace('.', ',')}</span>
                <span className="text-text-muted font-bold">/mês</span>
              </div>
              
              <ul className="space-y-4 mb-8 flex-1">
                {generateFeatures(plan).map((feat, i) => (
                  <li key={i} className="flex items-start gap-3 text-text-secondary font-medium">
                    <CheckCircle2 className="w-5 h-5 text-red shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <button 
                onClick={() => setSelectedPlan(plan)}
                className="w-full py-4 rounded-xl font-bold bg-surface-highlight hover:bg-red hover:text-white text-text-primary transition-all flex items-center justify-center gap-2 group-hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]"
              >
                Escolher Plano <ArrowRight size={18} />
              </button>
            </div>
          ))}
        </div>
      ))}

      {/* Modal de Checkout / CPF */}
      <AnimatePresence>
        {selectedPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedPlan(null)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-surface border border-border/50 rounded-2xl shadow-2xl p-6"
            >
              <button onClick={() => setSelectedPlan(null)} className="absolute top-4 right-4 text-text-muted hover:text-white transition-colors">
                <X size={24} />
              </button>
              
              <div className="mb-6">
                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                  <CreditCard className="text-red" />
                  Checkout Seguros
                </h2>
                <p className="text-text-secondary mt-1 text-sm">
                  Você está assinando o plano <strong className="text-white">{selectedPlan.name}</strong> por <strong className="text-red">R$ {Number(selectedPlan.price).toFixed(2).replace('.', ',')}</strong>.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-text-primary text-sm font-bold mb-2 uppercase tracking-wide">
                    CPF (Necessário para a fatura PIX)
                  </label>
                  <input 
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(formatCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-white font-mono focus:border-red focus:ring-1 focus:ring-red outline-none transition-all"
                    autoFocus
                  />
                  {error && (
                    <div className="flex items-center gap-2 mt-2 text-red text-sm font-medium">
                      <AlertCircle size={16} />
                      <span>{error}</span>
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="w-full py-4 rounded-xl font-bold bg-red hover:bg-red-hover text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Gerando PIX...
                    </div>
                  ) : (
                    <>Gerar PIX e Concluir</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal PIX nativo já existente */}
      {paymentData && (
        <PaymentModal 
          isOpen={!!paymentData}
          onClose={() => setPaymentData(null)}
          pixCopyPaste={paymentData.pixCopyPaste}
          paymentUrl={paymentData.paymentUrl}
          amount={paymentData.amount}
          isProcessing={false}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  );
};
