import { professionalCpfRepository } from '@/features/avaliacao/composition';
import TelaFinalScreen from '@/features/avaliacao/tela-final-screen';

// Tela final do paciente (#11). O fluxo das três tarefas (#9) chega aqui depois
// da última tarefa; o CPF protegido é lido somente no momento da confirmação.
export default function FimDoTesteRoute() {
  return <TelaFinalScreen repository={professionalCpfRepository} />;
}
