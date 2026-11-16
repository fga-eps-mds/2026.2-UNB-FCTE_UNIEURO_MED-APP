import { FeedbackMessage } from '@/features/auth/feedback-message';
import { describeFailure, type SyncFailure } from '@/features/sincronizacao/error-codes';

/** "Senha incorreta (Cód. de Erro: 202)" e, embaixo, o que fazer. */
export function FailureMessage({ failure }: { failure: SyncFailure }) {
  const { headline, action, spoken, warning } = describeFailure(failure);
  return (
    <FeedbackMessage
      kind={warning ? 'info' : 'error'}
      message={headline}
      detail={action}
      spoken={spoken}
    />
  );
}
