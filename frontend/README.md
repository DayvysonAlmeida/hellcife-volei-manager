# Hellcife Vôlei Manager — Frontend

SPA em React 19 + TypeScript + Vite, instalável como PWA. Visão geral do projeto, backend e deploy no [README principal](../README.md).

## Scripts

```bash
npm install       # instala as dependências
npm run dev       # servidor de desenvolvimento em http://localhost:5173
npm run build     # checagem de tipos (tsc -b) + build de produção em dist/
npm run preview   # serve o build localmente
npm run lint      # Oxlint
```

## API

O endereço da API vem de `VITE_API_URL` (padrão: `/api`).

- **Desenvolvimento:** o Vite redireciona `/api` para o backend em `http://127.0.0.1:8000` (ver `vite.config.ts`), então não é preciso configurar nada.
- **Produção:** `VITE_API_URL` é definida em `.env.production`, apontando para o Cloud Run.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/pages/` | Telas do painel admin; `athlete/` (portal do atleta), `finance/` e `subscriptions/` |
| `src/components/` | Componentes por domínio (`attendance/`, `teams/`, `athlete/`, `layout/`, `ui/`...) |
| `src/services/` | Chamadas à API agrupadas por recurso (axios) |
| `src/lib/` | Utilitários: cliente da API, formatação (`formatBRL`), queries de pagamento, reservas |
| `src/store/` | Contextos de autenticação e de tema |
| `src/types/` | Tipos compartilhados das respostas da API |
| `src/hooks/`, `src/routes/` | Hooks e proteção de rotas |

Estado de servidor com TanStack Query; estilos com Tailwind CSS. As fontes e paletas seguem a pasta de inspiração do projeto.
