import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { MapPin, X, ExternalLink } from 'lucide-react';

interface LocationMapModalProps {
  location: string;
  className?: string;
  buttonText?: string;
  showIcon?: boolean;
}

export function LocationMapModal({ location, className = '', buttonText, showIcon = true }: LocationMapModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!location) return null;

  const encodedLocation = encodeURIComponent(location);
  const mapUrl = `https://maps.google.com/maps?q=${encodedLocation}&output=embed`;
  const externalMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <div onClick={(e) => e.stopPropagation()} className="inline-flex">
        <Dialog.Trigger asChild>
          <button 
            className={`flex items-center gap-1.5 text-primary hover:text-primary-light transition-colors text-left ${className}`}
            title="Ver localização da arena no mapa"
          >
            {showIcon && <MapPin size={16} className="shrink-0" />}
            {buttonText && <span>{buttonText}</span>}
            {!buttonText && <span className="truncate">{location}</span>}
          </button>
        </Dialog.Trigger>
      </div>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-in fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95%] sm:w-[90%] max-w-4xl bg-surface border border-border p-4 sm:p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in-0 duration-200">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-full text-primary hidden sm:block">
                <MapPin size={24} />
              </div>
              <div>
                <Dialog.Title className="font-display text-lg sm:text-xl text-text-primary">
                  Localização da Arena
                </Dialog.Title>
                <Dialog.Description className="text-text-secondary text-sm">
                  {location}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close className="text-text-muted hover:text-text-primary transition-colors p-1">
              <X size={24} />
            </Dialog.Close>
          </div>
          
          <div className="w-full h-[400px] sm:h-[500px] rounded-xl overflow-hidden border border-border mt-4 bg-background">
            <iframe
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src={mapUrl}
            ></iframe>
          </div>

          <div className="mt-4 flex justify-end">
             <a 
                href={externalMapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex items-center gap-2 py-2 px-4"
              >
                Abrir no Google Maps <ExternalLink size={16} />
             </a>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
