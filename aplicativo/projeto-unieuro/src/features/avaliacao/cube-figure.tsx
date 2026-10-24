/**
 * Figura de modelo da cópia do cubo (história #9, cenário "figura de modelo do
 * cubo"): um cubo em perspectiva com as 12 arestas à vista, como o cubo de Necker
 * do MoCA, que os pacientes do conjunto de treino do modelo copiaram.
 *
 * A figura é desenhada aqui, e não copiada do formulário do MoCA, que tem direitos
 * autorais. A forma e a proporção seguem o protótipo no Figma.
 */
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

/** Tamanho da figura no protótipo, em pontos. */
export const LARGURA_FIGURA = 220;
export const ALTURA_FIGURA = 200;

/** Cor e espessura das arestas no protótipo. */
const COR_ARESTA = '#1E293B';
const ESPESSURA_ARESTA = 4;

type Ponto = readonly [number, number];
export type Aresta = readonly [Ponto, Ponto];

// Vértices do protótipo, na figura de 220 × 200: a face da frente embaixo à
// esquerda e a de trás deslocada para cima e para a direita, com lado de 99.
const LADO = 99;
const FRENTE: Ponto = [47, 73];
const DESLOCAMENTO: Ponto = [36, -41];

function quadrado([x, y]: Ponto): [Ponto, Ponto, Ponto, Ponto] {
  return [
    [x, y],
    [x + LADO, y],
    [x + LADO, y + LADO],
    [x, y + LADO],
  ];
}

/**
 * As 12 arestas do cubo: 4 da face da frente, 4 da face de trás e as 4 que ligam
 * os vértices correspondentes. Os pontos ficam na escala da figura de 220 × 200.
 */
export function arestasDoCubo(): Aresta[] {
  const frente = quadrado(FRENTE);
  const tras = quadrado([FRENTE[0] + DESLOCAMENTO[0], FRENTE[1] + DESLOCAMENTO[1]]);
  const contorno = (face: Ponto[]) => face.map((ponto, i): Aresta => [ponto, face[(i + 1) % 4]]);
  const ligacoes = frente.map((ponto, i): Aresta => [ponto, tras[i]]);
  return [...contorno(frente), ...contorno(tras), ...ligacoes];
}

/** Caminho SVG com um segmento por aresta, que o Skia desenha de uma vez. */
export function caminhoDoCubo(arestas: readonly Aresta[] = arestasDoCubo()): string {
  return arestas.map(([[x1, y1], [x2, y2]]) => `M ${x1} ${y1} L ${x2} ${y2}`).join(' ');
}

export function CubeFigure() {
  const caminho = useMemo(() => Skia.Path.MakeFromSVGString(caminhoDoCubo()), []);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Cubo para copiar"
      style={styles.figura}>
      <Canvas style={styles.figura}>
        {caminho && (
          <Path
            path={caminho}
            style="stroke"
            strokeWidth={ESPESSURA_ARESTA}
            strokeCap="round"
            strokeJoin="round"
            color={COR_ARESTA}
          />
        )}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  figura: { width: LARGURA_FIGURA, height: ALTURA_FIGURA },
});
