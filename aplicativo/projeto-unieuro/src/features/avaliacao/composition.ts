import { attendanceRepository } from '@/db/attendance-repository';
import type { AttendanceRepository } from '@/features/avaliacao/attendance';

/**
 * Liga a regra do atendimento ao banco. As rotas e a tela importam daqui, e não
 * de `@/db`, para respeitar a regra de camadas (o lint barra o import direto).
 */
export const registerAttendanceRepository: AttendanceRepository = attendanceRepository;
