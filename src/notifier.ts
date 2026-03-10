import axios from 'axios';
import {
  EVOLUTION_API_URL,
  EVOLUTION_API_KEY,
  EVOLUTION_INSTANCE,
  WHATSAPP_TARGET,
} from './config';
import { DisciplineStatus } from './types';

async function sendMessage(text: string): Promise<void> {
  const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;

  await axios.post(
    url,
    {
      number: WHATSAPP_TARGET,
      text,
    },
    {
      headers: {
        apikey: EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
    },
  );

  console.log(`[notifier] Mensagem enviada para ${WHATSAPP_TARGET}`);
}

export async function notifyAlert(disciplines: DisciplineStatus[]): Promise<void> {
  if (disciplines.length === 0) return;

  const lines = disciplines.flatMap((d) => {
    const turmaStr = d.turma !== undefined ? ` Turma ${d.turma}` : '';
    return [
      `• ${d.name}${turmaStr} (${d.code})`,
      `  📊 Oferecidas: ${d.total} | Ocupadas: ${d.occupied} | Solicitadas: ${d.requested}`,
      `  ✅ Vagas disponíveis: ${d.available}`,
    ];
  });

  const text = [
    '🎓 *Vagas abertas na UERJ!*',
    '',
    ...lines,
    '',
    'Acesse: https://alunoonline.uerj.br',
  ].join('\n');

  await sendMessage(text);
}

export async function notifyStatus(disciplines: DisciplineStatus[]): Promise<void> {
  const hour = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

  const lines = disciplines.flatMap((d) => {
    const turmaStr = d.turma !== undefined ? ` Turma ${d.turma}` : '';
    const statusStr = d.available > 0 ? `✅ ${d.available} vaga(s) disponível(is)` : 'sem vagas disponíveis';
    return [
      `• ${d.name}${turmaStr} (${d.code})`,
      `  Oferecidas: ${d.total} | Ocupadas: ${d.occupied} | Solicitadas: ${d.requested}`,
      `  Status: ${statusStr}`,
    ];
  });

  const text = [
    `📊 *Status UERJ Monitor - ${hour}*`,
    '',
    ...lines,
    '',
    '🕐 Próxima verificação em 5 minutos',
  ].join('\n');

  await sendMessage(text);
}

/** @deprecated use notifyAlert instead */
export async function notify(disciplines: DisciplineStatus[]): Promise<void> {
  return notifyAlert(disciplines);
}
