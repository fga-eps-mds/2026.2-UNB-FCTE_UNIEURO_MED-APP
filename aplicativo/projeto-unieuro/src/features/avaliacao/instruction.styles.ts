import { StyleSheet } from 'react-native';

import { BrandPalette, FontFamilies, type ThemeColors } from '@/constants/theme';

/** Altura do botão grande, o tamanho dos botões nas telas do paciente (guia de identidade visual). */
export const ALTURA_BOTAO_PACIENTE = 84;

/** Tamanho do ícone da tarefa: o guia manda 32 a 48 nos destaques das telas do paciente. */
export const TAMANHO_ICONE_TAREFA = 48;

/**
 * Medidas da instrução que acompanham o tamanho da tela (#109). Os textos e o botão
 * não entram aqui: o guia de identidade visual fixa o texto do paciente em 20 pontos
 * ou mais e o botão em 84 de altura, em qualquer tela.
 */
export type InstructionLayout = {
  /** A tela está em pé (mais alta do que larga). */
  retrato: boolean;
  /** Largura máxima do cartão. */
  larguraCartao: number;
  /** Espaço interno do cartão. */
  padding: number;
  /** Diâmetro do círculo do ícone. */
  icone: number;
  /** Espaço entre os itens do cartão. */
  espaco: number;
  /** Margem da área da instrução, em volta do cartão. */
  margem: number;
};

/** As medidas que a tela tinha antes da #109, desenhadas para o tablet deitado. */
export const LAYOUT_PADRAO: InstructionLayout = {
  retrato: false,
  larguraCartao: 880,
  padding: 48,
  icone: 120,
  espaco: 20,
  margem: 24,
};

const limitar = (valor: number, minimo: number, maximo: number) =>
  Math.min(maximo, Math.max(minimo, valor));

/**
 * Calcula as medidas da instrução para uma tela de `largura` × `altura`.
 *
 * - O cartão, o espaço interno e o ícone encolhem quando falta altura (tablet deitado)
 *   ou largura (telas menores), e nunca crescem além do desenho original. A largura de
 *   referência é 1024 deitado e 800 em pé, a largura do tablet do projeto em pé: assim,
 *   em pé, o cartão mantém o tamanho original em vez de encolher sem necessidade.
 * - O espaço entre os itens acompanha a altura: no tablet em pé ele cresce, para o
 *   cartão não ficar pequeno no meio de uma tela alta.
 * - A margem acompanha a largura, de 16 a 40.
 */
export function getInstructionLayout(largura: number, altura: number): InstructionLayout {
  const retrato = altura > largura;
  const larguraDeReferencia = retrato ? 800 : 1024;
  const escala = limitar(Math.min(largura / larguraDeReferencia, altura / 900), 0.5, 1);
  const escalaVertical = limitar(altura / 900, 0.6, 1.4);
  const margem = Math.round(limitar(largura * 0.03, 16, 40));

  return {
    retrato,
    larguraCartao: Math.min(LAYOUT_PADRAO.larguraCartao, largura - 2 * margem),
    padding: Math.round(LAYOUT_PADRAO.padding * escala),
    icone: Math.round(LAYOUT_PADRAO.icone * escala),
    espaco: Math.round(LAYOUT_PADRAO.espaco * escalaVertical),
    margem,
  };
}

/**
 * Estilos da tela de instrução (#8), uma tela do paciente: texto de 20 pontos ou mais.
 * Sem `layout`, usa as medidas originais; é o caso da barra das tarefas, que também
 * aparece nas telas de desenho.
 */
export function createInstructionStyles(
  colors: ThemeColors,
  layout: InstructionLayout = LAYOUT_PADRAO,
) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    topBar: {
      flexDirection: 'row',
      // Numa tela estreita, como a de um celular, a frase de ajuda desce para a linha de
      // baixo em vez de quebrar palavra por palavra ao lado do progresso. No tablet ela
      // continua na mesma linha, porque cabe.
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      paddingHorizontal: 24,
      paddingVertical: 20,
      backgroundColor: colors.surface,
    },
    progress: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dots: { flexDirection: 'row', gap: 8 },
    dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.borderDecorative },
    dotFilled: { backgroundColor: colors.primary },
    progressText: {
      color: colors.text,
      fontFamily: FontFamilies.bold,
      fontSize: 22,
      lineHeight: 28,
    },
    help: {
      flexShrink: 1,
      color: colors.textSecondary,
      fontFamily: FontFamilies.semibold,
      fontSize: 20,
      lineHeight: 26,
      textAlign: 'right',
    },
    content: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: layout.margem,
      paddingVertical: Math.round(layout.espaco * 1.6),
    },
    card: {
      width: '100%',
      maxWidth: layout.larguraCartao,
      alignItems: 'center',
      gap: layout.espaco,
      padding: layout.padding,
      borderRadius: 28,
      backgroundColor: colors.surface,
      boxShadow: '0px 10px 32px rgba(15, 23, 41, 0.12)',
    },
    iconCircle: {
      width: layout.icone,
      height: layout.icone,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: layout.icone / 2,
      backgroundColor: BrandPalette.lightPeach,
    },
    cardLabel: {
      color: colors.primary,
      fontFamily: FontFamilies.semibold,
      fontSize: 20,
      lineHeight: 26,
    },
    title: {
      color: colors.text,
      fontFamily: FontFamilies.bold,
      fontSize: 48,
      lineHeight: 58,
      textAlign: 'center',
    },
    instruction: {
      maxWidth: 760,
      color: colors.textSecondary,
      fontFamily: FontFamilies.regular,
      fontSize: 24,
      lineHeight: 36,
      textAlign: 'center',
    },
    button: {
      width: '100%',
      maxWidth: 520,
      minHeight: ALTURA_BOTAO_PACIENTE,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      paddingHorizontal: 24,
      borderRadius: 16,
      backgroundColor: colors.primary,
    },
    buttonText: {
      color: colors.onPrimary,
      fontFamily: FontFamilies.semibold,
      fontSize: 26,
      lineHeight: 32,
    },
    pressed: { opacity: 0.85 },
  });
}
