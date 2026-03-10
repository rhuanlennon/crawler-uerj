import 'dotenv/config';
import { startScheduler, runCheck, runStatus } from './scheduler';

const REQUIRED_VARS = [
  'UERJ_LOGIN',
  'UERJ_PASSWORD',
  'EVOLUTION_API_URL',
  'EVOLUTION_API_KEY',
  'EVOLUTION_INSTANCE',
  'WHATSAPP_TARGET',
];

function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error(`[init] Variáveis de ambiente obrigatórias faltando: ${missing.join(', ')}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  validateEnv();
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
