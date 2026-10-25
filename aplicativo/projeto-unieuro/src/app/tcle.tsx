import { useLocalSearchParams } from 'expo-router';

import { registerConsentDecision } from '@/features/avaliacao/composition';
import TcleScreen from '@/features/avaliacao/tcle-screen';

// Termo de consentimento (#21), aberto depois do registro do atendimento. A
// decisão fica gravada no tablet antes de qualquer tarefa de desenho.
export default function ConsentRoute() {
  const { atendimento } = useLocalSearchParams<{ atendimento?: string }>();

  return <TcleScreen atendimento={atendimento} registrar={registerConsentDecision} />;
}
