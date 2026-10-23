import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Crown, Plus, Edit2, Trash2, Loader2, Save, X, Zap, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { PageLoading } from '@/components/ui/Loading';

export function AdminPlansPage() {
  const qc = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: plans, isLoading } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => api.get('/subscriptions/plans/').then(r => r.data.results !== undefined ? r.data.results : r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (data.id) return api.put(`/subscriptions/plans/${data.id}/`, data);
      return api.post('/subscriptions/plans/', data);
    },
    onSuccess: () => {
      toast.success('Plano salvo com sucesso!');
      setEditingPlan(null);
      setIsCreating(false);
      qc.invalidateQueries({ queryKey: ['admin-plans'] });
    },
    onError: () => toast.error('Erro ao salvar plano.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/subscriptions/plans/${id}/`),
    onSuccess: () => {
      toast.success('Plano deletado!');
      qc.invalidateQueries({ queryKey: ['admin-plans'] });
    },
    onError: () => toast.error('Erro ao deletar plano. (Pode estar em uso)'),
  });

  if (isLoading) return <PageLoading />;

  return (
    <div className="min-h-screen pb-20 bg-background animate-fade-in text-text-primary selection:bg-red/30">
      {/* Header Premium E-Sports */}
      <div className="relative border-b border-white/10 p-4 pt-6 sm:p-6 sm:pt-8 sticky top-0 z-20 shadow-[0_4px_30px_rgba(0,0,0,0.5)] backdrop-blur-3xl bg-background/90 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-50">
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-red/20 blur-[80px] rounded-full animate-pulse" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-blue-600/20 blur-[90px] rounded-full animate-pulse" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <h1 className="font-display text-3xl sm:text-4xl text-white uppercase tracking-widest drop-shadow-md leading-none flex items-center gap-4">
              <Crown className="w-8 h-8 sm:w-10 sm:h-10 text-red" />
              Gestão de <span className="text-red">Planos</span>
            </h1>
            <p className="text-white/60 text-sm mt-2 font-medium uppercase tracking-[0.2em]">Crie e edite as assinaturas</p>
          </div>
          
          <button 
            onClick={() => {
              setEditingPlan({ name: '', description: '', price: 0, credits: 0, priorities: 0, free_guests: 0, has_unlimited_priority: false, is_active: true });
              setIsCreating(true);
            }}
            className="btn-primary flex items-center gap-2 px-6 py-3"
          >
            <Plus size={20} />
            Novo Plano
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 mt-4">

        {/* Plan Form Modal */}
        {(isCreating || editingPlan) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-surface border-2 border-border shadow-[0_0_40px_rgba(217,4,41,0.2)] rounded-2xl w-full max-w-lg overflow-hidden animate-slide-in flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/40">
                <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Crown className="text-red" size={20} />
                  {isCreating ? 'Criar Novo Plano' : 'Editar Plano'}
                </h2>
                <button onClick={() => { setIsCreating(false); setEditingPlan(null); }} className="text-white/50 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                <div>
                  <label className="block text-xs font-black text-white/60 uppercase tracking-widest mb-1.5 ml-1">Nome do Plano</label>
                  <input 
                    type="text" 
                    value={editingPlan.name}
                    onChange={(e) => setEditingPlan({...editingPlan, name: e.target.value})}
                    className="w-full bg-white/5 border-2 border-white/10 rounded-xl px-4 py-3 text-white focus:border-red/50 focus:bg-white/10 outline-none transition-all"
                    placeholder="Ex: Hellcife Pro"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-black text-white/60 uppercase tracking-widest mb-1.5 ml-1">Descrição</label>
                  <textarea 
                    value={editingPlan.description || ''}
                    onChange={(e) => setEditingPlan({...editingPlan, description: e.target.value})}
                    className="w-full bg-white/5 border-2 border-white/10 rounded-xl px-4 py-3 text-white focus:border-red/50 focus:bg-white/10 outline-none transition-all h-24"
                    placeholder="Descreva os benefícios..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-white/60 uppercase tracking-widest mb-1.5 ml-1">Preço (R$)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={editingPlan.price}
                      onChange={(e) => setEditingPlan({...editingPlan, price: e.target.value})}
                      className="w-full bg-white/5 border-2 border-white/10 rounded-xl px-4 py-3 text-white focus:border-red/50 focus:bg-white/10 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-white/60 uppercase tracking-widest mb-1.5 ml-1">Quadras/Mês</label>
                    <input 
                      type="number" 
                      value={editingPlan.credits}
                      onChange={(e) => setEditingPlan({...editingPlan, credits: parseInt(e.target.value) || 0})}
                      className="w-full bg-white/5 border-2 border-white/10 rounded-xl px-4 py-3 text-white focus:border-red/50 focus:bg-white/10 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-white/60 uppercase tracking-widest mb-1.5 ml-1">Prioridades na Fila</label>
                    <input 
                      type="number" 
                      value={editingPlan.priorities}
                      disabled={editingPlan.has_unlimited_priority}
                      onChange={(e) => setEditingPlan({...editingPlan, priorities: parseInt(e.target.value) || 0})}
                      className="w-full bg-white/5 border-2 border-white/10 rounded-xl px-4 py-3 text-white focus:border-red/50 focus:bg-white/10 outline-none transition-all disabled:opacity-30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-white/60 uppercase tracking-widest mb-1.5 ml-1">Convidados Grátis</label>
                    <input 
                      type="number" 
                      value={editingPlan.free_guests}
                      onChange={(e) => setEditingPlan({...editingPlan, free_guests: parseInt(e.target.value) || 0})}
                      className="w-full bg-white/5 border-2 border-white/10 rounded-xl px-4 py-3 text-white focus:border-red/50 focus:bg-white/10 outline-none transition-all"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 bg-white/5 border-2 border-white/10 p-4 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={editingPlan.has_unlimited_priority}
                    onChange={(e) => setEditingPlan({...editingPlan, has_unlimited_priority: e.target.checked})}
                    className="w-5 h-5 accent-red rounded bg-transparent"
                  />
                  <div className="flex flex-col">
                    <span className="font-bold text-white text-sm">Prioridade Ilimitada</span>
                    <span className="text-[10px] text-white/50 uppercase tracking-widest">Fura a fila vip de convidados</span>
                  </div>
                </label>
                
                <label className="flex items-center gap-3 bg-white/5 border-2 border-white/10 p-4 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={editingPlan.is_active}
                    onChange={(e) => setEditingPlan({...editingPlan, is_active: e.target.checked})}
                    className="w-5 h-5 accent-red rounded bg-transparent"
                  />
                  <div className="flex flex-col">
                    <span className="font-bold text-white text-sm">Plano Ativo</span>
                    <span className="text-[10px] text-white/50 uppercase tracking-widest">Visível para compras no App</span>
                  </div>
                </label>
              </div>
              
              <div className="p-6 border-t border-white/10 bg-black/40">
                <button 
                  onClick={() => saveMutation.mutate(editingPlan)}
                  disabled={saveMutation.isPending}
                  className="w-full btn-primary flex items-center justify-center gap-2 py-4 text-sm tracking-widest"
                >
                  {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                  Salvar Configurações do Plano
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans?.map((plan: any) => (
            <div key={plan.id} className={`bg-card-gradient p-6 rounded-2xl border-2 transition-all relative group ${plan.is_active ? 'border-red/30 shadow-[0_0_20px_rgba(217,4,41,0.15)] hover:border-red/60 hover:shadow-neon-red' : 'border-white/5 opacity-70 grayscale-[30%]'}`}>
              
              <div className="absolute top-4 right-4 flex gap-2 z-10">
                <button 
                  onClick={() => setEditingPlan(plan)}
                  className="p-2 bg-black/50 text-blue-400 hover:text-white hover:bg-blue-600 rounded-lg transition-all border border-blue-400/30"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => {
                    if(confirm('Tem certeza que deseja apagar este plano? Ação irreversível!')) deleteMutation.mutate(plan.id);
                  }}
                  className="p-2 bg-black/50 text-red-500 hover:text-white hover:bg-red-500 rounded-lg transition-all border border-red-500/30"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="w-14 h-14 rounded-full bg-red/10 flex items-center justify-center mb-6 border border-red/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                <Crown className={`w-7 h-7 ${plan.is_active ? 'text-red' : 'text-white/50'}`} />
              </div>

              <h3 className="text-2xl font-black text-white uppercase tracking-wider mb-2">{plan.name}</h3>
              {plan.description && (
                <p className="text-white/60 text-sm font-medium mb-4 line-clamp-2">{plan.description}</p>
              )}
              
              <div className="flex items-end gap-1 mb-6">
                <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                  R$ {String(plan.price).replace('.', ',')}
                </span>
                <span className="text-sm text-white/40 font-bold mb-1 uppercase tracking-widest">/mês</span>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3 text-white/80 font-medium">
                  <div className="w-8 h-8 rounded-full bg-red/10 border border-red/20 flex items-center justify-center shrink-0">
                    <Zap size={14} className="text-red" />
                  </div>
                  <span><b className="text-white">{plan.credits}</b> {plan.credits === 1 ? 'Check-in incluso' : 'Check-ins inclusos'}</span>
                </div>
                
                <div className="flex items-center gap-3 text-white/80 font-medium">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Crown size={14} className="text-amber-500" />
                  </div>
                  <span>{plan.has_unlimited_priority ? <b className="text-amber-500">Prioridade Ilimitada</b> : <><b className="text-white">{plan.priorities}</b> Prioridades na Fila</>}</span>
                </div>
                
                <div className="flex items-center gap-3 text-white/80 font-medium">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Users size={14} className="text-blue-500" />
                  </div>
                  <span><b className="text-white">{plan.free_guests}</b> Convidados Grátis</span>
                </div>
              </div>
              
              {!plan.is_active && (
                <div className="w-full text-center py-2 bg-black/50 text-white/50 rounded-lg font-black uppercase tracking-widest text-xs border border-white/5">
                  Plano Oculto (Inativo)
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
