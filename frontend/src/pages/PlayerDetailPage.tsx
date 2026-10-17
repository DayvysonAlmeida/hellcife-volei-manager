import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Edit, Phone, Link as LinkIcon, Ruler, Weight, Calendar, Trophy, CalendarCheck, Swords, KeyRound, UserCog, Trash2, Copy, Loader2, Eye, EyeOff, RefreshCw, Share2, TrendingUp, Flame } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { PlayerCard } from '@/components/players/PlayerCard';
import { TrophyRoom } from '@/components/profile/TrophyRoom';
import { PageLoading, ErrorState } from '@/components/ui/Loading';
import { ShareAchievementModal, type ShareModalProps } from '@/components/athlete/share/ShareAchievementModal';
import { buildShareVariants, firstShareType } from '@/components/athlete/share/shareVariants';
import { playersService } from '@/services/players';
import { evaluationsService } from '@/services';
import { SKILL_LABELS } from '@/types';
import { formatDate, cn } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const playerId = Number(id);

  // ── Estado do Modal de Compartilhamento
  const [shareModal, setShareModal] = useState<Omit<ShareModalProps, 'isOpen' | 'onClose'> | null>(null);
  const openShareModal = (props: Omit<ShareModalProps, 'isOpen' | 'onClose'>) => setShareModal(props);
  const closeShareModal = () => setShareModal(null);

  // Access management state
  const [accessEmail, setAccessEmail] = useState('');
  const [accessPassword, setAccessPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newCreds, setNewCreds] = useState<{ email: string; password: string; player_name: string } | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const { data: player, isLoading, error } = useQuery({
    queryKey: ['player', playerId],
    queryFn: () => playersService.get(playerId),
    enabled: !isNaN(playerId),
  });

  // Access management mutations (admin only)
  const createAccessMutation = useMutation({
    mutationFn: () => api.post(`/players/${playerId}/create-access/`, { email: accessEmail, password: accessPassword }).then(r => r.data),
    onSuccess: (data) => {
      setNewCreds(data);
      setAccessEmail('');
      setAccessPassword('');
      qc.invalidateQueries({ queryKey: ['player', playerId] });
      toast.success('Acesso criado com sucesso!');
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Erro ao criar acesso.'),
  });

  const revokeAccessMutation = useMutation({
    mutationFn: () => api.post(`/players/${playerId}/revoke-access/`).then(r => r.data),
    onSuccess: () => {
      setShowRevokeConfirm(false);
      qc.invalidateQueries({ queryKey: ['player', playerId] });
      toast.success('Acesso revogado.');
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Erro ao revogar acesso.'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => api.post(`/players/${playerId}/reset-password/`, { password: accessPassword }).then(r => r.data),
    onSuccess: (data) => {
      setNewCreds(data);
      setAccessPassword('');
      toast.success('Senha redefinida!');
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Erro ao redefinir senha.'),
  });

  const { data: radarData } = useQuery({
    queryKey: ['player-radar', playerId],
    queryFn: () => evaluationsService.radar(playerId),
    enabled: !isNaN(playerId),
  });

  const { data: stats } = useQuery({
    queryKey: ['player-stats', playerId],
    queryFn: () => playersService.stats(playerId),
    enabled: !isNaN(playerId),
  });

  if (isLoading) return <PageLoading />;
  if (error || !player) return <ErrorState />;

  const canEdit = user?.profile === 'admin' || user?.profile === 'moderator';

  // Radar chart data
  const radarChartData = radarData?.skills
    ? Object.entries(radarData.skills).map(([key, value]) => ({
        skill: SKILL_LABELS[key as keyof typeof SKILL_LABELS] || key,
        value: value as number,
      }))
    : [];

  // Overall history for line chart
  const historyData = stats?.overall_history?.map((h: { date: string; overall: number }) => ({
    date: formatDate(h.date),
    overall: h.overall,
  })) || [];

  const StatRow = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: number }) => (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2 text-text-secondary text-sm">
        {icon}
        {label}
      </div>
      <span className="font-mono text-white">{value}</span>
    </div>
  );

  const starCategories = [
    { label: 'MVP', value: (player as any).total_mvp || 0, icon: '🏆', total: (player as any).total_mvp },
    { label: 'Ataque', value: (player as any).total_attack || 0, icon: '⚡', total: (player as any).total_attack },
    { label: 'Defesa', value: (player as any).total_defense || 0, icon: '🛡️', total: (player as any).total_defense },
    { label: 'Levant.', value: (player as any).total_setter || 0, icon: '🎯', total: (player as any).total_setter },
    { label: 'Passe', value: (player as any).total_pass || 0, icon: '🤝', total: (player as any).total_pass },
    { label: 'Bloqueio', value: (player as any).total_block || 0, icon: '🧱', total: (player as any).total_block },
  ];

  // Mesmas posições da lista de atletas (rankings da temporada)
  const fireSharkRank = stats?.season?.fire_shark_rank ?? undefined;
  const winRank = stats?.season?.gladiator_rank ?? undefined;

  // Um card por conquista do atleta, cada um com os seus dados
  const shareVariants = buildShareVariants(player, stats);
  const firstShare = firstShareType(shareVariants);
  const openAthleteShare = () => {
    if (!firstShare) {
      toast('Este atleta ainda não tem conquistas para compartilhar.', { icon: 'ℹ️' });
      return;
    }
    openShareModal({ type: firstShare, ...shareVariants[firstShare]!, variants: shareVariants });
  };

  return (
    <div className="space-y-6">
      {/* ── Modal de Compartilhamento ── */}
      {shareModal && (
        <ShareAchievementModal
          isOpen={true}
          onClose={closeShareModal}
          {...shareModal}
        />
      )}

      {/* Back button */}
      <RouterLink to="/players" className="btn-ghost inline-flex items-center gap-2 -mb-2">
        <ArrowLeft size={16} />
        Voltar para Atletas
      </RouterLink>

      {/* Profile header - Premium Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative rounded-[32px] bg-white/80 dark:bg-[#050505]/80 backdrop-blur-3xl border border-gray-200 dark:border-white/10 p-8 pt-12 shadow-neon-red flex flex-col items-center group"
      >
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-red/60 to-transparent overflow-hidden rounded-t-[32px]" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none opacity-50 overflow-hidden rounded-[32px]" />
        
        {/* Admin Actions */}
        {canEdit && (
          <div className="absolute top-6 right-6 z-20 flex flex-wrap gap-2 justify-end">
            <button
              onClick={openAthleteShare}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/40 text-gray-300 hover:text-orange-400 text-sm font-medium transition-all duration-200"
              title="Compartilhar conquista do atleta"
            >
              <Share2 size={16} />
              <span className="hidden sm:inline">Compartilhar</span>
            </button>
            <RouterLink 
              to={`/players/${player.id}/edit`} 
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red hover:bg-red/80 text-white border border-red hover:border-red-400 text-sm font-medium transition-all duration-200 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
            >
              <Edit size={16} />
              <span className="hidden sm:inline">Editar</span>
            </RouterLink>
          </div>
        )}

        <p className="text-text-muted text-[10px] uppercase tracking-widest mb-6 font-bold z-10 drop-shadow">Player Card Oficial</p>
        <div className="w-[240px] z-10 relative group-hover:scale-105 transition-transform duration-500">
          <PlayerCard
            player={{ ...player, stats: stats || player.stats }}
            idx={0}
            canEdit={false}
            onDelete={() => {}}
            winRank={winRank}
            fireSharkRank={fireSharkRank}
          />
        </div>
      </motion.div>

      {/* ── Stats Rápidas ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Partidas', value: stats?.total_matches ?? '—', icon: Swords, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Vitórias', value: stats?.wins ?? '—', icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: '% Vitórias', value: stats?.win_rate != null ? `${stats.win_rate}%` : '—', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Presença', value: stats?.attendance_rate != null ? `${stats.attendance_rate}%` : '—', icon: CalendarCheck, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            whileHover={{ scale: 1.05, y: -5 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="relative overflow-hidden rounded-[24px] bg-gray-50/80 dark:bg-[#111]/60 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-4 text-center hover:bg-white dark:hover:bg-black/80 hover:border-red/50 hover:shadow-neon-red transition-all duration-300 group cursor-pointer"
          >
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center mx-auto mb-2 transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1`}>
              <s.icon size={24} className={s.color} />
            </div>
            <p className="font-display text-3xl text-gray-900 dark:text-white drop-shadow-sm">{s.value}</p>
            <p className="text-text-muted text-[10px] mt-1 uppercase tracking-widest font-medium">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <TrophyRoom player={player} />

      {/* ── Faltas Consecutivas ── */}
      {player.consecutive_absences >= 8 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("mt-2 flex items-start gap-3 p-4 rounded-[24px] border backdrop-blur-sm", 
            player.consecutive_absences >= 8 ? "bg-red/20 border-red/40 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-[pulse_2s_ease-in-out_infinite]" : "bg-orange-500/10 border-orange-500/30 text-orange-200"
          )}
        >
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", player.consecutive_absences >= 8 ? "bg-red/20" : "bg-orange-500/10")}>
            <Flame size={20} className={player.consecutive_absences >= 8 ? "text-red" : "text-orange-400"} />
          </div>
          <div className="flex-1">
            <p className="text-text-primary font-bold text-sm tracking-wide">
              {player.consecutive_absences} {player.consecutive_absences === 1 ? 'falta consecutiva na quadra' : 'faltas consecutivas na quadra'}
            </p>
            {/* Progress bar */}
            <div className="mt-2 h-1.5 rounded-full bg-black/50 overflow-hidden border border-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-600 transition-all duration-700 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                style={{ width: `${Math.min((player.consecutive_absences / 10) * 100, 100)}%` }}
              />
            </div>
            <p className={cn("text-xs mt-1.5", player.consecutive_absences >= 8 ? "text-red-300 font-bold" : "text-text-muted")}>{player.consecutive_absences}/10 para inativação</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Radar de Habilidades ── */}
        {radarChartData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ y: -5 }}
            className="relative overflow-hidden rounded-[32px] bg-white/60 dark:bg-[#050505]/60 backdrop-blur-2xl border border-gray-200 dark:border-white/10 p-6 shadow-2xl hover:border-red/30 transition-all duration-300 group"
          >
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-red/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <h2 className="font-display text-lg text-text-primary tracking-wider mb-4">HABILIDADES</h2>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarChartData}>
                <PolarGrid stroke="#27272A" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: '#71717A', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: '#71717A', fontSize: 9 }} />
                <Radar
                  name="Habilidade"
                  dataKey="value"
                  stroke="#D90429"
                  fill="#D90429"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* ── Estrelas por Categoria ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          whileHover={{ y: -5 }}
          className="relative overflow-hidden rounded-[32px] bg-white/60 dark:bg-[#050505]/60 backdrop-blur-2xl border border-gray-200 dark:border-white/10 p-6 shadow-2xl hover:border-blue-500/30 transition-all duration-300 group"
        >
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <h2 className="font-display text-lg text-text-primary tracking-wider mb-4">ESTRELAS</h2>
          <div className="space-y-3">
            {starCategories.map((cat) => (
              <div key={cat.label} className="flex items-center gap-3">
                <span className="text-lg w-6 text-center flex-shrink-0">{cat.icon}</span>
                <span className="text-text-secondary text-sm w-16 flex-shrink-0">{cat.label}</span>
                <div className="flex-1 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-2 rounded-full transition-all duration-500 ${
                        i < cat.value ? 'bg-yellow-400' : 'bg-surface-highlight'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-text-muted text-xs w-8 text-right">{cat.value}/5</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <span className="text-text-muted text-sm">Total acumulado</span>
            <div className="flex items-center gap-2">
              <span className="font-display text-text-primary">{player.big_stars}🌟 + {player.mini_stars}⭐</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Evolução do Overall ── */}
      {historyData.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ y: -5 }}
          className="relative overflow-hidden rounded-[32px] bg-white/60 dark:bg-[#050505]/60 backdrop-blur-2xl border border-gray-200 dark:border-white/10 p-6 shadow-2xl hover:border-red/30 transition-all duration-300 group"
        >
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-red/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <h2 className="font-display text-lg text-text-primary tracking-wider mb-4">EVOLUÇÃO DO OVERALL</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={historyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
              <XAxis dataKey="date" tick={{ fill: '#71717A', fontSize: 10 }} />
              <YAxis domain={[0, 10]} tick={{ fill: '#71717A', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#18181B', border: '1px solid #27272A', borderRadius: 8 }}
                labelStyle={{ color: '#A1A1AA' }}
              />
              <Line
                type="monotone"
                dataKey="overall"
                stroke="#D90429"
                strokeWidth={2}
                dot={{ fill: '#D90429', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* ── Informações Pessoais ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        whileHover={{ y: -5 }}
        className="relative overflow-hidden rounded-[32px] bg-white/60 dark:bg-[#050505]/60 backdrop-blur-2xl border border-gray-200 dark:border-white/10 p-6 shadow-2xl hover:border-gray-500/30 transition-all duration-300 group"
      >
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-gray-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <h2 className="font-display text-lg text-text-primary tracking-wider mb-4">INFORMAÇÕES</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {[
            { label: 'Mão dominante', value: player.dominant_hand_display, icon: null },
            player.secondary_position && { label: 'Posição secundária', value: player.secondary_position_display, icon: null },
            player.age && { label: 'Idade', value: `${player.age} anos`, icon: <Calendar size={14} /> },
            player.height && { label: 'Altura', value: `${player.height}m`, icon: <Ruler size={14} /> },
            player.weight && { label: 'Peso', value: `${player.weight}kg`, icon: <Weight size={14} /> },
            player.phone && { label: 'Telefone', value: player.phone, icon: <Phone size={14} /> },
            player.instagram && { label: 'Instagram', value: `@${player.instagram}`, icon: <LinkIcon size={14} /> },
          ].filter(Boolean).map((item: any, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <span className="text-text-muted text-sm flex items-center gap-2">
                {item.icon}
                {item.label}
              </span>
              <span className="text-text-primary text-sm font-medium">{item.value}</span>
            </div>
          ))}
        </div>
        {player.notes && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-text-muted text-xs uppercase tracking-wider mb-1">Observações</p>
            <p className="text-text-secondary text-sm">{player.notes}</p>
          </div>
        )}
      </motion.div>

      {/* ── Gerenciamento de Acesso (Admin only) ── */}
      {canEdit && !player.is_guest && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          whileHover={{ y: -5 }}
          className="relative overflow-hidden rounded-[32px] bg-white/60 dark:bg-[#050505]/60 backdrop-blur-2xl border border-gray-200 dark:border-white/10 p-6 shadow-2xl hover:border-red/30 transition-all duration-300 group"
        >
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-red/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-red/10 flex items-center justify-center text-red border border-red/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
              <UserCog size={20} />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-lg text-text-primary tracking-wider">ACESSO DO ATLETA</h2>
              <p className="text-text-muted text-xs">Gerencie o acesso ao portal do atleta</p>
            </div>
            {player.user ? (
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.15)]">
                ✅ Com acesso
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface-highlight text-text-muted border border-border">
                ○ Sem acesso
              </span>
            )}
          </div>

          {/* Popup de credenciais criadas */}
          <AnimatePresence>
            {newCreds && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mb-5 p-5 rounded-[24px] bg-green-500/5 border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.1)]"
              >
                <p className="text-green-400 font-medium text-sm mb-3 flex items-center gap-2">
                  <span>✅</span> Acesso pronto! Envie as credenciais:
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between bg-black/40 rounded-xl p-3 border border-white/5">
                    <span className="text-text-muted text-xs uppercase tracking-wider">Usuário:</span>
                    <span className="text-text-primary font-mono text-base">{newCreds.email}</span>
                  </div>
                  <div className="flex items-center justify-between bg-black/40 rounded-xl p-3 border border-white/5">
                    <span className="text-text-muted text-xs uppercase tracking-wider">Senha:</span>
                    <span className="text-text-primary font-mono text-base">{newCreds.password}</span>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `Seu acesso ao Hellcife Vôlei Manager está pronto! 🏐\nAcesse o app e faça login:\nUsuário: ${newCreds.email}\nSenha: ${newCreds.password}\nBem-vindo(a)! 💪`
                      );
                      toast.success('Mensagem copiada!');
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg"
                  >
                    <Copy size={16} /> Copiar para WhatsApp
                  </button>
                  <button onClick={() => setNewCreds(null)} className="btn-ghost px-5 text-sm rounded-xl">Fechar</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!player.user ? (
            /* ── Criar Acesso ── */
            <div className="space-y-4">
              <div>
                <label className="block text-text-secondary text-xs font-medium mb-1.5 uppercase tracking-wider">E-mail do atleta</label>
                <input
                  type="email"
                  value={accessEmail}
                  onChange={e => setAccessEmail(e.target.value)}
                  placeholder="atleta@email.com"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red focus:ring-1 focus:ring-red transition-all"
                />
              </div>
              <div>
                <label className="block text-text-secondary text-xs font-medium mb-1.5 uppercase tracking-wider">Senha inicial</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={accessPassword}
                    onChange={e => setAccessPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 pr-10 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red focus:ring-1 focus:ring-red transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button
                onClick={() => createAccessMutation.mutate()}
                disabled={createAccessMutation.isPending || !accessEmail || !accessPassword}
                className="w-full flex items-center justify-center gap-2 py-3 bg-red hover:bg-red/80 disabled:opacity-50 disabled:hover:bg-red text-white rounded-xl text-sm font-medium transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              >
                {createAccessMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                Criar Acesso
              </button>
            </div>
          ) : (
            /* ── Gerenciar Acesso Existente ── */
            <div className="space-y-4">
              <div>
                <label className="block text-text-secondary text-xs font-medium mb-1.5 uppercase tracking-wider">Nova senha (para redefinir)</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={accessPassword}
                    onChange={e => setAccessPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 pr-10 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red focus:ring-1 focus:ring-red transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => resetPasswordMutation.mutate()}
                  disabled={resetPasswordMutation.isPending || !accessPassword}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-sm font-medium transition-all"
                >
                  {resetPasswordMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Redefinir Senha
                </button>
                <button
                  onClick={() => setShowRevokeConfirm(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-red-400 hover:text-white hover:bg-red/80 border border-red/20 transition-all shadow-[0_0_10px_rgba(239,68,68,0.1)]"
                >
                  <Trash2 size={16} /> Revogar
                </button>
              </div>
              {showRevokeConfirm && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-5 rounded-[24px] bg-red/10 border border-red/30 shadow-[0_0_20px_rgba(239,68,68,0.15)] overflow-hidden"
                >
                  <p className="text-red-100 text-sm font-medium mb-4">⚠️ Tem certeza? O atleta perderá o acesso imediatamente.</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => revokeAccessMutation.mutate()}
                      disabled={revokeAccessMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red hover:bg-red/80 text-white rounded-xl text-sm font-medium transition-colors shadow-lg"
                    >
                      {revokeAccessMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                      Confirmar Revogação
                    </button>
                    <button onClick={() => setShowRevokeConfirm(false)} className="btn-ghost px-5 text-sm rounded-xl">Cancelar</button>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
