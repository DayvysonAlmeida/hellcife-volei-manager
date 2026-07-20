import { useState, useEffect } from 'react';

/**
 * Hook de debounce — atrasa a atualização de um valor por `delay` ms.
 * Usado para evitar requests desnecessários durante digitação em campos de busca.
 *
 * @param value - Valor a ser "debounced"
 * @param delay - Delay em milissegundos (padrão: 300ms)
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
