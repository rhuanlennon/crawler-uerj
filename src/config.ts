import 'dotenv/config';
import { DisciplineConfig } from './types';

export const UERJ_LOGIN = process.env.UERJ_LOGIN ?? '';
export const UERJ_PASSWORD = process.env.UERJ_PASSWORD ?? '';

// WhatsApp (Evolution API) - opcional
export const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL ?? '';
export const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY ?? '';
export const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE ?? '';
export const WHATSAPP_TARGET = process.env.WHATSAPP_TARGET ?? '';

// Telegram - opcional (precisa de TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? '';

// Email - opcional (precisa de EMAIL_FROM + EMAIL_PASS + EMAIL_TO)
export const EMAIL_FROM = process.env.EMAIL_FROM ?? '';
export const EMAIL_PASS = process.env.EMAIL_PASS ?? '';
export const EMAIL_TO = process.env.EMAIL_TO ?? '';

// Add or remove disciplines here
export const DISCIPLINES: DisciplineConfig[] = [
  { code: 'IME04-10840', name: 'Sistemas Operacionais II', turma: 2 },
];
