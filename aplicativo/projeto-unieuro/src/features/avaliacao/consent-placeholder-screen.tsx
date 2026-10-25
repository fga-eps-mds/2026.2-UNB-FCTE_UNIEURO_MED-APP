import { useRouter } from 'expo-router';

import PlaceholderScreen from '@/features/avaliacao/placeholder-screen';
import { valorDoParametro, type ParametroDeRota } from '@/features/avaliacao/tarefas';

export const CONSENT_PENDING_MESSAGE =
  'Atendimento registrado. A apresentação e o aceite do termo de consentimento ainda estão em construção.';

/**
 * Destino provisório do registro do atendimento (#7). A tela do termo de
 * consentimento é a história #21. Até ela existir, esta tela confirma que o
 * atendimento foi gravado e leva de volta ao início. Também oferece o botão
 * provisório "Iniciar as tarefas", que abre a instrução da tarefa 1 (#8) para o
 * atendimento recebido; a #21 passa a abri-la depois do aceite do termo.
 */
export default function ConsentPlaceholderScreen({
  atendimento,
}: Readonly<{
  atendimento: ParametroDeRota;
}>) {
  const router = useRouter();
  const atendimentoId = valorDoParametro(atendimento);

  return (
    <PlaceholderScreen
      title="Termo de consentimento"
      message={CONSENT_PENDING_MESSAGE}
      action={
        atendimentoId
          ? {
              label: 'Iniciar as tarefas',
              onPress: () =>
                router.replace({
                  pathname: '/instrucao',
                  params: { atendimento: atendimentoId, tarefa: '1' },
                }),
            }
          : undefined
      }
    />
  );
}
