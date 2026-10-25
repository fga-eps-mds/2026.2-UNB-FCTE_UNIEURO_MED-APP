import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import InstructionScreen from '@/features/avaliacao/instruction-screen';
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
      onStart={(escolhida) =>
        router.replace({
          pathname: '/desenho',
          params: { atendimento: String(atendimento), tarefa: String(escolhida.numero) },
        })
      }
    />
  );
}
