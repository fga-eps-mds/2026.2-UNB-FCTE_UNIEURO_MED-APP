import { attendanceRepository } from '@/db/attendance-repository';
import type { PatientDetailRepository } from '@/features/home/patient-detail';
import type { PatientListRepository } from '@/features/home/patients';

/**
 * Liga a lista da tela inicial e a tela do paciente ao banco. As rotas importam
 * daqui, e não de `@/db`, para respeitar a regra de camadas.
 */
export const patientListRepository: PatientListRepository = attendanceRepository;

export const patientDetailRepository: PatientDetailRepository = attendanceRepository;
