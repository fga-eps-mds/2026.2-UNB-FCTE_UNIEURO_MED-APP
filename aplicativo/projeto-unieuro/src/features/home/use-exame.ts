import { useEffect, useState } from 'react';

import { useSession } from '@/features/auth/session';
import { paraConsulta, type ExameDaConsulta, type ExameRepository } from '@/features/home/exame';

// Os estados que a tela trata
export type EstadoDoExame =
  | { status: 'carregando' }
  | { status: 'pronto'; exame: ExameDaConsulta }
  | { status: 'nao-encontrado' }
  | { status: 'falhou' };

const CARREGANDO: EstadoDoExame = { status: 'carregando' };
const NAO_ENCONTRADO: EstadoDoExame = { status: 'nao-encontrado' };

/**
 * O exame de outro profissional aparece como não encontrado, igual a um id que não
 * existe. Sem id válido na rota, nem consulta o banco.
 */
export function useExame(repository: ExameRepository, atendimentoId: number | null): EstadoDoExame {
  const { professional } = useSession();
  const professionalId = professional?.id ?? null;
  const chave =
    professionalId !== null && atendimentoId !== null ? `${professionalId}:${atendimentoId}` : null;
  // Guarda de qual leitura veio, para não mostrar o exame anterior ao trocar de exame ou de sessão.
  const [resultado, setResultado] = useState<{ chave: string; estado: EstadoDoExame } | null>(null);

  // o exame consultado não muda enquanto a tela está aberta.
  useEffect(() => {
    if (professionalId === null || atendimentoId === null) return;

    // A leitura que termina depois de a tela sair não altera o estado.
    let atual = true;
    const chaveDaLeitura = `${professionalId}:${atendimentoId}`;
    repository
      .buscarExame(professionalId, atendimentoId)
      .then((exame) => {
        if (!atual) return;
        setResultado({
          chave: chaveDaLeitura,
          estado: exame ? { status: 'pronto', exame: paraConsulta(exame) } : NAO_ENCONTRADO,
        });
      })
      // A falha do banco vira a faixa de erro da tela
      .catch(() => {
        if (atual) setResultado({ chave: chaveDaLeitura, estado: { status: 'falhou' } });
      });
    return () => {
      atual = false;
    };
  }, [professionalId, atendimentoId, repository]);

  if (atendimentoId === null) return NAO_ENCONTRADO;
  if (resultado === null || resultado.chave !== chave) return CARREGANDO;
  return resultado.estado;
}
