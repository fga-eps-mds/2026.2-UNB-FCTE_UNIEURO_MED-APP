import { useEffect, useState } from 'react';

import { useSession } from '@/features/auth/session';
import {
  carregarResultado,
  type ResultadoDoExame,
  type ResultadoRepository,
} from '@/features/resultado/resultado';

type Leitura = { chave: string; resultado: ResultadoDoExame | null; falhou: boolean };

/**
 * Resultado do exame para o profissional da sessão (#14). `exameId` é `null` quando o
 * parâmetro da rota não é um número, e a tela mostra "exame não encontrado".
 */
export function useResultado(repository: ResultadoRepository, exameId: number | null) {
  const { professional } = useSession();
  const profissionalId = professional?.id ?? null;
  const chave = profissionalId !== null && exameId !== null ? `${profissionalId}:${exameId}` : null;
  const [leitura, setLeitura] = useState<Leitura | null>(null);

  useEffect(() => {
    if (profissionalId === null || exameId === null) return;
    const chaveLida = `${profissionalId}:${exameId}`;
    // Uma leitura que termina depois de a tela sair ou de a sessão mudar não vale mais.
    let atual = true;
    carregarResultado(profissionalId, exameId, repository).then(
      (resultado) => {
        if (atual) setLeitura({ chave: chaveLida, resultado, falhou: false });
      },
      () => {
        if (atual) setLeitura({ chave: chaveLida, resultado: null, falhou: true });
      },
    );
    return () => {
      atual = false;
    };
  }, [profissionalId, exameId, repository]);

  const ultima = leitura?.chave === chave ? leitura : null;
  return {
    resultado: ultima?.resultado ?? null,
    carregando: chave !== null && ultima === null,
    falhou: ultima?.falhou ?? false,
    naoEncontrado: exameId === null || (ultima !== null && !ultima.falhou && !ultima.resultado),
  };
}
