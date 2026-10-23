import { GUEST_LEVELS } from '@/lib/guestLevel';

/** Lista de níveis do convidado, agrupada em Iniciante (1–3), Intermediário (4–7) e Avançado (8–10). */
export function GuestLevelSelect({ id, value, onChange, className, ariaLabel }: {
  id?: string;
  value: number | null;
  onChange: (value: number) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <select id={id} value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))} className={className} aria-label={ariaLabel}>
      {value == null && <option value="" disabled>Sem nível</option>}
      {GUEST_LEVELS.map((level) => (
        <optgroup key={level.label} label={`${level.label} (${level.values[0]}–${level.values[level.values.length - 1]})`}>
          {level.values.map((v) => (
            <option key={v} value={v}>{level.label} · {v}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
