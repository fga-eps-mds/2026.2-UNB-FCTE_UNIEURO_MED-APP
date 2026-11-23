import { useEffect, useState } from 'react';

import { useSession } from '@/features/auth/session';
import {
  analisarExame,
  type DependenciasDaAnalise,
  type EtapaDaAnalise,
  type ResultadoDaAnalise,
} from '@/features/inferencia/analise';

export type EstadoDaAnalise = {
  etapa: EtapaDaAnalise | null;
  paciente: { nome: string; ficha: string } | null;
  resultado: ResultadoDaAnalise | null;
};

const INICIAL: EstadoDaAnalise = { etapa: null, paciente: null, resultado: null };

type AoAvancar = NonNullable<DependenciasDaAnalise['aoAvancar']>;
type Execucao = { promessa: Promise<ResultadoDaAnalise>; ouvintes: Set<AoAvancar> };

// Um cálculo por exame de cada vez: a tela montada de novo, ou o efeito repetido pelo React,
// acompanha o cálculo que já está rodando em vez de abrir outro com o modelo de 185 MB.
const execucoes = new Map<string, Execucao>();

function acompanhar(
  chave: string,
  rodar: (aoAvancar: AoAvancar) => Promise<ResultadoDaAnalise>,
): Execucao {
  const existente = execucoes.get(chave);
  if (existente) return existente;
  const ouvintes = new Set<AoAvancar>();
  const promessa = rodar((etapa, exame) => {
    for (const ouvinte of ouvintes) ouvinte(etapa, exame);
  }).finally(() => execucoes.delete(chave));
  const execucao = { promessa, ouvintes };
  execucoes.set(chave, execucao);
  return execucao;
}

/**
 * Roda a análise do exame uma vez por abertura da tela (#12). `tentativa` muda quando o
 * profissional pede para calcular de novo depois de um erro.
 */
export function useAnalise(
  dependencias: DependenciasDaAnalise,
  exameId: number | null,
  tentativa: number,
): EstadoDaAnalise {
  const { professional } = useSession();
  const profissionalId = professional?.id ?? null;
  const chave = profissionalId !== null && exameId !== null ? `${profissionalId}:${exameId}` : null;
  // O estado guarda a tentativa a que pertence: uma tentativa nova começa do zero sem limpar o
  // estado dentro do efeito.
  const [estado, setEstado] = useState<EstadoDaAnalise & { de: string | null }>({
    ...INICIAL,
    de: null,
  });
  const tentativaAtual = chave === null ? null : `${chave}:${tentativa}`;

  useEffect(() => {
    if (profissionalId === null || exameId === null || chave === null) return;
    // O cálculo continua se a tela sair, porque o resultado é gravado no banco; só a tela
    // para de ser atualizada.
    let atual = true;
    const de = `${chave}:${tentativa}`;
    const atualizar = (mudanca: Partial<EstadoDaAnalise>) =>
      setEstado((anterior) => ({ ...(anterior.de === de ? anterior : INICIAL), ...mudanca, de }));
    const ouvinte: AoAvancar = (etapa, exame) => {
      if (atual)
        atualizar({ etapa, paciente: { nome: exame.patientName, ficha: exame.recordNumber } });
    };
    const execucao = acompanhar(chave, (aoAvancar) =>
      analisarExame(profissionalId, exameId, { ...dependencias, aoAvancar }),
    );
    execucao.ouvintes.add(ouvinte);
    execucao.promessa.then(
      (resultado) => {
        if (atual) atualizar({ resultado });
      },
      () => {
        if (atual) {
          atualizar({
            resultado: { situacao: 'erro', mensagem: 'Não foi possível ler o exame no tablet.' },
          });
        }
      },
    );
    return () => {
      atual = false;
      execucao.ouvintes.delete(ouvinte);
    };
  }, [dependencias, profissionalId, exameId, chave, tentativa]);

  if (exameId === null) return { ...INICIAL, resultado: { situacao: 'nao-encontrado' } };
  const { de, ...visivel } = estado;
  return de === tentativaAtual ? visivel : INICIAL;
}
