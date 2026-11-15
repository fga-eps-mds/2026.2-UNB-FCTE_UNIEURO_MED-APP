import { attendanceRepository } from '@/db/attendance-repository';
import { examRepository } from '@/db/exam-repository';
import type { ExameRepository } from '@/features/home/exame';
import type { PatientListRepository } from '@/features/home/patients';

/**
 * Liga a lista da tela inicial ao banco. A rota importa daqui, e não de `@/db`,
 * para respeitar a regra de camadas.
 */
export const patientListRepository: PatientListRepository = attendanceRepository;

export const exameRepository: ExameRepository = examRepository;
