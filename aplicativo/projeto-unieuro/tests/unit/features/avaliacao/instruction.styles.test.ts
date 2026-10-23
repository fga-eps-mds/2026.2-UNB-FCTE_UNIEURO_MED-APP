import { BrandPalette, Colors, FontFamilies } from '@/constants/theme';
import {
  ALTURA_BOTAO_PACIENTE,
  TAMANHO_ICONE_TAREFA,
  createInstructionStyles,
} from '@/features/avaliacao/instruction.styles';

const styles = createInstructionStyles(Colors.light);

describe('createInstructionStyles', () => {
  it('mantém todo texto com 20 pontos ou mais, o mínimo das telas do paciente', () => {
    const textos = [
      styles.progressText,
      styles.help,
      styles.cardLabel,
      styles.title,
      styles.instruction,
      styles.buttonText,
    ];

    for (const texto of textos) {
      expect(texto.fontSize).toBeGreaterThanOrEqual(20);
    }
  });

  it('mantém o botão "Começar" com alvo de toque de pelo menos 48 pontos', () => {
    expect(styles.button.minHeight).toBeGreaterThanOrEqual(48);
  });

  it('usa as cores da paleta recebida', () => {
    expect(styles.safeArea.backgroundColor).toBe(Colors.light.background);
    expect(styles.card.backgroundColor).toBe(Colors.light.surface);
    expect(styles.button.backgroundColor).toBe(Colors.light.primary);
    expect(styles.buttonText.color).toBe(Colors.light.onPrimary);
    expect(styles.title.color).toBe(Colors.light.text);
  });

  it('pinta de laranja o círculo de progresso preenchido e de outra cor o vazio', () => {
    expect(styles.dotFilled.backgroundColor).toBe(Colors.light.primary);
    expect(styles.dot.backgroundColor).not.toBe(Colors.light.primary);
  });

  it('pinta o círculo do ícone com o pêssego claro da marca, sem cor escrita à parte', () => {
    expect(styles.iconCircle.backgroundColor).toBe(BrandPalette.lightPeach);
    expect(BrandPalette.lightPeach).toBe('#FFE8D6');
  });

  it('dá ao botão "Começar" o tamanho grande do guia: 84 de altura e texto 26/32 semibold', () => {
    expect(ALTURA_BOTAO_PACIENTE).toBe(84);
    expect(styles.button.minHeight).toBe(84);
    expect(styles.button.borderRadius).toBe(16);
    expect(styles.buttonText).toMatchObject({
      fontFamily: FontFamilies.semibold,
      fontSize: 26,
      lineHeight: 32,
    });
  });

  it('desenha o cartão principal como no guia: canto 28, margem interna 48 e sombra de nível 3', () => {
    expect(styles.card).toMatchObject({
      borderRadius: 28,
      padding: 48,
      boxShadow: '0px 10px 32px rgba(15, 23, 41, 0.12)',
    });
  });

  it('escreve a frase de instrução no corpo grande do guia: Inter regular 24/36', () => {
    expect(styles.instruction).toMatchObject({
      fontFamily: FontFamilies.regular,
      fontSize: 24,
      lineHeight: 36,
    });
  });

  it('mantém o ícone da tarefa dentro dos 32 a 48 pontos que o guia permite ao paciente', () => {
    expect(TAMANHO_ICONE_TAREFA).toBeGreaterThanOrEqual(32);
    expect(TAMANHO_ICONE_TAREFA).toBeLessThanOrEqual(48);
    expect(styles.iconCircle.width).toBeGreaterThan(TAMANHO_ICONE_TAREFA);
  });

  it('pinta de borda decorativa do guia (#CBD5E1) os círculos de progresso vazios', () => {
    expect(styles.dot.backgroundColor).toBe(Colors.light.borderDecorative);
    expect(styles.dot.backgroundColor).toBe('#CBD5E1');
    expect(styles.dot).toMatchObject({ width: 16, height: 16 });
  });
});
