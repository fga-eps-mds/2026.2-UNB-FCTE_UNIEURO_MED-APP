import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { getAttendancePatient, registerConsentDecision } from '@/features/avaliacao/composition';
import {
  AreaAssinatura,
  AvisoDecisao,
  BotoesDecisao,
  DecisaoTermoProvider,
} from '@/features/avaliacao/consent-decision';
import type { ResultadoDecisao } from '@/features/avaliacao/consentimento';
import { valorDoParametro, type ParametroDeRota } from '@/features/avaliacao/tarefas';
import TermoConsentimentoScreen, {
  type ContextoDecisao,
} from '@/features/avaliacao/termo-consentimento-screen';
import { useConsentGate } from '@/features/avaliacao/use-consent-gate';
import { gerarImagemDesenho } from '@/features/captura/imagem-desenho';

export const MENSAGEM_FALHA_DECISAO =
  'Não foi possível registrar a decisão. Nada foi perdido: tente de novo.';

type PacienteDoTermo = { nome: string; ficha: string };

/** O aviso de falha fica logo acima dos botões, fora da rolagem do termo. */
const acoesDoTermo = (contexto: ContextoDecisao) => (
  <>
    <AvisoDecisao />
    <BotoesDecisao contexto={contexto} />
  </>
);

/** Os botões da tela do termo sempre entregam quem assina e a versão; sem isso, não há o que gravar. */
function exigirContexto(contexto: ContextoDecisao | undefined) {
  if (!contexto) throw new Error('A decisão do termo precisa de quem assina e da versão.');
  return contexto;
}

/**
 * Termo de consentimento do atendimento (#21). O termo só aparece enquanto a
 * avaliação aguarda o consentimento, com o nome e a ficha do paciente no
 * cabeçalho. O aceite grava a assinatura em PNG e abre a instrução da primeira
 * tarefa; a recusa grava sem assinatura e volta ao início. Uma falha ao gravar
 * avisa e libera a tela para outra tentativa, sem mudar de tela.
 */
export default function ConsentFlowScreen({
  atendimento,
}: Readonly<{ atendimento: ParametroDeRota }>) {
  const router = useRouter();
  const acesso = useConsentGate(atendimento);
  const atendimentoId = Number(valorDoParametro(atendimento));
  const [paciente, setPaciente] = useState<PacienteDoTermo | undefined>();
  const [aviso, setAviso] = useState<string | null>(null);

  const irParaInstrucao = () =>
    router.replace({
      pathname: '/instrucao',
      params: { atendimento: String(atendimentoId), tarefa: '1' },
    });

  useEffect(() => {
    if (acesso === 'liberado') {
      router.replace({
        pathname: '/instrucao',
        params: { atendimento: String(atendimentoId), tarefa: '1' },
      });
    } else if (acesso === 'bloqueado') {
      // Volta à tela inicial que já está na pilha, sem abrir outra por cima.
      router.dismissTo('/menu');
    }
  }, [acesso, atendimentoId, router]);

  useEffect(() => {
    if (acesso !== 'aguardando_consentimento') return;
    let ativo = true;

    getAttendancePatient(atendimentoId)
      .then((encontrado) => {
        if (ativo && encontrado)
          setPaciente({ nome: encontrado.name, ficha: encontrado.recordNumber });
      })
      .catch(() => undefined);

    return () => {
      ativo = false;
    };
  }, [acesso, atendimentoId]);

  if (acesso !== 'aguardando_consentimento') return null;

  async function decidir(registrar: () => Promise<ResultadoDecisao>, aoRegistrar: () => void) {
    setAviso(null);
    try {
      const resultado = await registrar();
      if (resultado.sucesso) return aoRegistrar();
      if (resultado.motivo === 'decisao_ja_registrada') return irParaInstrucao();
      throw new Error('Atendimento inválido ao registrar a decisão do termo.');
    } catch (error_) {
      setAviso(MENSAGEM_FALHA_DECISAO);
      throw error_;
    }
  }

  return (
    <DecisaoTermoProvider
      aviso={aviso}
      onAssinar={(assinatura, contexto) => {
        const { quemAssina, versaoTermo } = exigirContexto(contexto);
        return decidir(
          () =>
            registerConsentDecision({
              atendimentoId,
              versaoTermo,
              quemAssina,
              aceito: true,
              assinaturaPng: gerarImagemDesenho(assinatura.tracos, assinatura.dimensoes),
            }),
          irParaInstrucao,
        );
      }}
      onRecusar={(contexto) => {
        const { quemAssina, versaoTermo } = exigirContexto(contexto);
        return decidir(
          () => registerConsentDecision({ atendimentoId, versaoTermo, quemAssina, aceito: false }),
          () => router.dismissTo('/menu'),
        );
      }}>
      <TermoConsentimentoScreen
        paciente={paciente}
        assinatura={<AreaAssinatura />}
        acoes={acoesDoTermo}
      />
    </DecisaoTermoProvider>
  );
}
