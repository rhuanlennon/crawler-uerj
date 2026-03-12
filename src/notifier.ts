import axios from 'axios';
import nodemailer from 'nodemailer';
import {
  EVOLUTION_API_URL,
  EVOLUTION_API_KEY,
  EVOLUTION_INSTANCE,
  WHATSAPP_TARGET,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  EMAIL_FROM,
  EMAIL_PASS,
  EMAIL_TO,
} from './config';
import { DisciplineStatus } from './types';

// ── WhatsApp ─────────────────────────────────────────────────────────────────

async function sendWhatsApp(text: string): Promise<void> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE || !WHATSAPP_TARGET) return;

  await axios.post(
    `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
    { number: WHATSAPP_TARGET, text },
    { headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' } },
  );
  console.log(`[notifier] WhatsApp → ${WHATSAPP_TARGET}`);
}

// ── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegram(text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  // Telegram Markdown: *bold*, _italic_ — remove unsupported chars
  await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: 'Markdown',
  });
  console.log(`[notifier] Telegram → ${TELEGRAM_CHAT_ID}`);
}

// ── Email ─────────────────────────────────────────────────────────────────────

async function sendEmail(subject: string, body: string): Promise<void> {
  if (!EMAIL_FROM || !EMAIL_PASS || !EMAIL_TO) return;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_FROM, pass: EMAIL_PASS },
  });

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: EMAIL_TO,
    subject,
    text: body,
  });
  console.log(`[notifier] Email → ${EMAIL_TO}`);
}

// ── Shared message builders ───────────────────────────────────────────────────

function buildAlertText(disciplines: DisciplineStatus[]): string {
  const lines = disciplines.flatMap((d) => {
    const turmaStr = d.turma !== undefined ? ` Turma ${d.turma}` : '';
    return [
      `• ${d.name}${turmaStr} (${d.code})`,
      `  📊 Oferecidas: ${d.total} | Ocupadas: ${d.occupied} | Solicitadas: ${d.requested}`,
      `  ✅ Vagas disponíveis: ${d.available}`,
    ];
  });

  return [
    '🎓 *Vagas abertas na UERJ!*',
    '',
    ...lines,
    '',
    'Acesse: https://alunoonline.uerj.br',
  ].join('\n');
}

function buildStatusText(disciplines: DisciplineStatus[]): string {
  const hour = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' });

  const lines = disciplines.flatMap((d) => {
    const turmaStr = d.turma !== undefined ? ` Turma ${d.turma}` : '';
    const statusStr = d.available > 0 ? `✅ ${d.available} vaga(s) disponível(is)` : 'sem vagas disponíveis';
    return [
      `• ${d.name}${turmaStr} (${d.code})`,
      `  Oferecidas: ${d.total} | Ocupadas: ${d.occupied} | Solicitadas: ${d.requested}`,
      `  Status: ${statusStr}`,
    ];
  });

  return [
    `📊 *Status UERJ Monitor - ${hour}*`,
    '',
    ...lines,
    '',
    '🕐 Próxima verificação em 5 minutos',
  ].join('\n');
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function notifyAlert(disciplines: DisciplineStatus[]): Promise<void> {
  if (disciplines.length === 0) return;
  const text = buildAlertText(disciplines);
  await Promise.allSettled([
    sendWhatsApp(text),
    sendTelegram(text),
    sendEmail('🎓 Vagas abertas na UERJ!', text),
  ]);
}

export async function notifyStatus(disciplines: DisciplineStatus[]): Promise<void> {
  const text = buildStatusText(disciplines);
  await Promise.allSettled([
    sendWhatsApp(text),
    sendTelegram(text),
    sendEmail('📊 Status UERJ Monitor', text),
  ]);
}

/** @deprecated use notifyAlert instead */
export async function notify(disciplines: DisciplineStatus[]): Promise<void> {
  return notifyAlert(disciplines);
}
