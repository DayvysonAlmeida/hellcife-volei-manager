import type { QueryClient } from '@tanstack/react-query';

/** Invalida tudo que depende de pagamentos de circuito. */
export function invalidatePaymentQueries(qc: QueryClient, gamedayId: number) {
  qc.invalidateQueries({ queryKey: ['gameday', gamedayId] });
  qc.invalidateQueries({ queryKey: ['gameday-finance', gamedayId] });
  qc.invalidateQueries({ queryKey: ['gamedays'] });
  qc.invalidateQueries({ queryKey: ['circuit-finance'] });
}
