import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FontFamilies, type ThemeColors } from '@/constants/theme';
import { returnToLogin, useSession } from '@/features/auth/session';
import {
  SEM_MODELO_NO_APK,
  type DependenciasDaAnalise,
  type EtapaDaAnalise,
} from '@/features/inferencia/analise';
import { useAnalise } from '@/features/inferencia/use-analise';
import { useTheme } from '@/hooks/use-theme';

export const TITULO_ANALISE = 'Analisando os desenhos';
export const ETAPA_DO_EXAME = 'Etapa 5 de 5 · Análise';
export const SEM_DADO_SAINDO = 'Nenhum dado sai deste aparelho';
export const ITENS_DA_ANALISE = [
  '3 desenhos salvos no aparelho',
  'Traçado, ordem e tempo registrados',
  'Modelo rodando localmente no tablet',
  'Calculando o peso de cada desenho',
] as const;
export const TENTAR_DE_NOVO = 'Calcular de novo';
export const VER_DESENHOS = 'Ver os desenhos';
export const NAO_ENCONTRADO = 'Exame não encontrado entre os exames que esperam o resultado.';

type Situacao = 'feito' | 'em-andamento' | 'pendente';

// Os dois primeiros itens já valem quando a tela abre: o exame só chega aqui com os três
// desenhos gravados. Os outros seguem as etapas do cálculo.
function situacaoDoItem(indice: number, etapa: EtapaDaAnalise | null, terminou: boolean): Situacao {
  if (indice < 2 || terminou) return 'feito';
  const emCalculo = etapa === 'calculando' || etapa === 'gravando';
  if (indice === 2) return emCalculo ? 'feito' : 'em-andamento';
  return emCalculo ? 'em-andamento' : 'pendente';
}

const DESCRICAO_DA_SITUACAO: Record<Situacao, string> = {
  feito: 'concluído',
  'em-andamento': 'em andamento',
  pendente: 'aguardando',
};

type AnaliseScreenProps = {
  exameId: number | null;
  dependencias: DependenciasDaAnalise;
};

/**
 * Análise do exame no tablet (#12, protótipo "Analisando os desenhos"). Abre depois que o
 * profissional retoma o aparelho na tela final, e segue para o resultado quando o cálculo
 * termina. O paciente nunca chega aqui (#11).
 */
export default function AnaliseScreen({ exameId, dependencias }: Readonly<AnaliseScreenProps>) {
  const router = useRouter();
  const { professional } = useSession();
  const theme = useTheme();
  const styles = useMemo(() => createAnaliseStyles(theme), [theme]);
  const [tentativa, setTentativa] = useState(0);
  const { etapa, paciente, resultado } = useAnalise(dependencias, exameId, tentativa);

  useEffect(() => {
    if (!professional) returnToLogin(router);
  }, [professional, router]);

  const terminou = resultado?.situacao === 'concluida' || resultado?.situacao === 'ja-concluida';
  useEffect(() => {
    if (terminou && exameId !== null) router.replace(`/resultado/${exameId}`);
  }, [terminou, exameId, router]);

  if (!professional) return null;

  const falhou = resultado?.situacao === 'erro' || resultado?.situacao === 'sem-modelo';
  let mensagemDeFalha: string | null = null;
  if (resultado?.situacao === 'erro') mensagemDeFalha = resultado.mensagem;
  if (resultado?.situacao === 'sem-modelo') mensagemDeFalha = SEM_MODELO_NO_APK;

  return (
    <SafeAreaView testID="tela-analise" style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.cabecalho}>
          {paciente && (
            <Text style={styles.paciente}>{`${paciente.nome} · Ficha ${paciente.ficha}`}</Text>
          )}
          <Text style={styles.etapa}>{ETAPA_DO_EXAME}</Text>
          <Text accessibilityRole="header" style={styles.titulo}>
            {TITULO_ANALISE}
          </Text>
        </View>

        {resultado?.situacao === 'nao-encontrado' ? (
          <Text accessibilityRole="alert" style={styles.mensagem}>
            {NAO_ENCONTRADO}
          </Text>
        ) : (
          <View style={styles.card} accessibilityRole="list">
            {ITENS_DA_ANALISE.map((item, indice) => {
              const situacao =
                falhou && indice >= 2 ? 'pendente' : situacaoDoItem(indice, etapa, terminou);
              return (
                <View
                  key={item}
                  accessible
                  accessibilityLabel={`${item}: ${DESCRICAO_DA_SITUACAO[situacao]}`}
                  style={styles.item}>
                  <Marcador situacao={situacao} theme={theme} styles={styles} />
                  <Text style={[styles.itemTexto, situacao === 'pendente' && styles.itemPendente]}>
                    {item}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {mensagemDeFalha && (
          <View style={styles.falha}>
            <Text accessibilityRole="alert" style={styles.mensagem}>
              {mensagemDeFalha}
            </Text>
            <View style={styles.acoes}>
              {resultado?.situacao === 'erro' && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setTentativa((anterior) => anterior + 1)}
                  style={({ pressed }) => [styles.primario, pressed && styles.pressed]}>
                  <Text style={styles.primarioTexto}>{TENTAR_DE_NOVO}</Text>
                </Pressable>
              )}
              {exameId !== null && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.replace(`/resultado/${exameId}`)}
                  style={({ pressed }) => [styles.secundario, pressed && styles.pressed]}>
                  <Text style={styles.secundarioTexto}>{VER_DESENHOS}</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        <View style={styles.faixa}>
          <Text style={styles.faixaTexto}>{SEM_DADO_SAINDO}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Marcador({
  situacao,
  theme,
  styles,
}: Readonly<{ situacao: Situacao; theme: ThemeColors; styles: AnaliseStyles }>) {
  if (situacao === 'em-andamento') {
    return <ActivityIndicator color={theme.primary} style={styles.marcador} />;
  }
  return (
    <View style={[styles.marcador, situacao === 'feito' ? styles.feito : styles.pendente]}>
      {situacao === 'feito' && <Text style={styles.feitoTexto}>✓</Text>}
    </View>
  );
}

function createAnaliseStyles(theme: ThemeColors) {
  const corpo = { fontFamily: FontFamilies.regular, fontSize: 18, lineHeight: 26 };
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    content: { flex: 1, gap: 24, padding: 32, maxWidth: 880, width: '100%', alignSelf: 'center' },
    cabecalho: { gap: 6 },
    paciente: { ...corpo, color: theme.text, fontFamily: FontFamilies.semibold },
    etapa: { ...corpo, color: theme.textSecondary },
    titulo: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 34, lineHeight: 42 },
    card: { gap: 20, padding: 28, borderRadius: 24, backgroundColor: theme.surface },
    item: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 48 },
    itemTexto: { ...corpo, color: theme.text, flexShrink: 1 },
    itemPendente: { color: theme.textSecondary },
    marcador: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    feito: { backgroundColor: theme.successBg },
    feitoTexto: { color: theme.success, fontFamily: FontFamilies.bold, fontSize: 18 },
    pendente: { borderWidth: 2, borderColor: theme.border },
    falha: { gap: 16 },
    mensagem: { ...corpo, color: theme.text },
    acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    primario: {
      minHeight: 56,
      paddingHorizontal: 28,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
    },
    primarioTexto: { color: theme.onPrimary, fontFamily: FontFamilies.semibold, fontSize: 18 },
    secundario: {
      minHeight: 56,
      paddingHorizontal: 28,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.primary,
    },
    secundarioTexto: { color: theme.primary, fontFamily: FontFamilies.semibold, fontSize: 18 },
    faixa: { padding: 16, borderRadius: 16, backgroundColor: theme.infoBg },
    faixaTexto: {
      ...corpo,
      color: theme.info,
      fontFamily: FontFamilies.semibold,
      textAlign: 'center',
    },
    pressed: { opacity: 0.82 },
  });
}

type AnaliseStyles = ReturnType<typeof createAnaliseStyles>;
