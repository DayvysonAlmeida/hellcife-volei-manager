import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Position, PlayerStatus } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getPositionClass(position: Position): string {
  const classes: Record<Position, string> = {
    libero: 'badge-libero',
    setter: 'badge-setter',
    opposite: 'badge-opposite',
    outside: 'badge-outside',
    middle: 'badge-middle',
    universal: 'badge-universal',
  };
  return classes[position] || 'badge-universal';
}

export function getStatusClass(status: PlayerStatus): string {
  const classes: Record<PlayerStatus, string> = {
    active: 'badge-active',
    inactive: 'badge-inactive',
    injured: 'badge-injured',
    suspended: 'badge-suspended',
  };
  return classes[status] || 'badge-inactive';
}

export function getOverallColor(overall: number): string {
  if (overall >= 8.5) return '#D90429'; // Elite - vermelho neon
  if (overall >= 7.5) return '#2563EB'; // Ótimo - azul
  if (overall >= 6.5) return '#16A34A'; // Bom - verde
  if (overall >= 5.5) return '#CA8A04'; // Regular - amarelo
  return '#71717A'; // Abaixo da média - cinza
}

export function getOverallLabel(overall: number): string {
  if (overall >= 8.5) return 'ELITE';
  if (overall >= 7.5) return 'ÓTIMO';
  if (overall >= 6.5) return 'BOM';
  if (overall >= 5.5) return 'REGULAR';
  return 'EM DESENVOLVIMENTO';
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  // Se for apenas a data (YYYY-MM-DD), não aplica conversão de timezone que subtrai 1 dia no Brasil
  if (dateStr.length === 10 && dateStr.includes('-')) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function getAvatarColor(name: string): string {
  const colors = [
    'from-red to-red-dark',
    'from-blue to-blue-dark',
    'from-purple-600 to-purple-800',
    'from-green-600 to-green-800',
    'from-orange-500 to-orange-700',
    'from-cyan-500 to-cyan-700',
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}
