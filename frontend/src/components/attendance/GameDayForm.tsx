import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { attendanceService } from '@/services';

interface GameDayFormProps {
  onClose: () => void;
}

export function GameDayForm({ onClose }: GameDayFormProps) {
  const qc = useQueryClient();

  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('19:30');
  const [newLocation, setNewLocation] = useState('');
  const [newMaxPlayers, setNewMaxPlayers] = useState<number | ''>('');

  const createMutation = useMutation({
    mutationFn: () =>
      attendanceService.createGameDay({
        date: newDate,
        time: newTime,
        location: newLocation,
        max_players: newMaxPlayers === '' ? undefined : newMaxPlayers,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gamedays'] });
      onClose();
      toast.success('Lista de pelada criada com sucesso!');
    },
    onError: (err: any) => {
      if (err.response?.data?.date) {
        toast.error('Já existe uma pelada cadastrada com esta data!');
      } else {
        toast.error('Erro ao criar a lista de pelada.');
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
        NOVO DIA DE JOGO
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
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
          <label className="text-text-muted text-xs uppercase tracking-wider">Hora</label>
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
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
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="btn-secondary text-sm">
          Cancelar
        </button>
        <button
          onClick={() => createMutation.mutate()}
          disabled={!newDate || !newLocation || createMutation.isPending}
          className="btn-primary text-sm"
        >
          Criar dia de jogo
        </button>
      </div>
    </motion.div>
  );
}
