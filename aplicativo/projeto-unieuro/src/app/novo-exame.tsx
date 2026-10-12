import { useRouter } from 'expo-router';

import { registerAttendanceRepository } from '@/features/avaliacao/composition';
import NewAttendanceScreen from '@/features/avaliacao/new-attendance-screen';

// Registro do atendimento (#7). Depois de gravar, abre o termo de consentimento com
// o id do atendimento. O `replace` tira esta tela da pilha, para o médico não voltar
// a ela e registrar o mesmo atendimento de novo.
export default function NewAttendanceRoute() {
  const router = useRouter();

  return (
    <NewAttendanceScreen
      repository={registerAttendanceRepository}
      onRegistered={(attendanceId) =>
        router.replace({ pathname: '/tcle', params: { atendimento: String(attendanceId) } })
      }
    />
  );
}
