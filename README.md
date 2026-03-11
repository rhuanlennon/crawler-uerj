# Monitor de Vagas UERJ

Monitora vagas em disciplinas da UERJ pelo portal [Aluno Online](https://www.alunoonline.uerj.br/requisicaoaluno/) e envia alertas via **Telegram** (e opcionalmente email ou WhatsApp) quando vagas ficam disponíveis.

## Como funciona

- A cada **5 minutos**: faz login, coleta os dados de vagas de cada disciplina configurada e envia alerta imediato via Telegram se surgiram novas vagas.
- A cada **1 hora**: envia um resumo de status independente de haver mudanças.
- O estado é salvo em `data/state.json` para evitar alertas duplicados.
- Uma página de status pública exibe os logs e o estado atual das vagas em tempo real.

## Pré-requisitos

- **Node.js** ≥ 18
- **Bot do Telegram** (criado via [@BotFather](https://t.me/BotFather))

## Instalação

```bash
git clone https://github.com/rhuanlennon/crawler-uerj.git
cd crawler-uerj
npm install
npx playwright install chromium
```

## Configuração

### 1. Variáveis de ambiente

Copie o `.env.example` e preencha:

```bash
cp .env.example .env
```

| Variável | Descrição |
| --- | --- |
| `UERJ_LOGIN` | Sua matrícula ou CPF do Aluno Online |
| `UERJ_PASSWORD` | Sua senha do Aluno Online |
| `TELEGRAM_BOT_TOKEN` | Token do bot (gerado pelo @BotFather) |
| `TELEGRAM_CHAT_ID` | ID do grupo ou chat privado |
| `EMAIL_FROM` | *(opcional)* Conta Gmail para envio |
| `EMAIL_PASS` | *(opcional)* Senha de App do Gmail |
| `EMAIL_TO` | *(opcional)* Destinatário(s), separados por vírgula |

> Configure ao menos **Telegram** ou **Email**. WhatsApp via Evolution API também é suportado mas requer self-hosting.

### 2. Configurando o Telegram

**Criar o bot:**

1. Abra o Telegram e pesquise `@BotFather`
2. Envie `/newbot` e siga as instruções
3. Copie o token gerado → `TELEGRAM_BOT_TOKEN`

**Obter o Chat ID do grupo:**

1. Crie um grupo no Telegram e adicione o bot
2. Nas configurações do bot no BotFather, desative o **Privacy Mode** (`Bot Settings → Group Privacy → Turn off`)
3. Envie qualquer mensagem no grupo
4. Acesse `https://api.telegram.org/bot<TOKEN>/getUpdates`
5. Copure o `"id"` dentro de `"chat"` (número negativo para grupos) → `TELEGRAM_CHAT_ID`

### 3. Adicionando disciplinas para monitorar

Edite `src/config.ts`:

```typescript
export const DISCIPLINES: DisciplineConfig[] = [
  { code: 'IME04-10840', name: 'Sistemas Operacionais II', turma: 2 },
  { code: 'IME04-XXXXX', name: 'Outra Disciplina', turma: 1 },
];
```

O `code` deve ser exatamente o código que aparece na lista "Disciplinas do Currículo/A Cursar" no portal. O campo `turma` é opcional (padrão: `1`).

## Executando

```bash
# Desenvolvimento (TypeScript direto)
npm run dev

# Build de produção
npm run build
npm start
```

Ao iniciar, uma verificação é feita imediatamente. Em seguida os crons de 5 minutos e 1 hora assumem o controle.

## Página de status

O monitor expõe uma página web com os logs e estado atual das vagas:

- **Local:** `http://localhost:8080`
- **Nuvem (Fly.io):** `https://uerj-monitor.fly.dev`

A página atualiza automaticamente a cada 60 segundos e exibe:

- Estado de cada disciplina monitorada (vagas disponíveis / sem vagas)
- Horário da última notificação enviada
- Últimos 100 logs do sistema

## Deploy na nuvem (Fly.io)

O projeto já está configurado para rodar no Fly.io. Após instalar o [flyctl](https://fly.io/docs/hands-on/install-flyctl/):

```bash
fly auth login

# Configurar secrets
fly secrets set UERJ_LOGIN=sua_matricula UERJ_PASSWORD=sua_senha \
  TELEGRAM_BOT_TOKEN=seu_token TELEGRAM_CHAT_ID=seu_chat_id \
  --app uerj-monitor

# Deploy
fly deploy --ha=false
```

## Deixando rodando localmente (PM2)

```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name uerj-monitor
pm2 save
pm2 startup  # para iniciar automaticamente com o sistema
```

Comandos úteis:

```bash
pm2 logs uerj-monitor    # ver logs em tempo real
pm2 restart uerj-monitor --update-env  # reiniciar com novas variáveis
pm2 stop uerj-monitor
```

## Formato das mensagens

**Alerta de vaga disponível:**

```text
🎓 Vagas abertas na UERJ!

• Sistemas Operacionais II Turma 2 (IME04-10840)
  📊 Oferecidas: 40 | Ocupadas: 38 | Solicitadas: 35
  ✅ Vagas disponíveis: 2

Acesse: https://alunoonline.uerj.br
```

**Status horário:**

```text
📊 Status UERJ Monitor - 23:00

• Sistemas Operacionais II Turma 2 (IME04-10840)
  Oferecidas: 40 | Ocupadas: 40 | Solicitadas: 65
  Status: sem vagas disponíveis

🕐 Próxima verificação em 5 minutos
```

## Estrutura do projeto

```text
src/
├── index.ts       # Entrada: validação do .env + servidor HTTP + scheduler
├── server.ts      # Servidor HTTP com página de status e logs
├── scheduler.ts   # node-cron: verificação a cada 5min + status a cada 1h
├── crawler.ts     # Playwright: login, navegação e coleta de vagas
├── notifier.ts    # Envio de alertas via Telegram, Email ou WhatsApp
├── state.ts       # Leitura/escrita do data/state.json
├── config.ts      # Variáveis de ambiente + lista de DISCIPLINES
└── types.ts       # Interfaces TypeScript
data/
├── state.json     # Criado automaticamente; registra o último estado
└── monitor.log    # Log persistente exibido na página de status
evolution-api/
└── docker-compose.yml  # Evolution API v1.8.2 (opcional, para WhatsApp local)
```

## Arquivos de debug

A cada verificação, um screenshot e o HTML da página são salvos em `data/debug/` para facilitar a identificação de problemas de navegação.
