import { BrandPalette, Colors, FontFamilies } from '@/constants/theme';
import {
  ALTURA_BOTAO_PACIENTE,
  LAYOUT_PADRAO,
  TAMANHO_ICONE_TAREFA,
  createInstructionStyles,
  getInstructionLayout,
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

// Telas da #109: o tablet do projeto deitado e em pé, uma tela menor e um celular.
const TABLET_DEITADO = getInstructionLayout(1280, 800);
const TABLET_EM_PE = getInstructionLayout(800, 1280);
const TELA_MENOR = getInstructionLayout(1024, 600);
const CELULAR = getInstructionLayout(360, 740);

describe('getInstructionLayout', () => {
  it('diz se a tela está em pé ou deitada', () => {
    expect(TABLET_DEITADO.retrato).toBe(false);
    expect(TABLET_EM_PE.retrato).toBe(true);
    expect(CELULAR.retrato).toBe(true);
  });

  it('nunca passa das medidas originais do cartão e do ícone', () => {
    for (const layout of [TABLET_DEITADO, TABLET_EM_PE, TELA_MENOR, CELULAR]) {
      expect(layout.larguraCartao).toBeLessThanOrEqual(LAYOUT_PADRAO.larguraCartao);
      expect(layout.padding).toBeLessThanOrEqual(LAYOUT_PADRAO.padding);
      expect(layout.icone).toBeLessThanOrEqual(LAYOUT_PADRAO.icone);
    }
  });

  it('cabe na largura da tela, com a margem dos dois lados', () => {
    for (const [largura, altura] of [
      [1280, 800],
      [800, 1280],
      [1024, 600],
      [360, 740],
    ]) {
      const layout = getInstructionLayout(largura, altura);
      expect(layout.larguraCartao + 2 * layout.margem).toBeLessThanOrEqual(largura);
    }
  });

  it('no tablet deitado, encolhe o espaço interno e o ícone para caber na altura de 800', () => {
    expect(TABLET_DEITADO.padding).toBeLessThan(LAYOUT_PADRAO.padding);
    expect(TABLET_DEITADO.icone).toBeLessThan(LAYOUT_PADRAO.icone);
    expect(TABLET_DEITADO.espaco).toBeLessThan(LAYOUT_PADRAO.espaco);
  });

  it('no tablet em pé, mantém o cartão e o ícone originais e aumenta o espaço entre os itens', () => {
    expect(TABLET_EM_PE.padding).toBe(LAYOUT_PADRAO.padding);
    expect(TABLET_EM_PE.icone).toBe(LAYOUT_PADRAO.icone);
    expect(TABLET_EM_PE.espaco).toBeGreaterThan(TABLET_DEITADO.espaco);
    expect(TABLET_EM_PE.larguraCartao).toBe(800 - 2 * TABLET_EM_PE.margem);
  });

  it('numa tela menor, encolhe mais do que no tablet', () => {
    expect(TELA_MENOR.padding).toBeLessThan(TABLET_DEITADO.padding);
    expect(TELA_MENOR.icone).toBeLessThan(TABLET_DEITADO.icone);
  });

  it('no celular, usa a margem mínima e o menor ícone que ainda cabe o desenho da tarefa', () => {
    expect(CELULAR.margem).toBe(16);
    expect(CELULAR.icone).toBeGreaterThan(TAMANHO_ICONE_TAREFA);
    expect(CELULAR.padding).toBeGreaterThanOrEqual(24);
  });

  it('em qualquer tela, mantém o texto com 20 pontos ou mais e o botão com 84 de altura', () => {
    for (const layout of [TABLET_DEITADO, TABLET_EM_PE, TELA_MENOR, CELULAR]) {
      const estilos = createInstructionStyles(Colors.light, layout);
      for (const texto of [
        estilos.cardLabel,
        estilos.title,
        estilos.instruction,
        estilos.buttonText,
      ]) {
        expect(texto.fontSize).toBeGreaterThanOrEqual(20);
      }
      expect(estilos.button.minHeight).toBe(ALTURA_BOTAO_PACIENTE);
    }
  });

  it('leva as medidas do layout para o cartão, o ícone e a área da instrução', () => {
    const estilos = createInstructionStyles(Colors.light, TABLET_EM_PE);

    expect(estilos.card).toMatchObject({
      maxWidth: TABLET_EM_PE.larguraCartao,
      padding: TABLET_EM_PE.padding,
      gap: TABLET_EM_PE.espaco,
    });
    expect(estilos.iconCircle).toMatchObject({
      width: TABLET_EM_PE.icone,
      height: TABLET_EM_PE.icone,
      borderRadius: TABLET_EM_PE.icone / 2,
    });
    expect(estilos.content.paddingHorizontal).toBe(TABLET_EM_PE.margem);
  });

  it('deixa a frase de ajuda descer para a linha de baixo quando a barra não cabe numa linha', () => {
    expect(styles.topBar.flexWrap).toBe('wrap');
    expect(styles.help.flexShrink).toBe(1);
  });

  it('sem layout, mantém as medidas de antes, que a barra das tarefas também usa', () => {
    const estilos = createInstructionStyles(Colors.light);

    expect(estilos.card).toMatchObject({ maxWidth: 880, padding: 48, gap: 20 });
    expect(estilos.iconCircle).toMatchObject({ width: 120, height: 120 });
    expect(estilos.content).toMatchObject({ paddingHorizontal: 24, paddingVertical: 32 });
    expect(estilos.topBar).toEqual(createInstructionStyles(Colors.light, CELULAR).topBar);
  });
});
