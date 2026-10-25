import { BrandPalette, Colors, FontFamilies } from '@/constants/theme';
import {
  ALTURA_BOTAO_CONFIRMAR,
  CORES_DA_TAREFA,
  DESABILITADO,
  LARANJA_ESCURO,
  createDrawingTaskStyles,
} from '@/features/avaliacao/drawing-task.styles';

const styles = createDrawingTaskStyles();

describe('createDrawingTaskStyles', () => {
  it('usa sempre as cores claras: a tela do paciente não muda com o modo escuro', () => {
    expect(CORES_DA_TAREFA).toBe(Colors.light);
    expect(styles.safeArea.backgroundColor).toBe(Colors.light.background);
  });

  it('mantém todo texto com 20 pontos ou mais, o mínimo das telas do paciente', () => {
    const textos = [
      styles.lembreteTitulo,
      styles.lembreteFrase,
      styles.textoConfirmar,
      styles.dica,
      styles.modeloTitulo,
    ];

    for (const texto of textos) {
      expect(texto.fontSize).toBeGreaterThanOrEqual(20);
    }
  });

  it('dá ao "Confirmar" o tamanho extragrande do guia: 112 de altura e texto 26/32 semibold', () => {
    expect(ALTURA_BOTAO_CONFIRMAR).toBe(112);
    expect(styles.botaoConfirmar).toMatchObject({
      minHeight: 112,
      borderRadius: 16,
      backgroundColor: Colors.light.primary,
    });
    expect(styles.textoConfirmar).toMatchObject({
      color: Colors.light.onPrimary,
      fontFamily: FontFamilies.semibold,
      fontSize: 26,
      lineHeight: 32,
    });
  });

  it('pinta o "Confirmar" pressionado de laranja escuro e o desabilitado com as cores do guia', () => {
    expect(LARANJA_ESCURO).toBe('#7C2D12');
    expect(styles.botaoConfirmarPressionado.backgroundColor).toBe(LARANJA_ESCURO);
    expect(DESABILITADO).toEqual({ fundo: '#E2E8F0', texto: '#475569' });
    expect(styles.botaoConfirmarDesabilitado.backgroundColor).toBe(DESABILITADO.fundo);
    expect(styles.textoConfirmarDesabilitado.color).toBe(DESABILITADO.texto);
  });

  it('esconde a dica só com transparência, sem tirar o espaço que ela ocupa', () => {
    expect(styles.dicaOculta).toEqual({ opacity: 0 });
  });

  it('desenha o lembrete com o pêssego claro e o texto em laranja, como no guia', () => {
    expect(styles.lembrete.backgroundColor).toBe(BrandPalette.lightPeach);
    expect(styles.lembreteTitulo.color).toBe(Colors.light.primary);
    expect(styles.lembreteFrase.color).toBe(LARANJA_ESCURO);
    expect(styles.lembrete.minHeight).toBe(ALTURA_BOTAO_CONFIRMAR);
  });

  it('desenha o cartão da figura do cubo com a borda laranja e o fundo acolhedor', () => {
    expect(styles.modelo).toMatchObject({
      borderWidth: 2,
      borderColor: Colors.light.primary,
      borderRadius: 24,
      backgroundColor: Colors.light.surface,
    });
    expect(styles.figura.backgroundColor).toBe('#FFF7ED');
  });

  it('deixa o quadro ocupar o espaço que sobra', () => {
    expect(styles.quadro.flex).toBe(1);
    expect(styles.area.flex).toBe(1);
  });
});
