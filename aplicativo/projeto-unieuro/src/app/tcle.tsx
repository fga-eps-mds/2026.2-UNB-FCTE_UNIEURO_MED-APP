import { useLocalSearchParams } from 'expo-router';

import ConsentFlowScreen from '@/features/avaliacao/consent-flow-screen';

export default function ConsentRoute() {
  const { atendimento } = useLocalSearchParams<{ atendimento?: string }>();

  return <ConsentFlowScreen atendimento={atendimento} />;
}
