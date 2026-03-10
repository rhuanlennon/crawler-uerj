import fs from 'fs';
import path from 'path';
import { DisciplineStatus, StateFile } from './types';

const STATE_PATH = path.resolve(__dirname, '../data/state.json');

export function readState(): StateFile {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf-8');
    return JSON.parse(raw) as StateFile;
  } catch {
    return {};
  }
}

export function writeState(state: StateFile): void {
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

function stateKey(d: { code: string; turma?: number }): string {
  return d.turma !== undefined ? `${d.code}-T${d.turma}` : d.code;
}

export function hasOpenedNewSlots(
  prev: StateFile,
  current: DisciplineStatus[],
): DisciplineStatus[] {
  return current.filter((d) => {
    const prevEntry = prev[stateKey(d)];
    const wasEmpty = !prevEntry || prevEntry.available === 0;
    return wasEmpty && d.available > 0;
  });
}
