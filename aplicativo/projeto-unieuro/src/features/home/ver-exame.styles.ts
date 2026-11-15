import { StyleSheet } from 'react-native';

import { BrandPalette, FontFamilies, type ThemeColors } from '@/constants/theme';
import { COR_FUNDO } from '@/features/captura/estilo-traco';

// Mesmos tamanhos da tela inicial, do guia de identidade visual. O menor texto
// é 16, o corpo é 18 e o botão médio tem 64 de altura, com texto 20.
export function createVerExameStyles(theme: ThemeColors) {
  const label = {
    color: theme.textSecondary,
    fontFamily: FontFamilies.semibold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.64,
  };
  const body = { fontFamily: FontFamilies.regular, fontSize: 18, lineHeight: 28 };
  const buttonText = { fontFamily: FontFamilies.semibold, fontSize: 20, lineHeight: 26 };
  // Cartão do guia, com margem interna de 32 e cantos de 24, na cor de superfície.
  const card = { gap: 20, padding: 32, borderRadius: 24, backgroundColor: theme.surface };

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    // Mesma barra das configurações, para a área do profissional ficar padronizada.
    topBar: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    topBarWide: { paddingHorizontal: 40 },
    // Alvo de toque de pelo menos 48 de altura, que o guia exige até em botão de texto.
    back: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
    backText: { ...buttonText, color: theme.primary },
    // O nome encolhe e vira reticências, para não empurrar o "Voltar" para fora.
    accountText: { flexShrink: 1, alignItems: 'flex-end' },
    professionalName: { ...body, color: theme.text, fontFamily: FontFamilies.semibold },
    professionalCrm: { ...label, marginTop: 2 },
    pressed: { opacity: 0.82 },
    // O conteúdo rola, porque no tablet em pé os três desenhos ficam um embaixo do outro.
    content: { gap: 24, padding: 24, paddingBottom: 48 },
    contentWide: { paddingHorizontal: 40, paddingTop: 32 },
    titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
    title: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 34, lineHeight: 42 },
    chip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    chipText: { fontFamily: FontFamilies.semibold, fontSize: 16, lineHeight: 22 },
    // Mesmas cores dos selos da lista de pacientes; o em andamento usa as de informação.
    chipConcluido: { backgroundColor: theme.background },
    chipConcluidoText: { color: theme.text },
    chipInterrompido: { backgroundColor: BrandPalette.lightPeach },
    chipInterrompidoText: { color: theme.primary },
    chipRecusado: { backgroundColor: BrandPalette.cream },
    chipRecusadoText: { color: BrandPalette.deepWine },
    chipEmAndamento: { backgroundColor: theme.infoBg },
    chipEmAndamentoText: { color: theme.info },
    card,
    cardTitle: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 24, lineHeight: 32 },
    cardHeader: { gap: 4 },
    cardSubtitle: { ...body, color: theme.textSecondary },
    // Os dados quebram linha em tela estreita, sem cortar o nome do paciente.
    fields: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 48, rowGap: 16 },
    field: { gap: 4, minWidth: 160 },
    fieldLabel: label,
    fieldValue: { ...body, color: theme.text },
    resultText: { ...body, color: theme.text },
    drawings: { gap: 20 },
    // Lado a lado só no tablet deitado, com cada desenho dividindo a largura por igual.
    drawingsWide: { flexDirection: 'row' },
    drawing: { gap: 10 },
    drawingWide: { flex: 1 },
    // A imagem imita o papel do quadro de desenho, com fundo branco também no tema
    // escuro. A altura é fixa para as três tarefas ficarem alinhadas.
    drawingFrame: {
      height: 240,
      overflow: 'hidden',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: COR_FUNDO,
    },
    drawingImage: { width: '100%', height: '100%' },
    // Tarefa sem desenho tem a mesma altura das outras, com borda tracejada e fundo de
    // campo. O texto "Não realizado" fica no meio, para não depender só da aparência.
    drawingMissing: {
      height: 240,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      borderRadius: 16,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: theme.border,
      backgroundColor: theme.field,
    },
    drawingMissingText: { ...body, color: theme.textSecondary, textAlign: 'center' },
    drawingCaption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    },
    drawingName: { ...body, color: theme.text, fontFamily: FontFamilies.semibold },
    drawingTime: {
      color: theme.textSecondary,
      fontFamily: FontFamilies.regular,
      fontSize: 16,
      lineHeight: 28,
    },
    // Carregando, falha e não encontrado ficam centralizados abaixo da barra.
    state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
    stateTitle: { color: theme.text, fontFamily: FontFamilies.bold, fontSize: 24, lineHeight: 32 },
    stateText: { ...body, color: theme.textSecondary, textAlign: 'center', maxWidth: 560 },
  });
}

export type VerExameStyles = ReturnType<typeof createVerExameStyles>;
