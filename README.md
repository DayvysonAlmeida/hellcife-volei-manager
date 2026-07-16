# Hellcife Vôlei Manager 🏐

Um sistema completo de gerenciamento para o time Hellcife Vôlei. Esta aplicação permite o controle total das atividades do time, desde o cadastro de jogadores até o acompanhamento de presenças, partidas, avaliações e a manutenção de um "Hall da Fama".

## 🚀 Funcionalidades

O sistema está dividido em vários módulos no backend que refletem as funcionalidades principais:
- **Players (Jogadores)**: Gestão de perfis e dados de jogadores.
- **Teams (Times)**: Gerenciamento de escalações e equipes.
- **Matches (Partidas)**: Registro e acompanhamento de jogos, placares e estatísticas.
- **Attendance (Presenças)**: Controle de presença nos treinos e jogos.
- **Evaluations (Avaliações)**: Avaliação de desempenho técnico e tático dos jogadores.
- **Hall of Fame**: Destaques, premiações e jogadores notáveis.

## 💻 Tecnologias e Stack

### Frontend
- **Framework**: React 19 com TypeScript
- **Build Tool**: Vite
- **Estilização**: Tailwind CSS com componentes baseados em Radix UI (shadcn/ui-like)
- **Animações**: Framer Motion
- **Gerenciamento de Estado/Data Fetching**: TanStack React Query v5
- **Roteamento**: React Router DOM v7
- **Gráficos**: Recharts
- **Linter**: Oxlint

### Backend
- **Framework**: Django 5.1 + Django REST Framework (DRF)
- **Linguagem**: Python 3.12
- **Banco de Dados**: SQLite (Desenvolvimento) / PostgreSQL via psycopg2 (Produção)
- **Autenticação**: SimpleJWT (JSON Web Tokens)
- **Documentação de API**: drf-spectacular (Swagger/OpenAPI)
- **Filtros**: django-filter

## 📁 Estrutura do Projeto

O projeto é estruturado como um monorepo contendo ambas as aplicações:
- `/frontend/` - Aplicação SPA React
- `/backend/` - API RESTful Django
- `render.yaml` - Configurações de infraestrutura como código para deploy no Render.

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

# Rode as migrações do banco de dados
python manage.py migrate

# Inicie o servidor de desenvolvimento
python manage.py runserver
```
A API estará disponível em `http://127.0.0.1:8000/`. (A documentação Swagger geralmente fica em `/api/schema/swagger-ui/`).

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

## ☁️ Deploy

A infraestrutura atual está configurada para suportar deploy automatizado:
- **Backend**: Configurado via `render.yaml` para deploy no **Render** (com suporte a gunicorn e whitenoise para arquivos estáticos).
- **Frontend**: Configurado via `vercel.json` para deploy na **Vercel**.
- **Banco de Dados (Produção)**: Espera-se conexão com um banco de dados relacional como PostgreSQL (ex: Neon DB), configurado pela variável de ambiente `DATABASE_URL`.

---
Desenvolvido para gerenciar a paixão e o talento do Hellcife Vôlei. 🏐🔥
