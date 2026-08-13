# Hellcife Vôlei Manager 🏐

Um sistema completo de gerenciamento para o time Hellcife Vôlei. Esta aplicação permite o controle total das atividades do time, desde o cadastro de jogadores até o acompanhamento de presenças, partidas, avaliações e a manutenção de um "Hall da Fama".

## 🚀 Funcionalidades

O sistema está dividido em vários módulos no backend que refletem as funcionalidades principais:
- **Players (Jogadores)**: Gestão de perfis e dados de jogadores.
- **Teams (Times)**: Gerenciamento de escalações e equipes balanceadas por overall.
- **Matches (Partidas)**: Registro e acompanhamento de jogos, placares e estatísticas.
- **Attendance (Presenças)**: Controle de presença nos circuitos, fila de espera e check-in na quadra.
- **Evaluations (Avaliações)**: Avaliação de desempenho técnico com 13 fundamentos e cálculo de overall automático.
- **Stars System (Estrelas)**: Sistema de premiação por categorias (MVP, Ataque, Defesa, etc.) com mini e grandes estrelas.
- **Notifications (Notificações)**: Notificações individuais e avisos globais para todos os atletas.
- **Subscriptions (Assinaturas)**: Gestão de planos, assinaturas e integração com Asaas para pagamentos via PIX.
- **Hall of Fame**: Destaques, premiações e jogadores notáveis por categoria e ano.

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

# Configure as variáveis de ambiente (copie o .env.example)
copy .env.example .env
# Edite o .env com suas configurações locais

# Rode as migrações do banco de dados
python manage.py migrate

# Inicie o servidor de desenvolvimento
python manage.py runserver
```

A API estará disponível em `http://127.0.0.1:8000/`. A documentação Swagger fica em `/api/schema/swagger-ui/`.

### 2. Frontend (React/Vite)

Em um novo terminal, navegue até a pasta `frontend` e execute:

```bash
cd frontend

# Instale as dependências do Node
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

O Frontend estará disponível (normalmente) em `http://localhost:5173/`.

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

> **Nota:** As migrações do banco de dados são executadas automaticamente na inicialização do container via `CMD` no Dockerfile.

---
Desenvolvido para gerenciar a paixão e o talento do Hellcife Vôlei. 🏐🔥
