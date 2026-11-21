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

  useFocusEffect(
    useCallback(() => {
      if (professionalId === null) {
        setContas([]);
        setLoadFailed(false);
        return;
      }

      // Uma leitura que termina depois de a tela perder o foco não sobrescreve a lista.
      let current = true;
      repository
        .listAccounts(professionalId)
        .then((list) => {
          if (!current) return;
          setContas(list.map(toLinhaConta));
          setLoadFailed(false);
          setLoadedFor(professionalId);
        })
        .catch(() => {
          if (!current) return;
          setLoadFailed(true);
          setLoadedFor(professionalId);
        });
      return () => {
        current = false;
      };
    }, [professionalId, repository]),
  );

  const loading = professionalId !== null && loadedFor !== professionalId;

  return { contas, loading, loadFailed };
}
