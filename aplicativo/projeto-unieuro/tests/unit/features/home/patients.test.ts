import {
  countExams,
  cpfDigitsOf,
  describeTotals,
  filterPatients,
  formatDate,
  sortByLastExam,
  EXAM_STATUS_TONE,
  toExamStatus,
  toPatientSummary,
  type PatientSummary,
} from '@/features/home/patients';

const paciente = (dados: Partial<PatientSummary>): PatientSummary => ({
  id: 1,
  name: 'José Alves Martins',
  recordNumber: '2026-0184',
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

  it('compara o momento do exame, e não o texto da data', () => {
    // 23h30 em UTC é 20h30 em Brasília: este exame é anterior ao das 21h.
    const emUtc = paciente({ id: 1, lastExamAt: '2026-10-05T23:30:00Z' });
    const comFuso = paciente({ id: 2, lastExamAt: '2026-10-05T21:00:00-03:00' });

    expect(sortByLastExam([emUtc, comFuso]).map((p) => p.id)).toEqual([2, 1]);
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

  it('encontra a ficha com letras sem diferenciar maiúsculas', () => {
    const comLetra = [paciente({ id: 9, recordNumber: 'AB-0042' })];

    expect(filterPatients(comLetra, 'ab-0042').map((p) => p.id)).toEqual([9]);
  });

  it('devolve todos quando a busca está vazia', () => {
    expect(filterPatients(lista, '   ')).toHaveLength(3);
  });

  it('devolve lista vazia quando nada corresponde', () => {
    expect(filterPatients(lista, 'Helena')).toEqual([]);
  });
});

describe('busca pelo CPF', () => {
  const cpfs = new Map([
    [1, '12345678909'],
    [2, '98765432100'],
  ]);

  it.each([
    ['123', [1]],
    ['123.456', [1]],
    ['123.456.789-09', [1]],
    ['12345678909', [1]],
    [' 987 ', [2]],
  ])('encontra pelos primeiros dígitos "%s"', (busca, ids) => {
    expect(filterPatients(lista, busca, cpfs).map((p) => p.id)).toEqual(ids);
  });

  it('não encontra por dígitos do meio do CPF', () => {
    expect(filterPatients(lista, '456', cpfs)).toEqual([]);
  });

  it('não compara o CPF quando a busca tem letras', () => {
    expect(filterPatients(lista, 'José 123', cpfs)).toEqual([]);
  });

  it('busca só pelo nome e pela ficha enquanto os CPFs não foram lidos', () => {
    expect(filterPatients(lista, '123')).toEqual([]);
  });
});

describe('dígitos de CPF na busca', () => {
  it.each([
    ['123.456.789-09', '12345678909'],
    [' 123 ', '123'],
    ['José', null],
    ['12a', null],
    ['.-', null],
    ['', null],
  ])('"%s" vira %p', (busca, digitos) => {
    expect(cpfDigitsOf(busca)).toBe(digitos);
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
  it('formata datas e datas com hora no padrão brasileiro', () => {
    expect(formatDate('1948-03-14')).toBe('14/03/1948');
    expect(formatDate('2026-10-05T14:32:00')).toBe('05/10/2026');
  });

  it('mostra o dia do tablet para um exame gravado em UTC', () => {
    // Exame às 22h30 no horário do aparelho. Em Brasília, o texto em UTC já é
    // do dia 06, e a tela precisa continuar mostrando o dia 05.
    const gravado = new Date(2026, 9, 5, 22, 30).toISOString();

    expect(formatDate(gravado)).toBe('05/10/2026');
  });
});

describe('atendimento convertido para a lista', () => {
  it.each([
    ['concluida', 'concluido'],
    ['interrompida', 'interrompido'],
    ['cancelada', 'recusado'],
  ])('o estado %s vira %s', (estado, status) => {
    expect(toExamStatus(estado)).toBe(status);
  });

  it.each(['aguardando_consentimento', 'em_andamento', 'processando_resultado', 'erro_inferencia'])(
    'o exame ainda não terminado (%s) fica sem rótulo',
    (estado) => {
      expect(toExamStatus(estado)).toBeNull();
    },
  );

  it('usa o atendimento mais recente como último exame e conta todos os atendimentos', () => {
    expect(
      toPatientSummary({
        id: 4,
        name: 'José Alves Martins',
        recordNumber: '2026-0001',
        attendanceCount: 3,
        lastStartedAt: '2026-10-13T09:10:00.000Z',
        lastState: 'aguardando_consentimento',
      }),
    ).toEqual({
      id: 4,
      name: 'José Alves Martins',
      recordNumber: '2026-0001',
      lastExamAt: '2026-10-13T09:10:00.000Z',
      lastExamStatus: null,
      examCount: 3,
    });
  });
});

describe('tom da situação do exame', () => {
  it('usa sucesso para o exame concluído e aviso para o interrompido e a recusa', () => {
    expect(EXAM_STATUS_TONE).toEqual({
      concluido: 'success',
      interrompido: 'warning',
      recusado: 'warning',
    });
  });
});
