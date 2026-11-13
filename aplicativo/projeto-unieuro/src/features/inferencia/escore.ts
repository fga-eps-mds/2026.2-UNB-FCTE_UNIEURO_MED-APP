import type { TipoTarefa } from '@/features/captura/drawing';
import { prepararDesenho } from '@/features/inferencia/preparo-desenho';

// O modelo recebe os três desenhos juntos e devolve a probabilidade de comprometimento cognitivo
// leve (CCL) do exame inteiro (#12). As entradas do arquivo exportado têm os nomes das tarefas.
const TAREFAS_DO_EXAME: readonly TipoTarefa[] = ['relogio', 'cubo', 'trilhas'];

export type DesenhosDoExame = Readonly<Record<TipoTarefa, Uint8Array>>;
export type EntradasDoModelo = Readonly<Record<TipoTarefa, Float32Array>>;

// O cálculo roda no próprio tablet, sem rede (#12, "escore sem internet"). O runtime do modelo
// entra por aqui, separado da regra.
export type ModeloDePontuacao = {
  calcularProbabilidade(entradas: EntradasDoModelo): Promise<number>;
};

const ehProbabilidade = (valor: number) => Number.isFinite(valor) && valor >= 0 && valor <= 1;

function prepararEntradas(
  desenhos: DesenhosDoExame,
  preparar: (png: Uint8Array) => Float32Array,
): EntradasDoModelo {
  const faltaDesenho = TAREFAS_DO_EXAME.some((tarefa) => !desenhos[tarefa]?.length);
  if (faltaDesenho) throw new Error('O exame precisa dos três desenhos para calcular o escore.');
  return {
    relogio: preparar(desenhos.relogio),
    cubo: preparar(desenhos.cubo),
    trilhas: preparar(desenhos.trilhas),
  };
}

export async function calcularEscoreDoExame(
  desenhos: DesenhosDoExame,
  modelo: ModeloDePontuacao,
  preparar: (png: Uint8Array) => Float32Array = prepararDesenho,
): Promise<number> {
  const probabilidade = await modelo.calcularProbabilidade(prepararEntradas(desenhos, preparar));
  if (!ehProbabilidade(probabilidade)) {
    throw new Error('O modelo devolveu um escore fora do intervalo de 0 a 1.');
  }
  return probabilidade;
}
