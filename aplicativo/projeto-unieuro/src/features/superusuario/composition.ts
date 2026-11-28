import { professionalRepository } from '@/db/professional-repository';
import type { ContasDosMedicosRepository } from '@/features/superusuario/contas-dos-medicos';
import type { CriacaoRepository } from '@/features/superusuario/criar-superusuario';

/** Liga a área do superusuário ao banco. As rotas importam daqui, e não de `@/db`. */
export const contasRepository: ContasDosMedicosRepository & CriacaoRepository =
  professionalRepository;
