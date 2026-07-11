import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Settings, Save, Loader2, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { PageLoading } from '@/components/ui/Loading';
import { evaluationsService } from '@/services';
import type { EvaluationConfig } from '@/types';
import { useAuth } from '@/store/AuthContext';

const WEIGHT_FIELDS: { key: keyof EvaluationConfig; label: string }[] = [
  { key: 'w_serve', label: 'Saque' },
  { key: 'w_reception', label: 'Recepção' },
  { key: 'w_pass', label: 'Passe' },
  { key: 'w_setting', label: 'Levantamento' },
  { key: 'w_attack', label: 'Ataque' },
  { key: 'w_block', label: 'Bloqueio' },
  { key: 'w_defense', label: 'Defesa' },
  { key: 'w_recovery', label: 'Recuperação de bola' },
  { key: 'w_positioning', label: 'Posicionamento' },
  { key: 'w_communication', label: 'Comunicação' },
  { key: 'w_tactical', label: 'Inteligência tática' },
  { key: 'w_conditioning', label: 'Condicionamento físico' },
  { key: 'w_consistency', label: 'Regularidade' },
];

export function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: configs, isLoading } = useQuery({
    queryKey: ['eval-configs'],
    queryFn: evaluationsService.configs.list,
  });

  const activeConfig = configs?.find((c: EvaluationConfig) => c.is_active);
  const [weights, setWeights] = useState<Record<string, number>>({});

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!activeConfig) return Promise.reject('No active config');
      return evaluationsService.configs.update(activeConfig.id, weights);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eval-configs'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  if (user?.profile !== 'admin') {
    return (
      <div className="card p-8 text-center">
        <Settings size={48} className="text-red mx-auto mb-4 opacity-50" />
        <p className="text-text-muted">Apenas administradores podem acessar as configurações.</p>
      </div>
    );
  }

  if (isLoading) return <PageLoading />;

  const currentWeights = { ...(activeConfig || {}), ...weights } as EvaluationConfig;
  const totalWeight = WEIGHT_FIELDS.reduce((sum, { key }) => sum + (Number(currentWeights[key]) || 0), 0);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="page-title">Configurações</h1>
        <p className="page-subtitle">Configure os pesos dos fundamentos para o cálculo do Overall.</p>
      </div>

      {activeConfig && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-lg text-text-primary tracking-wider">
              PESOS DOS FUNDAMENTOS
            </h2>
            <div className="text-right">
              <p className="text-text-muted text-xs">Total dos pesos</p>
              <p className={`font-display text-xl ${Math.abs(totalWeight - 100) < 1 ? 'text-green-400' : 'text-yellow-400'}`}>
                {totalWeight.toFixed(1)}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {WEIGHT_FIELDS.map(({ key, label }) => {
              const value = Number(currentWeights[key]) || 0;
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <label className="text-text-secondary">{label}</label>
                    <span className="text-text-primary font-bold">{value.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    step={0.5}
                    value={value}
                    onChange={(e) => setWeights(w => ({ ...w, [key]: parseFloat(e.target.value) }))}
                    className="w-full accent-red h-1.5"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 mt-6 justify-end">
            <button
              onClick={() => setWeights({})}
              className="btn-ghost flex items-center gap-2"
            >
              <RotateCcw size={14} />
              Resetar
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              {saveMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : saved ? (
                '✓ Salvo!'
              ) : (
                <Save size={14} />
              )}
              {!saved && 'Salvar configurações'}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
