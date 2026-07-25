import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { playersService } from '@/services/players';
import { PageLoading } from '@/components/ui/Loading';
import { cn } from '@/lib/utils';
import { POSITION_LABELS } from '@/types';
import type { Player, Position } from '@/types';

const schema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  nickname: z.string().optional(),
  shirt_number: z.coerce.number().optional(),
  age: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
  weight: z.coerce.number().optional(),
  main_position: z.enum(['libero', 'setter', 'opposite', 'outside', 'middle', 'universal']),
  secondary_position: z.enum(['libero', 'setter', 'opposite', 'outside', 'middle', 'universal', '']).optional(),
  dominant_hand: z.enum(['right', 'left', 'both']),
  gender: z.enum(['M', 'F']),
  phone: z.string().optional(),
  instagram: z.string().optional(),
  avatar: z.any().optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive', 'injured', 'suspended']),
  mini_stars: z.coerce.number().min(0).max(10),
  big_stars: z.coerce.number().min(0).max(10),
});

type FormData = z.infer<typeof schema>;

const FieldGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="card p-6">
    <h3 className="font-display text-base text-text-primary tracking-wider mb-4 uppercase">{title}</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {children}
    </div>
  </div>
);

const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-text-secondary text-sm font-medium mb-1.5">{label}</label>
    {children}
    {error && <p className="text-red text-xs mt-1">{error}</p>}
  </div>
);

export function PlayerFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState('');

  const { data: player, isLoading } = useQuery({
    queryKey: ['player', Number(id)],
    queryFn: () => playersService.get(Number(id)),
    enabled: isEdit && !isNaN(Number(id)),
  });

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    values: player ? {
      name: player.name,
      nickname: player.nickname || '',
      shirt_number: player.shirt_number || undefined,
      age: player.age || undefined,
      height: player.height || undefined,
      weight: player.weight || undefined,
      main_position: player.main_position,
      secondary_position: player.secondary_position || '',
      dominant_hand: player.dominant_hand || 'right',
      gender: player.gender || 'M',
      phone: player.phone || '',
      instagram: player.instagram || '',
      notes: player.notes || '',
      status: player.status || 'active',
      mini_stars: player.mini_stars ?? 1,
      big_stars: player.big_stars ?? 0,
    } : {
      main_position: 'outside',
      secondary_position: '',
      dominant_hand: 'right',
      gender: 'M',
      status: 'active',
      mini_stars: 1,
      big_stars: 0,
    } as any,
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      isEdit ? playersService.update(Number(id), data as any) : playersService.create(data as any),
    onSuccess: (savedPlayer) => {
      qc.invalidateQueries({ queryKey: ['players'] });
      toast.success(isEdit ? 'Atleta atualizado com sucesso!' : 'Atleta cadastrado com sucesso!');
      navigate(`/players/${savedPlayer.id}`);
    },
    onError: () => {
      setServerError('Erro ao salvar jogador. Verifique os dados e tente novamente.');
      toast.error('Erro ao salvar atleta!');
    },
  });

  const avatarFile = watch('avatar');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (avatarFile && avatarFile.length > 0) {
      const file = avatarFile[0];
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (player?.avatar_url) {
      setPreviewUrl(player.avatar_url);
    } else {
      setPreviewUrl(null);
    }
  }, [avatarFile, player?.avatar_url]);

  if (isLoading) return <PageLoading />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/players" className="btn-ghost inline-flex items-center gap-2">
        <ArrowLeft size={16} />
        Voltar
      </Link>

      <div>
        <h1 className="page-title">{isEdit ? 'Editar Atleta' : 'Novo Atleta'}</h1>
        <p className="page-subtitle">Preencha as informações do atleta abaixo.</p>
      </div>

      {serverError && (
        <div className="bg-red/10 border border-red/30 rounded-lg p-3 text-red text-sm">{serverError}</div>
      )}

      <form onSubmit={handleSubmit((d) => {
        const formData = new FormData();
        Object.entries(d).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            if (key === 'avatar') {
              if (value && value.length > 0) {
                formData.append(key, value[0]);
              }
            } else {
              formData.append(key, value as string);
            }
          }
        });
        mutation.mutate(formData as any);
      })} className="space-y-4">
        {/* Informações pessoais */}
        <FieldGroup title="Informações pessoais">
          <Field label="Nome completo *" error={errors.name?.message}>
            <input {...register('name')} className={cn('input w-full', errors.name && 'border-red/50')} />
          </Field>
          <Field label="Apelido" error={errors.nickname?.message}>
            <input {...register('nickname')} className="input w-full" />
          </Field>
          <Field label="Número da camisa" error={errors.shirt_number?.message}>
            <input {...register('shirt_number')} type="number" className="input w-full" />
          </Field>
          <Field label="Idade">
            <input {...register('age')} type="number" className="input w-full" />
          </Field>
          <Field label="Altura (m)">
            <input {...register('height')} type="number" step="0.01" className="input w-full" />
          </Field>
          <Field label="Peso (kg)">
            <input {...register('weight')} type="number" step="0.1" className="input w-full" />
          </Field>
        </FieldGroup>

        {/* Posições e características */}
        <FieldGroup title="Posições e características">
          <Field label="Posição principal *" error={errors.main_position?.message}>
            <select {...register('main_position')} className={cn('input w-full', errors.main_position && 'border-red/50')}>
              {Object.entries(POSITION_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Posição secundária">
            <select {...register('secondary_position')} className="input w-full">
              <option value="">Nenhuma</option>
              {Object.entries(POSITION_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Mão dominante">
            <select {...register('dominant_hand')} className="input w-full">
              <option value="right">Destro</option>
              <option value="left">Canhoto</option>
              <option value="both">Ambidestro</option>
            </select>
          </Field>
          <Field label="Gênero / Sexo">
            <select {...register('gender')} className="input w-full">
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </Field>
          <Field label="Status">
            <select {...register('status')} className="input w-full">
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="injured">Lesionado</option>
              <option value="suspended">Suspenso</option>
            </select>
          </Field>
        </FieldGroup>

        {/* Sistema de Estrelas */}
        <FieldGroup title="Sistema de Estrelas">
          <Field label="Mini Estrelas" error={errors.mini_stars?.message}>
            <input {...register('mini_stars')} type="number" min="0" max="10" className="input w-full" />
          </Field>
          <Field label="Estrelas Grandes" error={errors.big_stars?.message}>
            <input {...register('big_stars')} type="number" min="0" max="10" className="input w-full" />
          </Field>
        </FieldGroup>

        {/* Contato */}
        <FieldGroup title="Contato e redes sociais">
          <Field label="Telefone">
            <input {...register('phone')} className="input w-full" placeholder="(11) 99999-9999" />
          </Field>
          <Field label="Instagram">
            <input {...register('instagram')} className="input w-full" placeholder="@usuario" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Foto do Jogador (Avatar)" error={errors.avatar?.message as string}>
              <div className="flex items-center gap-4 mt-2">
                {/* Preview Circle */}
                {previewUrl ? (
                  <div className="shrink-0 w-24 h-24 rounded-full border-2 border-border/50 overflow-hidden bg-black/10 shadow-sm relative group">
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      className={`w-full h-full ${previewUrl.toLowerCase().includes('.png') ? 'object-contain object-bottom' : 'object-cover object-top'}`} 
                    />
                  </div>
                ) : (
                  <div className="shrink-0 w-24 h-24 rounded-full border-2 border-dashed border-border flex flex-col items-center justify-center bg-background/50 text-text-muted">
                    <ImageIcon size={24} className="opacity-50 mb-1" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Sem foto</span>
                  </div>
                )}
                
                <div className="flex-1">
                  <input type="file" accept="image/*" {...register('avatar')} className="input w-full p-2 text-sm" />
                  <p className="text-xs text-text-muted mt-2 leading-relaxed">
                    <strong className="text-red">Dica de Ouro:</strong> Envie uma imagem <strong>PNG com fundo transparente</strong> do peito pra cima. O sistema vai automaticamente gerar o efeito 3D (Pop-out) no card FUT!
                  </p>
                </div>
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Observações">
              <textarea {...register('notes')} rows={3} className="input w-full resize-none" />
            </Field>
          </div>
        </FieldGroup>

        <div className="flex gap-3 justify-end">
          <Link to="/players" className="btn-secondary">Cancelar</Link>
          <button type="submit" disabled={mutation.isPending} className="btn-primary flex items-center gap-2">
            {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Salvar alterações' : 'Cadastrar atleta'}
          </button>
        </div>
      </form>
    </div>
  );
}
