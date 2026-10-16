import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Save, RefreshCw, Eye, Edit3, FileText } from 'lucide-react';
import { regulationService } from '@/services';
import { PageLoading, ErrorState } from '@/components/ui/Loading';
import { sanitizeHtml } from '@/lib/sanitizeHtml';

export function RegulationAdminPage() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('Regulamento Oficial');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['regulation'],
    queryFn: regulationService.get,
    staleTime: 0,
  });

  useEffect(() => {
    if (data) {
      setTitle(data.title);
      setContent(data.content);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: { title: string; content: string }) =>
      regulationService.update(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regulation'] });
      setIsEditing(false);
    },
  });

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6 border-neon-blue-sm"
      >
        <div className="flex items-center gap-3 mb-4">
          <FileText className="text-blue" size={24} />
          <div>
            <h2 className="font-display text-xl tracking-wider text-text-primary">
              Editor do Regulamento
            </h2>
            <p className="text-xs text-text-muted">
              Edite o texto oficial do clube. Alterações são imediatas para todos os atletas.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <RefreshCw size={12} />
            Atualizado em: {data?.updated_at ? new Date(data.updated_at).toLocaleString('pt-BR') : '—'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreview(!preview)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                preview ? 'bg-blue/10 text-blue border border-blue/30' : 'bg-surface border border-border text-text-muted hover:text-text-primary'
              }`}
            >
              <Eye size={14} />
              {preview ? 'Editar' : 'Visualizar'}
            </button>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isEditing ? 'bg-red/10 text-red border border-red/30' : 'bg-surface border border-border text-text-muted hover:text-text-primary'
              }`}
            >
              <Edit3 size={14} />
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do regulamento"
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-text-primary font-medium focus:outline-none focus:border-red/50"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Conteúdo HTML do regulamento..."
              rows={20}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-text-primary font-mono text-sm focus:outline-none focus:border-red/50 resize-y"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setTitle(data?.title || 'Regulamento Oficial');
                  setContent(data?.content || '');
                  setIsEditing(false);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-text-muted hover:bg-surface transition-all"
              >
                Descartar
              </button>
              <button
                onClick={() => mutation.mutate({ title, content })}
                disabled={mutation.isPending}
                className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold text-white bg-red hover:bg-red/90 transition-all disabled:opacity-50"
              >
                <Save size={16} />
                {mutation.isPending ? 'Salvando...' : 'Publicar alteração'}
              </button>
            </div>
          </div>
        ) : preview ? (
          <div className="bg-background/50 rounded-lg p-6 border border-border min-h-[300px]">
            <h3 className="font-display text-lg text-text-primary mb-4">{title}</h3>
            <div
              className="rich-content"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
            />
          </div>
        ) : (
          <div className="bg-background/50 rounded-lg p-6 border border-border">
            <h3 className="font-display text-lg text-text-primary mb-4">{title}</h3>
            <pre className="text-text-muted text-sm whitespace-pre-wrap font-mono max-h-[400px] overflow-y-auto">
              {content}
            </pre>
          </div>
        )}
      </motion.div>
    </div>
  );
}