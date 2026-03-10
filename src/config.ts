import 'dotenv/config';
import { DisciplineConfig } from './types';

export const UERJ_LOGIN = process.env.UERJ_LOGIN ?? '';
export const UERJ_PASSWORD = process.env.UERJ_PASSWORD ?? '';
export const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL ?? '';
export const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY ?? '';
export const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE ?? '';
export const WHATSAPP_TARGET = process.env.WHATSAPP_TARGET ?? '';

// Add or remove disciplines here
export const DISCIPLINES: DisciplineConfig[] = [
  { code: 'IME04-10840', name: 'Sistemas Operacionais II', turma: 2 },
];
