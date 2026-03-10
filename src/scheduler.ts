import cron from 'node-cron';
import { checkDisciplines } from './crawler';
import { readState, writeState, hasOpenedNewSlots } from './state';
import { notifyAlert, notifyStatus } from './notifier';

const stateKey = (d: { code: string; turma?: number }) =>
  d.turma !== undefined ? `${d.code}-T${d.turma}` : d.code;

const nowBRT = () =>
  new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

async function runCheck(): Promise<void> {
  console.log(`[scheduler] Verificando vagas — ${nowBRT()}`);

  const statuses = await checkDisciplines();
  const prev = readState();
  const opened = hasOpenedNewSlots(prev, statuses);

  if (opened.length > 0) {
    console.log(`[scheduler] ${opened.length} disciplina(s) com novas vagas — notificando`);
    await notifyAlert(opened);
  } else {
    console.log('[scheduler] Nenhuma nova vaga encontrada');
  }

  const newState = Object.fromEntries(
    statuses.map((d) => [
      stateKey(d),
      {
        available: d.available,
        notifiedAt:
          opened.find((o) => o.code === d.code && o.turma === d.turma) != null
            ? new Date().toISOString()
            : (prev[stateKey(d)]?.notifiedAt ?? null),
      },
    ]),
  );

  writeState(newState);
}

async function runStatus(): Promise<void> {
  console.log(`[scheduler] Enviando status horário — ${nowBRT()}`);
  try {
    const statuses = await checkDisciplines();
    await notifyStatus(statuses);
  } catch (err) {
    console.error('[scheduler] Erro ao enviar status horário:', err);
  }
}

export function startScheduler(): void {
  cron.schedule('*/5 * * * *', async () => {
    try {
      await runCheck();
    } catch (err) {
      console.error('[scheduler] Erro durante verificação:', err);
    }
  });

  cron.schedule('0 * * * *', async () => {
    await runStatus();
  });

  console.log('[scheduler] Agendado: verificação a cada 5 minutos, status a cada hora');
}

export { runCheck, runStatus };
