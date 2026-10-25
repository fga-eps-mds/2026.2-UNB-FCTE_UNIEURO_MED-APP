import { credentialsRepository } from '@/features/auth/composition';
import TelaFinalScreen from '@/features/avaliacao/tela-final-screen';

// Tela final do paciente (#11). O fluxo das três tarefas (#9) chega aqui depois
// da última tarefa; a confirmação do profissional usa a mesma conferência do login.
export default function FimDoTesteRoute() {
  return <TelaFinalScreen repository={credentialsRepository} />;
}
