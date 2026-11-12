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
      frase: 'Círculo, todos os números e ponteiros em onze e dez.',
    });
    expect(LEMBRETES[2]).toEqual({
      titulo: 'Copie o cubo',
      frase: 'Desenhe do jeito que você consegue.',
    });
  });

  it('marca no relógio a mesma hora da instrução: onze e dez', () => {
    expect(relogio.instrucao).toContain('onze horas e dez minutos');
    expect(LEMBRETES[1].frase).toContain('onze e dez');
  });

  it('pede no relógio o círculo, os números e os ponteiros, na instrução e no lembrete', () => {
    for (const texto of [relogio.instrucao, LEMBRETES[1].frase]) {
      expect(texto).toMatch(/círculo/i);
      expect(texto).toMatch(/números/i);
      expect(texto).toMatch(/ponteiros/i);
    }
  });

  it('não escreve a hora em algarismos, para não ser lida como "escreva 11:10"', () => {
    for (const texto of [relogio.instrucao, LEMBRETES[1].frase]) {
      expect(texto).not.toMatch(/\d/);
    }
  });

  it('pede nas trilhas a sequência do MoCA, alternando número e letra até o E', () => {
    expect(LEMBRETES[3].frase).toContain('1, A, 2, B');
    expect(LEMBRETES[3].frase).toContain('até o E');
  });

  it('pede nas trilhas uma linha só, sem levantar a caneta, na instrução e no lembrete', () => {
    for (const texto of [trilhas.instrucao, LEMBRETES[3].frase]) {
      expect(texto).toMatch(/uma linha só/i);
      expect(texto).toMatch(/sem levantar a caneta/i);
    }
  });
});

describe('dica do "Confirmar"', () => {
  it('diz o que falta para habilitar o botão, como pede o guia', () => {
    expect(DICA_CONFIRMAR).toBe('Desenhe pelo menos um traço para confirmar.');
  });
});
