import { BrandPalette, Colors, type ThemeColors } from '@/constants/theme';
import { useAjustesDoTeste, type AjustesDoTeste } from '@/features/acessibilidade/ajustes-do-teste';

/**
 * Cores das telas do paciente: a paleta clara mais as cores próprias das tarefas
 * (guia de identidade visual, "Telas do paciente").
 */
export type CoresDoPaciente = ThemeColors & {
  /** Fundo do lembrete e do botão de ação pressionado: o pêssego claro. */
  destaque: string;
  /** Texto sobre o `destaque`. */
  textoSobreDestaque: string;
  /** Fundo do botão principal pressionado. */
  pressionado: string;
  desabilitadoFundo: string;
  desabilitadoTexto: string;
  /** Fundo atrás da figura de modelo e da tela final. */
  fundoAcolhedor: string;
};

/** As telas do paciente são sempre claras, mesmo com o tablet no modo escuro. */
export const CORES_DO_PACIENTE: CoresDoPaciente = {
  ...Colors.light,
  destaque: BrandPalette.lightPeach,
  textoSobreDestaque: '#7C2D12',
  pressionado: '#7C2D12',
  desabilitadoFundo: '#E2E8F0',
  desabilitadoTexto: '#475569',
  fundoAcolhedor: '#FFF7ED',
};

/**
 * Alto contraste (#24): texto preto sobre branco, bordas pretas e o laranja mais escuro
 * da marca. Cada par de texto e fundo passa de 7:1, o nível AAA da WCAG. O ponto vazio
 * do progresso fica branco com borda preta, para não se confundir com o preenchido.
 */
export const CORES_ALTO_CONTRASTE: CoresDoPaciente = {
  primary: '#7C2D12',
  onPrimary: '#FFFFFF',
  text: '#000000',
  textSecondary: '#111827',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  field: '#FFFFFF',
  border: '#000000',
  borderDecorative: '#FFFFFF',
  placeholder: '#374151',
  error: '#7F1D1D',
  errorBg: '#FFFFFF',
  success: '#14532D',
  successBg: '#FFFFFF',
  warning: '#78350F',
  warningBg: '#FFFFFF',
  info: '#1E3A8A',
  infoBg: '#FFFFFF',
  destaque: BrandPalette.lightPeach,
  textoSobreDestaque: '#000000',
  pressionado: '#431407',
  desabilitadoFundo: '#D1D5DB',
  desabilitadoTexto: '#111827',
  fundoAcolhedor: '#FFFFFF',
};

/** Letras maiores (#24): 25% a mais no texto e na entrelinha. 20 pontos viram 25. */
export const ESCALA_LETRAS_MAIORES = 1.25;

export type TemaDoPaciente = { cores: CoresDoPaciente; escala: number };

export function temaDoPaciente(ajustes: AjustesDoTeste): TemaDoPaciente {
  return {
    cores: ajustes.altoContraste ? CORES_ALTO_CONTRASTE : CORES_DO_PACIENTE,
    escala: ajustes.letrasMaiores ? ESCALA_LETRAS_MAIORES : 1,
  };
}

/** O tema das telas do paciente, conforme os ajustes que o profissional escolheu. */
export function useTemaDoPaciente(): TemaDoPaciente {
  const { ajustes } = useAjustesDoTeste();
  return temaDoPaciente(ajustes);
}

type EstiloDeTexto = { fontSize?: unknown; lineHeight?: unknown };

/**
 * Aplica a escala ao tamanho da letra e à entrelinha de todos os estilos de uma tela,
 * sem mexer em mais nada. Assim cada tela continua com os tamanhos do guia, e as letras
 * maiores valem para todas do mesmo jeito.
 */
export function ampliarTexto<Estilos extends Record<string, object>>(
  estilos: Estilos,
  escala: number,
): Estilos {
  if (escala === 1) return estilos;
  const escalar = (valor: unknown) =>
    typeof valor === 'number' ? { valor: Math.round(valor * escala) } : null;

  return Object.fromEntries(
    Object.entries(estilos).map(([nome, estilo]) => {
      const { fontSize, lineHeight } = estilo as EstiloDeTexto;
      const tamanho = escalar(fontSize);
      const entrelinha = escalar(lineHeight);
      if (!tamanho && !entrelinha) return [nome, estilo];
      return [
        nome,
        {
          ...estilo,
          ...(tamanho && { fontSize: tamanho.valor }),
          ...(entrelinha && { lineHeight: entrelinha.valor }),
        },
      ];
    }),
  ) as Estilos;
}
