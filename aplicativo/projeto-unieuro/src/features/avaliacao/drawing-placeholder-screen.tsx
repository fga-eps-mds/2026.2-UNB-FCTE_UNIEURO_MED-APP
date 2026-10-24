import PlaceholderScreen from '@/features/avaliacao/placeholder-screen';

export const DRAWING_PENDING_MESSAGE = 'A área de desenho desta tarefa ainda está em construção.';

/**
 * Destino provisório do botão "Começar" da instrução (#8). As telas de desenho de
 * cada tarefa são histórias à parte. Até elas existirem, esta tela avisa que o
 * desenho ainda não está pronto e leva de volta ao início.
 */
export default function DrawingPlaceholderScreen() {
  return <PlaceholderScreen title="Área de desenho" message={DRAWING_PENDING_MESSAGE} />;
}
