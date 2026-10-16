/**
 * Pagamentos online (planos, créditos avulsos e PIX automático) dependem de um gateway configurado.
 * Enquanto não estiverem ativos, o atleta não vê as telas de planos/assinatura.
 * Para ligar: VITE_PAGAMENTOS_ONLINE=true no ambiente do frontend (Vercel).
 */
export const ONLINE_PAYMENTS = import.meta.env.VITE_PAGAMENTOS_ONLINE === 'true';
