import { useEffect, useMemo } from 'react';
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
import { useRouter } from 'expo-router';

import { FeedbackMessage } from '@/features/auth/feedback-message';
import { formatCrm, returnToLogin, useSession } from '@/features/auth/session';
import type { DesenhoDaConsulta, ExameDaConsulta } from '@/features/home/exame';
import { WIDE_LAYOUT_MIN_WIDTH } from '@/features/home/home.styles';
import type { ExamStatus } from '@/features/home/patients';
import type { EstadoDoExame } from '@/features/home/use-exame';
import { createVerExameStyles, type VerExameStyles } from '@/features/home/ver-exame.styles';
import { useTheme } from '@/hooks/use-theme';

type VerExameScreenProps = { estado: EstadoDoExame };

// Os textos dizem o que aconteceu e o que
// fazer sem termo técnico e sem culpar quem usa.
export const CARREGANDO_EXAME = 'Carregando o exame.';

export const FALHA_AO_CARREGAR =
  'Não foi possível carregar o exame. Volte e abra o exame de novo para tentar outra vez.';

export const EXAME_NAO_ENCONTRADO = 'Exame não encontrado';

export const EXAME_NAO_ENCONTRADO_TEXTO =
  'Este exame não está entre os exames aplicados por você neste tablet.';

export const SEM_DESENHO = 'Não realizado';

/**
 * Tela "Ver exame", em que o médico confere os dados e os desenhos gravados de um
 * exame sem internet, já que tudo vem do banco local. O resultado do modelo ainda
 * não aparece, porque a inferência ainda não roda no tablet.
 */
export default function VerExameScreen({ estado }: VerExameScreenProps) {
  const router = useRouter();
  const { professional } = useSession();
  const theme = useTheme();
  const styles = useMemo(() => createVerExameStyles(theme), [theme]);
  // No tablet deitado, os três desenhos ficam lado a lado.
  const isWide = useWindowDimensions().width >= WIDE_LAYOUT_MIN_WIDTH;

  // O exame tem dados sensíveis do paciente, então sem sessão a tela não mostra nada
  // e volta ao login.
  useEffect(() => {
    if (!professional) returnToLogin(router);
  }, [professional, router]);

  if (!professional) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Voltar à esquerda e quem entrou à direita, como nas configurações. */}
      <View style={[styles.topBar, isWide && styles.topBarWide]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹ Voltar</Text>
        </Pressable>
        <View style={styles.accountText}>
          <Text style={styles.professionalName} numberOfLines={1}>
            {professional.name}
          </Text>
          <Text style={styles.professionalCrm}>CRM {formatCrm(professional)}</Text>
        </View>
      </View>

      {estado.status === 'pronto' ? (
        <Exame exame={estado.exame} isWide={isWide} styles={styles} />
      ) : (
        <SemExame estado={estado} styles={styles} color={theme.primary} />
      )}
    </SafeAreaView>
  );
}

type SemExameProps = {
  estado: Exclude<EstadoDoExame, { status: 'pronto' }>;
  styles: VerExameStyles;
  color: string;
};

// Os estados sem exame ocupam a área abaixo da barra, para o Voltar ficar sempre à mão.
function SemExame({ estado, styles, color }: SemExameProps) {
  if (estado.status === 'carregando') {
    // O leitor de tela anuncia o carregamento uma vez só, pelo rótulo do bloco.
    return (
      <View style={styles.state} accessible accessibilityLabel={CARREGANDO_EXAME}>
        <ActivityIndicator color={color} size="large" />
        <Text style={styles.stateText}>{CARREGANDO_EXAME}</Text>
      </View>
    );
  }
  if (estado.status === 'falhou') {
    // Faixa de mensagem do guia, usada em problema da tela toda, com cor, ícone e texto.
    return (
      <View style={styles.state}>
        <FeedbackMessage kind="error" message={FALHA_AO_CARREGAR} />
      </View>
    );
  }
  // Também cai aqui o exame aplicado por outro médico no mesmo tablet. A tela não
  // revela que ele existe.
  return (
    <View style={styles.state}>
      <Text accessibilityRole="header" style={styles.stateTitle}>
        {EXAME_NAO_ENCONTRADO}
      </Text>
      <Text style={styles.stateText}>{EXAME_NAO_ENCONTRADO_TEXTO}</Text>
    </View>
  );
}

// Mesmas cores dos selos da lista de pacientes, para o médico reconhecer a situação.
// O texto vai sempre junto, porque a cor nunca é a única pista.
const CHIP_STYLES = {
  concluido: { box: 'chipConcluido', text: 'chipConcluidoText' },
  interrompido: { box: 'chipInterrompido', text: 'chipInterrompidoText' },
  recusado: { box: 'chipRecusado', text: 'chipRecusadoText' },
} as const satisfies Record<ExamStatus, { box: keyof VerExameStyles; text: keyof VerExameStyles }>;

// O exame em andamento não tem selo na lista, usa as cores de informação.
const CHIP_EM_ANDAMENTO = { box: 'chipEmAndamento', text: 'chipEmAndamentoText' } as const;

type ExameProps = { exame: ExameDaConsulta; isWide: boolean; styles: VerExameStyles };

// Mesma ordem do protótipo, com identificação do exame, dados, resultado e desenhos.
function Exame({ exame, isWide, styles }: ExameProps) {
  const chip = exame.situacao ? CHIP_STYLES[exame.situacao] : CHIP_EM_ANDAMENTO;
  const total = exame.desenhos.length;

  return (
    <ScrollView contentContainerStyle={[styles.content, isWide && styles.contentWide]}>
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" style={styles.title}>
          Exame de {exame.data} às {exame.hora}
        </Text>
        <View style={[styles.chip, styles[chip.box]]}>
          <Text style={[styles.chipText, styles[chip.text]]}>{exame.situacaoTexto}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.fields}>
          <Field styles={styles} label="PACIENTE" value={exame.pacienteNome} />
          <Field styles={styles} label="FICHA" value={exame.numeroFicha} />
          <Field styles={styles} label="APLICADO POR" value={exame.profissionalNome} />
        </View>
      </View>

      {/* O cartão fica no lugar do resultado do protótipo e só muda o conteúdo com o modelo. */}
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.cardTitle}>
          Resultado
        </Text>
        <Text style={styles.resultText}>{exame.resultado}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            Desenhos
          </Text>
          {/* Diz quantos desenhos há, já que exame interrompido tem menos de três. */}
          <Text style={styles.cardSubtitle}>
            {exame.desenhosGravados} de {total} desenhos gravados neste tablet.
          </Text>
        </View>
        <View style={[styles.drawings, isWide && styles.drawingsWide]}>
          {exame.desenhos.map((desenho) => (
            <Desenho key={desenho.ordem} desenho={desenho} isWide={isWide} styles={styles} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

// Rótulo em maiúsculas e valor embaixo
function Field({ styles, label, value }: { styles: VerExameStyles; label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

type DesenhoProps = { desenho: DesenhoDaConsulta; isWide: boolean; styles: VerExameStyles };

// Cada tarefa ocupa o mesmo espaço com ou sem desenho, para as três ficarem
// alinhadas. A que não tem desenho diz "Não realizado" em texto além da
// borda tracejada. O leitor de tela lê o nome da tarefa de cada imagem.
function Desenho({ desenho, isWide, styles }: DesenhoProps) {
  return (
    <View style={[styles.drawing, isWide && styles.drawingWide]}>
      {desenho.imagemUri ? (
        <View style={styles.drawingFrame}>
          {/* O contain mostra o desenho inteiro, porque a imagem gravada cresce quando o
              traço passa da borda do quadro. */}
          <Image
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Desenho: ${desenho.nome}`}
            source={{ uri: desenho.imagemUri }}
            resizeMode="contain"
            style={styles.drawingImage}
          />
        </View>
      ) : (
        <View
          style={styles.drawingMissing}
          accessible
          accessibilityLabel={`${desenho.nome}: ${SEM_DESENHO.toLowerCase()}`}>
          <Text style={styles.drawingMissingText}>{SEM_DESENHO}</Text>
        </View>
      )}
      <View style={styles.drawingCaption}>
        <Text style={styles.drawingName}>
          {desenho.ordem}. {desenho.nome}
        </Text>
        {desenho.confirmadoAs && (
          <Text style={styles.drawingTime}>Confirmado às {desenho.confirmadoAs}</Text>
        )}
      </View>
    </View>
  );
}
