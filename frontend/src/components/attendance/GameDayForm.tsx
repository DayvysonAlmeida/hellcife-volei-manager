import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { attendanceService } from '@/services';
import type { GameDay } from '@/types';

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

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        date: newDate,
        time: newTime,
        time_end: newTimeEnd,
        location: newLocation,
        max_players: newMaxPlayers === '' ? undefined : newMaxPlayers,
        court_price: newCourtPrice === '' ? undefined : newCourtPrice,
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
      if (err.response?.data?.date) {
        toast.error('Já existe um circuito cadastrado com esta data!');
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
          <label className="text-text-muted text-xs uppercase tracking-wider">Local *</label>
          <input
            placeholder="Ex: Quadra HellCife"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            className="input w-full mt-1"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="text-text-muted text-xs uppercase tracking-wider">
            Valor da Quadra (R$)
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="Ex: 150.00"
            value={newCourtPrice}
            onChange={(e) =>
              setNewCourtPrice(e.target.value === '' ? '' : Number(e.target.value))
            }
            min={0}
            className="input w-full mt-1"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="btn-secondary text-sm">
          Cancelar
        </button>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!newDate || !newTime || !newLocation || saveMutation.isPending}
          className="btn-primary text-sm"
        >
          {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </motion.div>
  );
}
