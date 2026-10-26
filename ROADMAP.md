# 🏐 Hellcife Vôlei Manager — Roadmap 2026
Última atualização: 17/10/2026 — Backend no Google Cloud Run, Frontend no Vercel, Banco de dados Neon (PostgreSQL), Storage de mídia Cloudflare R2.

## ✅ Feito Recentemente
| Item | Descrição |
|---|---|
| ✅ Temporadas | Pré-temporada até 31/12/2026 e temporadas semestrais a partir de 2027; na virada o resultado final é salvo e o Elo recomeça em 500 |
| ✅ Elo por times | Considera a força dos times em quadra; jogos de calibração no início da temporada; editar ou excluir partida recalcula a temporada |
| ✅ Fire Shark equilibrado | Mínimo de partidas proporcional à temporada, aproveitamento ajustado pela quantidade de jogos e desempate pelo saldo de pontos |
| ✅ Ranking de Elo (admin) | Top 10 da temporada no dashboard do admin; só ganha posição quem completou a calibração |
| ✅ Faltas e presença | Inativação pela sequência atual de faltas; presença calculada pelo check-in na quadra, com a mesma regra das faltas |
| ✅ Novo portal do atleta | Início com próximo circuito, pódio e "próximo alvo"; perfil com a evolução do Elo e números por temporada ou carreira |
| ✅ Cards por conquista | O compartilhar do admin oferece só os cards que o atleta conquistou, cada um com os seus dados |
| ✅ Desempenho | Imagens em WebP (até 97% menores), ícones das conquistas sob medida e remoção de imagens e código sem uso |
| ✅ Deploy | Migrações com trava no PostgreSQL ao subir vários containers juntos |
| ✅ Cobrança de circuitos | Rateio do custo da quadra ou taxa fixa por pessoa (eventos), ajustável pelo admin; reserva de vaga com prazo até o pagamento; confirmação manual (PIX, dinheiro, isento) com histórico e estorno |
| ✅ Painel financeiro | Recebido, custos de quadra, saldo e evolução mensal (`/finance`); pagamentos informados e pendências (`/finance/circuits`) |
| ✅ Regulamento dinâmico | Texto salvo no banco, editável pelo admin em `/regulation/edit`; conteúdo antigo recuperado |
| ✅ Hall da Fama | Página `/hall-of-fame` restaurada, com filtro por ano e categoria |
| ✅ Cards de compartilhamento | Novos cards (Fire Shark, Grande/Mini Estrela, Gladiadores) em Canvas, funcionando no iPhone |
| ✅ Placar da pelada | Salvamento do placar corrigido; jogadores emprestados registrados na partida |
| ✅ Quem saiu da pelada | Não volta no Embaralhar/Completar e mantém a presença na quadra (sem ausência ao fechar o circuito) |
| ✅ Webhook do Asaas | Reenvio do mesmo pagamento não gera ciclo duplicado |
| ✅ PlayerCard alerta de faltas | Corrigido: agora exige >= 8 (era > 0) |
| ✅ MyProfilePage alerta de faltas | Corrigido: mesma regra do PlayerCard |
| ✅ settings.py | Removido RENDER_EXTERNAL_HOSTNAME, adicionado suporte ao CLOUDRUN_SERVICE_URL |
| ✅ README.md | Reescrito com nova stack, tabela de vars do Cloud Run e instruções de deploy |
| ✅ Limpeza de imports | Removidos imports não usados em 5 arquivos |
| ✅ handleEditLimit | Renomeado para _handleEditLimit (sinaliza que é intencional) |
| ✅ useNotifications polling | staleTime: 0 + intervalo 60s → 30s |
| ✅ Notificações nativas | Web Notifications API |
| ✅ NotificationsPage | Nova página com filtros por tipo (incluindo financeiro) |
| ✅ Rotas /notifications | Adicionadas ao painel admin e ao portal do atleta |
| ✅ NotificationBell | Link "Ver todas" no dropdown leva para a página dedicada |
| ✅ Botão Excluir Atleta | Adicionado no formulário de edição de jogador |
| ✅ Requirements & Docker | Adicionados requests e python-dateutil; removidos Procfile e build.sh legados |
| ✅ Limpeza players/views.py | Removidas duplicações acidentais e corrigido reset_password |
| ✅ Badges & Conquistas | Modelos Badge, checagem automática e Sala de Troféus implementados |
| ✅ Módulo Financeiro | Gestão Asaas, Dashboard financeiro e confirmações de PIX implementados |

---

## 🗺️ O Que Ainda Falta

### 🔴 FASE 1 — Infraestrutura e DevOps
- [x] Atualizar settings.py (RENDER → Cloud Run)
- [x] Atualizar README.md
- [x] Remover arquivos obsoletos do Render (render.yaml, Procfile, build.sh)
- [x] Criar .env.example com todas as variáveis necessárias (incluindo EXTRA_CREDIT_UNIT_PRICE)
- [ ] Configurar CI/CD (GitHub Actions)
- [ ] Health Check endpoint (/api/health/) para o Cloud Run
- [x] Remover/mover arquivos de debug da raiz (debug_absences.py, test_api.py, test_rank.py, test_stats_rank.py)

### 🟠 FASE 2 — Correções e Dívida Técnica
- [x] Alerta de faltas no PlayerCard
- [x] Alerta de faltas no MyProfilePage
- [x] Limpeza de imports não utilizados no frontend
- [x] Variável winner não usada em AthleteMatchesPage
- [x] useEffect não usado em AttendancePage
- [x] handleEditLimit não utilizado
- [x] ALLOWED_HOSTS no Cloud Run
- [x] Limite de 10 faltas: regra alinhada — backend inativa com >=10, alerta visual a partir de >=8 como aviso antecipado
- [x] Otimizar queries no DashboardPage (validar N+1 queries no endpoint do dashboard)
- [x] `perform_update` duplicado no `GameDayViewSet`: unificado; encerrar o circuito recalcula as faltas

### 🟡 FASE 3 — Features Faltantes

#### 3.1 — Hall da Fama 🏆
- [x] Criar página `/hall-of-fame` no frontend
- [x] Listagem de campeões por categoria e ano (visual tipo "troféus")
- [ ] CRUD de entradas no Hall da Fama (admin)
- [x] Integrar com o Dashboard mostrando destaque do campeão atual (O endpoint do Dashboard já envia os dados do Hall da Fama e a tela renderiza)

#### 3.2 — Notificações 🔔
- [x] Página dedicada de notificações com filtros por tipo
- [x] Marcar todas como lidas
- [x] Filtrar por tipo (sistema, prêmio, circuito, alerta, financeiro)
- [x] Notificações nativas do navegador (Web Notifications API)
- [x] Polling corrigido (staleTime 0 + 30s)
- [x] GlobalAnnouncement via admin — garantir que admins consigam enviar aviso para todos os atletas de forma fácil

#### 3.3 — Regulamento Dinâmico 📋
- [x] Criar modelo no backend para o texto do regulamento (`RegulationText`)
- [x] Endpoint para leitura e edição por admins (`/api/hall-of-fame/regulation/`)
- [x] Atualizar RegulationPage para carregar da API e não hardcoded (edição em `/regulation/edit`)

### 🟢 FASE 4 — Melhorias de Experiência (UX/UI)
#### 4.1 — Portal do Atleta
- [x] Compartilhar conquista nas redes sociais (ShareAchievementModal integrado)
- [x] Histórico de avaliações visual: gráfico de evolução do overall no `/athlete/profile` (Já implementado em MyProfilePage)
- [x] Emblemas/badges desbloqueáveis por marcos (Badge, PlayerBadge, TrophyRoom e check_and_award_badges automático)
- [x] Novo início: próximo circuito, números da temporada, rankings com pódio e "próximo alvo"
- [x] Perfil: evolução do Elo partida a partida e números por temporada ou carreira

#### 4.2 — Painel Admin
- [x] Editar partida (`/matches/:id/edit`): formulário reutiliza MatchFormPage com carregamento de dados existentes
- [ ] Exportar dados: exportar lista de jogadores, presenças ou avaliações para CSV
- [ ] Histórico de estrelas visual: timeline interativa no detalhe do jogador
- [ ] Filtro por data no Leaderboard
- [x] Reordenar fila de espera: drag-and-drop com @dnd-kit para mudar prioridade
- [x] Admin sem Django Admin: justificar falta (Tiragem de Falta), escrever a premiação da temporada (Temporadas), contador de pagamentos avisados no menu e "Custo em Créditos" oculto enquanto os planos estão desligados

#### 4.3 — Geração de Times
- [x] Balancear por gênero: respeitando proporção M/F (Implementado direto no backend em `algorithm.py`)
- [ ] Salvar preset de times
- [ ] Melhorar visualização do chaveamento (animações no BracketPage)

### 🔵 FASE 5 — Features Avançadas (Médio Prazo)
#### 5.1 — Sistema de Temporadas 📅
- [x] Modelo `Season` e calendário semestral (Pré-temporada até 31/12/2026)
- [x] Elo, Fire Shark e Gladiador por temporada (as partidas entram pela data)
- [x] Encerramento automático da temporada com o resultado final salvo (`SeasonStanding`)
- [x] Página Temporadas com o pódio das temporadas encerradas e a premiação
- [ ] Leaderboard e Hall da Fama filtrados por temporada
- [ ] Recalibrar as faixas de Elo depois da Temporada 1
- [ ] Ideia: "Fire Shark do Mês"

#### 5.2 — Pagamentos, Assinaturas e Rateio 💰
- [x] Criação do módulo de assinaturas/planos (`apps/subscriptions`)
- [x] Integração com gateway de pagamentos (Asaas)
- [x] Atleta confirma pagamento PIX (`payment_claimed` no Portal do Atleta)
- [x] Admin confirma recebimento manual (PIX, dinheiro ou isento), com histórico (`AttendancePayment`) e estorno
- [x] Relatório financeiro por circuito e por mês (`FinanceDashboardPage`, `CircuitFinancePage` e endpoints `/api/attendance/finance/`)
- [x] Cobrança por circuito: rateio do custo da quadra ou taxa fixa por pessoa, ajustável pelo admin
- [x] Pagamento antecipado: reserva de vaga com prazo definido pelo admin; o pagamento confirma a vaga
- [x] Webhook do Asaas sem ciclo duplicado em reenvios do mesmo pagamento
- [ ] PIX automático por circuito com o Mercado Pago (gateway escolhido; começa depois da abertura do CNPJ)
- [ ] Cancelar a assinatura no Asaas quando o admin cancela pelo sistema
- [ ] Entrega do PIX na contratação de planos

#### 5.3 — Notificações Push (PWA) 📲
- [x] Implementar Web Push API no backend (`pywebpush`, inscrição dos aparelhos e envio depois do commit pelo `notify()`)
- [x] Service worker mostra o push com o app fechado e abre o app no toque; inscrição ao abrir o app e cancelamento no logout
- [ ] Gerar as chaves VAPID (`python manage.py generate_vapid_keys`) e configurar no Cloud Run
- [ ] Validar o push num Android e num iPhone com o app instalado

#### 5.4 — App Mobile (Longo Prazo) 📱
- [ ] Avaliar React Native (Expo)
- [ ] Funcionalidade offline para check-in na quadra

### ⚪ FASE 6 — Qualidade e Testes (Contínuo)
- [ ] Organizar testes do backend: mover `test_*.py` da raiz para `/tests/`
- [ ] Testes de integração da API *(em andamento: 98 testes em `apps/*/tests.py` para presenças, faltas, cobrança, partidas, Elo, temporadas, rankings, times, regulamento e assinaturas)*
- [ ] Testes E2E no frontend
- [ ] Cloud Monitoring
- [ ] Logs JSON estruturados
- [ ] Cobertura mínima: meta de 60% no backend

---
## 📊 Progresso Geral
| Fase | Itens Feitos | Total | % |
|---|---|---|---|
| 🔴 Fase 1 — Infra | 5 | 7 | 71% |
| 🟠 Fase 2 — Dívida Técnica | 10 | 10 | 100% |
| 🟡 Fase 3 — Features Faltantes | 12 | 13 | 92% |
| 🟢 Fase 4 — UX/UI | 9 | 14 | 64% |
| 🔵 Fase 5 — Avançado | 12 | 23 | 52% |
| ⚪ Fase 6 — Qualidade | 0 | 6 | 0% |


