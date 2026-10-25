/** 000.000.000-00 enquanto digita. */
export function formatCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Confere os dígitos verificadores (a mesma regra do servidor), para avisar antes de enviar. */
export function isValidCpf(value: string) {
  const d = value.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const size of [9, 10]) {
    const total = [...d.slice(0, size)].reduce((sum, digit, i) => sum + Number(digit) * (size + 1 - i), 0);
    if (((total * 10) % 11) % 10 !== Number(d[size])) return false;
  }
  return true;
}
