import { useEffect } from 'react';
import { BackHandler } from 'react-native';

/**
 * Desliga o botão voltar do Android nas telas do paciente (instrução e desenho).
 *
 * O "Novo exame" abre com `push`, e daí em diante cada tela troca a anterior com
 * `replace`. Por isso, durante as tarefas, a tela de baixo na pilha é a tela inicial
 * do profissional, com a lista dos pacientes: o voltar levaria o paciente até ela,
 * sem a senha do profissional. Com o gancho, o toque no voltar não faz nada.
 */
export function useSemVoltar() {
  useEffect(() => {
    const inscricao = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => inscricao.remove();
  }, []);
}
