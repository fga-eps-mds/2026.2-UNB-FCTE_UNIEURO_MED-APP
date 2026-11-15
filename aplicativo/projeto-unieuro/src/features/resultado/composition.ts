import { examResultRepository } from '@/db/exam-result-repository';
import type { ResultadoRepository } from '@/features/resultado/resultado';

/**
 * Liga a tela de resultado ao banco. A rota importa daqui, e não de `@/db`, para
 * respeitar a regra de camadas. A anotação confere que o repositório do banco
 * atende ao contrato da regra: se os formatos divergirem, o `tsc` acusa aqui.
 */
export const resultadoRepository: ResultadoRepository = examResultRepository;
