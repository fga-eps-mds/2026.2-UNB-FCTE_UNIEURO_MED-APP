import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import InstructionScreen from '@/features/avaliacao/instruction-screen';
import { valorDoParametro } from '@/features/avaliacao/tarefas';
import { giveUpExam } from '@/features/avaliacao/composition';
import { useConsentGate } from '@/features/avaliacao/use-consent-gate';

// Instrução de cada desenho (#8). O toque em "Começar" segue para a área de
// desenho. O `replace` mantém o fluxo só para a frente: o paciente não volta à
// instrução com o botão voltar.
export default function InstructionRoute() {
  const router = useRouter();
  const { atendimento, tarefa } = useLocalSearchParams<{ atendimento?: string; tarefa?: string }>();
  const acesso = useConsentGate(atendimento);

  useEffect(() => {
    if (acesso === 'aguardando_consentimento') {
      router.replace({ pathname: '/tcle', params: { atendimento: String(atendimento) } });
    } else if (acesso === 'bloqueado') {
      router.replace('/menu');
    }
  }, [acesso, atendimento, router]);

  if (acesso !== 'liberado') return null;

  return (
    <InstructionScreen
      tarefa={tarefa}
      atendimento={atendimento}
      onDesistir={async (atual, motivo) => {
        await giveUpExam({
          atendimentoId: Number(valorDoParametro(atendimento)),
          tarefa: atual.numero,
          motivo,
        });
        router.replace({
          pathname: '/exame-interrompido',
          params: { atendimento: String(atendimento) },
        });
      }}
      onStart={(escolhida) =>
        router.replace({
          pathname: '/desenho',
          params: { atendimento: String(atendimento), tarefa: String(escolhida.numero) },
        })
      }
    />
  );
}
