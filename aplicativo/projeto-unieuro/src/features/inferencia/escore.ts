import type { TipoTarefa } from '@/features/captura/drawing';
import type { Traco } from '@/features/captura/eventos-tracado';
import { prepararDesenho } from '@/features/inferencia/preparo-desenho';

// O modelo recebe os três desenhos juntos e devolve a probabilidade de comprometimento cognitivo
// leve (CCL) do exame inteiro (#12). As entradas do arquivo exportado têm os nomes das tarefas.
export const TAREFAS_DO_EXAME: readonly TipoTarefa[] = ['relogio', 'cubo', 'trilhas'];

// Cada mapa é a grade de 8 × 8 da última camada da VGG16: uma célula cobre 32 × 32 px da
// entrada de 256 × 256 (repositório de IA, docs/exportacao-do-modelo.md, Tabela 4).
export const LADO_DO_MAPA = 8;
const CELULAS_DO_MAPA = LADO_DO_MAPA * LADO_DO_MAPA;

// Os traços que valem em cada tarefa, sem os desfeitos nem os apagados (reconstruirTracos).
export type DesenhosDoExame = Readonly<Record<TipoTarefa, readonly Traco[]>>;
type PrepararDesenho = (tracos: readonly Traco[]) => Float32Array;
export type EntradasDoModelo = Readonly<Record<TipoTarefa, Float32Array>>;

/**
 * As três saídas do arquivo exportado. A contribuição está na escala do logit: positiva puxa o
 * escore para CCL, negativa para o normal. O mapa vem da oclusão das regiões: cada célula é quanto a
 * contribuição do desenho cai quando aquela região é coberta com papel em branco, na mesma escala: positiva puxou para CCL,
 * negativa puxou para sem CCL, zero onde não há traço perto.
 */
export type SaidasDoModelo = {
  probabilidade: number;
  contribuicoes: Readonly<Record<TipoTarefa, number>>;
  mapas: Readonly<Record<TipoTarefa, Float32Array>>;
};

// O cálculo roda no próprio tablet, sem rede (#12, "escore sem internet"). O runtime do modelo
// entra por aqui, separado da regra.
export type ModeloDePontuacao = {
  avaliar(entradas: EntradasDoModelo): Promise<SaidasDoModelo>;
};

const ehProbabilidade = (valor: number) => Number.isFinite(valor) && valor >= 0 && valor <= 1;

const mapaValido = (mapa: Float32Array | undefined) =>
  mapa?.length === CELULAS_DO_MAPA && mapa.every((valor) => Number.isFinite(valor));

function prepararEntradas(desenhos: DesenhosDoExame, preparar: PrepararDesenho): EntradasDoModelo {
  const faltaDesenho = TAREFAS_DO_EXAME.some((tarefa) => !desenhos[tarefa]?.length);
  if (faltaDesenho) throw new Error('O exame precisa dos três desenhos para calcular o escore.');
  return {
    relogio: preparar(desenhos.relogio),
    cubo: preparar(desenhos.cubo),
    trilhas: preparar(desenhos.trilhas),
  };
}

// Uma saída fora do contrato indica um arquivo de modelo trocado ou corrompido. Mostrar um
// número nesse caso seria pior que não mostrar nada.
function conferirSaidas(saidas: SaidasDoModelo): SaidasDoModelo {
  if (!ehProbabilidade(saidas.probabilidade)) {
    throw new Error('O modelo devolveu um escore fora do intervalo de 0 a 1.');
  }
  const contribuicaoInvalida = TAREFAS_DO_EXAME.some(
    (tarefa) => !Number.isFinite(saidas.contribuicoes[tarefa]),
  );
  if (contribuicaoInvalida) throw new Error('O modelo devolveu uma contribuição inválida.');
  if (!TAREFAS_DO_EXAME.every((tarefa) => mapaValido(saidas.mapas[tarefa]))) {
    throw new Error('O modelo devolveu um mapa fora do formato de 8 × 8.');
  }
  return saidas;
}

export async function avaliarExame(
  desenhos: DesenhosDoExame,
  modelo: ModeloDePontuacao,
  preparar: PrepararDesenho = prepararDesenho,
): Promise<SaidasDoModelo> {
  return conferirSaidas(await modelo.avaliar(prepararEntradas(desenhos, preparar)));
}
