import type { NewPatient, PatientErrors, PatientForm, Sex } from '@/features/avaliacao/attendance';
import { parseCpf } from '@/features/shared/cpf';

export type PatientValidation =
  | { valid: true; patient: NewPatient }
  | { valid: false; errors: PatientErrors };

const SEXES: readonly Sex[] = ['feminino', 'masculino'];

const BIRTH_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const WHOLE_NUMBER_PATTERN = /^\d+$/;

const pad = (value: number, length: number) => String(value).padStart(length, '0');

function daysInMonth(year: number, month: number): number {
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (month === 2) return isLeapYear ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function parseBirthDate(text: string): string | null {
  const parts = BIRTH_DATE_PATTERN.exec(text.trim());
  if (!parts) return null;

  const day = Number(parts[1]);
  const month = Number(parts[2]);
  const year = Number(parts[3]);

  if (year < 1 || month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;

  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

function toLocalIsoDate(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
}

export function parseSchoolingYears(text: string): number | null {
  const trimmed = text.trim();
  return WHOLE_NUMBER_PATTERN.test(trimmed) ? Number(trimmed) : null;
}

export function validatePatient(form: PatientForm, today: Date): PatientValidation {
  const errors: PatientErrors = {};

  const name = form.name.trim();
  if (!name) errors.name = 'Preencha o nome completo.';

  const cpf = parseCpf(form.cpf);
  if (!form.cpf.trim()) errors.cpf = 'Preencha o CPF.';
  else if (!cpf) errors.cpf = 'Informe um CPF válido.';

  const recordNumber = form.recordNumber.trim();
  if (!recordNumber) errors.recordNumber = 'Preencha o número da ficha.';

  const birthDate = parseBirthDate(form.birthDate);
  if (!form.birthDate.trim()) errors.birthDate = 'Preencha a data de nascimento.';
  else if (!birthDate) errors.birthDate = 'Informe uma data que exista, no formato DD/MM/AAAA.';
  else if (birthDate > toLocalIsoDate(today)) {
    errors.birthDate = 'A data de nascimento não pode ser depois de hoje.';
  }

  const schoolingYears = parseSchoolingYears(form.schooling);
  if (!form.schooling.trim()) errors.schooling = 'Preencha a escolaridade, em anos de estudo.';
  else if (schoolingYears === null) {
    errors.schooling = 'Informe a escolaridade em anos de estudo, só com números inteiros.';
  }

  const { sex } = form;
  if (sex !== null && !SEXES.includes(sex)) {
    errors.sex = 'Escolha feminino ou masculino, ou deixe em branco.';
  }

  if (Object.keys(errors).length > 0 || !cpf || !birthDate || schoolingYears === null) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    patient: { name, cpf, recordNumber, birthDate, schoolingYears, sex },
  };
}
