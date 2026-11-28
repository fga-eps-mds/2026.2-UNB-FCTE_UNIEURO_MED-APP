import { examResultRepository } from '@/db/exam-result-repository';
import { modelResultRepository } from '@/db/model-result-repository';
import type { ResultadoRepository } from '@/features/resultado/resultado';

/**
 * Liga a tela de resultado ao banco. A rota importa daqui, e não de `@/db`, para
 * respeitar a regra de camadas. A anotação confere que os repositórios do banco
 * atendem ao contrato da regra: se os formatos divergirem, o `tsc` acusa aqui.
 *
 * O exame vem do repositório do resultado, que já confere quem pode vê-lo; só depois
 * entra o resultado do modelo (#12). O traçado só é lido quando há mapa para pôr sobre ele.
 */
export const resultadoRepository: ResultadoRepository = {
  async findExamResult(requesterId, examId) {
    const exam = await examResultRepository.findExamResult(requesterId, examId);
    if (!exam) return null;
    const model = await modelResultRepository.findResult(examId);
    if (!model) return { ...exam, model };
    return { ...exam, model, traces: await modelResultRepository.findTraces(examId) };
  },
};
