import { useEffect, useState } from 'react';

import { getTaskAccess } from '@/features/avaliacao/composition';
import { valorDoParametro, type ParametroDeRota } from '@/features/avaliacao/tarefas';
import type { AcessoTarefas } from '@/features/avaliacao/consentimento';

export type EstadoPortaoConsentimento = AcessoTarefas | 'carregando';

/**
 * Consulta o estado persistido antes de renderizar uma instrução ou um quadro de
 * desenho. O cancelamento evita que uma resposta atrasada atualize outra rota.
 */
export function useConsentGate(atendimento: ParametroDeRota): EstadoPortaoConsentimento {
  const valor = valorDoParametro(atendimento);
  const atendimentoId = valor ? Number(valor) : Number.NaN;
  const chave = valor ?? '';
  const [resultado, setResultado] = useState<{
    chave: string;
    acesso: EstadoPortaoConsentimento;
  }>({ chave, acesso: 'carregando' });

  useEffect(() => {
    let ativo = true;

    void getTaskAccess(atendimentoId)
      .then((acesso) => {
        if (ativo) setResultado({ chave, acesso });
      })
      .catch(() => {
        if (ativo) setResultado({ chave, acesso: 'bloqueado' });
      });

    return () => {
      ativo = false;
    };
  }, [atendimentoId, chave]);

  return resultado.chave === chave ? resultado.acesso : 'carregando';
}
