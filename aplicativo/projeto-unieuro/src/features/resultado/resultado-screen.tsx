import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedbackMessage } from '@/features/auth/feedback-message';
import { returnToLogin, useSession, type SessionProfessional } from '@/features/auth/session';
import type { ResultadoExportacao } from '@/features/exportacao/exportacao';
import { ExportarExameDialog } from '@/features/exportacao/exportar-exame-dialog';
import { formatDateTime } from '@/features/home/patient-detail';
import { WIDE_LAYOUT_MIN_WIDTH } from '@/features/home/home.styles';
import type { DesenhoDoResultado, ResultadoDoExame } from '@/features/resultado/resultado';
import { createResultadoStyles, type ResultadoStyles } from '@/features/resultado/resultado.styles';
import { useTheme } from '@/hooks/use-theme';

export const TITULO_RESULTADO = 'Resultado do exame';
export const TITULO_MODELO = 'Resultado do modelo';
export const MODELO_INDISPONIVEL =
  'O resultado do modelo ainda não está disponível para este exame. Os desenhos ficam guardados no tablet.';
export const SEM_DESENHO = 'Desenho não gravado';
export const CARREGANDO = 'Carregando o resultado do exame.';
export const NAO_ENCONTRADO = 'Exame não encontrado entre os seus exames.';
export const FALHA_AO_CARREGAR =
  'Não foi possível carregar o resultado. Volte e abra o exame de novo.';

type ResultadoScreenProps = {
  resultado: ResultadoDoExame | null;
  carregando: boolean;
  falhou: boolean;
  naoEncontrado: boolean;
  /** Resultado do modelo para o exame inteiro: o escore geral e o aviso (#12 e #13). */
  modelo?: ReactNode;
  /** O que mais pesou na pontuação, desenho por desenho (#14, parte do Thales). */
  influencia?: (desenho: DesenhoDoResultado) => ReactNode;
  exportExam?: (professional: SessionProfessional, examId: number) => Promise<ResultadoExportacao>;
};

/**
 * Resultado do exame para o médico (#14): os três desenhos do paciente, na ordem das
 * tarefas, e o resultado do modelo. Só o médico que aplicou e o superusuário chegam
 * aqui, porque a consulta já filtra pelo profissional da sessão. A exportação do exame
 * em XML (#22) só aparece para quem o aplicou: o superusuário vê, mas não exporta.
 */
export default function ResultadoScreen({
  resultado,
  carregando,
  falhou,
  naoEncontrado,
  modelo,
  influencia,
  exportExam,
}: Readonly<ResultadoScreenProps>) {
  const router = useRouter();
  const { professional } = useSession();
  const theme = useTheme();
  const styles = useMemo(() => createResultadoStyles(theme), [theme]);
  const { width } = useWindowDimensions();
  const [larguraMedida, setLarguraMedida] = useState(0);
  const [confirmingExport, setConfirmingExport] = useState(false);
  const [savedFile, setSavedFile] = useState<string | null>(null);
  const largo = (larguraMedida || width) >= WIDE_LAYOUT_MIN_WIDTH;

  // Sem profissional autenticado, a tela não abre, como as demais telas do médico.
  useEffect(() => {
    if (!professional) returnToLogin(router);
  }, [professional, router]);

  if (!professional) return null;

  const canExport =
    Boolean(exportExam) && resultado !== null && resultado.professionalId === professional.id;

  return (
    <SafeAreaView
      testID="tela-resultado"
      style={styles.safeArea}
      onLayout={({ nativeEvent }) => setLarguraMedida(nativeEvent.layout.width)}>
      <View style={[styles.topBar, largo && styles.topBarWide]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹ Voltar</Text>
        </Pressable>
      </View>

      {resultado ? (
        <ScrollView contentContainerStyle={[styles.content, largo && styles.contentWide]}>
          <View style={styles.cabecalho}>
            <Text accessibilityRole="header" style={styles.titulo}>
              {TITULO_RESULTADO}
            </Text>
            <Text style={styles.paciente}>
              {`${resultado.patientName} · Ficha ${resultado.recordNumber}`}
            </Text>
            <Text style={styles.detalhe}>
              {`${formatDateTime(resultado.startedAt)} · Aplicado por ${resultado.appliedBy}`}
            </Text>
          </View>

          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.cardTitulo}>
              {TITULO_MODELO}
            </Text>
            {modelo ?? <Text style={styles.aviso}>{MODELO_INDISPONIVEL}</Text>}
          </View>

          <View style={styles.desenhos}>
            {resultado.desenhos.map((desenho) => (
              <CartaoDoDesenho
                key={desenho.tipo}
                desenho={desenho}
                influencia={influencia?.(desenho)}
                styles={styles}
              />
            ))}
          </View>

          {savedFile && <FeedbackMessage kind="success" message={`Arquivo salvo: ${savedFile}`} />}

          {canExport && (
            <View style={styles.actionsRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Exportar exame (XML)"
                onPress={() => {
                  setSavedFile(null);
                  setConfirmingExport(true);
                }}
                style={({ pressed }) => [styles.exportButton, pressed && styles.pressed]}>
                <Text style={styles.exportButtonText}>Exportar exame (XML)</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      ) : (
        <Estado
          carregando={carregando}
          falhou={falhou}
          naoEncontrado={naoEncontrado}
          styles={styles}
        />
      )}

      {resultado && exportExam && (
        <ExportarExameDialog
          visible={confirmingExport}
          exportar={() => exportExam(professional, resultado.id)}
          onCancelar={() => setConfirmingExport(false)}
          onSalvo={(arquivo) => {
            setConfirmingExport(false);
            setSavedFile(arquivo);
          }}
        />
      )}
    </SafeAreaView>
  );
}

function CartaoDoDesenho({
  desenho,
  influencia,
  styles,
}: Readonly<{ desenho: DesenhoDoResultado; influencia: ReactNode; styles: ResultadoStyles }>) {
  return (
    <View testID={`desenho-${desenho.tipo}`} style={styles.desenho}>
      <Text accessibilityRole="header" style={styles.desenhoTitulo}>
        {desenho.titulo.toUpperCase()}
      </Text>
      {desenho.imagem ? (
        <Image
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Desenho: ${desenho.titulo}`}
          source={{ uri: desenho.imagem }}
          resizeMode="contain"
          style={styles.imagem}
        />
      ) : (
        <View style={styles.semDesenho}>
          <Text style={styles.semDesenhoTexto}>{SEM_DESENHO}</Text>
        </View>
      )}
      {influencia}
    </View>
  );
}

function Estado({
  carregando,
  falhou,
  naoEncontrado,
  styles,
}: Readonly<{
  carregando: boolean;
  falhou: boolean;
  naoEncontrado: boolean;
  styles: ResultadoStyles;
}>) {
  if (carregando) {
    return (
      <View style={styles.estado}>
        <ActivityIndicator size="large" />
        <Text style={styles.estadoTexto}>{CARREGANDO}</Text>
      </View>
    );
  }
  const mensagem = falhou ? FALHA_AO_CARREGAR : naoEncontrado ? NAO_ENCONTRADO : null;
  return (
    <View style={styles.estado}>
      {mensagem && (
        <Text accessibilityRole="alert" style={styles.estadoTexto}>
          {mensagem}
        </Text>
      )}
    </View>
  );
}
