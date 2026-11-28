import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useSession } from '@/features/auth/session';
import {
  toLinhaConta,
  type ContasRepository,
  type LinhaConta,
} from '@/features/superusuario/contas';

/**
 * Contas dos profissionais para a tabela da área do superusuário.
 * Se o profissional da sessão não for superusuário ativo, o banco devolve a lista vazia.
 *
 */
export function useContas(repository: ContasRepository) {
  const { professional } = useSession();
  const professionalId = professional?.id ?? null;
  const [contas, setContas] = useState<LinhaConta[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  // Profissional cuja primeira leitura já terminou: até lá, a tabela mostra que está
  // carregando, e não "nenhuma conta".
  const [loadedFor, setLoadedFor] = useState<number | null>(null);

  // `vale` diz se o resultado ainda serve para a tela quando a leitura termina.
  const ler = useCallback(
    (id: number, vale: () => boolean) => {
      repository
        .listAccounts(id)
        .then((list) => {
          if (!vale()) return;
          setContas(list.map(toLinhaConta));
          setLoadFailed(false);
          setLoadedFor(id);
        })
        .catch(() => {
          if (!vale()) return;
          setLoadFailed(true);
          setLoadedFor(id);
        });
    },
    [repository],
  );

  useFocusEffect(
    useCallback(() => {
      if (professionalId === null) {
        setContas([]);
        setLoadFailed(false);
        return;
      }

      // Uma leitura que termina depois de a tela perder o foco não sobrescreve a lista.
      let current = true;
      ler(professionalId, () => current);
      return () => {
        current = false;
      };
    }, [professionalId, ler]),
  );

  // Depois de uma ação na área, como desativar uma conta, a tabela mostra o que o banco
  // gravou. A tabela continua na tela enquanto lê, sem voltar a "carregando".
  const recarregar = useCallback(() => {
    if (professionalId !== null) ler(professionalId, () => true);
  }, [professionalId, ler]);

  const loading = professionalId !== null && loadedFor !== professionalId;

  return { contas, loading, loadFailed, recarregar };
}
