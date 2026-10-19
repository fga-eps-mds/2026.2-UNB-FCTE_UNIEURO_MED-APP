import {
  emptySummary,
  receivedCount,
  type ImportSummary,
} from '@/features/sincronizacao/apply-package';
import { describeSummary, plural } from '@/features/sincronizacao/summary-text';

const summary = (change: (summary: ImportSummary) => void) => {
  const value = emptySummary();
  change(value);
  return value;
};

describe('describeSummary', () => {
  it('junta o que chegou de novo numa frase, no singular e no plural', () => {
    expect(
      describeSummary(
        summary((s) => {
          s.professionals.inserted = 1;
          s.patients.inserted = 2;
          s.attendances.inserted = 3;
        }),
      ),
    ).toEqual(['Recebidos: 1 profissional novo, 2 pacientes novos e 3 atendimentos novos.']);
    expect(describeSummary(summary((s) => (s.attendances.inserted = 1)))).toEqual([
      'Recebidos: 1 atendimento novo.',
    ]);
  });

  it('conta as atualizações, unificações, conflitos e recusas de todos os tipos', () => {
    expect(
      describeSummary(
        summary((s) => {
          s.professionals.updated = 1;
          s.patients.updated = 1;
          s.patients.unified = 1;
          s.conflicts = 2;
          s.quarantined = 1;
        }),
      ),
    ).toEqual([
      '2 registros atualizados.',
      '1 cadastro feito nos dois tablets foi unificado.',
      '2 edições concorrentes resolvidas pela versão mais recente.',
      '1 registro não foi importado por dados inválidos ou identidade ambígua.',
    ]);
  });

  it('avisa quando o tablet já tinha tudo', () => {
    expect(describeSummary(summary((s) => (s.skipped = 5)))).toEqual([
      'Este tablet já tinha todos os dados do outro.',
    ]);
  });
});

describe('contagens', () => {
  it('soma o que foi gravado neste tablet', () => {
    expect(
      receivedCount(
        summary((s) => {
          s.professionals.inserted = 1;
          s.patients.updated = 2;
          s.attendances.inserted = 3;
          s.skipped = 9;
        }),
      ),
    ).toBe(6);
  });

  it('escolhe o singular só para um', () => {
    expect(plural(1, 'item', 'itens')).toBe('1 item');
    expect(plural(0, 'item', 'itens')).toBe('0 itens');
  });
});
