import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Plus, Calendar, MapPin, Trophy, Star, Zap, Shield, ChevronDown, Users, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageLoading, EmptyState } from '@/components/ui/Loading';
import { Avatar } from '@/components/ui/Avatar';
import { matchesService } from '@/services';
import { formatDate } from '@/lib/utils';
import { MODALITY_LABELS } from '@/types';
import type { Modality, Match, MatchPlayer } from '@/types';
import { useAuth } from '@/store/AuthContext';

export function MatchesPage() {
  const { user } = useAuth();
  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: () => matchesService.list(),
  });

  const matches = data?.results || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Partidas</h1>
          <p className="page-subtitle">Histórico de partidas e resultados.</p>
        </div>
        {canEdit && (
          <Link to="/matches/new" className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            Nova partida
          </Link>
        )}
      </div>

      {isLoading ? (
        <PageLoading />
      ) : matches.length === 0 ? (
        <EmptyState message="Nenhuma partida registrada ainda." icon="🏐" />
      ) : (
        <div className="space-y-4">
          {matches.map((match: Match, idx: number) => (
            <MatchCard
              key={match.id}
              match={match}
              idx={idx}
              expanded={expandedId === match.id}
              onToggle={() => setExpandedId(expandedId === match.id ? null : match.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchCard({ match, idx, expanded, onToggle }: {
  match: Match;
  idx: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const teams = match.match_teams || [];
  const teamA = teams[0];
  const teamB = teams[1];

  // Busca destaques globais da partida
  const allPlayers: MatchPlayer[] = teams.flatMap((t: any) => t.match_players || []);
  const mvp = allPlayers.find(p => p.mvp);
  const bestAttacker = allPlayers.find(p => p.best_attacker);
  const bestServer = allPlayers.find(p => p.best_server);
  const bestDefender = allPlayers.find(p => p.best_defender);

  const hasDestaques = mvp || bestAttacker || bestServer || bestDefender;
  const hasPlayers = allPlayers.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
      className="card overflow-hidden"
    >
      {/* Header do card */}
      <div className="p-4 sm:p-5">
        {/* Linha de meta-info */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4">
          <span className="font-display text-sm text-text-primary tracking-wider">
            {MODALITY_LABELS[match.modality as Modality]}
          </span>
          <div className="flex items-center gap-1 text-text-muted text-xs">
            <Calendar size={11} />
            {formatDate(match.date)}
          </div>
          {match.location && (
            <div className="flex items-center gap-1 text-text-muted text-xs">
              <MapPin size={11} />
              {match.location}
            </div>
          )}
        </div>

        {/* Placar — Duelo visual */}
        {teams.length >= 2 && teamA && teamB ? (
          <div className="flex items-center gap-3">
            {/* Time A */}
            <div className={`flex-1 rounded-xl p-3 sm:p-4 border transition-all ${teamA.winner ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-surface border-border'}`}>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: teamA.color_hex || '#D90429' }}
                />
                <span className={`font-medium text-sm truncate ${teamA.winner ? 'text-yellow-400' : 'text-text-primary'}`}>
                  {teamA.team_name}
                </span>
                {teamA.winner && <Trophy size={13} className="text-yellow-500 flex-shrink-0" />}
              </div>
              <p className={`font-display text-4xl font-bold ${teamA.winner ? 'text-yellow-400' : 'text-text-muted'}`}>
                {teamA.score}
              </p>
              {/* Avatares do time A */}
              {(teamA as any).match_players?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {(teamA as any).match_players.map((mp: any) => (
                    <div key={mp.id} className="relative" title={mp.player_name}>
                      <Avatar
                        name={mp.player_name}
                        src={mp.player_avatar}
                        size="sm"
                        className="ring-1 ring-border"
                      />
                      {mp.mvp && (
                        <Star size={8} className="absolute -top-0.5 -right-0.5 text-yellow-500 fill-yellow-500 bg-background rounded-full" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* VS */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <span className="font-display text-xs text-text-muted tracking-widest">VS</span>
              <Swords size={18} className="text-border" />
            </div>

            {/* Time B */}
            <div className={`flex-1 rounded-xl p-3 sm:p-4 border transition-all ${teamB.winner ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-surface border-border'}`}>
              <div className="flex items-center gap-2 mb-2 flex-row-reverse">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: teamB.color_hex || '#2563EB' }}
                />
                <span className={`font-medium text-sm truncate text-right ${teamB.winner ? 'text-yellow-400' : 'text-text-primary'}`}>
                  {teamB.team_name}
                </span>
                {teamB.winner && <Trophy size={13} className="text-yellow-500 flex-shrink-0" />}
              </div>
              <p className={`font-display text-4xl font-bold text-right ${teamB.winner ? 'text-yellow-400' : 'text-text-muted'}`}>
                {teamB.score}
              </p>
              {/* Avatares do time B */}
              {(teamB as any).match_players?.length > 0 && (
                <div className="flex flex-wrap justify-end gap-1 mt-3">
                  {(teamB as any).match_players.map((mp: any) => (
                    <div key={mp.id} className="relative" title={mp.player_name}>
                      <Avatar
                        name={mp.player_name}
                        src={mp.player_avatar}
                        size="sm"
                        className="ring-1 ring-border"
                      />
                      {mp.mvp && (
                        <Star size={8} className="absolute -top-0.5 -right-0.5 text-yellow-500 fill-yellow-500 bg-background rounded-full" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : teams.length > 0 ? (
          /* fallback para partidas com número diferente de times */
          <div className="bg-surface rounded-lg p-3 space-y-2">
            {teams.map((team: any) => (
              <div key={team.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {team.winner && <Trophy size={13} className="text-yellow-500" />}
                  <span className={`text-sm font-medium ${team.winner ? 'text-yellow-500' : 'text-text-primary'}`}>{team.team_name}</span>
                </div>
                <span className={`font-display text-lg ${team.winner ? 'text-yellow-500 font-bold' : 'text-text-muted'}`}>{team.score}</span>
              </div>
            ))}
          </div>
        ) : null}

        {/* Destaques chips */}
        {hasDestaques && (
          <div className="flex flex-wrap gap-2 mt-4">
            {mvp && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                <Star size={11} className="fill-yellow-400" />
                MVP: {mvp.player_name}
              </span>
            )}
            {bestAttacker && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red/10 text-red border border-red/20">
                <Swords size={11} />
                Ataque: {bestAttacker.player_name}
              </span>
            )}
            {bestServer && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Zap size={11} />
                Saque: {bestServer.player_name}
              </span>
            )}
            {bestDefender && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                <Shield size={11} />
                Defesa: {bestDefender.player_name}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Botão expandir (notas / quem registrou / lista de nomes) */}
      {(match.notes || (match as any).created_by_name || hasPlayers) && (
        <>
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-between px-5 py-2.5 border-t border-border bg-surface/50 hover:bg-surface transition-colors text-xs text-text-muted"
          >
            <div className="flex items-center gap-2">
              <Users size={12} />
              <span>{allPlayers.length} jogadores</span>
              {(match as any).created_by_name && (
                <>
                  <span className="opacity-30">•</span>
                  <User size={12} />
                  <span>por {(match as any).created_by_name}</span>
                </>
              )}
            </div>
            <ChevronDown
              size={14}
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5 pt-3 space-y-4 border-t border-border">
                  {/* Elencos completos */}
                  {teams.length >= 2 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {teams.map((team: any) => (
                        <div key={team.id}>
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: team.color_hex || '#888' }}
                            />
                            <span className={`text-xs font-bold uppercase tracking-wider ${team.winner ? 'text-yellow-400' : 'text-text-muted'}`}>
                              {team.team_name}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {team.match_players?.map((mp: any) => (
                              <div key={mp.id} className="flex items-center gap-2 text-xs text-text-secondary">
                                <Avatar name={mp.player_name} src={mp.player_avatar} size="sm" />
                                <span className="truncate">{mp.player_name}</span>
                                <div className="flex gap-1 ml-auto">
                                  {mp.mvp && <Star size={10} className="text-yellow-500 fill-yellow-500" />}
                                  {mp.best_attacker && <Swords size={10} className="text-red" />}
                                  {mp.best_server && <Zap size={10} className="text-blue-400" />}
                                  {mp.best_defender && <Shield size={10} className="text-green-400" />}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Observações */}
                  {match.notes && (
                    <p className="text-xs text-text-muted bg-surface rounded-lg px-3 py-2 border border-border italic">
                      "{match.notes}"
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}
