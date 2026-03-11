import http from 'http';
import fs from 'fs';
import path from 'path';
import { DISCIPLINES } from './config';

const STATE_PATH = path.resolve(__dirname, '../data/state.json');
const LOG_PATH = path.resolve(__dirname, '../data/monitor.log');

function readState(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function readLogs(lines = 100): string[] {
  try {
    const content = fs.readFileSync(LOG_PATH, 'utf-8');
    return content.split('\n').filter(Boolean).slice(-lines);
  } catch {
    return [];
  }
}

function html(state: Record<string, unknown>, logs: string[]): string {
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const stateRows = Object.entries(state)
    .map(([key, val]) => {
      const s = val as { available: number; notifiedAt: string | null };
      // key format: "CODE" or "CODE-T2" — find matching discipline
      const disc = DISCIPLINES.find((d) => {
        const k = d.turma !== undefined ? `${d.code}-T${d.turma}` : d.code;
        return k === key;
      });
      const label = disc
        ? `<strong>${disc.name}</strong>${disc.turma !== undefined ? ` Turma ${disc.turma}` : ''}<br><span style="color:#64748b;font-size:0.8rem">${key}</span>`
        : key;
      const badge = s.available > 0
        ? `<span style="color:#22c55e;font-weight:bold">✅ ${s.available} vaga(s)</span>`
        : `<span style="color:#ef4444">sem vagas</span>`;
      const notified = s.notifiedAt
        ? new Date(s.notifiedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        : '—';
      return `<tr><td>${label}</td><td>${badge}</td><td>${notified}</td></tr>`;
    })
    .join('');

  const logLines = logs
    .map((l) => `<div>${l.replace(/</g, '&lt;')}</div>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="60">
  <title>UERJ Monitor</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;padding:1.5rem}
    h1{font-size:1.4rem;margin-bottom:0.25rem;color:#f8fafc}
    .sub{color:#94a3b8;font-size:0.85rem;margin-bottom:1.5rem}
    h2{font-size:1rem;color:#94a3b8;margin:1.5rem 0 0.5rem;text-transform:uppercase;letter-spacing:.05em}
    table{width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden}
    th,td{padding:0.6rem 1rem;text-align:left;font-size:0.9rem;border-bottom:1px solid #334155}
    th{background:#334155;color:#94a3b8;font-weight:600}
    tr:last-child td{border-bottom:none}
    .logs{background:#1e293b;border-radius:8px;padding:1rem;font-family:monospace;font-size:0.78rem;
          max-height:400px;overflow-y:auto;color:#94a3b8;line-height:1.6}
    .logs div:last-child{color:#e2e8f0}
    .badge{display:inline-block;padding:0.1rem 0.5rem;border-radius:4px;font-size:0.78rem;
           background:#0f172a;margin-bottom:1rem;color:#64748b}
  </style>
</head>
<body>
  <h1>🎓 UERJ Monitor</h1>
  <div class="sub">Atualiza automaticamente a cada 60s &nbsp;·&nbsp; Horário de Brasília: ${now}</div>

  <h2>Estado das disciplinas</h2>
  ${stateRows
    ? `<table><thead><tr><th>Disciplina</th><th>Vagas</th><th>Última notificação</th></tr></thead><tbody>${stateRows}</tbody></table>`
    : '<div class="badge">Nenhuma verificação concluída ainda</div>'
  }

  <h2>Últimos logs</h2>
  <div class="logs">${logLines || '<div>Nenhum log disponível</div>'}</div>
</body>
</html>`;
}

export function startServer(port = 8080): void {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }

    const state = readState();
    const logs = readLogs(100);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html(state, logs));
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[server] Status page disponível na porta ${port}`);
  });
}
