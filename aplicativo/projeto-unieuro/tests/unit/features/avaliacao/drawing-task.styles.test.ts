import { BrandPalette, Colors, FontFamilies } from '@/constants/theme';
import {
  ALTURA_BOTAO_ACAO,
  ALTURA_BOTAO_CONFIRMAR,
  CORES_DA_TAREFA,
  DESABILITADO,
  LARANJA_ESCURO,
  createDrawingTaskStyles,
} from '@/features/avaliacao/drawing-task.styles';
import { CORES_ALTO_CONTRASTE } from '@/features/avaliacao/tema-do-paciente';

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

  it('dá ao "Desfazer" e ao "Apagar tudo" o botão grande do guia, com contorno laranja', () => {
    expect(ALTURA_BOTAO_ACAO).toBe(84);
    expect(styles.botaoAcao).toMatchObject({
      minHeight: 84,
      borderWidth: 2,
      borderColor: Colors.light.primary,
      backgroundColor: Colors.light.surface,
    });
    expect(styles.botaoAcaoDesabilitado.backgroundColor).toBe(DESABILITADO.fundo);
    expect(styles.textoAcaoDesabilitado.color).toBe(DESABILITADO.texto);
  });

  it('deixa os botões descerem de linha com o tablet em pé, sem apertar o lembrete', () => {
    expect(styles.ferramentas.flexWrap).toBe('wrap');
    expect(styles.lembrete).toMatchObject({ flexGrow: 1, flexBasis: 400 });
  });

  it('mantém com 20 pontos ou mais o texto dos botões novos e da confirmação de apagar', () => {
    const textos = [
      styles.textoAcao,
      styles.textoApagar,
      styles.dialogoTitulo,
      styles.dialogoTexto,
      styles.dialogoRegistroRotulo,
      styles.dialogoRegistroTexto,
    ];

    for (const texto of textos) {
      expect(texto.fontSize).toBeGreaterThanOrEqual(20);
    }
  });

  it('dá aos botões da confirmação de apagar o mesmo tamanho grande', () => {
    expect(styles.botaoCancelar.minHeight).toBe(ALTURA_BOTAO_ACAO);
    expect(styles.botaoApagar.minHeight).toBe(ALTURA_BOTAO_ACAO);
    expect(styles.botaoApagarPressionado.backgroundColor).toBe(LARANJA_ESCURO);
  });
});

describe('createDrawingTaskStyles com os ajustes do teste (#24)', () => {
  const contraste = createDrawingTaskStyles(CORES_ALTO_CONTRASTE);
  const ampliados = createDrawingTaskStyles(undefined, 1.25);

  it('no alto contraste, troca as cores do lembrete, dos botões e do desabilitado', () => {
    expect(contraste.lembrete.backgroundColor).toBe(CORES_ALTO_CONTRASTE.destaque);
    expect(contraste.lembreteFrase.color).toBe(CORES_ALTO_CONTRASTE.textoSobreDestaque);
    expect(contraste.botaoConfirmar.backgroundColor).toBe(CORES_ALTO_CONTRASTE.primary);
    expect(contraste.botaoConfirmarPressionado.backgroundColor).toBe(
      CORES_ALTO_CONTRASTE.pressionado,
    );
    expect(contraste.botaoConfirmarDesabilitado.backgroundColor).toBe(
      CORES_ALTO_CONTRASTE.desabilitadoFundo,
    );
    expect(contraste.textoAcaoDesabilitado.color).toBe(CORES_ALTO_CONTRASTE.desabilitadoTexto);
    expect(contraste.figura.backgroundColor).toBe(CORES_ALTO_CONTRASTE.fundoAcolhedor);
  });

  it('com as letras maiores, aumenta o texto e mantém o tamanho dos botões e do quadro', () => {
    expect(ampliados.textoConfirmar.fontSize).toBe(33);
    expect(ampliados.lembreteTitulo.fontSize).toBe(30);
    expect(ampliados.dialogoTitulo.fontSize).toBe(35);
    expect(ampliados.botaoConfirmar.minHeight).toBe(styles.botaoConfirmar.minHeight);
    expect(ampliados.quadro).toEqual(styles.quadro);
  });

  it('sem ajustes, as cores derivadas continuam as do guia', () => {
    expect(styles.lembrete.backgroundColor).toBe('#FFE8D6');
    expect(styles.figura.backgroundColor).toBe('#FFF7ED');
  });
});
