# Deploy do Yeto Finanças

Este guia prepara o projeto para VPS + Coolify + Git.

## Para o erro de ligação não voltar

O erro de login aparece quando o frontend não consegue falar com o backend. Em produção, evite expor a API por `localhost` ou por uma porta direta no navegador.

Este repositório já fica preparado para:

- frontend e backend no mesmo `docker-compose.yml`;
- Nginx do frontend a encaminhar `/api` para o backend;
- frontend a usar `/api` no mesmo domínio quando `VITE_API_URL` estiver vazio;
- healthcheck do backend em `/api/health`;
- containers com `restart: unless-stopped`.

## Variáveis obrigatórias no Coolify

Copie `.env.production.example` para as variáveis do recurso no Coolify e ajuste:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `SESSION_SECRET`
- `CORS_ORIGIN`
- `BREVO_SMTP_KEY`, se os emails já forem enviados em produção

Se usar o domínio principal para tudo, deixe `VITE_API_URL` vazio. Se usar API separada, configure `VITE_API_URL=https://api.seudominio.com`.

## Fluxo recomendado

1. Comprar VPS na Hostinger.
2. Apontar o domínio para o IP da VPS.
3. Instalar Coolify na VPS.
4. Criar um projeto no Coolify ligado ao repositório Git.
5. Escolher Docker Compose como forma de deploy.
6. Configurar as variáveis de produção.
7. Associar o domínio ao serviço `frontend`.
8. Ativar HTTPS automático no Coolify.
9. Fazer o primeiro deploy.
10. Testar `/api/health`, login, cadastro, email, uploads/comprovativos e relatórios.

## Cuidados antes de ir ao ar

- Nunca subir `.env` real para o Git.
- Fazer backup automático do PostgreSQL.
- Criar ambiente `staging` antes do ambiente `production`.
- Usar senhas fortes e `SESSION_SECRET` grande.
- Confirmar `CORS_ORIGIN` com o domínio final.
- Testar recuperação de senha e verificação de email.
- Monitorar logs do backend pelo Coolify após cada deploy.
