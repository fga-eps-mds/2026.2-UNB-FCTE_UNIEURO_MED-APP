import type { PatientForm } from '@/features/avaliacao/attendance';
import { parseBirthDate, parseSchoolingYears, validatePatient } from '@/features/avaliacao/patient';

const TODAY = new Date(2026, 9, 9, 10, 30);

const validForm: PatientForm = {
  name: '  José Alves Martins ',
  cpf: '123.456.789-09',
  recordNumber: ' 2026-0184 ',
  birthDate: '14/03/1948',
  schooling: ' 5 ',
  sex: 'masculino',
};

const validate = (change: Partial<PatientForm> = {}) =>
  validatePatient({ ...validForm, ...change }, TODAY);

describe('Cenário: identificação mínima do paciente', () => {
  it('normaliza os seis dados do paciente e não guarda mais nenhum', () => {
    const result = validate();

    expect(result).toEqual({
      valid: true,
      patient: {
        name: 'José Alves Martins',
        cpf: '12345678909',
        recordNumber: '2026-0184',
        birthDate: '1948-03-14',
        schoolingYears: 5,
        sex: 'masculino',
      },
    });
  });

  it('aceita o paciente sem o sexo informado', () => {
    expect(validate({ sex: null })).toMatchObject({ valid: true, patient: { sex: null } });
  });

  it('aceita o sexo feminino', () => {
    expect(validate({ sex: 'feminino' })).toMatchObject({
      valid: true,
      patient: { sex: 'feminino' },
    });
  });

  it('recusa um valor de sexo fora das duas opções', () => {
    expect(validate({ sex: 'outro' as PatientForm['sex'] })).toEqual({
      valid: false,
      errors: { sex: 'Escolha feminino ou masculino, ou deixe em branco.' },
    });
  });
});

describe('Cenário: campo obrigatório vazio', () => {
  it.each([
    ['nome completo', { name: '   ' }, { name: 'Preencha o nome completo.' }],
    ['CPF', { cpf: '' }, { cpf: 'Preencha o CPF.' }],
    ['número da ficha', { recordNumber: '  ' }, { recordNumber: 'Preencha o número da ficha.' }],
    ['data de nascimento', { birthDate: '' }, { birthDate: 'Preencha a data de nascimento.' }],
    [
      'escolaridade',
      { schooling: '' },
      { schooling: 'Preencha a escolaridade, em anos de estudo.' },
    ],
  ])('indica que falta o campo %s', (_field, change, errors) => {
    expect(validate(change)).toEqual({ valid: false, errors });
  });

  it('indica todos os campos que faltam de uma vez', () => {
    const result = validatePatient(
      { name: '', cpf: '', recordNumber: '', birthDate: '', schooling: '', sex: null },
      TODAY,
    );

    expect(result).toEqual({
      valid: false,
      errors: {
        name: 'Preencha o nome completo.',
        cpf: 'Preencha o CPF.',
        recordNumber: 'Preencha o número da ficha.',
        birthDate: 'Preencha a data de nascimento.',
        schooling: 'Preencha a escolaridade, em anos de estudo.',
      },
    });
  });
});

describe('Cenário: escolaridade do paciente', () => {
  it('exige a escolaridade para seguir', () => {
    expect(validate({ schooling: '   ' })).toEqual({
      valid: false,
      errors: { schooling: 'Preencha a escolaridade, em anos de estudo.' },
    });
  });

  it.each([
    ['negativa', '-3'],
    ['com letras', 'cinco'],
    ['com casas decimais', '5,5'],
    ['com ponto', '5.5'],
  ])('recusa a escolaridade %s', (_case, schooling) => {
    expect(validate({ schooling })).toEqual({
      valid: false,
      errors: {
        schooling: 'Informe a escolaridade em anos de estudo, só com números inteiros.',
      },
    });
  });

  it.each([
    ['0', 0],
    ['12', 12],
  ])('aceita %s anos de estudo', (schooling, schoolingYears) => {
    expect(validate({ schooling })).toMatchObject({ valid: true, patient: { schoolingYears } });
  });
});

describe('Cenário: CPF inválido', () => {
  it.each([
    ['dígitos verificadores errados', '123.456.789-00'],
    ['todos os dígitos iguais', '111.111.111-11'],
    ['dígitos a menos', '123.456.789'],
  ])('pede para corrigir o CPF com %s', (_case, cpf) => {
    expect(validate({ cpf })).toEqual({ valid: false, errors: { cpf: 'Informe um CPF válido.' } });
  });

  it.each([
    ['com máscara', '123.456.789-09'],
    ['sem máscara', '12345678909'],
  ])('aceita o CPF válido %s e grava só os dígitos', (_case, cpf) => {
    expect(validate({ cpf })).toMatchObject({ valid: true, patient: { cpf: '12345678909' } });
  });

  it('não repete o CPF digitado na mensagem', () => {
    const result = validate({ cpf: '123.456.789-00' });

    expect(JSON.stringify(result)).not.toContain('123');
  });
});

describe('Cenário: data de nascimento inválida', () => {
  it.each([
    ['dia que não existe no mês', '31/02/1950'],
    ['29 de fevereiro em ano não bissexto', '29/02/1949'],
    ['29 de fevereiro em ano de século não bissexto', '29/02/1900'],
    ['dia 31 em mês de 30 dias', '31/04/1950'],
    ['dia zero', '00/03/1950'],
    ['mês que não existe', '14/13/1950'],
    ['mês zero', '14/00/1950'],
    ['ano zero', '14/03/0000'],
    ['data incompleta', '14/03/19'],
    ['formato trocado', '1948-03-14'],
  ])('pede para corrigir a data com %s', (_case, birthDate) => {
    expect(validate({ birthDate })).toEqual({
      valid: false,
      errors: { birthDate: 'Informe uma data que exista, no formato DD/MM/AAAA.' },
    });
  });

  it('pede para corrigir a data posterior à data atual', () => {
    expect(validate({ birthDate: '10/10/2026' })).toEqual({
      valid: false,
      errors: { birthDate: 'A data de nascimento não pode ser depois de hoje.' },
    });
  });

  it.each([
    ['a data de hoje', '09/10/2026', '2026-10-09'],
    ['29 de fevereiro em ano bissexto', '29/02/1948', '1948-02-29'],
    ['29 de fevereiro em ano de século bissexto', '29/02/2000', '2000-02-29'],
    ['o último dia de um mês de 30 dias', '30/11/1950', '1950-11-30'],
  ])('aceita %s', (_case, birthDate, expected) => {
    expect(validate({ birthDate })).toMatchObject({
      valid: true,
      patient: { birthDate: expected },
    });
  });
});

describe('parseBirthDate', () => {
  it('converte para o formato de gravação', () => {
    expect(parseBirthDate(' 14/03/1948 ')).toBe('1948-03-14');
  });

  it('devolve null para texto vazio', () => {
    expect(parseBirthDate('')).toBeNull();
  });
});

describe('parseSchoolingYears', () => {
  it('converte os anos de estudo em número', () => {
    expect(parseSchoolingYears(' 08 ')).toBe(8);
  });

  it('devolve null para texto vazio', () => {
    expect(parseSchoolingYears('')).toBeNull();
  });
});
