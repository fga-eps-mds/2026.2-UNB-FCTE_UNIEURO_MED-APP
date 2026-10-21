import { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import type { TermoStyles } from '@/features/avaliacao/termo-consentimento.styles';
import { descreverVersao, type TermoTcle } from '@/features/avaliacao/termo-tcle';

export const AVISO_ROLAGEM = 'Role para ler o termo completo';

// Folga para considerar que a rolagem chegou ao fim, em pontos de tela.
const FOLGA_FIM = 24;

type TermoConsentimentoProps = {
  termo: TermoTcle;
  styles: TermoStyles;
};

/**
 * O texto completo do termo, com rolagem, e a versão no fim (#21, cenário
 * "apresentação do termo"). O aviso de rolagem some quando o texto inteiro já
 * passou pela tela. Ler até o fim não é exigido para a decisão: o termo pode ser
 * lido em voz alta para o paciente.
 */
export function TermoConsentimento({ termo, styles }: TermoConsentimentoProps) {
  const [alturaVisivel, setAlturaVisivel] = useState(0);
  const [alturaConteudo, setAlturaConteudo] = useState(0);
  const [chegouAoFim, setChegouAoFim] = useState(false);

  const cabeInteiro = alturaVisivel > 0 && alturaConteudo <= alturaVisivel + FOLGA_FIM;
  const mostrarAviso = !chegouAoFim && !cabeInteiro;

  function aoRolar({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - FOLGA_FIM) {
      setChegouAoFim(true);
    }
  }

  return (
    <View style={styles.colunaTermo}>
      <View style={styles.cartaoTermo}>
        <ScrollView
          accessibilityLabel="Texto do termo de consentimento"
          contentContainerStyle={styles.rolagem}
          onContentSizeChange={(_, altura) => setAlturaConteudo(altura)}
          onLayout={({ nativeEvent }: LayoutChangeEvent) =>
            setAlturaVisivel(nativeEvent.layout.height)
          }
          onScroll={aoRolar}
          scrollEventThrottle={100}>
          <Text accessibilityRole="header" style={styles.titulo}>
            {termo.titulo}
          </Text>
          <Text style={styles.pesquisa}>{termo.pesquisa}</Text>
          <View style={styles.responsavel}>
            <Text style={styles.responsavelTexto}>{termo.pesquisador}</Text>
            <Text style={styles.instituicao}>{termo.instituicao}</Text>
          </View>
          {termo.secoes.map((secao) => (
            <View key={secao.titulo}>
              <Text accessibilityRole="header" style={styles.secaoTitulo}>
                {secao.titulo}
              </Text>
              {secao.paragrafos.map((paragrafo) => (
                <Text key={paragrafo} style={styles.paragrafo}>
                  {paragrafo}
                </Text>
              ))}
            </View>
          ))}
          <Text style={styles.versao}>{descreverVersao(termo)}</Text>
        </ScrollView>
      </View>
      {mostrarAviso && <Text style={styles.avisoRolagem}>{AVISO_ROLAGEM}</Text>}
    </View>
  );
}
