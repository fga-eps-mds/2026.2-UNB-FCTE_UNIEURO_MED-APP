import { StyleSheet } from 'react-native';

import { BrandPalette, Colors, FontFamilies } from '@/constants/theme';

/**
 * As telas do paciente são sempre claras, mesmo com o tablet no modo escuro, para a
 * área de desenho ser igual para todos (guia de identidade visual).
 */
export const CORES_DA_TAREFA = Colors.light;

/** Altura do "Confirmar": o tamanho extragrande, só deste botão (guia de identidade visual). */
export const ALTURA_BOTAO_CONFIRMAR = 112;

/** Largura da coluna do "Confirmar" e do cartão da figura de modelo, como no protótipo. */
export const LARGURA_LATERAL = 260;

/** Texto sobre o pêssego claro e fundo do "Confirmar" pressionado (guia de identidade visual). */
export const LARANJA_ESCURO = '#7C2D12';

/** Botão desabilitado (guia de identidade visual). */
export const DESABILITADO = { fundo: '#E2E8F0', texto: '#475569' } as const;

/** Fundo acolhedor das telas do paciente, atrás da figura de modelo e na tela final. */
export const FUNDO_ACOLHEDOR = '#FFF7ED';

/** Estilos da tela de desenho de cada tarefa (#9), uma tela do paciente: texto de 20 pontos ou mais. */
export function createDrawingTaskStyles() {
  const cores = CORES_DA_TAREFA;
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: cores.background },
    corpo: { flex: 1, gap: 16, paddingHorizontal: 40, paddingTop: 16, paddingBottom: 40 },
    ferramentas: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
    lembrete: {
      flex: 1,
      minHeight: ALTURA_BOTAO_CONFIRMAR,
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 16,
      backgroundColor: BrandPalette.lightPeach,
    },
    lembreteTitulo: {
      color: cores.primary,
      fontFamily: FontFamilies.semibold,
      fontSize: 24,
      lineHeight: 32,
    },
    lembreteFrase: {
      color: LARANJA_ESCURO,
      fontFamily: FontFamilies.regular,
      fontSize: 20,
      lineHeight: 28,
    },
    confirmar: { width: LARGURA_LATERAL, gap: 8 },
    botaoConfirmar: {
      minHeight: ALTURA_BOTAO_CONFIRMAR,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      borderRadius: 16,
      backgroundColor: cores.primary,
    },
    botaoConfirmarPressionado: { backgroundColor: LARANJA_ESCURO },
    botaoConfirmarDesabilitado: { backgroundColor: DESABILITADO.fundo },
    textoConfirmar: {
      color: cores.onPrimary,
      fontFamily: FontFamilies.semibold,
      fontSize: 26,
      lineHeight: 32,
    },
    textoConfirmarDesabilitado: { color: DESABILITADO.texto },
    dica: {
      color: cores.textSecondary,
      fontFamily: FontFamilies.regular,
      fontSize: 20,
      lineHeight: 26,
      textAlign: 'center',
    },
    dicaOculta: { opacity: 0 },
    area: { flex: 1, flexDirection: 'row', gap: 20 },
    modelo: {
      width: LARGURA_LATERAL,
      alignSelf: 'flex-start',
      alignItems: 'center',
      gap: 16,
      padding: 20,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: cores.primary,
      backgroundColor: cores.surface,
    },
    modeloTitulo: {
      alignSelf: 'stretch',
      color: cores.primary,
      fontFamily: FontFamilies.semibold,
      fontSize: 20,
      lineHeight: 26,
    },
    figura: { overflow: 'hidden', borderRadius: 16, backgroundColor: FUNDO_ACOLHEDOR },
    quadro: { flex: 1 },
  });
}
