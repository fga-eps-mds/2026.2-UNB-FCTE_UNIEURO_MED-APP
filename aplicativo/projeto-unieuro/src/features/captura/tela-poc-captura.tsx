/**
 * Tela da prova de conceito da captura do traçado (#60).
 *
 * Serve para testar a captura no emulador e no tablet: mostra quantos pontos o
 * aparelho entrega por segundo, se ele informa a pressão da caneta e a imagem
 * que iria para o modelo. Nada é gravado: o registro existe só enquanto a tela
 * está aberta.
 */
import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FontFamilies } from '@/constants/theme';
import {
  acrescentarAcao,
  acrescentarTraco,
  reconstruirTracos,
  resumirAmostragem,
  type EventoDeAcao,
  type EventoTracado,
  type PontoTracado,
  type TipoPonteiro,
} from '@/features/captura/eventos-tracado';
import {
  gerarImagemDesenho,
  type Dimensoes,
  type ImagemDesenho,
} from '@/features/captura/imagem-desenho';
import { QuadroDesenho } from '@/features/captura/quadro-desenho';
import { useTheme } from '@/hooks/use-theme';

const NOMES_PONTEIRO: Record<TipoPonteiro, string> = {
  caneta: 'caneta',
  dedo: 'dedo',
  mouse: 'mouse',
  desconhecido: 'não identificado',
};

type BotaoProps = { rotulo: string; desabilitado: boolean; onPress: () => void };

function Botao({ rotulo, desabilitado, onPress }: BotaoProps) {
  const tema = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: desabilitado }}
      disabled={desabilitado}
      onPress={onPress}
      style={({ pressed }) => [
        styles.botao,
        { borderColor: tema.primary },
        desabilitado && styles.botaoDesabilitado,
        pressed && styles.pressionado,
      ]}>
      <Text style={[styles.textoBotao, { color: tema.primary }]}>{rotulo}</Text>
    </Pressable>
  );
}

export default function TelaPocCaptura() {
  const tema = useTheme();
  const { width } = useWindowDimensions();
  const larga = width >= 900;

  const [inicio] = useState(() => Date.now());
  const [eventos, setEventos] = useState<EventoTracado[]>([]);
  const [dimensoes, setDimensoes] = useState<Dimensoes | null>(null);
  const [imagem, setImagem] = useState<ImagemDesenho | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const tracos = useMemo(() => reconstruirTracos(eventos), [eventos]);
  const resumo = useMemo(() => resumirAmostragem(eventos), [eventos]);
  const semTracos = tracos.length === 0;

  function registrarTraco(pontos: PontoTracado[], ponteiro: TipoPonteiro) {
    const relativos = pontos.map((ponto) => ({ ...ponto, instante: ponto.instante - inicio }));
    setEventos((anteriores) => acrescentarTraco(anteriores, relativos, ponteiro));
    setImagem(null);
  }

  function registrarAcao(tipo: EventoDeAcao['tipo']) {
    setEventos((anteriores) => acrescentarAcao(anteriores, tipo, Date.now() - inicio));
    setImagem(null);
  }

  function gerarImagem() {
    if (!dimensoes) return;
    try {
      setImagem(gerarImagemDesenho(tracos, dimensoes));
      setErro(null);
    } catch (falha) {
      setImagem(null);
      setErro(falha instanceof Error ? falha.message : 'Não foi possível gerar a imagem.');
    }
  }

  const ponteiros = resumo.ponteiros.map((tipo) => NOMES_PONTEIRO[tipo]).join(', ');
  const linhasResumo = [
    `${resumo.pontos} pontos em ${resumo.tracos} traços registrados`,
    `${tracos.length} traços valem no desenho`,
    `Amostragem: ${Math.round(resumo.frequenciaHz)} pontos por segundo`,
    `Maior intervalo entre pontos: ${resumo.maiorIntervaloMs} ms`,
    `Pressão: ${resumo.comPressao ? 'informada pelo aparelho' : 'não informada'}`,
    `Ponteiro: ${ponteiros || 'nenhum ainda'}`,
  ];

  return (
    <GestureHandlerRootView style={styles.raiz}>
      <SafeAreaView style={[styles.raiz, { backgroundColor: tema.background }]}>
        <View style={styles.cabecalho}>
          <Text accessibilityRole="header" style={[styles.titulo, { color: tema.text }]}>
            Prova de conceito: captura do traçado
          </Text>
          <Text style={[styles.legenda, { color: tema.textSecondary }]}>
            Tela de teste da tarefa #60. Nada é gravado no aparelho.
          </Text>
        </View>

        <View style={[styles.corpo, larga && styles.corpoLargo]}>
          <View style={styles.areaQuadro}>
            <QuadroDesenho
              tracos={tracos}
              onTracoConcluido={registrarTraco}
              onDimensoes={setDimensoes}
            />
          </View>

          <ScrollView
            style={[styles.painel, larga && styles.painelLargo]}
            contentContainerStyle={styles.conteudoPainel}>
            <View style={styles.botoes}>
              <Botao
                rotulo="Desfazer"
                desabilitado={semTracos}
                onPress={() => registrarAcao('desfazer')}
              />
              <Botao
                rotulo="Limpar"
                desabilitado={semTracos}
                onPress={() => registrarAcao('limpar')}
              />
              <Botao
                rotulo="Gerar imagem"
                desabilitado={semTracos || !dimensoes}
                onPress={gerarImagem}
              />
            </View>

            <View style={[styles.cartao, { backgroundColor: tema.surface }]}>
              {linhasResumo.map((linha) => (
                <Text key={linha} style={[styles.linha, { color: tema.text }]}>
                  {linha}
                </Text>
              ))}
            </View>

            {erro ? (
              <Text accessibilityRole="alert" style={[styles.linha, { color: tema.primary }]}>
                {erro}
              </Text>
            ) : null}

            {imagem ? (
              <View style={[styles.cartao, { backgroundColor: tema.surface }]}>
                <Text style={[styles.linha, { color: tema.text }]}>
                  Imagem para o modelo, {imagem.lado} × {imagem.lado}, em tons de cinza
                </Text>
                <Image
                  accessibilityLabel={`Imagem para o modelo, ${imagem.lado} por ${imagem.lado} pixels`}
                  source={{ uri: `data:image/png;base64,${imagem.pngModelo}` }}
                  style={[styles.previa, { width: imagem.lado, height: imagem.lado }]}
                />
              </View>
            ) : null}
          </ScrollView>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  cabecalho: { paddingHorizontal: 20, paddingTop: 16, gap: 4 },
  titulo: { fontFamily: FontFamilies.bold, fontSize: 20, fontWeight: '700' },
  legenda: { fontFamily: FontFamilies.regular, fontSize: 14 },
  corpo: { flex: 1, padding: 20, gap: 16 },
  corpoLargo: { flexDirection: 'row' },
  areaQuadro: { flex: 1, minHeight: 320 },
  painel: { flexGrow: 0, maxHeight: '50%' },
  painelLargo: { width: 320, maxHeight: '100%' },
  conteudoPainel: { gap: 12 },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  botao: {
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
  },
  botaoDesabilitado: { opacity: 0.4 },
  pressionado: { opacity: 0.8 },
  textoBotao: { fontFamily: FontFamilies.semibold, fontSize: 15, fontWeight: '600' },
  cartao: { padding: 14, borderRadius: 12, gap: 6 },
  linha: { fontFamily: FontFamilies.regular, fontSize: 14, lineHeight: 20 },
  previa: { alignSelf: 'center', borderWidth: 1, borderColor: '#C7D2E5' },
});
