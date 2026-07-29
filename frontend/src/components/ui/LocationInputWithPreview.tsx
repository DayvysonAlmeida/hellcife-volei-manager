import { forwardRef, useState, useEffect } from 'react';
import { useDebounce } from '@/lib/useDebounce';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LocationInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  wrapperClassName?: string;
}

export const LocationInputWithPreview = forwardRef<HTMLInputElement, LocationInputProps>(
  ({ className, wrapperClassName, onChange, value, ...props }, ref) => {
    // Sincroniza o valor local para sabermos quando atualizar o iframe
    const [localValue, setLocalValue] = useState(value?.toString() || '');
    
    // Aguarda 800ms após o usuário parar de digitar para atualizar o mapa
    const debouncedValue = useDebounce(localValue, 800);

    // Se o valor mudar externamente (ex: inicialização do formulário), atualiza o estado local
    useEffect(() => {
      if (value !== undefined && value !== null) {
        setLocalValue(value.toString());
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalValue(e.target.value);
      if (onChange) onChange(e);
    };

    // Só mostra o preview se tiver mais de 3 letras
    const showPreview = debouncedValue.trim().length > 3;
    const encodedLocation = encodeURIComponent(debouncedValue.trim());
    const mapUrl = `https://maps.google.com/maps?q=${encodedLocation}&output=embed`;

    return (
      <div className={cn("flex flex-col", wrapperClassName)}>
        <input
          ref={ref}
          value={value !== undefined ? value : localValue}
          onChange={handleChange}
          className={cn("w-full", className)}
          {...props}
        />
        
        {/* Container do Mini-mapa animado */}
        {showPreview && (
          <div className="relative w-full h-[160px] rounded-lg overflow-hidden border border-border mt-2 bg-surface-highlight animate-in fade-in slide-in-from-top-2 duration-300 shadow-inner">
            <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-text-muted flex items-center gap-1.5 z-10 border border-border shadow-sm">
              <MapPin size={12} className="text-red" />
              PREVIEW DO MAPA
            </div>
            <iframe
              key={mapUrl} // O key força o iframe a recarregar quando a URL muda
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src={mapUrl}
            ></iframe>
          </div>
        )}
      </div>
    );
  }
);

LocationInputWithPreview.displayName = 'LocationInputWithPreview';
