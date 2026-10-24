import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BellRing, CheckCircle2, ChevronDown, Loader2, Send, Smartphone, Users, XCircle, AlertTriangle } from 'lucide-react';
import { usePushHealth } from '@/hooks/usePushHealth';
import { enablePushHere } from '@/lib/push';
import { notificationsService, type PushTestResult } from '@/services/notifications';
import { cn, formatDateTime } from '@/lib/utils';

type Check = 'ok' | 'warn' | 'fail';
const TEST_DELAY = 10;

function Row({ state, title, children }: { state: Check; title: string; children?: React.ReactNode }) {
  const Icon = state === 'ok' ? CheckCircle2 : state === 'warn' ? AlertTriangle : XCircle;
  return (
    <li className="flex gap-3 py-3">
      <Icon size={18} className={cn('shrink-0 mt-0.5', state === 'ok' ? 'text-green-500' : state === 'warn' ? 'text-amber-500' : 'text-red')} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-bold text-text-primary">{title}</p>
        {children && <div className="text-xs text-text-muted leading-relaxed space-y-2">{children}</div>}
      </div>
    </li>
  );
}

const ANDROID_STEPS = (
  <p><strong className="text-text-secondary">Android:</strong> Configurações → Apps → HellCife (ou Chrome) → Notificações → ative e ligue “Tela de bloqueio” e “Pop-up” (ou “Mostrar como flutuante”). Se o celular economiza bateria, deixe o app “Sem restrições”.</p>
);
const IPHONE_STEPS = (
  <p><strong className="text-text-secondary">iPhone:</strong> funciona com o app instalado (iOS 16.4 ou mais novo). Ajustes → Notificações → HellCife → Permitir, com “Tela Bloqueada” e “Faixas” ligados. Confira também se nenhum modo Foco está bloqueando.</p>
);

/** Staff: quantos atletas recebem as notificações no celular e quem ainda não ativou. */
function StaffCoverage() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ queryKey: ['push-stats'], queryFn: notificationsService.pushStats, staleTime: 5 * 60_000 });
  if (!data) return null;
  const pct = data.athletes ? Math.round((data.with_push / data.athletes) * 100) : 0;
  return (
    <div className="rounded-xl border border-border/50 p-3 space-y-2">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full flex items-center gap-2 text-left">
        <Users size={16} className="text-text-muted shrink-0" />
        <span className="flex-1 text-sm text-text-primary">
          <strong>{data.with_push}</strong> de {data.athletes} atletas recebem no celular <span className="text-text-muted">({pct}%)</span>
        </span>
        {data.without.length > 0 && <ChevronDown size={16} className={cn('text-text-muted transition-transform', open && 'rotate-180')} />}
      </button>
      <div className="h-1.5 rounded-full bg-surface-highlight overflow-hidden">
        <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
      </div>
      {open && data.without.length > 0 && (
        <p className="text-xs text-text-muted leading-relaxed">
          <strong className="text-text-secondary">Ainda não ativaram:</strong> {data.without.join(', ')}.
        </p>
      )}
    </div>
  );
}

/** "Notificações no celular": lista de verificação ao vivo e teste com a tela bloqueada. */
export function PushDiagnostics({ isStaff }: { isStaff: boolean }) {
  const { local, server, loading, registered, ready, refresh } = usePushHealth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [results, setResults] = useState<PushTestResult[] | null>(null);

  // Vindo do atalho "Ativar notificações" do menu: rola até este cartão
  useEffect(() => {
    if (window.location.hash === '#celular') document.getElementById('celular')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const enable = async () => {
    setBusy(true);
    setError('');
    try {
      await enablePushHere();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const test = async (delay: number) => {
    setResults(null);
    setError('');
    setCountdown(delay);
    try {
      setResults(await notificationsService.pushTest(delay));
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Não foi possível enviar o teste agora.');
    } finally {
      setCountdown(0);
      refresh();
    }
  };

  const thisDevice = server?.devices.find((d) => d.endpoint === local?.endpoint);
  const otherDevices = server?.devices.filter((d) => d.endpoint !== local?.endpoint) ?? [];

  return (
    <section id="celular" className="card p-4 sm:p-5 space-y-3 scroll-mt-20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-text-primary tracking-wider flex items-center gap-2">
            <Smartphone size={18} className="text-text-muted" /> NOTIFICAÇÕES NO CELULAR
          </h2>
          <p className="text-xs text-text-muted">Para os avisos aparecerem mesmo com o app fechado e a tela bloqueada.</p>
        </div>
        {!loading && (
          <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider',
            ready ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30')}>
            {ready ? 'Funcionando aqui' : 'Precisa de atenção'}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-text-muted flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Verificando…</p>
      ) : (
        <ul className="divide-y divide-border/40">
          <Row state={server?.server === 'ok' ? 'ok' : 'fail'}
            title={server?.server === 'ok' ? 'Servidor pronto para enviar' : 'Servidor com o push desligado'}>
            {server?.server === 'missing' && <p>Faltam as chaves VAPID no servidor. {isStaff ? 'Confira VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_CLAIM_EMAIL no Cloud Run.' : 'Avise a organização.'}</p>}
            {server?.server === 'invalid' && <p>As chaves VAPID do servidor não formam um par válido. {isStaff ? 'A chave privada e a pública no Cloud Run precisam ter sido geradas juntas.' : 'Avise a organização.'}</p>}
          </Row>

          <Row state={local?.supported ? 'ok' : 'fail'} title={local?.supported ? 'Este aparelho recebe notificações' : 'Este navegador não recebe notificações'}>
            {local?.iosOutsideApp && (
              <p>No iPhone, as notificações só funcionam com o app instalado: no Safari toque em Compartilhar → “Adicionar à Tela de Início” e abra o app pelo ícone.</p>
            )}
            {!local?.supported && !local?.iosOutsideApp && <p>Use o Chrome no Android, ou o app instalado na Tela de Início no iPhone.</p>}
          </Row>

          {local?.supported && (
            <Row state={local.worker ? 'ok' : 'fail'} title={local.worker ? 'Serviço de notificações do app ativo' : 'O serviço de notificações do app não carregou'}>
              {!local.worker && <p>Sem ele os avisos não chegam com o app fechado. Feche o app por completo e abra de novo (no navegador, recarregue a página).</p>}
            </Row>
          )}

          {local?.supported && (
            <Row
              state={local.permission === 'granted' ? 'ok' : local.permission === 'denied' ? 'fail' : 'warn'}
              title={local.permission === 'granted' ? 'Permissão concedida' : local.permission === 'denied' ? 'Notificações bloqueadas para o app' : 'Ainda não ativadas neste aparelho'}
            >
              {local.permission === 'denied' && <>{ANDROID_STEPS}{IPHONE_STEPS}<p>Depois de liberar, volte aqui e toque em “Verificar de novo”.</p></>}
              {local.permission === 'default' && (
                <button type="button" onClick={enable} disabled={busy} className="btn-primary text-xs inline-flex items-center gap-1.5">
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <BellRing size={13} />} Ativar notificações
                </button>
              )}
            </Row>
          )}

          {local?.supported && local.permission === 'granted' && (
            <Row state={registered ? 'ok' : 'fail'} title={registered ? `Aparelho inscrito (${thisDevice?.device})` : 'Este aparelho não está inscrito'}>
              {registered && thisDevice?.last_success_at && <p>Último aviso entregue em {formatDateTime(thisDevice.last_success_at)}.</p>}
              {registered && thisDevice?.last_error && <p className="text-red">Último erro: {thisDevice.last_error}</p>}
              {!registered && (
                <button type="button" onClick={enable} disabled={busy} className="btn-primary text-xs inline-flex items-center gap-1.5">
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <BellRing size={13} />} Inscrever este aparelho
                </button>
              )}
            </Row>
          )}
        </ul>
      )}

      {error && <p className="rounded-xl border border-red/30 bg-red/10 p-3 text-xs font-medium text-red">{error}</p>}

      {/* Teste com a tela bloqueada */}
      {ready && (
        <div className="rounded-xl bg-text-primary/[0.03] border border-border/50 p-3 space-y-2">
          {countdown > 0 ? (
            <p className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Loader2 size={15} className="animate-spin" /> Bloqueie a tela agora… o teste chega em {countdown}s
            </p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" onClick={() => test(TEST_DELAY)} className="btn-primary text-sm inline-flex items-center justify-center gap-2">
                <Send size={14} /> Enviar teste em {TEST_DELAY} segundos
              </button>
              <button type="button" onClick={() => test(0)} className="btn-secondary text-sm">Enviar agora</button>
            </div>
          )}
          <p className="text-[11px] text-text-muted">Toque em enviar, bloqueie o celular e espere: a notificação deve aparecer na tela bloqueada.</p>
          {results && (
            <ul className="space-y-1">
              {results.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  {r.status === 'delivered' ? <CheckCircle2 size={14} className="text-green-500 shrink-0" /> : <XCircle size={14} className="text-red shrink-0" />}
                  <span className="text-text-secondary">
                    <strong className="text-text-primary">{r.device}:</strong>{' '}
                    {r.status === 'delivered' ? 'entregue ao celular.' : r.status === 'expired' ? 'inscrição expirada (removida). Ative de novo nesse aparelho.' : r.detail}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {results?.some((r) => r.status === 'delivered') && (
            <p className="text-[11px] text-text-muted">Foi entregue mas não apareceu na tela? Então falta liberar no celular: veja o passo a passo logo abaixo.</p>
          )}
        </div>
      )}

      {otherDevices.length > 0 && (
        <p className="text-[11px] text-text-muted">
          Outros aparelhos nesta conta: {otherDevices.map((d) => `${d.device}${d.last_error ? ' (com erro)' : ''}`).join(', ')}.
        </p>
      )}

      <details className="rounded-xl border border-border/50 p-3 text-xs text-text-muted">
        <summary className="cursor-pointer font-bold text-text-primary">Aparece no app mas não na tela do celular?</summary>
        <div className="mt-2 space-y-2 leading-relaxed">{ANDROID_STEPS}{IPHONE_STEPS}</div>
      </details>

      <div className="flex justify-end">
        <button type="button" onClick={refresh} className="text-xs font-bold text-text-muted hover:text-text-primary">Verificar de novo</button>
      </div>

      {isStaff && <StaffCoverage />}
    </section>
  );
}
