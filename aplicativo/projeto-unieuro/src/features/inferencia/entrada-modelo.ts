import type { PontoTracado, Traco } from '@/features/captura/eventos-tracado';

// Contrato do modelo exportado (repositório de IA, docs/exportacao-do-modelo.md, Tabela 4):
// cada desenho entra em RGB de 256 × 256, com os canais separados (todo o vermelho, depois o
// verde e o azul) e cada pixel dividido por 255. A normalização fica dentro do modelo.
export const LADO_ENTRADA = 256;
// O conjunto de treino tem cada desenho esticado até uma caixa de 224 px, com 16 px de borda
// (IA #21, PR #29). A conta usa 223 para o último ponto cair dentro da caixa.
const CAIXA_DO_DESENHO = 224;
const BORDA_DA_CAIXA = (LADO_ENTRADA - CAIXA_DO_DESENHO) / 2;
const ULTIMO_PIXEL_DA_CAIXA = CAIXA_DO_DESENHO - 1;

const CANAIS_RGBA = 4;
const CANAIS_RGB = 3;
const VALOR_MAXIMO_PIXEL = 255;

type Eixo = { minimo: number; extensao: number };

function eixo(valores: readonly number[]): Eixo {
  // Sem espalhar o vetor no Math.min: um desenho longo tem milhares de pontos.
  const minimo = valores.reduce((menor, valor) => Math.min(menor, valor));
  const maximo = valores.reduce((maior, valor) => Math.max(maior, valor));
  return { minimo, extensao: maximo - minimo };
}

function ajustarCoordenada(valor: number, { minimo, extensao }: Eixo): number {
  // Um traço reto deixa um eixo sem extensão. Esse eixo fica no meio da caixa, porque o
  // conjunto não tem esse caso e esticar zero não tem escala (IA #21).
  if (extensao === 0) return BORDA_DA_CAIXA + ULTIMO_PIXEL_DA_CAIXA / 2;
  return BORDA_DA_CAIXA + ((valor - minimo) * ULTIMO_PIXEL_DA_CAIXA) / extensao;
}

export function ajustarTracosNaEntrada(tracos: readonly Traco[]): Traco[] {
  const pontos = tracos.flat();
  const temCoordenadaInvalida = pontos.some(
    ({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y),
  );
  if (pontos.length === 0 || temCoordenadaInvalida) {
    throw new Error('Desenho sem traço válido para o preparo do escore.');
  }
  // O paciente desenha em qualquer posição e tamanho do quadro. Recortar pela caixa dos pontos
  // e esticar cada eixo até a caixa do treino deixa o escore estável no tamanho do desenho
  // (IA PR #29, Tabela 9: traçado vetorial, 89 % a 90 % dos pacientes na mesma classe).
  const horizontal = eixo(pontos.map(({ x }) => x));
  const vertical = eixo(pontos.map(({ y }) => y));
  return tracos.map((traco) =>
    traco.map(
      (ponto): PontoTracado => ({
        ...ponto,
        x: ajustarCoordenada(ponto.x, horizontal),
        y: ajustarCoordenada(ponto.y, vertical),
      }),
    ),
  );
}

export function pixelsParaEntrada(rgba: Uint8Array, lado: number = LADO_ENTRADA): Float32Array {
  const totalDePixels = lado * lado;
  if (rgba.length !== totalDePixels * CANAIS_RGBA) {
    throw new Error('Pixels do desenho fora do tamanho esperado pelo modelo.');
  }
  // O canal alfa fica de fora: o fundo do desenho é opaco.
  const entrada = new Float32Array(totalDePixels * CANAIS_RGB);
  for (let pixel = 0; pixel < totalDePixels; pixel++) {
    for (let canal = 0; canal < CANAIS_RGB; canal++) {
      entrada[canal * totalDePixels + pixel] =
        rgba[pixel * CANAIS_RGBA + canal] / VALOR_MAXIMO_PIXEL;
    }
  }
  return entrada;
}
