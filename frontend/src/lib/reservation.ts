/** Tempo restante de uma reserva aguardando pagamento. */
export function reservationTimeLeft(until?: string | null): { label: string; expired: boolean } | null {
  if (!until) return null;
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return { label: 'prazo vencido', expired: true };
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return { label: h > 0 ? `${h}h${m ? ` ${m}min` : ''}` : `${m}min`, expired: false };
}
