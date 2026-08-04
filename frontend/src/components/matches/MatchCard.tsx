import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Calendar, MapPin, Trophy, Star, Shield, ChevronDown, Users, Trash2, Pencil } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { LocationMapModal } from '@/components/ui/LocationMapModal';
import { formatDate } from '@/lib/utils';
import { MODALITY_LABELS } from '@/types';
import type { Modality, Match, MatchPlayer } from '@/types';

export function MatchCard({ match, idx, expanded, isAdmin, isDeleting, onToggle, onDelete }: {
  match: Match;
  idx: number;
  expanded: boolean;
  isAdmin: boolean;
  isDeleting: boolean;
  onToggle: () => void;
  onDelete: (id: number) => void;
  onEdit?: (id: number) => void;
}) {
  const navigate = useNavigate();
  const teams = match.match_teams || [];
  const teamA = teams[0];
  const teamB = teams[1];

  const allPlayers: MatchPlayer[] = teams.flatMap((t: any) => t.match_players || []);
  const mvp = allPlayers.find(p => p.mvp);
  const bestAttacker = allPlayers.find(p => p.best_attacker);
  const bestDefender = allPlayers.find(p => p.best_defender);

  const hasDestaques = mvp || bestAttacker || bestDefender;
  const hasPlayers = allPlayers.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
      className="card overflow-hidden"
    >
      {/* Topo do card: meta-info + botão admin */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* Badge modalidade */}
          <span className="text-xs font-bold text-red bg-red/10 border border-red/20 px-2 py-0.5 rounded-full tracking-wider uppercase">
            {MODALITY_LABELS[match.modality as Modality]}
          </span>
          <div className="flex items-center gap-1 text-text-muted text-xs" title={match.created_at ? `Confirmado em: ${new Date(match.created_at).toLocaleString('pt-BR')}` : ''}>
            <Calendar size={11} />
            {formatDate(match.date)}
            {match.created_at && (
              <span className="ml-1 opacity-70 border-l border-border pl-2">
                {new Date(match.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          {match.location && (
            <div className="flex items-center gap-1 text-text-muted text-xs truncate max-w-[140px]">
              <LocationMapModal location={match.location} className="text-xs" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {match.team_generation && (
            <Link
              to={`/bracket/${match.team_generation}`}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-text-muted hover:text-red hover:bg-red/10 rounded-xl transition-colors"
              title="Ir para a Fila / Circuito"
              aria-label="Ir para a Fila / Circuito"
            >
              <Trophy size={16} />
            </Link>
          )}
          {isAdmin && (
            <button
              onClick={() => navigate(`/matches/${match.id}/edit`)}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-text-muted hover:text-yellow-500 hover:bg-yellow-500/10 rounded-xl transition-colors"
              title="Editar partida"
              aria-label="Editar partida"
            >
              <Pencil size={16} />
            </button>
          )}
          {/* Botão excluir — área de toque generosa no mobile */}
          {isAdmin && (
            <button
              onClick={() => onDelete(match.id)}
              disabled={isDeleting}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-text-muted hover:text-red hover:bg-red/10 rounded-xl transition-colors"
              title="Excluir partida"
              aria-label="Excluir partida"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Placar — Duelo visual */}
      <div className="px-4 pb-4">
        {teams.length >= 2 && teamA && teamB ? (
          <div className="flex items-stretch gap-2">
            {/* Time A */}
            <div className={`flex-1 rounded-xl px-3 py-3 border ${teamA.winner ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-surface border-border'}`}>
              {/* Nome + cor */}
              <div className="flex items-center gap-1.5 mb-2">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: teamA.color_hex || '#D90429' }}
                />
                <span className={`font-semibold text-xs leading-tight truncate ${teamA.winner ? 'text-yellow-400' : 'text-text-primary'}`}>
                  {teamA.team_name}
                </span>
                {teamA.winner && <Trophy size={11} className="text-yellow-500 flex-shrink-0 ml-auto" />}
              </div>
              {/* Placar grande */}
              <p className={`font-display text-5xl font-bold leading-none ${teamA.winner ? 'text-yellow-400' : 'text-text-muted'}`}>
                {teamA.score}
              </p>
              {/* Avatares — pilha horizontal limitada */}
              {(teamA as any).match_players?.length > 0 && (
                <div className="flex -space-x-1.5 mt-3">
                  {(teamA as any).match_players.slice(0, 7).map((mp: any) => (
                    <div key={mp.id} className="relative flex-shrink-0" title={mp.player_name}>
                      <Avatar
                        name={mp.player_name}
                        src={mp.player_avatar}
                        size="sm"
                        className="ring-2 ring-background"
                      />
                      {mp.mvp && (
                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 flex items-center justify-center bg-yellow-500 rounded-full">
                          <Star size={7} className="fill-white text-white" />
                        </span>
                      )}
                    </div>
                  ))}
                  {(teamA as any).match_players.length > 7 && (
                    <div className="w-8 h-8 rounded-full bg-surface border-2 border-background flex items-center justify-center text-[9px] text-text-muted font-bold flex-shrink-0">
                      +{(teamA as any).match_players.length - 7}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Separador VS */}
            <div className="flex flex-col items-center justify-center gap-1 px-1 flex-shrink-0">
              <span className="font-display text-[10px] text-text-muted tracking-widest">VS</span>
              <Swords size={16} className="text-border" />
            </div>

            {/* Time B */}
            <div className={`flex-1 rounded-xl px-3 py-3 border ${teamB.winner ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-surface border-border'}`}>
              {/* Nome + cor — alinhado à direita */}
              <div className="flex items-center gap-1.5 mb-2 flex-row-reverse">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: teamB.color_hex || '#2563EB' }}
                />
                <span className={`font-semibold text-xs leading-tight truncate text-right ${teamB.winner ? 'text-yellow-400' : 'text-text-primary'}`}>
                  {teamB.team_name}
                </span>
                {teamB.winner && <Trophy size={11} className="text-yellow-500 flex-shrink-0 mr-auto" />}
              </div>
              {/* Placar grande */}
              <p className={`font-display text-5xl font-bold leading-none text-right ${teamB.winner ? 'text-yellow-400' : 'text-text-muted'}`}>
                {teamB.score}
              </p>
              {/* Avatares — pilha horizontal limitada, alinhada à direita */}
              {(teamB as any).match_players?.length > 0 && (
                <div className="flex -space-x-1.5 justify-end mt-3">
                  {(teamB as any).match_players.slice(0, 7).map((mp: any) => (
                    <div key={mp.id} className="relative flex-shrink-0" title={mp.player_name}>
                      <Avatar
                        name={mp.player_name}
                        src={mp.player_avatar}
                        size="sm"
                        className="ring-2 ring-background"
                      />
                      {mp.mvp && (
                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 flex items-center justify-center bg-yellow-500 rounded-full">
                          <Star size={7} className="fill-white text-white" />
                        </span>
                      )}
                    </div>
                  ))}
                  {(teamB as any).match_players.length > 7 && (
                    <div className="w-8 h-8 rounded-full bg-surface border-2 border-background flex items-center justify-center text-[9px] text-text-muted font-bold flex-shrink-0">
                      +{(teamB as any).match_players.length - 7}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : teams.length > 0 ? (
          <div className="bg-surface rounded-xl p-3 space-y-2">
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

        {/* Chips de destaques — scroll horizontal no mobile */}
        {hasDestaques && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {mvp && (
              <span className="inline-flex flex-shrink-0 items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 whitespace-nowrap">
                <Star size={10} className="fill-yellow-400" />
                {mvp.player_name}
              </span>
            )}
            {bestAttacker && (
              <span className="inline-flex flex-shrink-0 items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red/10 text-red border border-red/20 whitespace-nowrap">
                <Swords size={10} />
                {bestAttacker.player_name}
              </span>
            )}
            {bestDefender && (
              <span className="inline-flex flex-shrink-0 items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20 whitespace-nowrap">
                <Shield size={10} />
                {bestDefender.player_name}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Botão expandir — área de toque generosa (min 44px) */}
      {(match.notes || (match as any).created_by_name || hasPlayers) && (
        <>
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-between px-4 py-3 border-t border-border bg-surface/40 hover:bg-surface active:bg-surface transition-colors text-xs text-text-muted"
          >
            <div className="flex items-center gap-2">
              <Users size={12} />
              <span>{allPlayers.length} jogadores</span>
              {(match as any).created_by_name && (
                <span className="text-text-muted/40">• por {(match as any).created_by_name}</span>
              )}
            </div>
            <ChevronDown
              size={15}
              className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
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
                <div className="px-4 pb-4 pt-3 space-y-4 border-t border-border">
                  {/* Elencos por times */}
                  {teams.length >= 1 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {teams.map((team: any) => (
                        <div key={team.id}>
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: team.color_hex || '#888' }}
                            />
                            <span className={`text-xs font-bold uppercase tracking-wider ${team.winner ? 'text-yellow-400' : 'text-text-muted'}`}>
                              {team.team_name}
                            </span>
                            {team.winner && <Trophy size={10} className="text-yellow-500 ml-auto" />}
                          </div>
                          <div className="space-y-1.5">
                            {team.match_players?.map((mp: any) => (
                              <div key={mp.id} className="flex items-center gap-2 py-0.5">
                                <Avatar name={mp.player_name} src={mp.player_avatar} size="sm" />
                                <span className="text-xs text-text-secondary truncate flex-1 flex items-center gap-1">
                                  {mp.player_name}
                                  {mp.player_is_guest && (
                                    <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1 py-0.5 rounded uppercase font-bold hidden sm:inline-block">
                                      Convidado {mp.player_invited_by ? `por: ${mp.player_invited_by}` : ''}
                                    </span>
                                  )}
                                </span>
                                <div className="flex gap-1.5 flex-shrink-0">
                                  {mp.mvp && <Star size={11} className="text-yellow-500 fill-yellow-500" />}
                                  {mp.best_attacker && <Swords size={11} className="text-red" />}
                                  {mp.best_defender && <Shield size={11} className="text-green-400" />}
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
                    <p className="text-xs text-text-muted bg-surface rounded-xl px-3 py-2.5 border border-border italic leading-relaxed">
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
