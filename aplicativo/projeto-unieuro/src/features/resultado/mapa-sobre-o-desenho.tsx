import { BlurMask, Canvas, Oval } from '@shopify/react-native-skia';
import { useState } from 'react';
import { Image, Text, View, type LayoutChangeEvent } from 'react-native';

import type { MapaDoDesenho, RegiaoDoMapa } from '@/features/resultado/mapa-do-desenho';
import {
  COR_PUXA_CCL,
  COR_PUXA_SEM_CCL,
  type ResultadoStyles,
} from '@/features/resultado/resultado.styles';

export const ONDE_PESOU = 'Onde o desenho pesou';
export const LEGENDA_CCL = 'Puxou para CCL';
export const LEGENDA_SEM_CCL = 'Puxou para sem CCL';
export const COMO_LER_O_MAPA =
  'As regiões coloridas são as que mais mudariam o escore se aquela parte do traço não existisse.';

// O mapa do modelo é uma grade de 8 × 8. Cada célula vira uma mancha maior que ela e desfocada,
// para que as vizinhas se fundam numa área só, como no protótipo, em vez de aparecerem como
// quadrados.
const AUMENTO_DA_MANCHA = 1.6;
const DESFOQUE_DO_MENOR_LADO = 0.35;
// A cor mais fraca ainda aparece depois do desfoque; a mais forte não esconde o traço.
const OPACIDADE_MINIMA = 0.25;
const OPACIDADE_MAXIMA = 0.7;

type Tamanho = { largura: number; altura: number };
type Area = Tamanho & { x: number; y: number };

/** Área que a imagem ocupa dentro da caixa com `resizeMode="contain"`. */
function areaDaImagemNaTela(caixa: Tamanho, proporcao: number) {
  const largura = Math.min(caixa.largura, caixa.altura * proporcao);
  const altura = largura / proporcao;
  return {
    largura,
    altura,
    x: (caixa.largura - largura) / 2,
    y: (caixa.altura - altura) / 2,
  };
}

function Mancha({ regiao, area }: Readonly<{ regiao: RegiaoDoMapa; area: Area }>) {
  const largura = regiao.largura * area.largura * AUMENTO_DA_MANCHA;
  const altura = regiao.altura * area.altura * AUMENTO_DA_MANCHA;
  const centroX = area.x + (regiao.esquerda + regiao.largura / 2) * area.largura;
  const centroY = area.y + (regiao.topo + regiao.altura / 2) * area.altura;
  return (
    <Oval
      x={centroX - largura / 2}
      y={centroY - altura / 2}
      width={largura}
      height={altura}
      color={regiao.puxaPara === 'ccl' ? COR_PUXA_CCL : COR_PUXA_SEM_CCL}
      opacity={OPACIDADE_MINIMA + (OPACIDADE_MAXIMA - OPACIDADE_MINIMA) * regiao.intensidade}>
      <BlurMask blur={Math.min(largura, altura) * DESFOQUE_DO_MENOR_LADO} style="normal" />
    </Oval>
  );
}

export function MapaSobreODesenho({
  titulo,
  imagem,
  mapa,
  styles,
}: Readonly<{ titulo: string; imagem: string; mapa: MapaDoDesenho; styles: ResultadoStyles }>) {
  const [caixa, setCaixa] = useState<Tamanho | null>(null);
  const aoMedir = ({ nativeEvent }: LayoutChangeEvent) =>
    setCaixa({ largura: nativeEvent.layout.width, altura: nativeEvent.layout.height });
  const area = caixa ? areaDaImagemNaTela(caixa, mapa.proporcao) : null;

  return (
    <View style={styles.influencia}>
      <View testID="mapa-do-desenho" onLayout={aoMedir} style={styles.imagem}>
        <Image
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Desenho: ${titulo}. ${mapa.destaque}`}
          source={{ uri: imagem }}
          resizeMode="contain"
          style={styles.imagemCheia}
        />
        {area && (
          <Canvas pointerEvents="none" style={styles.imagemCheia}>
            {mapa.regioes.map((regiao, indice) => (
              <Mancha key={indice} regiao={regiao} area={area} />
            ))}
          </Canvas>
        )}
      </View>
      <Text style={styles.influenciaTitulo}>{ONDE_PESOU}</Text>
      <Text style={styles.influenciaTexto}>{mapa.destaque}</Text>
      <View style={styles.legenda}>
        <View style={styles.legendaItem}>
          <View style={[styles.legendaCor, styles.barraCcl]} />
          <Text style={styles.legendaTexto}>{LEGENDA_CCL}</Text>
        </View>
        <View style={styles.legendaItem}>
          <View style={[styles.legendaCor, styles.barraSemCcl]} />
          <Text style={styles.legendaTexto}>{LEGENDA_SEM_CCL}</Text>
        </View>
      </View>
      <Text style={styles.rodape}>{COMO_LER_O_MAPA}</Text>
    </View>
  );
}
