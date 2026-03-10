# Monitor de Vagas UERJ

Monitora vagas em disciplinas da UERJ pelo portal [Aluno Online](https://www.alunoonline.uerj.br/requisicaoaluno/) e envia alertas via WhatsApp quando vagas ficam disponíveis.

## Como funciona

- A cada **5 minutos**: faz login, coleta os dados de vagas de cada disciplina configurada e envia alerta via WhatsApp se `Oferecidas > Solicitadas` (ou seja, se surgiram novas vagas desde a última verificação).
- A cada **1 hora**: envia um resumo de status independente de haver mudanças nas vagas.
- O estado é salvo em `data/state.json` para evitar alertas duplicados.

## Pré-requisitos

- **Node.js** ≥ 18
- **Docker** e **Docker Compose** (para rodar a Evolution API)

## Instalação

```bash
git clone <url-do-repo>
cd crawler-uerj
npm install
npx playwright install chromium
```

## Configuração

### 1. Variáveis de ambiente

Copie o `.env.example` e preencha com suas credenciais:

```bash
cp .env.example .env
```

| Variável | Descrição |
|---|---|
| `UERJ_LOGIN` | Sua matrícula ou CPF do Aluno Online |
| `UERJ_PASSWORD` | Sua senha do Aluno Online |
| `EVOLUTION_API_URL` | URL base da Evolution API (ex: `http://localhost:8080`) |
| `EVOLUTION_API_KEY` | Chave de API configurada na Evolution API |
| `EVOLUTION_INSTANCE` | Nome da instância criada na Evolution API |
| `WHATSAPP_TARGET` | Número de destino com código do país (ex: `5521999999999`) |

### 2. Subindo a Evolution API com Docker

O `docker-compose.yml` já está incluído no projeto em `evolution-api/docker-compose.yml`. Basta subir:

```bash
docker compose -f evolution-api/docker-compose.yml up -d
```

Para parar:

```bash
docker compose -f evolution-api/docker-compose.yml down
```

#### Conectando o WhatsApp

Com o container rodando, crie a instância e escaneie o QR code:

```bash
# Criar a instância
curl -X POST "http://localhost:8080/instance/create" \
  -H "apikey: sua_chave_aqui" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"uerj-monitor","qrcode":true,"integration":"WHATSAPP-BAILEYS"}'

# Salvar o QR code como imagem e abrir
curl -s "http://localhost:8080/instance/connect/uerj-monitor" \
  -H "apikey: sua_chave_aqui" | \
  python3 -c "
import json, sys, base64
d = json.load(sys.stdin)
b64 = d.get('base64','')
if b64:
    with open('/tmp/qrcode.png', 'wb') as f:
        f.write(base64.b64decode(b64.split(',')[1]))
    print('QR code salvo em /tmp/qrcode.png')
"
open /tmp/qrcode.png  # macOS
```

Ou acesse `http://localhost:8080/manager` no browser, clique no card da instância e escaneie o QR code com o WhatsApp (Configurações → Aparelhos conectados → Conectar aparelho).

Verifique se conectou:

```bash
curl "http://localhost:8080/instance/connectionState/uerj-monitor" \
  -H "apikey: sua_chave_aqui"
# Esperado: {"instance":{"instanceName":"uerj-monitor","state":"open"}}
```

### 3. Adicionando disciplinas para monitorar

Edite `src/config.ts`:

```typescript
export const DISCIPLINES: DisciplineConfig[] = [
  { code: 'IME04-10840', name: 'Sistemas Operacionais II', turma: 2 },
  { code: 'IME04-XXXXX', name: 'Outra Disciplina', turma: 1 },
];
```

O `code` deve ser exatamente o código que aparece na lista de "Disciplinas do Currículo/A Cursar" no portal. O campo `turma` é opcional e assume `1` como padrão.

## Executando

```bash
# Desenvolvimento (TypeScript direto)
npm run dev

# Build de produção
npm run build
npm start
```

Ao iniciar, uma verificação é feita imediatamente e em seguida os crons de 5 minutos e 1 hora assumem o controle.

## Deixando rodando continuamente (local)

Para manter o monitor rodando em segundo plano na sua máquina sem depender de uma janela de terminal aberta, use o **PM2**:

### Instalação do PM2

```bash
npm install -g pm2
```

### Iniciando o monitor com PM2

```bash
# Builda o projeto primeiro
npm run build

# Inicia com PM2
pm2 start dist/index.js --name uerj-monitor

# Verifica se está rodando
pm2 status

# Acompanha os logs em tempo real
pm2 logs uerj-monitor
```

### Fazendo o PM2 iniciar automaticamente com o sistema

```bash
pm2 startup
# Execute o comando que ele mostrar na tela
pm2 save
```

A partir daí o monitor vai iniciar automaticamente sempre que sua máquina ligar, sem precisar abrir terminal.

### Comandos úteis do PM2

```bash
pm2 stop uerj-monitor      # Para o monitor
pm2 restart uerj-monitor   # Reinicia
pm2 delete uerj-monitor    # Remove do PM2
pm2 logs uerj-monitor      # Ver logs
pm2 monit                  # Dashboard em tempo real
```

> **Próximo passo:** Para rodar na nuvem sem depender da sua máquina, o ideal é subir em uma VPS (ex: Oracle Cloud Free Tier, DigitalOcean, Hetzner) usando Docker. Ajuste `SERVER_URL` no `evolution-api/docker-compose.yml` para o IP/domínio público do servidor antes de subir.

## Formato das mensagens

**Alerta de vaga disponível:**

```
🎓 Vagas abertas na UERJ!

• Sistemas Operacionais II Turma 2 (IME04-10840)
  📊 Oferecidas: 40 | Ocupadas: 38 | Solicitadas: 35
  ✅ Vagas disponíveis: 5

Acesse: https://alunoonline.uerj.br
```

**Status horário:**

```
📊 Status UERJ Monitor - 23:00

• Sistemas Operacionais II Turma 2 (IME04-10840)
  Oferecidas: 40 | Ocupadas: 40 | Solicitadas: 65
  Status: sem vagas disponíveis

🕐 Próxima verificação em 5 minutos
```

## Estrutura do projeto

```
evolution-api/
└── docker-compose.yml  # Evolution API v1.8.2 (WhatsApp gateway)
src/
├── index.ts       # Ponto de entrada: validação do .env + execução inicial + início do scheduler
├── scheduler.ts   # node-cron: verificação a cada 5min + status a cada 1h
├── crawler.ts     # Playwright: login, navegação e coleta de vagas
├── notifier.ts    # Evolution API: envio de alertas e mensagens de status
├── state.ts       # Leitura/escrita do data/state.json + detecção de novas vagas
├── config.ts      # Variáveis de ambiente + lista de DISCIPLINES
└── types.ts       # Interfaces TypeScript
data/
└── state.json     # Criado automaticamente; registra o último estado conhecido das vagas
```

## Arquivos de debug

A cada verificação de disciplina, um screenshot e o HTML da página são salvos em `data/debug/` para facilitar a identificação de problemas de navegação.
