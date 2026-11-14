import {
  ageInYears,
  describeAge,
  describeExams,
  formatDateTime,
  formatSchooling,
  SEX_LABEL,
  toPatientDetail,
  type PatientWithExams,
} from '@/features/home/patient-detail';

const registro: PatientWithExams = {
  id: 7,
  name: 'José Alves Martins',
  recordNumber: '2026-0184',
  birthDate: '1948-03-14',
  schoolingYears: 5,
  sex: 'masculino',
  exams: [
    { id: 12, startedAt: '2026-10-05T14:32:00', state: 'concluida' },
    { id: 9, startedAt: '2026-09-28T10:05:00', state: 'interrompida' },
  ],
};

describe('toPatientDetail', () => {
  it('mantém os dados do paciente e a ordem dos exames', () => {
    const detalhe = toPatientDetail(registro);

    expect(detalhe).toMatchObject({
      id: 7,
      name: 'José Alves Martins',
      recordNumber: '2026-0184',
      birthDate: '1948-03-14',
      schoolingYears: 5,
      sex: 'masculino',
    });
    expect(detalhe.exams.map((exam) => exam.id)).toEqual([12, 9]);
  });

  it('traduz o estado de cada exame para a situação mostrada', () => {
    const { exams } = toPatientDetail({
      ...registro,
      exams: [
        { id: 1, startedAt: '2026-10-05T14:32:00', state: 'concluida' },
        { id: 2, startedAt: '2026-10-04T14:32:00', state: 'interrompida' },
        { id: 3, startedAt: '2026-10-03T14:32:00', state: 'cancelada' },
      ],
    });

    expect(exams.map((exam) => [exam.status, exam.label])).toEqual([
      ['concluido', 'Concluído'],
      ['interrompido', 'Interrompido'],
      ['recusado', 'Recusou o termo'],
    ]);
  });

  it.each([
    ['concluida', 'success'],
    ['interrompida', 'warning'],
    ['cancelada', 'warning'],
    ['erro_inferencia', 'error'],
    ['aguardando_consentimento', 'info'],
    ['em_andamento', 'info'],
    ['processando_resultado', 'info'],
    ['outro_estado', 'info'],
  ])('classifica o exame %s como "%s", para a cor e o ícone da situação', (state, tone) => {
    const { exams } = toPatientDetail({
      ...registro,
      exams: [{ id: 1, startedAt: '2026-10-05T14:32:00', state }],
    });

    expect(exams[0].tone).toBe(tone);
  });

  it.each([
    ['aguardando_consentimento', 'Aguardando o termo'],
    ['em_andamento', 'Em andamento'],
    ['processando_resultado', 'Processando'],
    ['erro_inferencia', 'Erro ao calcular'],
  ])('mostra o exame %s ainda sem desfecho como "%s"', (state, label) => {
    const { exams } = toPatientDetail({
      ...registro,
      exams: [{ id: 1, startedAt: '2026-10-05T14:32:00', state }],
    });

    expect(exams[0]).toMatchObject({ status: null, label });
  });

  it('não esconde um estado que a tela não conhece', () => {
    const { exams } = toPatientDetail({
      ...registro,
      exams: [{ id: 1, startedAt: '2026-10-05T14:32:00', state: 'outro_estado' }],
    });

    expect(exams[0]).toMatchObject({ status: null, label: 'Situação desconhecida' });
  });
});

describe('idade', () => {
  it('conta o aniversário só depois do dia', () => {
    expect(ageInYears('1948-03-14', new Date(2026, 2, 13))).toBe(77);
    expect(ageInYears('1948-03-14', new Date(2026, 2, 14))).toBe(78);
    expect(ageInYears('1948-03-14', new Date(2026, 10, 13))).toBe(78);
  });

  it('não passa de um mês para o outro antes da hora', () => {
    expect(ageInYears('1948-12-31', new Date(2026, 11, 30))).toBe(77);
    expect(ageInYears('1948-12-31', new Date(2026, 11, 31))).toBe(78);
  });

  it('mostra a data de nascimento e a idade', () => {
    expect(describeAge('1948-03-14', new Date(2026, 10, 13))).toBe('14/03/1948 · 78 anos');
  });

  it('usa o singular para um ano', () => {
    expect(describeAge('2025-06-01', new Date(2026, 10, 13))).toBe('01/06/2025 · 1 ano');
  });
});

describe('sexo e escolaridade', () => {
  it('traduz o sexo e avisa quando não foi informado', () => {
    expect(SEX_LABEL.masculino).toBe('Masculino');
    expect(SEX_LABEL.feminino).toBe('Feminino');
    expect(SEX_LABEL.none).toBe('Não informado');
  });

  it('escreve a escolaridade em anos', () => {
    expect(formatSchooling(5)).toBe('5 anos');
    expect(formatSchooling(1)).toBe('1 ano');
    expect(formatSchooling(0)).toBe('0 anos');
  });
});

describe('resumo dos exames', () => {
  it('usa o singular para um exame', () => {
    expect(describeExams(1)).toBe('1 exame');
  });

  it('diz a ordem quando há mais de um', () => {
    expect(describeExams(2)).toBe('2 exames, do mais recente para o mais antigo');
  });
});

describe('data e hora do exame', () => {
  it('escreve no padrão brasileiro, no horário do tablet', () => {
    expect(formatDateTime('2026-10-05T14:32:00')).toBe('05/10/2026 · 14:32');
  });

  it('mostra o dia e a hora do tablet para um exame gravado em UTC', () => {
    const gravado = new Date(2026, 9, 5, 22, 30).toISOString();

    expect(formatDateTime(gravado)).toBe('05/10/2026 · 22:30');
  });

  it('completa com zero a hora e o minuto', () => {
    expect(formatDateTime('2026-10-05T07:05:00')).toBe('05/10/2026 · 07:05');
  });
});
