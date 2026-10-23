import { Colors } from '@/constants/theme';
import { createInstructionStyles } from '@/features/avaliacao/instruction.styles';

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
});
