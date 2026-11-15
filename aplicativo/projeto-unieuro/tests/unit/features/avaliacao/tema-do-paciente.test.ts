import { Colors } from '@/constants/theme';
import {
  ampliarTexto,
  CORES_ALTO_CONTRASTE,
  CORES_DO_PACIENTE,
  ESCALA_LETRAS_MAIORES,
  temaDoPaciente,
  type CoresDoPaciente,
} from '@/features/avaliacao/tema-do-paciente';

/** Contraste entre duas cores pela fórmula da WCAG 2.1 (luminância relativa). */
function contraste(cor1: string, cor2: string): number {
  const luminancia = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((inicio) => {
      const canal = Number.parseInt(hex.slice(inicio, inicio + 2), 16) / 255;
      return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [clara, escura] = [luminancia(cor1), luminancia(cor2)].sort((a, b) => b - a);
  return (clara + 0.05) / (escura + 0.05);
}

/** Pares de texto e fundo que aparecem nas telas do paciente. */
const PARES: [keyof CoresDoPaciente, keyof CoresDoPaciente][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['textSecondary', 'surface'],
  ['primary', 'surface'],
  ['onPrimary', 'primary'],
  ['onPrimary', 'pressionado'],
  ['textoSobreDestaque', 'destaque'],
  ['primary', 'destaque'],
  ['desabilitadoTexto', 'desabilitadoFundo'],
  ['error', 'surface'],
];

describe('tema do paciente', () => {
  it('sem ajustes, usa as cores claras do guia e o tamanho normal das letras', () => {
    const tema = temaDoPaciente({ altoContraste: false, letrasMaiores: false });

    expect(tema.escala).toBe(1);
    expect(tema.cores).toBe(CORES_DO_PACIENTE);
    expect(tema.cores).toMatchObject(Colors.light);
    expect(CORES_DO_PACIENTE).toMatchObject({
      textoSobreDestaque: '#7C2D12',
      pressionado: '#7C2D12',
      desabilitadoFundo: '#E2E8F0',
      desabilitadoTexto: '#475569',
      fundoAcolhedor: '#FFF7ED',
    });
  });

  it('com o alto contraste, troca as cores e mantém o tamanho', () => {
    const tema = temaDoPaciente({ altoContraste: true, letrasMaiores: false });

    expect(tema.cores).toBe(CORES_ALTO_CONTRASTE);
    expect(tema.escala).toBe(1);
  });

  it('com as letras maiores, aumenta 25% e mantém as cores', () => {
    const tema = temaDoPaciente({ altoContraste: false, letrasMaiores: true });

    expect(tema.escala).toBe(ESCALA_LETRAS_MAIORES);
    expect(ESCALA_LETRAS_MAIORES).toBe(1.25);
    expect(tema.cores).toBe(CORES_DO_PACIENTE);
  });

  it('a paleta de alto contraste tem as mesmas chaves da clara', () => {
    expect(Object.keys(CORES_ALTO_CONTRASTE).sort()).toEqual(Object.keys(CORES_DO_PACIENTE).sort());
  });

  it.each(PARES)('no alto contraste, %s sobre %s passa de 7:1 (WCAG AAA)', (texto, fundo) => {
    expect(
      contraste(CORES_ALTO_CONTRASTE[texto], CORES_ALTO_CONTRASTE[fundo]),
    ).toBeGreaterThanOrEqual(7);
  });

  it('o alto contraste é mais forte que o padrão no texto secundário', () => {
    expect(
      contraste(CORES_ALTO_CONTRASTE.textSecondary, CORES_ALTO_CONTRASTE.surface),
    ).toBeGreaterThan(contraste(CORES_DO_PACIENTE.textSecondary, CORES_DO_PACIENTE.surface));
  });
});

describe('ampliarTexto', () => {
  const estilos = {
    titulo: { fontSize: 48, lineHeight: 58, color: '#000000' },
    texto: { fontSize: 20 },
    caixa: { padding: 24, borderRadius: 16 },
  };

  it('aumenta o tamanho da letra e a entrelinha, arredondados, e deixa o resto igual', () => {
    const ampliados = ampliarTexto(estilos, 1.25);

    expect(ampliados.titulo).toEqual({ fontSize: 60, lineHeight: 73, color: '#000000' });
    expect(ampliados.texto).toEqual({ fontSize: 25 });
    expect(ampliados.caixa).toBe(estilos.caixa);
  });

  it('sem escala, devolve os mesmos estilos', () => {
    expect(ampliarTexto(estilos, 1)).toBe(estilos);
  });
});
