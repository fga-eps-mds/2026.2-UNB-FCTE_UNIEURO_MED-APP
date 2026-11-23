import { modelResultRepository } from '@/db/model-result-repository';
import type { AnaliseRepository, DependenciasDaAnalise } from '@/features/inferencia/analise';
import { carregarModeloDoTablet } from '@/features/inferencia/runtime-do-modelo';

/**
 * Liga a análise ao banco e ao modelo do tablet. A rota importa daqui, e não de `@/db`, para
 * respeitar a regra de camadas. A anotação confere que o repositório do banco atende ao
 * contrato da análise: se os formatos divergirem, o `tsc` acusa aqui.
 */
export const analiseRepository: AnaliseRepository = modelResultRepository;

export const dependenciasDaAnalise: DependenciasDaAnalise = {
  repository: analiseRepository,
  carregarModelo: carregarModeloDoTablet,
};
