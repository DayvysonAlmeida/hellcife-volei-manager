import { Link, useLocation } from 'react-router-dom';
import { IdCard } from 'lucide-react';
import { useMyAthlete } from '@/hooks/useMyAthlete';

const LABELS: Record<string, string> = { cpf: 'CPF', phone: 'WhatsApp' };

/** "Atualize seus dados": no portal do atleta, enquanto faltar CPF ou WhatsApp no cadastro. */
export function MissingDataBanner() {
  const { pathname } = useLocation();
  const { data: athlete } = useMyAthlete();
  const missing = athlete?.missing_data ?? [];
  if (!pathname.startsWith('/athlete') || pathname === '/athlete/profile/edit' || missing.length === 0) return null;

  const what = missing.map((m) => LABELS[m] ?? m).join(' e ');
  return (
    <div role="status" className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 sm:p-4">
      <IdCard size={20} className="text-amber-600 dark:text-amber-400 shrink-0" />
      <p className="flex-1 text-sm text-text-primary">
        <strong>Atualize seus dados:</strong> falta o seu {what} no cadastro. Leva menos de um minuto.
      </p>
      <Link to="/athlete/profile/edit" className="btn-primary text-xs inline-flex items-center justify-center text-center whitespace-nowrap">Completar agora</Link>
    </div>
  );
}
