import {
  ageOn,
  countExams,
  describeTotals,
  filterPatients,
  formatDate,
  sortByLastExam,
  type PatientSummary,
} from '@/features/home/patients';

const paciente = (dados: Partial<PatientSummary>): PatientSummary => ({
  id: 1,
  name: 'José Alves Martins',
  recordNumber: '2026-0184',
  birthDate: '1948-03-14',
  lastExamAt: '2026-10-05T14:32:00',
  lastExamStatus: 'concluido',
  examCount: 2,
  ...dados,
});

const lista = [
  paciente({ id: 1, name: 'José Alves Martins', lastExamAt: '2026-09-28T10:05:00' }),
  paciente({ id: 2, name: 'Antônio Carlos Ferreira', recordNumber: '2026-0179' }),
  paciente({ id: 3, name: 'Maria das Graças Lima', lastExamAt: null, examCount: 0 }),
];

describe('ordem da lista', () => {
  it('põe primeiro o paciente com o exame mais recente e por último quem não fez exame', () => {
    expect(sortByLastExam(lista).map((p) => p.id)).toEqual([2, 1, 3]);
  });

  it('não altera a lista recebida', () => {
    sortByLastExam(lista);

    expect(lista.map((p) => p.id)).toEqual([1, 2, 3]);
  });
});

describe('busca de paciente', () => {
  it('encontra por parte do nome sem diferenciar acentos nem maiúsculas', () => {
    expect(filterPatients(lista, 'antonio').map((p) => p.id)).toEqual([2]);
    expect(filterPatients(lista, 'GRAÇAS').map((p) => p.id)).toEqual([3]);
  });

  it('encontra pelo número da ficha', () => {
    expect(filterPatients(lista, '0179').map((p) => p.id)).toEqual([2]);
  });

  it('devolve todos quando a busca está vazia', () => {
    expect(filterPatients(lista, '   ')).toHaveLength(3);
  });

  it('devolve lista vazia quando nada corresponde', () => {
    expect(filterPatients(lista, 'Helena')).toEqual([]);
  });
});

describe('resumo do cabeçalho', () => {
  it('soma os exames de todos os pacientes', () => {
    expect(countExams(lista)).toBe(4);
  });

  it('descreve pacientes e exames no plural', () => {
    expect(describeTotals(lista)).toBe('3 pacientes e 4 exames aplicados por você.');
  });

  it('usa o singular para um paciente com um exame', () => {
    expect(describeTotals([paciente({ examCount: 1 })])).toBe(
      '1 paciente e 1 exame aplicado por você.',
    );
  });

  it('avisa quando ainda não há exame', () => {
    expect(describeTotals([])).toBe('Nenhum exame aplicado ainda.');
  });
});

describe('datas', () => {
  it('calcula a idade antes e depois do aniversário', () => {
    expect(ageOn('1948-03-14', new Date(2026, 2, 13))).toBe(77);
    expect(ageOn('1948-03-14', new Date(2026, 2, 14))).toBe(78);
    expect(ageOn('1948-03-14', new Date(2026, 9, 5))).toBe(78);
  });

  it('formata datas e datas com hora no padrão brasileiro', () => {
    expect(formatDate('1948-03-14')).toBe('14/03/1948');
    expect(formatDate('2026-10-05T14:32:00')).toBe('05/10/2026');
  });
});
