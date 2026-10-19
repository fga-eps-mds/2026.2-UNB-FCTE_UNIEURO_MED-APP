import type { ImportSummary } from '@/features/sincronizacao/apply-package';

export const plural = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

/** "a", "a e b", "a, b e c". */
function joinItems(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
}

export function describeSummary(summary: ImportSummary): string[] {
  const { professionals, patients, attendances } = summary;
  const lines: string[] = [];

  const added = [
    professionals.inserted > 0 &&
      plural(professionals.inserted, 'profissional novo', 'profissionais novos'),
    patients.inserted > 0 && plural(patients.inserted, 'paciente novo', 'pacientes novos'),
    attendances.inserted > 0 &&
      plural(attendances.inserted, 'atendimento novo', 'atendimentos novos'),
  ].filter((item): item is string => Boolean(item));
  if (added.length > 0) lines.push(`Recebidos: ${joinItems(added)}.`);

  const updated = professionals.updated + patients.updated + attendances.updated;
  if (updated > 0) {
    lines.push(`${plural(updated, 'registro atualizado', 'registros atualizados')}.`);
  }

  const unified = professionals.unified + patients.unified;
  if (unified > 0) {
    lines.push(
      `${plural(unified, 'cadastro feito nos dois tablets foi unificado', 'cadastros feitos nos dois tablets foram unificados')}.`,
    );
  }
  if (summary.conflicts > 0) {
    lines.push(
      `${plural(summary.conflicts, 'edição concorrente resolvida', 'edições concorrentes resolvidas')} pela versão mais recente.`,
    );
  }
  if (summary.quarantined > 0) {
    lines.push(
      `${plural(summary.quarantined, 'registro não foi importado', 'registros não foram importados')} por dados inválidos ou identidade ambígua.`,
    );
  }
  if (lines.length === 0) {
    lines.push('Este tablet já tinha todos os dados do outro.');
  }
  return lines;
}
