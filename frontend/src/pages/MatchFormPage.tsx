import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Trophy, Users, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { matchesService, attendanceService, teamsService } from '@/services';
import { playersService } from '@/services/players';
import { PageLoading } from '@/components/ui/Loading';
import { Avatar } from '@/components/ui/Avatar';
import { PositionBadge } from '@/components/ui/Badges';
import { cn, formatDate } from '@/lib/utils';
import type { Player } from '@/types';

const schema = z.object({
  date: z.string().min(1, 'Data é obrigatória'),
  location: z.string().optional(),
  modality: z.coerce.number(),
  gameday: z.coerce.number().optional().nullable(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type TeamState = {
  name: string;
  color_hex: string;
  score: number;
  playerIds: number[];
};

export function MatchFormPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [teamA, setTeamA] = useState<TeamState>({ name: 'Time Vermelho', color_hex: '#D90429', score: 0, playerIds: [] });
  const [teamB, setTeamB] = useState<TeamState>({ name: 'Time Azul', color_hex: '#2563EB', score: 0, playerIds: [] });
  const [mvpId, setMvpId] = useState<number | null>(null);
  const [playerSearch, setPlayerSearch] = useState('');

  // Queries
  const { data: playersData, isLoading: loadingPlayers } = useQuery({
    queryKey: ['players-active'],
    queryFn: () => playersService.list({ status: 'active', page_size: 200 }),
  });

  const { data: gamedaysData } = useQuery({
    queryKey: ['gamedays'],
    queryFn: () => attendanceService.listGameDays(),
  });

  const { data: generationsData } = useQuery({
    queryKey: ['team-generations'],
    queryFn: () => teamsService.list(),
  });

  const handleImportTeam = (teamIdStr: string, side: 'A' | 'B') => {
    if (!teamIdStr) return;
    const teamId = Number(teamIdStr);
    const generations = generationsData?.results || [];
    const generation = generations.find(g => g.teams.some(t => t.id === teamId));
    if (!generation) return;
    
    const dbTeam = generation.teams.find(t => t.id === teamId);
    if (!dbTeam) return;

    const playerIds = dbTeam.team_players.map(tp => tp.player);

    if (side === 'A') {
      setTeamA(prev => ({ ...prev, name: dbTeam.name, color_hex: dbTeam.color_hex, playerIds }));
    } else {
      setTeamB(prev => ({ ...prev, name: dbTeam.name, color_hex: dbTeam.color_hex, playerIds }));
    }
  };

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      modality: 6,
    },
  });

  const modality = watch('modality');

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (teamA.playerIds.length === 0 && teamB.playerIds.length === 0) {
        throw new Error('Você precisa adicionar jogadores aos times!');
      }

      // 1. Create match
      const match = await matchesService.create({
        date: data.date,
        location: data.location || undefined,
        modality: data.modality,
        gameday: data.gameday || undefined,
        notes: data.notes || undefined,
      });

      // 2. Add result
      await matchesService.addResult(match.id, [
        {
          team_name: teamA.name,
          color_hex: teamA.color_hex,
          score: teamA.score,
          player_ids: teamA.playerIds,
          mvp_ids: mvpId && teamA.playerIds.includes(mvpId) ? [mvpId] : [],
        },
        {
          team_name: teamB.name,
          color_hex: teamB.color_hex,
          score: teamB.score,
          player_ids: teamB.playerIds,
          mvp_ids: mvpId && teamB.playerIds.includes(mvpId) ? [mvpId] : [],
        }
      ]);

      return match;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matches'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['player-stats'] });
      toast.success('Partida registrada com sucesso!');
      navigate('/matches');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao salvar a partida.');
    },
  });

  if (loadingPlayers) return <PageLoading />;

  const players = playersData?.results || [];
  const gamedays = gamedaysData?.results || [];
  const generations = generationsData?.results || [];

  const availablePlayers = players
    .filter(p => !teamA.playerIds.includes(p.id) && !teamB.playerIds.includes(p.id))
    .filter(p => p.display_name.toLowerCase().includes(playerSearch.toLowerCase()) || p.name.toLowerCase().includes(playerSearch.toLowerCase()));

  const teamAPlayers = players.filter(p => teamA.playerIds.includes(p.id));
  const teamBPlayers = players.filter(p => teamB.playerIds.includes(p.id));

  const toggleMvp = (id: number) => {
    setMvpId(prev => prev === id ? null : id);
  };

  const moveToTeam = (playerId: number, team: 'A' | 'B') => {
    if (team === 'A') {
      if (teamA.playerIds.length >= modality) {
        toast.error(`O time já atingiu o limite de ${modality} jogadores!`);
        return;
      }
      setTeamA(prev => ({ ...prev, playerIds: [...prev.playerIds, playerId] }));
    } else {
      if (teamB.playerIds.length >= modality) {
        toast.error(`O time já atingiu o limite de ${modality} jogadores!`);
        return;
      }
      setTeamB(prev => ({ ...prev, playerIds: [...prev.playerIds, playerId] }));
    }
  };

  const removeFromTeam = (playerId: number, team: 'A' | 'B') => {
    if (mvpId === playerId) setMvpId(null);
    if (team === 'A') {
      setTeamA(prev => ({ ...prev, playerIds: prev.playerIds.filter(id => id !== playerId) }));
    } else {
      setTeamB(prev => ({ ...prev, playerIds: prev.playerIds.filter(id => id !== playerId) }));
    }
  };

  const renderPlayer = (player: Player, team: 'A' | 'B' | null) => (
    <div key={player.id} className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/50 hover:border-border transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Avatar name={player.display_name} src={player.avatar_url} size="sm" />
        <div className="min-w-0">
          <p className="text-text-primary text-sm font-medium truncate flex items-center gap-2">
            {player.display_name}
            {mvpId === player.id && <Star size={12} className="text-yellow-500 fill-yellow-500" />}
          </p>
          <PositionBadge position={player.main_position} />
        </div>
      </div>
      
      <div className="flex items-center gap-1 flex-shrink-0">
        {team ? (
          <>
            <button
              type="button"
              onClick={() => toggleMvp(player.id)}
              className={cn("p-1.5 rounded-md transition-colors", mvpId === player.id ? "bg-yellow-500/20 text-yellow-500" : "text-text-muted hover:text-yellow-500 hover:bg-yellow-500/10")}
              title="Marcar como MVP"
            >
              <Star size={14} className={mvpId === player.id ? "fill-yellow-500" : ""} />
            </button>
            <button
              type="button"
              onClick={() => removeFromTeam(player.id, team)}
              className="p-1.5 text-text-muted hover:text-red hover:bg-red/10 rounded-md transition-colors text-xs"
            >
              Remover
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => moveToTeam(player.id, 'A')}
              className="px-2 py-1 bg-red/10 text-red border border-red/30 rounded-md text-xs font-medium hover:bg-red hover:text-white transition-colors"
            >
              + Time A
            </button>
            <button
              type="button"
              onClick={() => moveToTeam(player.id, 'B')}
              className="px-2 py-1 bg-blue/10 text-blue border border-blue/30 rounded-md text-xs font-medium hover:bg-blue hover:text-white transition-colors"
            >
              + Time B
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <Link to="/matches" className="btn-ghost inline-flex items-center gap-2 -mb-2">
        <ArrowLeft size={16} />
        Voltar
      </Link>

      <div>
        <h1 className="page-title">Registrar Nova Partida</h1>
        <p className="page-subtitle">Preencha os detalhes e escale os times para registrar o resultado.</p>
      </div>

      <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-6">
        {/* Detalhes da Partida */}
        <div className="card p-6">
          <h2 className="font-display text-base text-text-primary tracking-wider mb-4 uppercase flex items-center gap-2">
            <Trophy size={18} className="text-red" />
            1. Detalhes da Partida
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-text-secondary text-sm font-medium mb-1.5">Data *</label>
              <input type="date" {...register('date')} className={cn('input w-full', errors.date && 'border-red/50')} />
            </div>
            <div>
              <label className="block text-text-secondary text-sm font-medium mb-1.5">Local</label>
              <input type="text" {...register('location')} placeholder="Ex: Quadra 1" className="input w-full" />
            </div>
            <div>
              <label className="block text-text-secondary text-sm font-medium mb-1.5">Modalidade *</label>
              <select {...register('modality')} className="input w-full">
                <option value={2}>Dupla (2x2)</option>
                <option value={3}>Trio (3x3)</option>
                <option value={4}>Quarteto (4x4)</option>
                <option value={5}>Quinteto (5x5)</option>
                <option value={6}>Sexteto (6x6)</option>
              </select>
            </div>
            <div>
              <label className="block text-text-secondary text-sm font-medium mb-1.5">Dia de Jogo (Opcional)</label>
              <select {...register('gameday')} className="input w-full">
                <option value="">Nenhum</option>
                {gamedays.map(gd => (
                  <option key={gd.id} value={gd.id}>{gd.date} {gd.location ? `- ${gd.location}` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-text-secondary text-sm font-medium mb-1.5">Observações (Opcional)</label>
            <input type="text" {...register('notes')} placeholder="Ex: Final do campeonato, partida amistosa..." className="input w-full" />
          </div>
        </div>

        {/* Times e Placar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Time A */}
          <div className="card p-6 relative overflow-hidden border-t-2 border-red flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red/5 rounded-bl-full -z-10" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base text-text-primary tracking-wider uppercase">
                Time A
              </h2>
              <select 
                onChange={(e) => handleImportTeam(e.target.value, 'A')}
                className="input py-1 px-2 text-xs bg-surface border-border-subtle"
              >
                <option value="">Importar Gerador...</option>
                {generations.map(g => (
                  <optgroup 
                    key={g.id} 
                    label={g.gameday 
                      ? `${formatDate(g.gameday_date || '')} ${g.gameday_location ? `(${g.gameday_location})` : ''}` 
                      : `Avulso (${formatDate(g.created_at)})`}
                  >
                    {g.teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.avg_overall.toFixed(1)})</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-text-secondary text-xs font-medium mb-1">Nome do Time</label>
                <input 
                  type="text" 
                  value={teamA.name} 
                  onChange={e => setTeamA(prev => ({ ...prev, name: e.target.value }))}
                  className="input w-full bg-background" 
                />
              </div>
              <div className="w-24">
                <label className="block text-text-secondary text-xs font-medium mb-1">Pontos</label>
                <input 
                  type="number" 
                  min="0"
                  value={teamA.score} 
                  onChange={e => setTeamA(prev => ({ ...prev, score: Number(e.target.value) }))}
                  className="input w-full font-display text-xl text-center text-red bg-background" 
                />
              </div>
            </div>

            <div className="space-y-2 min-h-[150px] flex-1">
              <div className="flex items-center justify-between text-xs text-text-muted uppercase tracking-wider mb-2">
                <span>Jogadores ({teamA.playerIds.length}/{modality})</span>
              </div>
              {teamAPlayers.length === 0 ? (
                <div className="text-center py-6 text-text-muted text-sm bg-background/50 rounded-lg border border-dashed border-border h-full flex items-center justify-center">
                  Nenhum jogador selecionado
                </div>
              ) : (
                teamAPlayers.map(p => renderPlayer(p, 'A'))
              )}
            </div>
          </div>

          {/* Time B */}
          <div className="card p-6 relative overflow-hidden border-t-2 border-blue flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue/5 rounded-bl-full -z-10" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base text-text-primary tracking-wider uppercase">
                Time B
              </h2>
              <select 
                onChange={(e) => handleImportTeam(e.target.value, 'B')}
                className="input py-1 px-2 text-xs bg-surface border-border-subtle"
              >
                <option value="">Importar Gerador...</option>
                {generations.map(g => (
                  <optgroup 
                    key={g.id} 
                    label={g.gameday 
                      ? `${formatDate(g.gameday_date || '')} ${g.gameday_location ? `(${g.gameday_location})` : ''}` 
                      : `Avulso (${formatDate(g.created_at)})`}
                  >
                    {g.teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.avg_overall.toFixed(1)})</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-text-secondary text-xs font-medium mb-1">Nome do Time</label>
                <input 
                  type="text" 
                  value={teamB.name} 
                  onChange={e => setTeamB(prev => ({ ...prev, name: e.target.value }))}
                  className="input w-full bg-background" 
                />
              </div>
              <div className="w-24">
                <label className="block text-text-secondary text-xs font-medium mb-1">Pontos</label>
                <input 
                  type="number" 
                  min="0"
                  value={teamB.score} 
                  onChange={e => setTeamB(prev => ({ ...prev, score: Number(e.target.value) }))}
                  className="input w-full font-display text-xl text-center text-blue bg-background" 
                />
              </div>
            </div>

            <div className="space-y-2 min-h-[150px] flex-1">
              <div className="flex items-center justify-between text-xs text-text-muted uppercase tracking-wider mb-2">
                <span>Jogadores ({teamB.playerIds.length}/{modality})</span>
              </div>
              {teamBPlayers.length === 0 ? (
                <div className="text-center py-6 text-text-muted text-sm bg-background/50 rounded-lg border border-dashed border-border h-full flex items-center justify-center">
                  Nenhum jogador selecionado
                </div>
              ) : (
                teamBPlayers.map(p => renderPlayer(p, 'B'))
              )}
            </div>
          </div>
        </div>

        {/* Seleção de Jogadores */}
        <div className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="font-display text-base text-text-primary tracking-wider uppercase flex items-center gap-2">
              <Users size={18} className="text-text-muted" />
              Elenco Disponível
            </h2>
            <input
              type="text"
              placeholder="Buscar jogador..."
              value={playerSearch}
              onChange={e => setPlayerSearch(e.target.value)}
              className="input w-full sm:w-64 py-1.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {availablePlayers.length === 0 ? (
              <div className="col-span-full text-center py-8 text-text-muted">
                Nenhum jogador disponível encontrado.
              </div>
            ) : (
              availablePlayers.map(p => renderPlayer(p, null))
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 justify-end sticky bottom-6 z-10 bg-background/80 backdrop-blur-sm p-4 rounded-xl border border-border shadow-2xl">
          <Link to="/matches" className="btn-secondary">Cancelar</Link>
          <button type="submit" disabled={createMutation.isPending} className="btn-primary flex items-center gap-2">
            {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Salvar Resultado da Partida
          </button>
        </div>
      </form>
    </div>
  );
}
