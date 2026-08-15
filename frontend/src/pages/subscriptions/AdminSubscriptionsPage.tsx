import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Crown, Users, TrendingUp, AlertCircle, Edit, Trash2, CheckCircle2, ShieldAlert, X, Save, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@/lib/api';

export const AdminSubscriptionsPage = () => {
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [editingSub, setEditingSub] = useState<any>(null);

  const { data: plans } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/plans/');
      return res.data.results !== undefined ? res.data.results : res.data;
    }
  });

  const { data: subs, isLoading } = useQuery({
    queryKey: ['admin_subscriptions'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/user-subscriptions/');
      return res.data.results !== undefined ? res.data.results : res.data;
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/subscriptions/user-subscriptions/${id}/`, { status: 'canceled' });
    },
    onSuccess: () => {
      toast.success('Assinatura cancelada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['admin_subscriptions'] });
    },
    onError: () => {
      toast.error('Erro ao cancelar assinatura.');
    },
    onSettled: () => setProcessingId(null)
  });

  const handleCancel = (id: number) => {
    if (window.confirm('Tem certeza que deseja cancelar esta assinatura? (Ela ficará com status Cancelado)')) {
      setProcessingId(id);
      cancelMutation.mutate(id);
    }
  };

  const editMutation = useMutation({
    mutationFn: async (data: any) => {
      await api.patch(`/subscriptions/user-subscriptions/${data.id}/`, data);
    },
    onSuccess: () => {
      toast.success('Assinatura atualizada com sucesso!');
      setEditingSub(null);
      queryClient.invalidateQueries({ queryKey: ['admin_subscriptions'] });
    },
    onError: () => {
      toast.error('Erro ao atualizar assinatura.');
    },
  });

  const handleEdit = (id: number) => {
    const sub = subs?.find((s: any) => s.id === id);
    if (sub) {
      setEditingSub({
        id: sub.id,
        plan_id: sub.plan?.id || '',
        status: sub.status,
        next_billing_date: sub.next_billing_date ? sub.next_billing_date.split('T')[0] : '',
        player_name: sub.player_name || `Atleta #${sub.player}`
      });
    }
  };

  const stats = {
    total: subs?.length || 0,
    active: subs?.filter((s: any) => s.status === 'active').length || 0,
    pending: subs?.filter((s: any) => s.status === 'PENDING_PAYMENT').length || 0,
    mrr: subs?.filter((s: any) => s.status === 'active').reduce((acc: number, curr: any) => acc + Number(curr.plan?.price || 0), 0) || 0
  };

  return (
    <div className="pb-20 bg-background min-h-screen relative animate-fade-in text-text-primary">
      {/* Modal de Edição */}
      {editingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-surface border-2 border-border shadow-[0_0_40px_rgba(217,4,41,0.2)] rounded-2xl w-full max-w-md overflow-hidden animate-slide-in flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-border/50 bg-black/40">
              <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Edit size={20} className="text-blue-500" />
                Editar Assinatura
              </h2>
              <button onClick={() => setEditingSub(null)} className="text-white/50 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-white font-black text-lg">{editingSub.player_name}</p>
              
              <div>
                <label className="block text-xs font-black text-white/60 uppercase tracking-widest mb-1.5 ml-1">Plano</label>
                <select 
                  value={editingSub.plan_id}
                  onChange={(e) => setEditingSub({...editingSub, plan_id: e.target.value})}
                  className="w-full bg-white/5 border-2 border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500/50 focus:bg-white/10 outline-none transition-all appearance-none"
                >
                  <option value="" disabled>Selecione um plano...</option>
                  {plans?.map((p: any) => (
                    <option key={p.id} value={p.id} className="bg-surface">{p.name} - R$ {p.price}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-white/60 uppercase tracking-widest mb-1.5 ml-1">Status</label>
                <select 
                  value={editingSub.status}
                  onChange={(e) => setEditingSub({...editingSub, status: e.target.value})}
                  className="w-full bg-white/5 border-2 border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500/50 focus:bg-white/10 outline-none transition-all appearance-none"
                >
                  <option value="active" className="bg-surface">Ativo</option>
                  <option value="PENDING_PAYMENT" className="bg-surface">Pendente</option>
                  <option value="past_due" className="bg-surface">Atrasado</option>
                  <option value="canceled" className="bg-surface">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-white/60 uppercase tracking-widest mb-1.5 ml-1">Próxima Fatura</label>
                <input 
                  type="date" 
                  value={editingSub.next_billing_date}
                  onChange={(e) => setEditingSub({...editingSub, next_billing_date: e.target.value})}
                  className="w-full bg-white/5 border-2 border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500/50 focus:bg-white/10 outline-none transition-all"
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-border/50 bg-black/40">
              <button 
                onClick={() => editMutation.mutate(editingSub)}
                disabled={editMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 py-4 text-sm transition-colors disabled:opacity-50"
              >
                {editMutation.isPending ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Fixo */}
      <div className="relative border-b border-border/50 p-4 pt-6 sm:p-6 sm:pt-8 sticky top-0 z-20 backdrop-blur-xl bg-background/80 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <h1 className="page-title text-3xl sm:text-4xl text-white">
            <Crown className="text-red w-8 h-8 sm:w-10 sm:h-10 shrink-0" />
            Gestão de Assinaturas
          </h1>
          <p className="text-text-secondary mt-1 text-sm tracking-widest uppercase font-medium">
            Visão geral financeira e controle de planos
          </p>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto relative">
        {/* Glow Effect Top Right */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red/5 rounded-full blur-[120px] pointer-events-none -z-10" />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-surface/40 backdrop-blur-md border border-border/50 p-6 rounded-2xl hover:border-border transition-all hover:shadow-lg">
            <div className="flex items-center justify-between text-text-secondary mb-3 uppercase tracking-wider text-xs font-bold">
              <span>Total Assinantes</span>
              <div className="w-8 h-8 bg-surface border border-border/50 rounded-full flex items-center justify-center">
                <Users size={16} className="text-text-primary" />
              </div>
            </div>
            <span className="text-4xl font-black text-white">{stats.total}</span>
          </div>

          <div className="bg-surface/40 backdrop-blur-md border border-border/50 p-6 rounded-2xl hover:border-emerald-500/30 transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] group">
            <div className="flex items-center justify-between text-emerald-500 mb-3 uppercase tracking-wider text-xs font-bold">
              <span>Ativos</span>
              <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <span className="text-4xl font-black text-emerald-400">{stats.active}</span>
          </div>

          <div className="bg-surface/40 backdrop-blur-md border border-border/50 p-6 rounded-2xl hover:border-orange-500/30 transition-all hover:shadow-[0_0_20px_rgba(249,115,22,0.1)] group">
            <div className="flex items-center justify-between text-orange-500 mb-3 uppercase tracking-wider text-xs font-bold">
              <span>Pendentes</span>
              <div className="w-8 h-8 bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors">
                <AlertCircle size={16} />
              </div>
            </div>
            <span className="text-4xl font-black text-orange-400">{stats.pending}</span>
          </div>

          <div className="bg-gradient-to-br from-red/20 to-surface border border-red/30 p-6 rounded-2xl hover:border-red/50 transition-all hover:shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <div className="flex items-center justify-between text-red mb-3 uppercase tracking-wider text-xs font-bold">
              <span>Receita (MRR)</span>
              <div className="w-8 h-8 bg-red/20 rounded-full flex items-center justify-center text-red">
                <TrendingUp size={16} />
              </div>
            </div>
            <span className="text-4xl font-black text-white">
              R$ {stats.mrr.toFixed(2).replace('.', ',')}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface/50 backdrop-blur-md border border-border/50 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-border/50 flex justify-between items-center bg-surface-highlight/30">
            <h2 className="text-xl font-black text-white uppercase tracking-wide">Lista de Assinantes</h2>
            <div className="text-xs text-text-muted font-mono bg-background px-3 py-1.5 rounded-lg border border-border/50">
              Atualizado em Tempo Real
            </div>
          </div>

          <div className="w-full">
            {/* --- VERSÃO DESKTOP (Tabela) --- */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-background/80 text-text-secondary text-xs uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-5 font-bold">Atleta</th>
                    <th className="px-6 py-5 font-bold">Plano</th>
                    <th className="px-6 py-5 font-bold">Status</th>
                    <th className="px-6 py-5 font-bold">Próxima Fatura</th>
                    <th className="px-6 py-5 font-bold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <div className="w-8 h-8 border-4 border-red border-t-transparent rounded-full animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : subs?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <ShieldAlert size={48} className="text-text-muted mx-auto mb-4 opacity-50" />
                        <p className="text-text-secondary text-lg font-bold uppercase">Nenhuma Assinatura Encontrada</p>
                      </td>
                    </tr>
                  ) : (
                    subs?.map((sub: any) => (
                      <tr key={sub.id} className="hover:bg-surface-highlight/50 transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-background border border-border/50 flex items-center justify-center font-black text-text-muted">
                              {(sub.player_name || 'A')[0]}
                            </div>
                            <span className="font-bold text-white uppercase">{sub.player_name || `Atleta #${sub.player}`}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="bg-surface px-3 py-1.5 rounded-lg text-sm font-bold text-text-primary border border-border/50">
                            {sub.plan?.name || `Plano ID ${sub.plan}`}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          {sub.status === 'active' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Ativo
                            </span>
                          )}
                          {sub.status === 'PENDING_PAYMENT' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20 uppercase tracking-wider">
                              Pendente
                            </span>
                          )}
                          {(sub.status === 'canceled' || sub.status === 'past_due') && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black rounded-md bg-red/10 text-red border border-red/20 uppercase tracking-wider">
                              {sub.status === 'canceled' ? 'Cancelado' : 'Atrasado'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-5 text-sm font-mono text-text-secondary">
                          {sub.next_billing_date ? new Date(sub.next_billing_date).toLocaleDateString('pt-BR') : 'N/A'}
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEdit(sub.id)}
                              className="p-2 bg-surface hover:bg-blue-500/20 text-text-muted hover:text-blue-400 rounded-lg border border-border/50 hover:border-blue-500/30 transition-all"
                              title="Editar Assinatura"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleCancel(sub.id)}
                              disabled={processingId === sub.id}
                              className="p-2 bg-surface hover:bg-red/20 text-text-muted hover:text-red rounded-lg border border-border/50 hover:border-red/30 transition-all disabled:opacity-50"
                              title="Cancelar Assinatura"
                            >
                              {processingId === sub.id ? (
                                <div className="w-4 h-4 border-2 border-red border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* --- VERSÃO MOBILE (Cards) --- */}
            <div className="md:hidden flex flex-col divide-y divide-border/50">
              {isLoading ? (
                <div className="py-12 flex justify-center">
                  <div className="w-8 h-8 border-4 border-red border-t-transparent rounded-full animate-spin" />
                </div>
              ) : subs?.length === 0 ? (
                <div className="py-12 text-center px-4">
                  <ShieldAlert size={40} className="text-text-muted mx-auto mb-3 opacity-50" />
                  <p className="text-text-secondary text-sm font-bold uppercase">Nenhuma Assinatura Encontrada</p>
                </div>
              ) : (
                subs?.map((sub: any) => (
                  <div key={sub.id} className="p-4 flex flex-col gap-4 bg-surface/20 hover:bg-surface-highlight/30 transition-colors">
                    {/* Header: Nome e Status */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-background border border-border/50 flex items-center justify-center font-black text-text-muted flex-shrink-0">
                          {(sub.player_name || 'A')[0]}
                        </div>
                        <span className="font-bold text-white uppercase text-sm">{sub.player_name || `Atleta #${sub.player}`}</span>
                      </div>
                      
                      <div className="flex-shrink-0">
                        {sub.status === 'active' && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-black rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Ativo
                          </span>
                        )}
                        {sub.status === 'PENDING_PAYMENT' && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-black rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20 uppercase tracking-wider">
                            Pendente
                          </span>
                        )}
                        {(sub.status === 'canceled' || sub.status === 'past_due') && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-black rounded-md bg-red/10 text-red border border-red/20 uppercase tracking-wider">
                            {sub.status === 'canceled' ? 'Cancelado' : 'Atrasado'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Detalhes: Plano e Fatura */}
                    <div className="grid grid-cols-2 gap-4 bg-background/50 p-3 rounded-xl border border-border/50">
                      <div>
                        <p className="text-[9px] text-text-muted uppercase font-bold tracking-widest mb-1">Plano</p>
                        <span className="bg-surface px-2 py-1 rounded text-xs font-bold text-text-primary border border-border/50">
                          {sub.plan?.name || `Plano ID ${sub.plan}`}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-text-muted uppercase font-bold tracking-widest mb-1">Próxima Fatura</p>
                        <span className="text-xs font-mono text-text-secondary">
                          {sub.next_billing_date ? new Date(sub.next_billing_date).toLocaleDateString('pt-BR') : 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
                      <button
                        onClick={() => handleEdit(sub.id)}
                        className="btn-secondary py-1.5 px-4 text-xs h-auto"
                      >
                        <Edit size={14} className="mr-1.5 inline" /> Editar
                      </button>
                      <button
                        onClick={() => handleCancel(sub.id)}
                        disabled={processingId === sub.id}
                        className="btn-secondary py-1.5 px-4 text-xs h-auto border-red/30 text-red hover:bg-red/10"
                      >
                        {processingId === sub.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-red border-t-transparent rounded-full animate-spin inline-block align-middle" />
                        ) : (
                          <><Trash2 size={14} className="mr-1.5 inline" /> Cancelar</>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
