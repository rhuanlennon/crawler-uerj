import { chromium, Page } from 'playwright';
import { UERJ_LOGIN, UERJ_PASSWORD, DISCIPLINES } from './config';
import { DisciplineStatus } from './types';
import path from 'path';
import fs from 'fs';

/**
 * Navigation flow (all at https://www.alunoonline.uerj.br/requisicaoaluno/):
 * 1. Login with matricula + senha
 * 2. Click "Disciplinas do Currículo/A Cursar" (executaMenu link → form POST)
 * 3. In the discipline list, find the row with the code and click its link
 * 4. On "Consulta de Disciplina", extract vagas from the turma section
 *
 * Key quirk: menu links use href="#" + onclick=executaMenu() → two navigations.
 * We use click() + waitForURL(non-#) + waitForLoadState to handle both.
 */

const REQUISICAO_URL = 'https://www.alunoonline.uerj.br/';
const DEBUG_DIR = path.resolve(__dirname, '../data/debug');

async function saveDebug(page: Page, name: string): Promise<void> {
  if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });
  await page.screenshot({ path: path.join(DEBUG_DIR, `${name}.png`), fullPage: true });
  fs.writeFileSync(path.join(DEBUG_DIR, `${name}.html`), await page.content());
}

async function waitAfterMenuClick(page: Page): Promise<void> {
  // executaMenu: href="#" fires first, then form.submit() fires the real nav.
  await page.waitForURL((url) => !url.toString().includes('#'), { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
}

async function login(page: Page): Promise<void> {
  await page.goto(REQUISICAO_URL, { waitUntil: 'networkidle' });

  await page.screenshot({ path: 'data/debug/pm2-startup.png' });
  console.log('[debug] URL atual:', page.url());
  console.log('[debug] Title:', await page.title());

  await page.fill('input[name="matricula"]', UERJ_LOGIN);
  await page.fill('input[name="senha"]', UERJ_PASSWORD);

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ]);

  if ((await page.$('input[name="matricula"]')) !== null) {
    await saveDebug(page, 'login-error');
    throw new Error('Login falhou — verifique UERJ_LOGIN e UERJ_PASSWORD no .env');
  }

  console.log('[crawler] Login bem-sucedido');
}

async function goToCurriculumList(page: Page): Promise<void> {
  await saveDebug(page, 'post-login-menu');
  console.log('[crawler] Menu pós-login salvo em data/debug/post-login-menu.html');

  const link = page.locator('a', { hasText: /Disciplinas do Curr.+culo/i });
  await link.waitFor({ timeout: 10_000 });
  await link.first().click();
  await waitAfterMenuClick(page);
  console.log('[crawler] URL pós-currículo:', page.url());
  await saveDebug(page, 'discipline-list');
  console.log('[crawler] Lista de disciplinas carregada');
}

async function openDiscipline(page: Page, code: string): Promise<void> {
  // Find the <a> whose text content contains the discipline code.
  // Using locator('a').filter catches the binoculo link whose <span> has the code text.
  // Avoids the <tr>-based fallback that matched outer layout rows and clicked the wrong discipline.
  const link = page.locator('a').filter({ hasText: new RegExp(`\\b${code}\\b`) }).first();

  if ((await link.count()) === 0) {
    await saveDebug(page, `no-row-${code}`);
    throw new Error(`Disciplina ${code} não encontrada na lista`);
  }

  await link.click();
  await waitAfterMenuClick(page);
  console.log('[crawler] URL pós-consulta:', page.url());

  // Wait for JS to populate table cells (portal renders values after networkidle)
  await page.waitForFunction(
    () => {
      const captions = Array.from(document.querySelectorAll('caption'));
      return captions.some((c) => c.textContent?.includes('Vagas Atualizadas'));
    },
    { timeout: 15_000 },
  );
  await page.waitForTimeout(1500);

  await saveDebug(page, `consulta-${code}`);
  console.log(`[crawler] Consulta aberta: ${code}`);
}

/**
 * Finds the ancestor element of `el` (up to `maxDepth` levels) whose
 * innerText matches the given regex. Returns null if not found.
 */
function findTurmaSection(el: Element, turma: number): Element | null {
  const re = new RegExp(`TURMA:\\s*${turma}\\b`);
  let cur: Element | null = el.parentElement;
  for (let d = 0; d < 8 && cur; d++) {
    const text = (cur as HTMLElement).innerText ?? cur.textContent ?? '';
    if (re.test(text)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

function uerjCells(table: Element): HTMLTableCellElement[] | null {
  for (const row of Array.from(table.querySelectorAll('tr'))) {
    const cells = Array.from(row.querySelectorAll('td')) as HTMLTableCellElement[];
    if (cells.length >= 2 && cells[0].textContent?.trim().toUpperCase() === 'UERJ') {
      return cells;
    }
  }
  return null;
}

/**
 * Per-turma extraction from the two tables inside a turma section:
 *
 * "Vagas Atualizadas da Turma":
 *   cols [Tipo de Vaga, Oferecidas, Ocupadas]  → occupied
 *
 * "Vagas para Solicitação de Inscrição":
 *   cols [Tipo de Vaga, Oferecidas, Total, Preferenciais]  → offered, requested
 *
 * available = offered - requested  (0 when full)
 */
async function extractVagas(
  page: Page,
  turma: number,
): Promise<{ offered: number; occupied: number; requested: number }> {
  const result = await page.evaluate(
    ({ turma }) => {
      let offered = 0;
      let occupied = 0;
      let requested = 0;

      for (const caption of Array.from(document.querySelectorAll('caption'))) {
        const captionText = caption.textContent ?? '';
        const table = caption.closest('table');
        if (!table) continue;

        // Check that this table is inside the correct turma section.
        // Strategy: walk up until we hit the innermost ancestor that contains ANY
        // "TURMA: N" marker (the per-turma <td>). If that element matches our
        // target turma, we're in the right section. Stopping at the first TURMA
        // ancestor prevents matching a higher container (e.g. <tbody>) that holds
        // all turmas and would cause every table to pass the filter.
        const re = new RegExp(`TURMA:\\s*${turma}\\b`);
        const anyTurmaRe = /TURMA:\s*\d/;
        let ancestor: Element | null = table.parentElement;
        let inSection = false;
        for (let d = 0; d < 8 && ancestor; d++) {
          const t = (ancestor as HTMLElement).innerText ?? ancestor.textContent ?? '';
          if (anyTurmaRe.test(t)) { inSection = re.test(t); break; }
          ancestor = ancestor.parentElement;
        }
        if (!inSection) continue;

        // "Vagas Atualizadas da Turma" → cols: [Tipo, Oferecidas, Ocupadas]
        // Source of truth for offered and occupied.
        if (captionText.includes('Vagas Atualizadas')) {
          const cells = (() => {
            for (const row of Array.from(table.querySelectorAll('tr'))) {
              const tds = Array.from(row.querySelectorAll('td')) as HTMLTableCellElement[];
              if (tds.length >= 3 && tds[0].textContent?.trim().toUpperCase() === 'UERJ') return tds;
            }
            return null;
          })();
          if (cells) {
            offered  = parseInt(cells[1]?.textContent?.trim() ?? '', 10) || 0;
            occupied = parseInt(cells[2]?.textContent?.trim() ?? '', 10) || 0;
          }
        }

        // "Vagas para Solicitação de Inscrição" → cols: [Tipo, Oferecidas, Total, Preferenciais]
        // Only used for requested (Total column).
        if (captionText.includes('Vagas para Solicita')) {
          const cells = (() => {
            for (const row of Array.from(table.querySelectorAll('tr'))) {
              const tds = Array.from(row.querySelectorAll('td')) as HTMLTableCellElement[];
              if (tds.length >= 3 && tds[0].textContent?.trim().toUpperCase() === 'UERJ') return tds;
            }
            return null;
          })();
          if (cells) {
            requested = parseInt(cells[2]?.textContent?.trim() ?? '', 10) || 0;
          }
        }
      }

      return { offered, occupied, requested };
    },
    { turma },
  );

  return result;
}

// Suppress unused-variable TS errors for the helper functions defined in evaluate
void (findTurmaSection as unknown);
void (uerjCells as unknown);

export async function checkDisciplines(): Promise<DisciplineStatus[]> {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const results: DisciplineStatus[] = [];

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await login(page);
    await goToCurriculumList(page);

    for (let i = 0; i < DISCIPLINES.length; i++) {
      const disc = DISCIPLINES[i];
      try {
        await openDiscipline(page, disc.code);

        const turma = disc.turma ?? 1;
        const { offered, occupied, requested } = await extractVagas(page, turma);
        const available = Math.max(0, offered - occupied);

        results.push({ code: disc.code, name: disc.name, turma: disc.turma, available, total: offered, occupied, requested });

        console.log(
          `[crawler] ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })} — ${disc.name} (Turma ${turma}): ` +
            `${available} livres (${offered} oferecidas − ${requested} solicitadas, ${occupied} ocupadas)`,
        );

        if (i < DISCIPLINES.length - 1) {
          await page.goBack({ waitUntil: 'networkidle' }).catch(() => {});
        }
      } catch (err) {
        console.error(`[crawler] Erro em ${disc.name}:`, err);
        results.push({ code: disc.code, name: disc.name, turma: disc.turma, available: 0, total: 0, occupied: 0, requested: 0 });
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}
