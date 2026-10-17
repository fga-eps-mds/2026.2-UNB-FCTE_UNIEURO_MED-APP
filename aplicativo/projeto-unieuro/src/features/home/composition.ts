import { attendanceRepository } from '@/db/attendance-repository';
import type { PatientListRepository } from '@/features/home/patients';

/**
 * Liga a lista da tela inicial ao banco. A rota importa daqui, e não de `@/db`,
 * para respeitar a regra de camadas.
 */
export const patientListRepository: PatientListRepository = attendanceRepository;
