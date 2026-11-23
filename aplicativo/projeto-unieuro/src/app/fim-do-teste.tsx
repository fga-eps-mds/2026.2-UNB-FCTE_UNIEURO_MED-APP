import { useLocalSearchParams } from 'expo-router';

import { professionalCpfRepository } from '@/features/avaliacao/composition';
import { valorDoParametro } from '@/features/avaliacao/tarefas';
import TelaFinalScreen from '@/features/avaliacao/tela-final-screen';

// Tela final do paciente (#11). O fluxo das três tarefas (#9) chega aqui depois
// da última tarefa; o CPF protegido é lido somente no momento da confirmação.
// O número do exame segue para a análise do modelo depois da confirmação (#12).
const exameIdDe = (param: string | string[] | undefined) => {
  const valor = valorDoParametro(param);
  return valor !== undefined && /^\d+$/.test(valor) ? Number(valor) : null;
};

export default function FimDoTesteRoute() {
  const { atendimento } = useLocalSearchParams<{ atendimento?: string }>();
  return (
    <TelaFinalScreen repository={professionalCpfRepository} exameId={exameIdDe(atendimento)} />
  );
}
