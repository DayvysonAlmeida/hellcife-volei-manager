import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, X, Plus, Star, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { Avatar } from '@/components/ui/Avatar';
import { GuestLevelSelect } from '@/components/attendance/GuestLevelSelect';
import { DEFAULT_GUEST_LEVEL } from '@/lib/guestLevel';
import { PositionBadge } from '@/components/ui/Badges';
import { playersService } from '@/services/players';
import { attendanceService } from '@/services';
import type { Position, Attendance, Player } from '@/types';
import { useAuth } from '@/store/AuthContext';

interface GuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameDayId: number;
  presentAttendances: Attendance[];
  absentAttendances: Attendance[];
  waitlistAttendances?: Attendance[];
  setConfirmDialog: (dialog: any) => void;
}

export function GuestModal({
  isOpen,
  onClose,
  gameDayId,
  presentAttendances,
  waitlistAttendances,
  setConfirmDialog,
}: GuestModalProps) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [guestTab, setGuestTab] = useState<'list' | 'new'>('list');
  const [guestName, setGuestName] = useState('');
  const [guestPosition, setGuestPosition] = useState<Position>('outside');
  const [guestGender, setGuestGender] = useState<'M' | 'F'>('M');
  const [guestInvitedBy, setGuestInvitedBy] = useState(user?.name || '');
  const [guestLevel, setGuestLevel] = useState<number>(DEFAULT_GUEST_LEVEL);

  // Buscar convidados salvos
  const { data: guestsData, isLoading: loadingGuests } = useQuery({
    queryKey: ['guests'],
    queryFn: () => playersService.list({ is_guest: 'true', page_size: 100 }),
    enabled: isOpen,
  });
  const existingGuests = guestsData?.results || [];

  // Mutations
  const addGuestMutation = useMutation({
    mutationFn: (data: { name: string; main_position: Position; invited_by: string; gender: 'M' | 'F'; guest_overall: number }) =>
      attendanceService.addGuest(gameDayId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gameday', gameDayId] });
      qc.invalidateQueries({ queryKey: ['gamedays'] });
      qc.invalidateQueries({ queryKey: ['guests'] });
      onClose();
      setGuestName('');
      setGuestLevel(DEFAULT_GUEST_LEVEL);
      toast.success('Convidado adicionado à pelada!');
    },
    onError: (error: any) => {
      const msg = error.response?.data?.detail || 'Erro ao adicionar convidado.';
      toast.error(msg);
    },
  });

  const deletePlayerMutation = useMutation({
    mutationFn: (id: number) => playersService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      qc.invalidateQueries({ queryKey: ['gameday', gameDayId] });
      qc.invalidateQueries({ queryKey: ['gamedays'] });
      toast.success('Convidado excluído com sucesso!');
    },
  });

  const promotePlayerMutation = useMutation({
    mutationFn: (id: number) => playersService.update(id, { is_guest: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      qc.invalidateQueries({ queryKey: ['players'] });
      toast.success('Convidado promovido a atleta oficial!');
    },
  });

  // Corrige o nível do convidado (vale no próximo sorteio)
  const updateLevelMutation = useMutation({
    mutationFn: ({ id, level }: { id: number; level: number }) => playersService.update(id, { guest_overall: level }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      qc.invalidateQueries({ queryKey: ['gameday', gameDayId] });
      toast.success('Nível do convidado atualizado.');
    },
    onError: () => toast.error('Não foi possível mudar o nível. Tente de novo.'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ gamedayId, playerId }: { gamedayId: number; playerId: number }) =>
      attendanceService.toggleAttendance(gamedayId, playerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gameday', gameDayId] });
      qc.invalidateQueries({ queryKey: ['gamedays'] });
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card max-w-md w-full p-6 shadow-xl flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display text-text-primary flex items-center gap-2">
            <Users className="text-red" />
            Gerenciar Convidados
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-4">
          <button
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              guestTab === 'list'
                ? 'border-red text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
            onClick={() => setGuestTab('list')}
          >
            Selecionar Existente
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              guestTab === 'new'
                ? 'border-red text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
            onClick={() => setGuestTab('new')}
          >
            Novo Convidado
          </button>
        </div>

        {guestTab === 'new' && (
          <div className="space-y-4 overflow-y-auto pr-2">
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wider block mb-1">
                Nome do Convidado *
              </label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="input w-full"
                placeholder="Ex: João Silva"
              />
            </div>

            <div>
              <label className="text-text-muted text-xs uppercase tracking-wider block mb-1">
                Posição Principal *
              </label>
              <select
                value={guestPosition}
                onChange={(e) => setGuestPosition(e.target.value as Position)}
                className="input w-full"
              >
                <option value="outside">Ponteiro</option>
                <option value="setter">Levantador</option>
                <option value="middle">Central</option>
                <option value="opposite">Oposto</option>
                <option value="libero">Líbero</option>
                <option value="universal">Universal</option>
              </select>
            </div>

            <div>
              <label htmlFor="guest-level" className="text-text-muted text-xs uppercase tracking-wider block mb-1">
                Nível do convidado *
              </label>
              <GuestLevelSelect id="guest-level" value={guestLevel} onChange={setGuestLevel} className="input w-full" />
              <p className="text-[11px] text-text-muted mt-1">
                Avaliação temporária para o sorteio. Quando ele for avaliado, passa a valer a avaliação.
              </p>
            </div>

            <div>
              <label className="text-text-muted text-xs uppercase tracking-wider block mb-1">
                Gênero *
              </label>
              <select
                value={guestGender}
                onChange={(e) => setGuestGender(e.target.value as 'M' | 'F')}
                className="input w-full"
              >
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
            </div>

            <div>
              <label className="text-text-muted text-xs uppercase tracking-wider block mb-1">
                Convidado por
              </label>
              <input
                type="text"
                value={guestInvitedBy}
                onChange={(e) => setGuestInvitedBy(e.target.value)}
                className="input w-full"
                placeholder="Seu nome"
              />
            </div>

            <div className="flex justify-end pt-4 mt-2 border-t border-border">
              <button
                onClick={() =>
                  addGuestMutation.mutate({
                    name: guestName,
                    main_position: guestPosition,
                    invited_by: guestInvitedBy,
                    gender: guestGender,
                    guest_overall: guestLevel,
                  })
                }
                disabled={!guestName || addGuestMutation.isPending}
                className="btn-primary"
              >
                {addGuestMutation.isPending ? 'Adicionando...' : 'Adicionar à Pelada'}
              </button>
            </div>
          </div>
        )}

        {guestTab === 'list' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {loadingGuests ? (
              <div className="py-8 text-center text-text-muted animate-pulse">
                Carregando convidados...
              </div>
            ) : existingGuests.length === 0 ? (
              <div className="py-12 text-center text-text-muted">
                <p>Nenhum convidado salvo no histórico.</p>
                <button
                  onClick={() => setGuestTab('new')}
                  className="mt-4 text-red hover:underline text-sm font-bold"
                >
                  Cadastrar o primeiro convidado
                </button>
              </div>
            ) : (() => {
              const inGame = (guest: Player) =>
                presentAttendances.some((a) => a.player === guest.id) || !!waitlistAttendances?.some((a) => a.player === guest.id);
              const availableGuests = existingGuests.filter((guest: Player) => !inGame(guest));
              const todayGuests = existingGuests.filter(inGame);
              const levelSelect = (guest: Player, className: string) => (
                <GuestLevelSelect
                  value={guest.guest_overall ?? null}
                  onChange={(level) => updateLevelMutation.mutate({ id: guest.id, level })}
                  className={className}
                  ariaLabel={`Nível de ${guest.name}`}
                />
              );

              // Convidados que já estão neste circuito: dá para corrigir o nível antes do sorteio
              const today = todayGuests.length > 0 && (
                <div className="rounded-xl border border-border p-3 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Neste circuito · nível para o sorteio (sem nível = 5)</p>
                  {todayGuests.map((guest: Player) => (
                    <div key={guest.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                      <span className="text-sm font-bold text-text-primary truncate">{guest.name}</span>
                      {levelSelect(guest, 'input py-1 text-xs w-full sm:w-44 sm:shrink-0')}
                    </div>
                  ))}
                </div>
              );

              if (availableGuests.length === 0) {
                return (
                  <div className="space-y-2 overflow-y-auto pr-2 pb-2">
                    {today}
                    <div className="py-12 text-center text-text-muted">
                      <p>Todos os convidados salvos já estão neste circuito.</p>
                    </div>
                  </div>
                );
              }

              return (
                <div className="space-y-2 overflow-y-auto pr-2 pb-2">
                  {today}
                  {availableGuests.map((guest: Player) => (
                    <div
                      key={guest.id}
                      className="flex items-center justify-between bg-surface/50 p-3 rounded-xl border border-border"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar name={guest.name} src={guest.avatar_url} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-text-primary truncate">{guest.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <PositionBadge position={guest.main_position} />
                            {guest.invited_by && (
                              <span className="text-[9px] text-text-muted uppercase truncate max-w-[80px]">
                                Por: {guest.invited_by}
                              </span>
                            )}
                          </div>
                          {levelSelect(guest, 'input py-1 text-xs w-full max-w-44 mt-1.5')}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              isOpen: true,
                              title: 'Promover a Oficial',
                              desc: `Deseja transformar ${guest.name} em um Atleta Oficial? Ele passará a aparecer nas estatísticas principais e ranking do Dashboard.`,
                              onConfirm: () => promotePlayerMutation.mutate(guest.id),
                            });
                          }}
                          disabled={promotePlayerMutation.isPending}
                          className="p-1.5 text-yellow-500 hover:bg-yellow-500/10 rounded-md transition-colors"
                          title="Promover a Oficial"
                        >
                          <Star size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setConfirmDialog({
                              isOpen: true,
                              title: 'Excluir Convidado',
                              desc: `Tem certeza que deseja apagar o convidado ${guest.name} do sistema? (Isso removerá ele do histórico de jogos)`,
                              onConfirm: () => deletePlayerMutation.mutate(guest.id),
                            });
                          }}
                          disabled={deletePlayerMutation.isPending}
                          className="p-1.5 text-text-muted hover:text-red hover:bg-red/10 rounded-md transition-colors"
                          title="Excluir Convidado"
                        >
                          <Trash2 size={16} />
                        </button>

                        <button
                          onClick={() => {
                            toggleMutation.mutate({ gamedayId: gameDayId, playerId: guest.id });
                            toast.success(`${guest.name} adicionado à pelada!`);
                          }}
                          disabled={toggleMutation.isPending}
                          className="p-1.5 rounded-md transition-colors flex items-center gap-1 px-2 text-xs font-bold bg-red text-white hover:bg-red-500 shadow-md shadow-red/20"
                          title="Adicionar à pelada atual"
                        >
                          <Plus size={14} />
                          <span className="hidden sm:inline">Add</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </motion.div>
    </div>
  );
}
