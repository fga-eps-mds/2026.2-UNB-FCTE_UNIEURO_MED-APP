import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';

import {
  AreaAssinatura,
  BotoesDecisao,
  DecisaoTermoProvider,
} from '@/features/avaliacao/consent-decision';
import {
  aceitarTermo,
  recusarTermo,
  type DestinoDaDecisao,
  type RegistrarDecisao,
} from '@/features/avaliacao/decisao-do-termo';
import { TAREFAS, valorDoParametro, type ParametroDeRota } from '@/features/avaliacao/tarefas';
import TermoConsentimentoScreen from '@/features/avaliacao/termo-consentimento-screen';
import { useConsentGate } from '@/features/avaliacao/use-consent-gate';

type TcleScreenProps = {
  atendimento: ParametroDeRota;
  registrar: RegistrarDecisao;
};

/**
 * Termo de consentimento do atendimento (#21). Só aparece enquanto a avaliação
 * aguarda o consentimento. O aceite abre a instrução da primeira tarefa, e a
 * recusa volta ao início sem abrir nenhuma tarefa. Se a decisão já foi gravada,
 * a tela segue direto para onde ela leva.
 */
export default function TcleScreen({ atendimento, registrar }: Readonly<TcleScreenProps>) {
  const router = useRouter();
  const acesso = useConsentGate(atendimento);
  const atendimentoId = Number(valorDoParametro(atendimento));

  const seguir = useCallback(
    (destino: DestinoDaDecisao) => {
      if (destino === 'tarefas') {
        router.replace({
          pathname: '/instrucao',
          params: { atendimento: String(atendimentoId), tarefa: String(TAREFAS[0].numero) },
        });
      } else {
        // Volta à tela inicial que já está na pilha, sem abrir outra por cima.
        router.dismissTo('/menu');
      }
    },
    [atendimentoId, router],
  );

  useEffect(() => {
    if (acesso === 'liberado') seguir('tarefas');
    else if (acesso === 'bloqueado') seguir('inicio');
  }, [acesso, seguir]);

  if (acesso !== 'aguardando_consentimento') return null;

  // O provider só libera a tela de novo quando a ação falha. Por isso as duas
  // terminam mudando de tela.
  return (
    <DecisaoTermoProvider
      onAssinar={async (assinatura, contexto) =>
        seguir(await aceitarTermo(atendimentoId, assinatura, contexto, registrar))
      }
      onRecusar={async (contexto) =>
        seguir(await recusarTermo(atendimentoId, contexto, registrar))
      }>
      <TermoConsentimentoScreen
        assinatura={<AreaAssinatura />}
        acoes={(contexto) => <BotoesDecisao contexto={contexto} />}
      />
    </DecisaoTermoProvider>
  );
}
