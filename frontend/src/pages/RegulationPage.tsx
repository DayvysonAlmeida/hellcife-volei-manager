import { motion } from 'framer-motion';
import { ScrollText, Shield, Star, Calendar, MapPin, Users, DollarSign, Heart, AlertTriangle, Clock, AlertCircle, Info } from 'lucide-react';

export function RegulationPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-8 text-center bg-card-gradient border-neon-red relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red via-blue to-red" />
        <ScrollText className="w-16 h-16 text-red mx-auto mb-4" />
        <h1 className="page-title">
          REGULAMENTO OFICIAL
        </h1>
        <h2 className="text-xl text-text-secondary font-medium uppercase tracking-widest">
          HELLCIFE VÔLEI
        </h2>
      </motion.div>

      {/* Intro */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-6 md:p-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <Shield className="text-red" />
          <h3 className="font-display text-2xl tracking-wider text-text-primary">APRESENTAÇÃO</h3>
        </div>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>
            O Hellcife Vôlei é uma comunidade esportiva dedicada à prática do voleibol, fundamentada nos valores de respeito, disciplina, comprometimento, meritocracia e espírito esportivo.
          </p>
          <p>
            Nosso propósito é proporcionar um ambiente organizado, competitivo e saudável para o desenvolvimento técnico dos atletas, promovendo integração, evolução contínua e preparação para futuras competições.
          </p>
          <blockquote className="border-l-4 border-blue bg-blue/5 p-4 rounded-r-lg italic text-text-primary">
            "A força de um grupo não está apenas em seus melhores jogadores, mas no compromisso coletivo com a excelência."
          </blockquote>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sistema de Estrelas */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Star className="text-yellow-500" />
            <h3 className="font-display text-xl tracking-wider text-text-primary">SISTEMA DE ESTRELAS</h3>
          </div>
          <div className="space-y-3 text-sm text-text-secondary">
            <p className="font-medium text-text-primary">Todo integrante inicia sua trajetória no grupo com 1🌟.</p>
            <p>O sistema tem como finalidade classificar os participantes de acordo com critérios de:</p>
            <ul className="grid grid-cols-2 gap-2 list-disc list-inside mt-2 text-text-muted">
              <li>Nível técnico</li>
              <li>Desempenho</li>
              <li>Frequência</li>
              <li>Comprometimento</li>
              <li>Antiguidade</li>
              <li>Conduta esportiva</li>
            </ul>
            <p className="mt-3">As classificações promovem equilíbrio técnico nas equipes e reconhecimento da evolução individual.</p>
          </div>
        </motion.section>

        {/* Princípios */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-6 border-neon-blue-sm"
        >
          <div className="flex items-center gap-3 mb-4">
            <Heart className="text-blue" />
            <h3 className="font-display text-xl tracking-wider text-text-primary">PRINCÍPIOS DO HELLCIFE</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              'Respeito', 'Lealdade', 'Comprometimento', 'Espírito esportivo',
              'Evolução contínua', 'Meritocracia', 'Organização'
            ].map((principio) => (
              <div key={principio} className="flex items-center gap-2 text-sm text-text-secondary bg-surface-highlight p-2 rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-blue" />
                {principio}
              </div>
            ))}
          </div>
        </motion.section>
      </div>

      {/* Programação e Locais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="text-green-500" />
            <h3 className="font-display text-xl tracking-wider text-text-primary">PROGRAMAÇÃO OFICIAL</h3>
          </div>
          <div className="space-y-3">
            {[
              { dia: 'Terça-Feira', hora: '19h às 22h', status: 'Em Andamento' },
              { dia: 'Quinta-Feira', hora: '19h às 22h', status: 'Em Andamento' },
              { dia: 'Sexta-feira', hora: '19h às 21h', status: '' },
              { dia: 'Domingo', hora: '10h às 12h', status: '' },
            ].map((prog) => (
              <div key={prog.dia} className="flex justify-between items-center p-3 rounded-lg bg-surface border border-border">
                <span className="font-medium text-text-primary">{prog.dia}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-green-400">{prog.hora}</span>
                  {prog.status && <span className="text-[10px] uppercase bg-green-900/40 text-green-400 px-2 py-0.5 rounded-full border border-green-800">{prog.status}</span>}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <MapPin className="text-orange-500" />
            <h3 className="font-display text-xl tracking-wider text-text-primary">LOCAIS DE ATIVIDADE</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-text-secondary">
            {[
              'Prainha ZS', 'Belo Gol', 'Arena São Miguel', 'Arena Deep',
              "Arena Mago's", 'Quadra Lagoa do Araçá (Em Andamento)', 'Quadra Compaz Miguel Arraes (Em Andamento)'
            ].map((local) => (
              <div key={local} className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface transition-colors">
                <MapPin size={14} className="text-orange-500/50" />
                <span className="truncate">{local}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-4 italic">A administração poderá utilizar outros locais sempre que necessário.</p>
        </motion.section>
      </div>

      {/* Regras e Penalidades */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="card p-6 md:p-8 border-neon-red-sm"
      >
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="text-red" />
          <h3 className="font-display text-2xl tracking-wider text-text-primary">CONDUTAS VEDADAS & PENALIDADES</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h4 className="font-medium text-red mb-3 flex items-center gap-2">
              <AlertCircle size={16} /> Não toleramos:
            </h4>
            <ul className="space-y-2 text-sm text-text-secondary">
              {[
                'Racismo, Homofobia, Machismo, Misoginia',
                'Qualquer forma de discriminação',
                'Assédio ou intimidação',
                'Comportamento antidesportivo',
                'Ofensas ou ataques pessoais',
                'Menosprezo ao nível técnico de outros atletas',
                'Spam e divulgação não autorizada'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-red font-bold mt-0.5">×</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className="font-medium text-yellow-500 mb-3 flex items-center gap-2">
                <Clock size={16} /> Faltas sem Justificativa
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3 p-2 bg-yellow-900/20 rounded border border-yellow-900/50">
                  <div className="w-3 h-3 bg-yellow-500 rounded-sm" />
                  <span className="text-text-secondary">1ª Ocorrência — Advertência</span>
                </div>
                <div className="flex items-center gap-3 p-2 bg-orange-900/20 rounded border border-orange-900/50">
                  <div className="w-3 h-3 bg-orange-500 rounded-sm" />
                  <span className="text-text-secondary">2ª Ocorrência — Afastamento</span>
                </div>
                <div className="flex items-center gap-3 p-2 bg-red-900/20 rounded border border-red-900/50">
                  <div className="w-3 h-3 bg-red rounded-sm" />
                  <span className="text-text-secondary">3ª Ocorrência — Exclusão</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Regras de Jogo & Listas */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="card p-6 md:p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <Info className="text-blue" />
          <h3 className="font-display text-2xl tracking-wider text-text-primary">FORMATO E INSCRIÇÕES</h3>
        </div>

        <div className="space-y-6 text-sm text-text-secondary">
          <div className="bg-surface p-4 rounded-xl border border-border">
            <h4 className="font-display tracking-wider text-text-primary text-lg mb-3">FORMATO DOS JOGOS</h4>
            <ul className="list-disc list-inside space-y-2 text-text-muted">
              <li>Modalidades: 2x2, 3x3 (Exceção), 4x4.</li>
              <li><strong>Areia:</strong> Rodízio de posição não é obrigatório, mas o rodízio de saque é.</li>
              <li>A retirada de 2 times por 2 vitórias consecutivas está <strong>TERMINANTEMENTE</strong> condicionada à presença de 2 times fora de quadra para entrar. Devido à impreterível meritocracia dos vencedores.</li>
              <li><strong>Quadra:</strong> Serão observadas as regras oficiais aplicáveis.</li>
            </ul>
          </div>

          <div className="bg-surface p-4 rounded-xl border border-border">
            <h4 className="font-display tracking-wider text-text-primary text-lg mb-3">LISTAS DE INSCRIÇÃO (Compaz Miguel Arraes)</h4>
            <ul className="list-disc list-inside space-y-2 text-text-muted">
              <li>A lista é liberada 72 horas antes para membros oficiais.</li>
              <li>Convidados podem ser inseridos (no fim da lista) no meio-dia do dia anterior.</li>
              <li>Convidados sobem na ordem se as vagas não forem preenchidas.</li>
              <li><strong>Retirada do nome:</strong> Permitido apenas até as 09h do domingo (Compaz) ou 19h (Prainha ZS). Após o horário, o nome não pode ser removido.</li>
            </ul>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-center py-8 text-text-muted space-y-4"
      >
        <p className="italic text-sm max-w-2xl mx-auto">
          "No Hellcife, o respeito é obrigatório, a evolução é constante e o comprometimento diferencia aqueles que apenas participam daqueles que verdadeiramente fazem parte do cardume."
        </p>
        <div className="inline-block px-4 py-2 bg-surface rounded-full text-xs font-bold uppercase tracking-wider border border-border mt-4 text-text-primary">
          👑 Administração Geral: Walef Abdias
        </div>
      </motion.div>
    </div>
  );
}
