import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { startScheduler, runCheck, runStatus } from './scheduler';
import { startServer } from './server';

// Redirect console.log/error to also write to data/monitor.log
const LOG_PATH = path.resolve(__dirname, '../data/monitor.log');
const MAX_LOG_BYTES = 1 * 1024 * 1024; // 1 MB

function patchConsole() {
  const write = (prefix: string, args: unknown[]) => {
    const line = `${new Date().toISOString()} ${prefix} ${args.map(String).join(' ')}\n`;
    process.stdout.write(line);
    try {
      if (fs.existsSync(LOG_PATH) && fs.statSync(LOG_PATH).size > MAX_LOG_BYTES) {
        fs.truncateSync(LOG_PATH, 0);
      }
      fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
      fs.appendFileSync(LOG_PATH, line);
    } catch { /* ignore write errors */ }
  };
  const origLog = console.log.bind(console);
  const origErr = console.error.bind(console);
  console.log = (...args) => write('[LOG]', args);
  console.error = (...args) => write('[ERR]', args);
}

const REQUIRED_VARS = ['UERJ_LOGIN', 'UERJ_PASSWORD'];

const NOTIFIER_GROUPS = [
  ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'],
  ['EMAIL_FROM', 'EMAIL_PASS', 'EMAIL_TO'],
  ['EVOLUTION_API_URL', 'EVOLUTION_API_KEY', 'EVOLUTION_INSTANCE', 'WHATSAPP_TARGET'],
];

function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error(`[init] Variáveis de ambiente obrigatórias faltando: ${missing.join(', ')}`);
    process.exit(1);
  }

  const hasNotifier = NOTIFIER_GROUPS.some((group) => group.every((v) => process.env[v]));
  if (!hasNotifier) {
    console.error('[init] Configure ao menos um notificador: Telegram (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID), Email (EMAIL_FROM + EMAIL_PASS + EMAIL_TO) ou WhatsApp (EVOLUTION_*)');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  patchConsole();
  validateEnv();
  startServer(8080);
  console.log('[init] UERJ Discipline Monitor iniciado');

  // Run immediately on startup, then let the cron take over
  try {
    await runCheck();
  } catch (err) {
    console.error('[init] Erro na verificação inicial:', err);
  }

  startScheduler();
}

main();
