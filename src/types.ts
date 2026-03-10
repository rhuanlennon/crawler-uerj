export interface DisciplineConfig {
  code: string;
  name: string;
  turma?: number;
}

export interface DisciplineStatus {
  code: string;
  name: string;
  available: number; // offered - requested (can be 0 or negative)
  total: number;     // vagas oferecidas para inscrição (UERJ)
  occupied: number;  // vagas ocupadas (Vagas Atualizadas da Turma)
  requested: number; // total solicitadas
  turma?: number;
}

export interface SlotState {
  available: number;
  notifiedAt: string | null;
}

export interface StateFile {
  [code: string]: SlotState;
}
