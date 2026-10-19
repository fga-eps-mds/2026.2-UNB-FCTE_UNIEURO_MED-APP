/**
 * Estado de uma tarefa de desenho: o registro dos eventos do traçado, os traços
 * que valem e o tamanho do quadro.
 *
 * É o que as telas das tarefas (#9) e do TCLE (#21) usam junto com o
 * `QuadroDesenho`:
 *
 *     const registro = useRegistroTracado();
 *     <QuadroDesenho {...registro.quadro} />
 *     <Botao onPress={registro.desfazer} disabled={!registro.temTraco} />
 *
 * Nada é gravado aqui: o registro existe só enquanto a tela está aberta. Quem
 * grava no banco lê `eventos`, `tracos`, `dimensoes` e `iniciadoEm` (#10).
 */
import { useMemo, useState } from 'react';

import {
  acrescentarAcao,
  acrescentarTraco,
  reconstruirTracos,
  type EventoDeAcao,
  type EventoTracado,
  type PontoTracado,
  type TipoPonteiro,
  type Traco,
} from '@/features/captura/eventos-tracado';
import type { Dimensoes, QuadroDesenhoProps } from '@/features/captura/quadro-desenho';

export type RegistroTracado = {
  /** Início da tarefa no relógio do aparelho, em milissegundos desde 1970. */
  iniciadoEm: number;
  /** Tudo o que aconteceu no quadro, inclusive os traços desfeitos e apagados. */
  eventos: readonly EventoTracado[];
  /** Os traços que valem no desenho. */
  tracos: readonly Traco[];
  /** Tamanho do quadro na tela, que dá a escala das coordenadas. Nulo até o quadro aparecer. */
  dimensoes: Dimensoes | null;
  temTraco: boolean;
  /** Tira o último traço do desenho e registra o desfazer. Sem traço, não faz nada. */
  desfazer: () => void;
  /** Tira todos os traços do desenho e registra o limpar. Sem traço, não faz nada. */
  limpar: () => void;
  /** Começa outra tarefa no mesmo quadro: zera o registro e o relógio da tarefa. */
  reiniciar: () => void;
  /** Propriedades para repassar ao `QuadroDesenho`. */
  quadro: Pick<QuadroDesenhoProps, 'tracos' | 'onTracoConcluido' | 'onDimensoes'>;
};

export function useRegistroTracado(): RegistroTracado {
  const [iniciadoEm, setIniciadoEm] = useState(() => Date.now());
  const [eventos, setEventos] = useState<EventoTracado[]>([]);
  const [dimensoes, setDimensoes] = useState<Dimensoes | null>(null);

  const tracos = useMemo(() => reconstruirTracos(eventos), [eventos]);

  // O quadro entrega os pontos no relógio do aparelho; o registro conta o tempo
  // desde o início da tarefa (documento de arquitetura, seção 8.4).
  function registrarTraco(pontos: PontoTracado[], ponteiro: TipoPonteiro) {
    const relativos = pontos.map((ponto) => ({ ...ponto, instante: ponto.instante - iniciadoEm }));
    setEventos((anteriores) => acrescentarTraco(anteriores, relativos, ponteiro));
  }

  function registrarAcao(tipo: EventoDeAcao['tipo']) {
    const instante = Date.now() - iniciadoEm;
    setEventos((anteriores) =>
      reconstruirTracos(anteriores).length === 0
        ? anteriores
        : acrescentarAcao(anteriores, tipo, instante),
    );
  }

  return {
    iniciadoEm,
    eventos,
    tracos,
    dimensoes,
    temTraco: tracos.length > 0,
    desfazer: () => registrarAcao('desfazer'),
    limpar: () => registrarAcao('limpar'),
    reiniciar: () => {
      setEventos([]);
      setIniciadoEm(Date.now());
    },
    quadro: { tracos, onTracoConcluido: registrarTraco, onDimensoes: setDimensoes },
  };
}
