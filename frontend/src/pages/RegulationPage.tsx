import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { ScrollText, Edit3 } from 'lucide-react';
import { regulationService } from '@/services';
import { PageLoading, ErrorState } from '@/components/ui/Loading';
import { useAuth } from '@/store/AuthContext';
import { sanitizeHtml } from '@/lib/sanitizeHtml';
import { isAdmin } from '@/lib/roles';
import api from '@/lib/api';

export function RegulationPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['regulation'],
    queryFn: regulationService.get,
    staleTime: 1000 * 60 * 5,
  });
  const { user } = useAuth();
  const canEdit = isAdmin(user); // editar o regulamento: só o admin

  // "Comece por aqui": abrir o regulamento marca o passo (só no portal do atleta)
  const inAthletePortal = useLocation().pathname.startsWith('/athlete');
  useEffect(() => {
    if (inAthletePortal) api.post('/players/me/regulation-seen/').catch(() => {});
  }, [inAthletePortal]);

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState onRetry={refetch} />;
  if (!data) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-8 text-center bg-card-gradient border-neon-red relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red via-blue to-red" />
        <ScrollText className="w-16 h-16 text-red mx-auto mb-4" />
        <h1 className="page-title">
          REGULAMENTO OFICIAL
        </h1>
        <h2 className="text-xl text-text-secondary font-medium uppercase tracking-widest">
          HELLCIFE VÔLEI
        </h2>
        <p className="text-xs text-text-muted mt-3">
          Última atualização: {new Date(data.updated_at).toLocaleDateString('pt-BR')}
          {data.updated_by_name ? ` · por ${data.updated_by_name}` : ''}
        </p>
        {canEdit && (
          <Link
            to="/regulation/edit"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg text-sm font-bold text-white bg-red hover:bg-red/90 transition-all"
          >
            <Edit3 size={16} />
            Editar regulamento
          </Link>
        )}
      </motion.div>

      {/* Conteúdo Dinâmico (HTML vindo do banco) */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-6 md:p-8"
      >
        <div
          className="rich-content"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.content) }}
        />
      </motion.section>

      {/* Footer de versionamento */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-center py-8 text-text-muted space-y-4"
      >
        <p className="italic text-sm max-w-2xl mx-auto">
          "No Hellcife, o respeito é obrigatório, a evolução é constante e o comprometimento diferencia aqueles que apenas participam daqueles que verdadeiramente fazem parte do cardume."
        </p>
        <div className="inline-block px-4 py-2 bg-surface rounded-full text-xs font-bold uppercase tracking-wider border border-border mt-4 text-text-primary">
          👑 Administração Geral: Walef Abdias
        </div>
      </motion.div>
    </div>
  );
}