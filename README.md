# Hellcife Vôlei Manager 🏐

Um sistema completo de gerenciamento para o time Hellcife Vôlei. Esta aplicação permite o controle total das atividades do time, desde o cadastro de jogadores até o acompanhamento de presenças, partidas, avaliações e a manutenção de um "Hall da Fama".

## 🚀 Funcionalidades

O sistema está dividido em vários módulos no backend que refletem as funcionalidades principais:
- **Players (Jogadores)**: Gestão de perfis e dados de jogadores, badges e Sala de Troféus.
- **Rankings e Temporadas**: Elo por times (força dos times em quadra; jogos de calibração no início de cada temporada), Fire Shark (aproveitamento ajustado, com mínimo de partidas proporcional à temporada e desempate pelo saldo de pontos), Gladiador (mais vitórias) e Estrelas (acumuladas na carreira). Temporadas semestrais a partir de 2027 (a Pré-temporada vai até 31/12/2026); na virada, o resultado final fica salvo e o Elo recomeça. O ranking de Elo é exibido só para administradores.
- **Portal do Atleta**: Início com o próximo circuito, seus números da temporada, rankings com pódio e "próximo alvo" (o que falta para subir); perfil com a evolução do Elo partida a partida.
- **Teams (Times)**: Gerenciamento de escalações e equipes balanceadas por overall. Na pelada, quem vai embora sai do sorteio (Embaralhar/Completar) sem perder a presença na quadra, e pode voltar depois.
- **Matches (Partidas)**: Registro de jogos, placares e estatísticas, incluindo jogadores emprestados de outro time.
- **Attendance (Presenças e Cobrança)**: Controle de presença nos circuitos, fila de espera e check-in na quadra. Cobrança por circuito com rateio do custo da quadra ou taxa fixa por pessoa (eventos), reserva de vaga com prazo até o pagamento e confirmação manual (PIX, dinheiro ou isento). Faltas contadas pelo check-in na quadra: 10 faltas seguidas inativam o atleta, e a porcentagem de presença segue a mesma regra.
- **Evaluations (Avaliações)**: Avaliação de desempenho técnico com 13 fundamentos e cálculo de overall automático.
- **Stars System (Estrelas)**: Sistema de premiação por categorias (MVP, Ataque, Defesa, etc.) com mini e grandes estrelas.
- **Notifications (Notificações)**: Notificações individuais e avisos globais para todos os atletas.
- **Subscriptions (Assinaturas)**: Gestão de planos, assinaturas e integração com Asaas para pagamentos via PIX.
- **Financeiro**: Painel com recebido, custos de quadra, saldo e evolução mensal (`/finance`), e tela de cobranças com pagamentos informados e pendências (`/finance/circuits`).
- **Hall of Fame e Regulamento**: Hall da Fama por categoria e ano; regulamento editável pelo admin em `/regulation/edit`.
- **Compartilhamento**: Cards de conquista (Fire Shark, Grande/Mini Estrela, Gladiadores) gerados no formato Stories para as redes sociais. O admin só vê os cards que o atleta conquistou, cada um com os números da sua conquista.

## 💻 Tecnologias e Stack

### Frontend
- **Framework**: React 19 com TypeScript
- **Build Tool**: Vite
- **Estilização**: Tailwind CSS
- **Animações**: Framer Motion
- **Gerenciamento de Estado/Data Fetching**: TanStack React Query v5
- **Roteamento**: React Router DOM v7
- **Gráficos**: Recharts
- **Linter**: Oxlint
- **PWA**: Vite PWA Plugin (instalável como aplicativo)

### Backend
- **Framework**: Django 5.1 + Django REST Framework (DRF)
- **Linguagem**: Python 3.11
- **Banco de Dados**: SQLite (Desenvolvimento) / PostgreSQL via psycopg2 (Produção)
- **Autenticação**: SimpleJWT (JSON Web Tokens)
- **Documentação de API**: drf-spectacular (Swagger/OpenAPI)
- **Filtros**: django-filter
- **Arquivos Estáticos**: Whitenoise
- **Servidor de Produção**: Gunicorn

## 📁 Estrutura do Projeto

O projeto é estruturado como um monorepo contendo ambas as aplicações:
- `/frontend/` - Aplicação SPA React (PWA)
- `/backend/` - API RESTful Django

## ☁️ Infraestrutura de Produção

| Serviço | Plataforma |
|---|---|
| **Backend (API)** | Google Cloud Run (container Docker) |
| **Frontend** | Vercel |
| **Banco de Dados** | Neon DB (PostgreSQL serverless) |
| **Storage de Mídia** | Cloudinary |

## 🛠️ Como Executar Localmente

Siga os passos abaixo para rodar o projeto na sua máquina.

### 1. Backend (Django API)

Abra o terminal, navegue até a pasta `backend` e execute:

```bash
cd backend

# Crie e ative um ambiente virtual (Windows)
python -m venv venv
venv\Scripts\activate
# (Para Linux/Mac: source venv/bin/activate)

# Instale as dependências
pip install -r requirements.txt

# Configure as variáveis de ambiente (o .env.example fica na raiz do repositório)
copy ..\.env.example .env
# (Para Linux/Mac: cp ../.env.example .env)
# Edite o .env com suas configurações locais

# Rode as migrações do banco de dados
python manage.py migrate

# Inicie o servidor de desenvolvimento
python manage.py runserver
```

A API estará disponível em `http://127.0.0.1:8000/`. A documentação Swagger fica em `/api/schema/swagger-ui/`.

Para rodar os testes do backend:

```bash
python manage.py test apps
```

### 2. Frontend (React/Vite)

Em um novo terminal, navegue até a pasta `frontend` e execute:

```bash
cd frontend

# Instale as dependências do Node
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

O Frontend estará disponível (normalmente) em `http://localhost:5173/`. Em desenvolvimento, as chamadas para `/api` são redirecionadas para o backend em `http://127.0.0.1:8000`.

## 🐳 Deploy no Google Cloud Run

O backend é containerizado via Docker e publicado no Google Cloud Run.

### Variáveis de Ambiente Necessárias no Cloud Run

Configure as seguintes variáveis no console do Cloud Run (ou via `gcloud`):

| Variável | Descrição |
|---|---|
| `SECRET_KEY` | Chave secreta do Django |
| `DEBUG` | `False` em produção |
| `DATABASE_URL` | Connection string do PostgreSQL (ex: Neon DB) |
| `ALLOWED_HOSTS` | Domínios permitidos (ex: `localhost`) |
| `CLOUDRUN_SERVICE_URL` | URL completa do serviço (ex: `https://seu-servico-xxxx.run.app`) |
| `CORS_ALLOWED_ORIGINS` | Origem do frontend (ex: `https://seu-app.vercel.app`) |
| `CLOUDINARY_CLOUD_NAME` | Nome do cloud Cloudinary |
| `CLOUDINARY_API_KEY` | API Key do Cloudinary |
| `CLOUDINARY_API_SECRET` | API Secret do Cloudinary |
| `CLOUDINARY_URL` | URL completa do Cloudinary |
| `ASAAS_API_KEY` | Chave da API do Asaas |
| `ASAAS_API_URL` | URL base da API do Asaas (Sandbox ou Produção) |
| `ASAAS_WEBHOOK_TOKEN` | Token para validação de webhooks do Asaas |
| `EXTRA_CREDIT_UNIT_PRICE` | Preço unitário do crédito avulso (ex: 10.00) |
| `FRONTEND_URL` | URL do frontend, usada nos links enviados por e-mail (ex: redefinição de senha) |
| `SECURE_SSL_REDIRECT` | Redireciona HTTP para HTTPS quando `DEBUG=False` (padrão: `True`) |
| `EMAIL_HOST` | Servidor SMTP (padrão: `smtp.gmail.com`) |
| `EMAIL_PORT` | Porta SMTP (padrão: `587`) |
| `EMAIL_USE_TLS` | Usa TLS no SMTP (padrão: `True`) |
| `EMAIL_HOST_USER` | Usuário do SMTP |
| `EMAIL_HOST_PASSWORD` | Senha (ou senha de app) do SMTP |
| `DEFAULT_FROM_EMAIL` | Remetente dos e-mails enviados pelo sistema |

### Processo de Build e Deploy

```bash
# Build da imagem Docker
docker build -t gcr.io/[PROJECT_ID]/hellcife-backend ./backend

# Push para o Google Container Registry
docker push gcr.io/[PROJECT_ID]/hellcife-backend

# Deploy no Cloud Run
gcloud run deploy hellcife-backend \
  --image gcr.io/[PROJECT_ID]/hellcife-backend \
  --platform managed \
  --region southamerica-east1 \
  --allow-unauthenticated
```

> **Nota:** As migrações do banco de dados são executadas automaticamente na inicialização do container (`python manage.py migrate_with_lock`, no `CMD` do Dockerfile). O comando usa uma trava no PostgreSQL, então vários containers subindo juntos não aplicam a mesma migração ao mesmo tempo.

### Variáveis do Frontend (Vercel)

| Variável | Descrição |
|---|---|
| `VITE_API_URL` | URL da API no Cloud Run, terminando em `/api` |
| `VITE_PAGAMENTOS_ONLINE` | `true` mostra planos e carteira para os atletas (desligado enquanto o pagamento online não está ativo) |

---
Desenvolvido para gerenciar a paixão e o talento do Hellcife Vôlei. 🏐🔥
