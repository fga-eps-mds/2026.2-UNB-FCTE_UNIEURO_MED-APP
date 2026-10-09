import { validatePatient } from '@/features/avaliacao/patient';

export type Sex = 'feminino' | 'masculino';

export type PatientForm = {
  name: string;
  cpf: string;
  recordNumber: string;
  birthDate: string;
  schooling: string;
  sex: Sex | null;
};

export type PatientField = keyof PatientForm;
export type PatientErrors = Partial<Record<PatientField, string>>;

export type NewPatient = {
  name: string;
  cpf: string;
  recordNumber: string;
  birthDate: string;
  schoolingYears: number;
  sex: Sex | null;
};

export type AttendanceRepository = {
  findPatientByCpf(cpf: string): Promise<{ id: number } | null>;
  createAttendance(data: {
    patient: NewPatient | { id: number };
    professionalId: number;
    startedAt: string;
  }): Promise<{ attendanceId: number }>;
};

export type AttendanceResult =
  | { success: true; attendanceId: number }
  | { success: false; errors: PatientErrors };

export type NewAttendanceScreenProps = {
  repository: AttendanceRepository;
  onRegistered: (attendanceId: number) => void;
};

export type AttendanceDependencies = {
  repository: AttendanceRepository;
  professionalId: number;
  now?: () => Date;
};

export async function registerAttendance(
  form: PatientForm,
  { repository, professionalId, now = () => new Date() }: AttendanceDependencies,
): Promise<AttendanceResult> {
  const startedAt = now();

  const validation = validatePatient(form, startedAt);
  if (!validation.valid) return { success: false, errors: validation.errors };

  const { patient } = validation;
  const existing = await repository.findPatientByCpf(patient.cpf);

  const { attendanceId } = await repository.createAttendance({
    patient: existing ? { id: existing.id } : patient,
    professionalId,
    startedAt: startedAt.toISOString(),
  });

  return { success: true, attendanceId };
}
