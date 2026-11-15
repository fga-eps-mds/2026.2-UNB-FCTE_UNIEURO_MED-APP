import { useLocalSearchParams } from 'expo-router';

import { exameRepository } from '@/features/home/composition';
import { lerAtendimento } from '@/features/home/exame';
import { useExame } from '@/features/home/use-exame';
import VerExameScreen from '@/features/home/ver-exame-screen';

// A tela de exames do paciente abre por `/exame?atendimento=ID`. A rota só
// liga o repositório da composição ao hook, sem acessar o banco.
export default function ExameRoute() {
  const { atendimento } = useLocalSearchParams<{ atendimento?: string }>();
  const estado = useExame(exameRepository, lerAtendimento(atendimento));
  return <VerExameScreen estado={estado} />;
}
