import {
  DICA_CONFIRMAR,
  LEMBRETES,
  mostraCirculosDasTrilhas,
  mostraFiguraDoCubo,
} from '@/features/avaliacao/drawing-task';
import { TAREFAS } from '@/features/avaliacao/tarefas';

const [relogio, cubo, trilhas] = TAREFAS;

describe('telas de desenho das tarefas', () => {
  it('só a cópia do cubo mostra a figura de modelo', () => {
    expect(mostraFiguraDoCubo(relogio)).toBe(false);
    expect(mostraFiguraDoCubo(cubo)).toBe(true);
    expect(mostraFiguraDoCubo(trilhas)).toBe(false);
  });

  it('só as trilhas mostram os círculos no quadro', () => {
    expect(mostraCirculosDasTrilhas(relogio)).toBe(false);
    expect(mostraCirculosDasTrilhas(cubo)).toBe(false);
    expect(mostraCirculosDasTrilhas(trilhas)).toBe(true);
  });
});

describe('lembrete de cada tarefa', () => {
  it('existe para as três tarefas', () => {
    for (const tarefa of TAREFAS) {
      expect(LEMBRETES[tarefa.numero]).toEqual({
        titulo: expect.any(String),
        frase: expect.any(String),
      });
    }
  });

  it('repete o pedido do relógio e do cubo com as palavras do protótipo', () => {
    expect(LEMBRETES[1]).toEqual({
      titulo: 'Desenhe um relógio',
      frase: 'Com todos os números, marcando 11h10.',
    });
    expect(LEMBRETES[2]).toEqual({
      titulo: 'Copie o cubo',
      frase: 'Desenhe do jeito que você consegue.',
    });
  });

  it('marca no relógio a mesma hora da instrução: onze horas e dez minutos', () => {
    expect(relogio.instrucao).toContain('onze horas e dez minutos');
    expect(LEMBRETES[1].frase).toContain('11h10');
  });

  it('pede nas trilhas a sequência do MoCA, alternando número e letra até o E', () => {
    expect(LEMBRETES[3].frase).toContain('1, A, 2, B');
    expect(LEMBRETES[3].frase).toContain('até o E');
  });
});

describe('dica do "Confirmar"', () => {
  it('diz o que falta para habilitar o botão, como pede o guia', () => {
    expect(DICA_CONFIRMAR).toBe('Desenhe pelo menos um traço para confirmar.');
  });
});
