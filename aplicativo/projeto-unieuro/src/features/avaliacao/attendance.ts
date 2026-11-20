import { validatePatient } from '@/features/avaliacao/patient';

export type Sex = 'feminino' | 'masculino';

export type PatientForm = {
  name: string;
  cpf: string;
  birthDate: string;
  schooling: string;
  sex: Sex | null;
};

export type PatientField = keyof PatientForm;
export type PatientErrors = Partial<Record<PatientField, string>>;

/** O número da ficha não vem do formulário: o banco gera um a cada paciente novo. */
export type NewPatient = {
  name: string;
  cpf: string;
  birthDate: string;
  schoolingYears: number;
  sex: Sex | null;
};

/** Paciente já cadastrado com o CPF digitado: nome e ficha para o aviso da #140. */
export type ExistingPatient = { id: number; name: string; recordNumber: string };

export type AttendanceRepository = {
  findPatientByCpf(cpf: string): Promise<ExistingPatient | null>;
  createAttendance(data: {
    patient: NewPatient | { id: number };
    professionalId: number;
    startedAt: string;
  }): Promise<{ attendanceId: number }>;
};

export type AttendanceResult =
  | { success: true; attendanceId: number }
  | { success: false; errors: PatientErrors }
  | { success: false; existingPatient: ExistingPatient };

export type NewAttendanceScreenProps = {
  repository: AttendanceRepository;
  onRegistered: (attendanceId: number) => void;
};

export type AttendanceDependencies = {
  repository: AttendanceRepository;
  professionalId: number;
  /**
   * Paciente que o médico confirmou no aviso do CPF já cadastrado (#140). Sem ele,
   * ou se o CPF agora é de outro paciente, o exame não é gravado e o aviso volta.
   */
  confirmedPatientId?: number;
  now?: () => Date;
};

export async function registerAttendance(
  form: PatientForm,
  {
    repository,
    professionalId,
    confirmedPatientId,
    now = () => new Date(),
  }: AttendanceDependencies,
): Promise<AttendanceResult> {
  const startedAt = now();

  const validation = validatePatient(form, startedAt);
  if (!validation.valid) return { success: false, errors: validation.errors };

  const { patient } = validation;
  const existing = await repository.findPatientByCpf(patient.cpf);

  // O CPF identifica o paciente. Se ele já existe, o exame entra na ficha dele e os
  // dados digitados não mudam o cadastro: antes, o médico precisa saber disso (#140).
  if (existing && existing.id !== confirmedPatientId) {
    return { success: false, existingPatient: existing };
  }

  const { attendanceId } = await repository.createAttendance({
    patient: existing ? { id: existing.id } : patient,
    professionalId,
    startedAt: startedAt.toISOString(),
  });

  return { success: true, attendanceId };
}
