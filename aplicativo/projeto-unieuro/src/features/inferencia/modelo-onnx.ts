import type { TipoTarefa } from '@/features/captura/drawing';
import { LADO_ENTRADA } from '@/features/inferencia/entrada-modelo';
import {
  LADO_DO_MAPA,
  TAREFAS_DO_EXAME,
  type EntradasDoModelo,
  type ModeloDePontuacao,
  type SaidasDoModelo,
} from '@/features/inferencia/escore';

// Contrato do arquivo exportado (repositório de IA, docs/exportacao-do-modelo.md, Tabela 4).
export const FORMA_DA_ENTRADA: readonly number[] = [1, 3, LADO_ENTRADA, LADO_ENTRADA];
export const SAIDA_PROBABILIDADE = 'probabilidade_ccl';
export const SAIDA_CONTRIBUICOES = 'contribuicoes';
export const SAIDA_MAPAS = 'mapas';

const CELULAS_DO_MAPA = LADO_DO_MAPA * LADO_DO_MAPA;

export type TensorDeSaida = { data: ArrayLike<number>; dims: readonly number[] };

export type SessaoDoModelo = {
  run(entradas: Record<string, unknown>): Promise<Record<string, TensorDeSaida | undefined>>;
};

/** O que o modelo usa do ONNX Runtime. A implementação real fica em `runtime-do-modelo.ts`. */
export type RuntimeOnnx = {
  criarTensor(dados: Float32Array, forma: readonly number[]): unknown;
  abrirSessao(endereco: string): Promise<SessaoDoModelo>;
};

export type ModeloCarregado = { versao: string; modelo: ModeloDePontuacao };

const mesmaForma = (dims: readonly number[], esperada: readonly number[]) =>
  dims.length === esperada.length && dims.every((valor, indice) => valor === esperada[indice]);

function saida(
  resultado: Record<string, TensorDeSaida | undefined>,
  nome: string,
  forma: number[],
) {
  const tensor = resultado[nome];
  if (!tensor || !mesmaForma(tensor.dims, forma)) {
    throw new Error(`O modelo não devolveu a saída "${nome}" no formato esperado.`);
  }
  return tensor.data;
}

function lerSaidas(resultado: Record<string, TensorDeSaida | undefined>): SaidasDoModelo {
  const tarefas = TAREFAS_DO_EXAME.length;
  const probabilidade = saida(resultado, SAIDA_PROBABILIDADE, [1]);
  const contribuicoes = saida(resultado, SAIDA_CONTRIBUICOES, [1, tarefas]);
  const mapas = saida(resultado, SAIDA_MAPAS, [1, tarefas, LADO_DO_MAPA, LADO_DO_MAPA]);
  const porTarefa = <T>(valor: (indice: number) => T) =>
    Object.fromEntries(TAREFAS_DO_EXAME.map((tarefa, indice) => [tarefa, valor(indice)])) as Record<
      TipoTarefa,
      T
    >;
  return {
    probabilidade: Number(probabilidade[0]),
    contribuicoes: porTarefa((indice) => Number(contribuicoes[indice])),
    // Cópia de cada mapa: o tensor de saída pertence à sessão.
    mapas: porTarefa((indice) =>
      Float32Array.from(
        Array.prototype.slice.call(mapas, indice * CELULAS_DO_MAPA, (indice + 1) * CELULAS_DO_MAPA),
      ),
    ),
  };
}

/**
 * Modelo de pontuação pelo ONNX Runtime. A sessão abre uma vez e fica aberta: abrir o arquivo
 * de 185 MB leva segundos, e o profissional pode aplicar vários exames seguidos. Se a abertura
 * falhar, a próxima chamada tenta de novo.
 */
export function criarCarregadorDoModelo(
  localizar: () => Promise<{ endereco: string; versao: string }>,
  runtime: RuntimeOnnx,
): () => Promise<ModeloCarregado> {
  let carregando: Promise<ModeloCarregado> | null = null;

  async function carregar(): Promise<ModeloCarregado> {
    const { endereco, versao } = await localizar();
    const sessao = await runtime.abrirSessao(endereco);
    const modelo: ModeloDePontuacao = {
      async avaliar(entradas: EntradasDoModelo) {
        const tensores = Object.fromEntries(
          TAREFAS_DO_EXAME.map((tarefa) => [
            tarefa,
            runtime.criarTensor(entradas[tarefa], FORMA_DA_ENTRADA),
          ]),
        );
        return lerSaidas(await sessao.run(tensores));
      },
    };
    return { versao, modelo };
  }

  return () => {
    carregando ??= carregar().catch((erro: unknown) => {
      carregando = null;
      throw erro;
    });
    return carregando;
  };
}
