import { professionalRepository } from '@/db/professional-repository';
import type { ContasRepository } from '@/features/superusuario/contas';

/** Liga a área do superusuário ao banco. As rotas importam daqui, e não de `@/db`. */
export const contasRepository: ContasRepository = professionalRepository;
