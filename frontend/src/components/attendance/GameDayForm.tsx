import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { LocationInputWithPreview } from '@/components/ui/LocationInputWithPreview';

import { attendanceService } from '@/services';
import type { GameDay, PricingType } from '@/types';
import { cn, formatBRL } from '@/lib/utils';
import { ONLINE_PAYMENTS } from '@/lib/features';

const HOLD_OPTIONS: Array<{ value: number | ''; label: string }> = [
  { value: '', label: 'Não expira' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 180, label: '3 horas' },
  { value: 360, label: '6 horas' },
  { value: 720, label: '12 horas' },
  { value: 1440, label: '24 horas' },
];

interface GameDayFormProps {
  onClose: () => void;
  initialData?: GameDay;
}

export function GameDayForm({ onClose, initialData }: GameDayFormProps) {
  const qc = useQueryClient();

  const [newDate, setNewDate] = useState(initialData?.date || '');
  const [newTime, setNewTime] = useState(initialData?.time ? initialData.time.slice(0, 5) : '');
  const [newTimeEnd, setNewTimeEnd] = useState(initialData?.time_end ? initialData.time_end.slice(0, 5) : '');
  const [newLocation, setNewLocation] = useState(initialData?.location || '');
  const [newMaxPlayers, setNewMaxPlayers] = useState<number | ''>(initialData?.max_players || '');
  const [newCourtPrice, setNewCourtPrice] = useState<number | ''>(initialData?.court_price || '');
  const [newCreditCost, setNewCreditCost] = useState<number | ''>(initialData?.credit_cost !== undefined ? Number(initialData.credit_cost) : 0);
  const [newPixKey, setNewPixKey] = useState(initialData?.pix_key || '');
  const [pricingType, setPricingType] = useState<PricingType>(initialData?.pricing_type || 'split');
  const [pricePerPerson, setPricePerPerson] = useState<number | ''>(
    initialData?.price_per_person != null ? Number(initialData.price_per_person) : ''
  );
  const [requiresPrepayment, setRequiresPrepayment] = useState(!!initialData?.requires_prepayment);
  const [holdMinutes, setHoldMinutes] = useState<number | ''>(initialData?.reservation_hold_minutes ?? '');

  const isEvent = pricingType === 'fixed';
  // Mesma regra do backend: quadra ÷ vagas, arredondado para cima no centavo
  const suggestedPrice = !isEvent && newCourtPrice && newMaxPlayers
    ? Math.ceil((Number(newCourtPrice) / Number(newMaxPlayers)) * 100) / 100
    : null;
  const effectivePrice = pricePerPerson !== '' ? pricePerPerson : (suggestedPrice ?? 0);

  const pricingError = isEvent && pricePerPerson === ''
    ? 'Informe a taxa por pessoa do evento.'
    : requiresPrepayment && effectivePrice <= 0
    ? 'Para exigir pagamento, defina o valor por pessoa (ou valor da quadra + limite de vagas).'
    : null;

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        date: newDate,
        time: newTime,
        time_end: newTimeEnd,
        location: newLocation,
        max_players: newMaxPlayers === '' ? 0 : newMaxPlayers, // vazio = ilimitado
        court_price: newCourtPrice === '' ? null : newCourtPrice, // vazio limpa o valor (senão o rateio continua)
        // Sem os planos ninguém tem crédito: um valor escondido no circuito bloquearia o check-in
        credit_cost: ONLINE_PAYMENTS && newCreditCost !== '' ? newCreditCost : 0,
        pix_key: newPixKey.trim(), // vazio limpa a chave (volta a usar a chave do grupo)
        pricing_type: pricingType,
        price_per_person: pricePerPerson === '' ? null : pricePerPerson,
        requires_prepayment: requiresPrepayment,
        reservation_hold_minutes: holdMinutes === '' ? null : holdMinutes,
      };
      
      if (initialData) {
        return attendanceService.updateGameDay(initialData.id, payload);
      }
      return attendanceService.createGameDay(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gamedays'] });
      if (initialData) {
        qc.invalidateQueries({ queryKey: ['gameday', initialData.id] });
      }
      onClose();
      toast.success(initialData ? 'Circuito atualizado com sucesso!' : 'Circuito criado com sucesso!');
    },
    onError: (err: any) => {
      const data = err.response?.data;
      if (data?.date) {
        toast.error('Já existe um circuito cadastrado com esta data!');
      } else if (data?.price_per_person) {
        toast.error(String(data.price_per_person));
      } else {
        toast.error(initialData ? 'Erro ao atualizar o circuito.' : 'Erro ao criar o circuito.');
      }
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5 border-red/20 mb-6"
    >
      <h3 className="font-display text-base tracking-wider text-text-primary mb-4">
        {initialData ? 'EDITAR CIRCUITO' : 'NOVO CIRCUITO'}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <div className="sm:col-span-1">
          <label className="text-text-muted text-xs uppercase tracking-wider">Data *</label>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="input w-full mt-1"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="text-text-muted text-xs uppercase tracking-wider">Hora Início *</label>
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="input w-full mt-1"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="text-text-muted text-xs uppercase tracking-wider">Hora Fim</label>
          <input
            type="time"
            value={newTimeEnd}
            onChange={(e) => setNewTimeEnd(e.target.value)}
            className="input w-full mt-1"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="text-text-muted text-xs uppercase tracking-wider">
            Limite (Jogadores)
          </label>
          <input
            type="number"
            placeholder="Ilimitado"
            value={newMaxPlayers}
            onChange={(e) =>
              setNewMaxPlayers(e.target.value === '' ? '' : Number(e.target.value))
            }
            min={0}
            className="input w-full mt-1"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="text-text-muted text-xs uppercase tracking-wider">Endereço (Mapa) *</label>
          <LocationInputWithPreview
            placeholder="Ex: R. Santos Dumont, Recife"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            className="input mt-1"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="text-text-muted text-xs uppercase tracking-wider">
            {isEvent ? 'Custo do evento (R$)' : 'Valor da Quadra (R$)'}
          </label>
          <input
            type="number"
            step="0.01"
            placeholder={isEvent ? 'Água, material... (opcional)' : 'Ex: 150.00'}
            value={newCourtPrice}
            onChange={(e) =>
              setNewCourtPrice(e.target.value === '' ? '' : Number(e.target.value))
            }
            min={0}
            className="input w-full mt-1"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="text-text-muted text-xs uppercase tracking-wider">
            Chave PIX (Opcional)
          </label>
          <input
            type="text"
            placeholder="Ex: CPF, E-mail ou Telefone"
            value={newPixKey}
            onChange={(e) => setNewPixKey(e.target.value)}
            className="input w-full mt-1"
          />
        </div>
        {/* Créditos só valem com os planos ligados; desligados, o campo some e o valor fica como está (0 por padrão) */}
        {ONLINE_PAYMENTS && (
          <div className="sm:col-span-1">
            <label htmlFor="gameday-credit-cost" className="text-text-muted text-xs uppercase tracking-wider">
              Custo em Créditos
            </label>
            <input
              id="gameday-credit-cost"
              type="number"
              step="0.5"
              placeholder="Ex: 1.0"
              value={newCreditCost}
              onChange={(e) =>
                setNewCreditCost(e.target.value === '' ? '' : Number(e.target.value))
              }
              min={0}
              className="input w-full mt-1"
            />
          </div>
        )}
      </div>

      {/* ── Cobrança ── */}
      <div className="rounded-xl border border-border/60 bg-background/40 p-4 mb-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-text-primary text-sm font-bold uppercase tracking-wider">Cobrança</p>
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-background">
            {([['split', 'Rateio da quadra'], ['fixed', 'Evento (taxa fixa)']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPricingType(value)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-bold transition-colors',
                  pricingType === value ? 'bg-red text-white' : 'text-text-muted hover:text-text-primary'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-text-muted text-xs uppercase tracking-wider">
              {isEvent ? 'Taxa por pessoa (R$) *' : 'Valor por pessoa (R$)'}
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              placeholder={suggestedPrice ? `Sugerido: ${formatBRL(suggestedPrice)}` : isEvent ? 'Ex: 5.00' : 'Quadra ÷ vagas'}
              value={pricePerPerson}
              onChange={(e) => setPricePerPerson(e.target.value === '' ? '' : Number(e.target.value))}
              className="input w-full mt-1"
            />
            <p className="text-[11px] text-text-muted mt-1">
              {isEvent
                ? 'Pode subir ou baixar depois; quem ainda não pagou passa a dever o novo valor.'
                : suggestedPrice
                ? `Vazio = ${formatBRL(suggestedPrice)} (quadra ÷ ${newMaxPlayers} vagas).`
                : 'Vazio = valor da quadra ÷ limite de vagas.'}
            </p>
          </div>

          <div>
            <label className="text-text-muted text-xs uppercase tracking-wider">Prazo para pagar</label>
            <select
              value={holdMinutes}
              onChange={(e) => setHoldMinutes(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={!requiresPrepayment}
              className="input w-full mt-1 disabled:opacity-40"
            >
              {HOLD_OPTIONS.map((o) => (
                <option key={o.label} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-text-muted mt-1">Passou do prazo, a vaga vai para o próximo da fila.</p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none sm:col-span-2 lg:col-span-1 lg:mt-5">
            <input
              type="checkbox"
              checked={requiresPrepayment}
              onChange={(e) => setRequiresPrepayment(e.target.checked)}
              className="mt-1 h-4 w-4 accent-red"
            />
            <span>
              <span className="block text-sm font-bold text-text-primary">Exigir pagamento para confirmar</span>
              <span className="block text-[11px] text-text-muted">
                A vaga fica reservada e só é confirmada quando o pagamento for confirmado.
              </span>
            </span>
          </label>
        </div>

        {effectivePrice > 0 && !pricingError && (
          <p className="text-xs text-text-secondary">
            Cada participante paga <strong className="text-text-primary">{formatBRL(effectivePrice)}</strong>
            {requiresPrepayment ? ' antes de ter a vaga confirmada.' : '.'}
          </p>
        )}
        {pricingError && <p className="text-xs text-red">{pricingError}</p>}
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="btn-secondary text-sm">
          Cancelar
        </button>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!newDate || !newTime || !newLocation || !!pricingError || saveMutation.isPending}
          className="btn-primary text-sm"
        >
          {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </motion.div>
  );
}
