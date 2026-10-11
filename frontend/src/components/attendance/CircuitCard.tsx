import React from 'react';
import { Clock, MapPin, ChevronRight, User } from 'lucide-react';
import type { GameDay } from '@/types';
import { cn } from '@/lib/utils';

interface CircuitCardProps {
  gameDay: GameDay;
  onClick: () => void;
  badge?: React.ReactNode;
}

export function CircuitCard({ gameDay, onClick, badge }: CircuitCardProps) {
  const dateObj = new Date(gameDay.date);
  
  // Ajuste do fuso para não dar problema no dia da semana
  const localDate = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000);
  
  const days = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
  const dayOfWeek = days[localDate.getDay()];
  
  const formattedDate = localDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const isFriday = localDate.getDay() === 5;
  const isWeekend = localDate.getDay() === 0 || localDate.getDay() === 6;

  let dayColor = 'text-white';
  if (isFriday) dayColor = 'text-blue-500';
  if (isWeekend) dayColor = 'text-red';

  const maxPlayers = gameDay.max_players || 16;
  const totalPresent = gameDay.total_present || 0;
  const availableSlots = Math.max(0, maxPlayers - totalPresent);
  const isAlmostFull = availableSlots > 0 && availableSlots <= 3;
  const isFull = availableSlots === 0;

  // Render slots as person icons
  const renderSlots = () => {
    const slots = [];
    for (let i = 0; i < maxPlayers; i++) {
      slots.push(
        <div key={i} className={`flex items-center justify-center ${i < totalPresent ? (isFriday ? 'text-blue-500' : 'text-red') : 'text-white/20'}`}>
          <User size={10} className="fill-current" />
        </div>
      );
    }
    return slots;
  };

  const isBeloGol = gameDay.location?.toLowerCase().includes('belo');

  return (
    <div 
      onClick={onClick}
      className="group cursor-pointer relative bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl overflow-hidden transition-all duration-300 hover:border-white/20 flex flex-row h-[130px] w-full"
    >
      {/* Coluna Esquerda: Imagem e Logo */}
      <div className="w-[35%] relative flex-shrink-0 bg-black overflow-hidden">
        {/* Imagem de Fundo */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-60 mix-blend-screen"
          style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?q=80&w=600&auto=format&fit=crop")' }}
        />
        
        {/* Gradient Bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
        
        <div className="relative z-20 w-full h-full flex items-center justify-center p-2">
          {isBeloGol ? (
            <div className="flex flex-col items-center">
              <span className="text-2xl sm:text-3xl font-black italic tracking-tighter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                <span className="text-blue-400">belo</span>
                <span className="text-green-500">Gol</span>
              </span>
              <span className="text-[6px] sm:text-[7px] font-bold tracking-[0.2em] text-white mt-1 drop-shadow-md">FUTEBOL SOCIETY</span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-red drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">HELLCIFE</span>
              <span className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-blue-500 -mt-1 drop-shadow-md">VÔLEI</span>
            </div>
          )}
        </div>
      </div>

      {/* Coluna Central: Data e Local */}
      <div className="flex-1 p-3 flex flex-col justify-center border-r border-[#2a2a2a] relative">
        <h3 className={`flex items-center justify-between text-[10px] font-black uppercase tracking-widest ${dayColor} mb-0.5`}>
          <span>{dayOfWeek}</span>
          {badge && <div>{badge}</div>}
        </h3>
        <p className="text-xl sm:text-2xl font-black text-white leading-none tracking-tight">
          {formattedDate}
        </p>
        
        <div className={`w-full h-px mt-2.5 mb-2.5 ${isFriday ? 'bg-blue-500/20' : 'bg-red/20'}`} />
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock size={13} className={isFriday ? 'text-blue-500' : 'text-red'} />
            <span className="text-xs font-bold text-white tracking-wide">{gameDay.time ? gameDay.time.substring(0, 5) : '00:00'}</span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin size={13} className="text-white shrink-0 mt-0.5" />
            <div className="flex flex-col leading-none">
              <span className="text-[10px] font-black text-white uppercase tracking-widest truncate max-w-[100px]">
                {gameDay.location || 'LOCAL'}
              </span>
              <span className="text-[8px] text-white/50 font-bold uppercase tracking-widest mt-1">
                {gameDay.location?.toUpperCase() || 'ARENA'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Coluna Direita: Vagas */}
      <div className="w-[30%] p-3 flex flex-col justify-between bg-[#0f0f0f]">
        <div>
          <h4 className="text-[9px] font-bold text-white uppercase tracking-widest mb-1">VAGAS</h4>
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-0.5 font-black">
              <span className={`text-3xl leading-none tracking-tighter ${isFriday ? 'text-blue-500' : 'text-red'}`}>{totalPresent}</span>
              <span className="text-sm text-white/50 leading-none">/{maxPlayers}</span>
            </div>
            <ChevronRight className="text-white/30" size={16} />
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          <div className="flex flex-wrap gap-0.5 max-w-[88px]">
            {renderSlots()}
          </div>
          
          <div className="flex items-center">
            {isFull ? (
              <span className="px-1.5 py-0.5 bg-[#222] border border-[#333] text-white/60 text-[7px] font-bold uppercase rounded flex items-center justify-center w-full">
                Lotação Máxima
              </span>
            ) : isAlmostFull ? (
              <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-500 text-[7px] font-bold uppercase rounded flex items-center justify-center gap-1 w-full truncate">
                <User size={8} /> Últimas Vagas!
              </span>
            ) : (
              <span className="px-1.5 py-0.5 bg-red/10 border border-red/30 text-red text-[7px] font-bold uppercase rounded flex items-center justify-center gap-1 w-full truncate">
                <User size={8} className="shrink-0" /> {availableSlots} DISPONÍVEIS
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
