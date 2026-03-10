import 'dotenv/config';
import { notifyAlert, notifyStatus } from './notifier';
import { DisciplineStatus } from './types';

const fakeDisc: DisciplineStatus = {
  code: 'IME04-10840',
  name: 'Sistemas Operacionais II',
  turma: 2,
  total: 40,
  occupied: 40,
  requested: 35,
  available: 5,
};

async function main(): Promise<void> {
  console.log('[test] Enviando mensagem de alerta...');
  await notifyAlert([fakeDisc]);

  console.log('[test] Aguardando 2s...');
  await new Promise((r) => setTimeout(r, 2000));

  // Status with no vacancies
  const fakeDiscFull: DisciplineStatus = { ...fakeDisc, requested: 65, available: 0 };
  console.log('[test] Enviando mensagem de status (sem vagas)...');
  await notifyStatus([fakeDiscFull]);

  console.log('[test] Concluído!');
}

main().catch((err) => {
  console.error('[test] Erro:', err);
  process.exit(1);
});
