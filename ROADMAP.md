# 🏐 Hellcife Vôlei Manager — Roadmap 2026
Última atualização: 03/08/2026 — Backend no Google Cloud Run, Frontend no Vercel, Banco de dados Neon (PostgreSQL), Storage de mídia Cloudinary.

## ✅ Feito Recentemente
| Item | Descrição |
|---|---|
| ✅ PlayerCard alerta de faltas | Corrigido: agora exige >= 8 (era > 0) |
| ✅ MyProfilePage alerta de faltas | Corrigido: mesma regra do PlayerCard |
| ✅ settings.py | Removido RENDER_EXTERNAL_HOSTNAME, adicionado suporte ao CLOUDRUN_SERVICE_URL |
| ✅ README.md | Reescrito com nova stack, tabela de vars do Cloud Run e instruções de deploy |
| ✅ Limpeza de imports | Removidos imports não usados em 5 arquivos |
| ✅ handleEditLimit | Renomeado para _handleEditLimit (sinaliza que é intencional) |
| ✅ useNotifications polling | staleTime: 0 + intervalo 60s → 30s |
| ✅ Notificações nativas | Web Notifications API |
| ✅ NotificationsPage | Nova página com filtros por tipo |
| ✅ Rotas /notifications | Adicionadas ao painel admin e ao portal do atleta |
| ✅ NotificationBell | Link "Ver todas" no dropdown leva para a página dedicada |
| ✅ Botão Excluir Atleta | Adicionado no formulário de edição de jogador |

---

## 🗺️ O Que Ainda Falta

### 🔴 FASE 1 — Infraestrutura e DevOps
- [x] Atualizar settings.py (RENDER → Cloud Run)
- [x] Atualizar README.md
- [x] Remover render.yaml da raiz do projeto (arquivo obsoleto)
- [x] Criar .env.example com todas as variáveis necessárias
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

### 🟡 FASE 3 — Features Faltantes

#### 3.1 — Hall da Fama 🏆 *(PAUSADO PARA O FUTURO)*
- [ ] Criar página `/hall-of-fame` no frontend
- [ ] Listagem de campeões por categoria e ano (visual tipo "troféus")
- [ ] CRUD de entradas no Hall da Fama (admin)
- [x] Integrar com o Dashboard mostrando destaque do campeão atual (O endpoint do Dashboard já envia os dados do Hall da Fama e a tela renderiza)

#### 3.2 — Notificações 🔔
- [x] Página dedicada de notificações com filtros por tipo
- [x] Marcar todas como lidas
- [x] Filtrar por tipo (sistema, prêmio, circuito, alerta)
- [x] Notificações nativas do navegador (Web Notifications API)
- [x] Polling corrigido (staleTime 0 + 30s)
- [x] GlobalAnnouncement via admin — garantir que admins consigam enviar aviso para todos os atletas de forma fácil

#### 3.3 — Regulamento Dinâmico 📋
- [ ] Criar modelo no backend para o texto do regulamento
- [ ] Endpoint para leitura pública e edição por admins
- [ ] Atualizar RegulationPage para carregar da API e não hardcoded

### 🟢 FASE 4 — Melhorias de Experiência (UX/UI)
#### 4.1 — Portal do Atleta
- [x] Compartilhar conquista nas redes sociais (ShareAchievementModal integrado)
- [x] Histórico de avaliações visual: gráfico de evolução do overall no `/athlete/profile` (Já implementado em MyProfilePage)
- [ ] Emblemas/badges desbloqueáveis por marcos ("10 jogos", "primeira grande estrela", "5 vitórias seguidas")

#### 4.2 — Painel Admin
- [x] Editar partida (`/matches/:id/edit`): formulário reutiliza MatchFormPage com carregamento de dados existentes
- [ ] Exportar dados: exportar lista de jogadores, presenças ou avaliações para CSV
- [ ] Histórico de estrelas visual: timeline interativa no detalhe do jogador
- [ ] Filtro por data no Leaderboard
- [x] Reordenar fila de espera: drag-and-drop com @dnd-kit para mudar prioridade

#### 4.3 — Geração de Times
- [x] Balancear por gênero: respeitando proporção M/F (Implementado direto no backend em `algorithm.py`)
- [ ] Salvar preset de times
- [ ] Melhorar visualização do chaveamento (animações no BracketPage)

### 🔵 FASE 5 — Features Avançadas (Médio Prazo)
#### 5.1 — Sistema de Temporadas 📅
- [ ] Criar modelo `Season` no backend
- [ ] Vincular circuitos, partidas e avaliações a uma temporada
- [ ] Leaderboard e Hall da Fama filtrados por temporada
- [ ] Encerramento de temporada (congelar estatísticas)

#### 5.2 — Pagamentos, Assinaturas e Rateio 💰
- [x] Criação do módulo de assinaturas/planos (`apps/subscriptions`)
- [x] Integração com gateway de pagamentos (Asaas)
- [ ] Atleta confirma pagamento PIX (`payment_claimed` no Portal do Atleta)
- [ ] Admin confirma recebimento (`has_paid`)
- [ ] Relatório financeiro por circuito e por mês

#### 5.3 — Notificações Push (PWA) 📲
- [ ] Implementar Web Push API no backend (django-push-notifications ou similar)
- [ ] Gerar VAPID keys
- [ ] Atleta recebe push nativo

#### 5.4 — App Mobile (Longo Prazo) 📱
- [ ] Avaliar React Native (Expo)
- [ ] Funcionalidade offline para check-in na quadra

### ⚪ FASE 6 — Qualidade e Testes (Contínuo)
- [ ] Organizar testes do backend: mover `test_*.py` da raiz para `/tests/`
- [ ] Testes de integração da API
- [ ] Testes E2E no frontend
- [ ] Cloud Monitoring
- [ ] Logs JSON estruturados
- [ ] Cobertura mínima: meta de 60% no backend

---
## 📊 Progresso Geral
| Fase | Itens Feitos | Total | % |
|---|---|---|---|
| 🔴 Fase 1 — Infra | 5 | 7 | 71% |
| 🟠 Fase 2 — Dívida Técnica | 9 | 9 | 100% ✅ |
| 🟡 Fase 3 — Features Faltantes | 8 | 11 | 73% |
| 🟢 Fase 4 — UX/UI | 5 | 10 | 50% |
| 🔵 Fase 5 — Avançado | 3 | 12 | 25% |
| ⚪ Fase 6 — Qualidade | 0 | 6 | 0% |

