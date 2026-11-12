import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CredentialsRepository } from '@/features/auth/authentication';
import { FeedbackMessage } from '@/features/auth/feedback-message';
import { returnToLogin, useSession } from '@/features/auth/session';
import { confirmarProfissional } from '@/features/avaliacao/confirmacao-profissional';
import {
  proximaTarefa,
  ROTULO_MOTIVO,
  type ExameInterrompido,
  type RetomadaResultado,
} from '@/features/avaliacao/interrupcao';
import { createInterrupcaoStyles } from '@/features/avaliacao/interrupcao.styles';
import {
  obterTarefa,
  TOTAL_TAREFAS,
  valorDoParametro,
  type ParametroDeRota,
} from '@/features/avaliacao/tarefas';
import { useSemVoltar } from '@/features/avaliacao/use-sem-voltar';

export const TITULO_INTERROMPIDO = 'Exame interrompido';
export const SEM_ANALISE = 'Sem análise do modelo: ele precisa dos três desenhos.';
export const AVISO_LOCAL = 'Nenhum dado sai deste aparelho.';
export const BOTAO_RETOMAR = 'Retomar exame';
export const BOTAO_PROFISSIONAL = 'Sou o profissional de saúde';
export const FALHA_AO_CARREGAR = 'Não foi possível abrir o exame interrompido.';
export const FALHA_AO_RETOMAR = 'Não foi possível retomar o exame. Tente de novo.';
export const FALHA_NA_CONFERENCIA = 'Não foi possível conferir a senha agora. Tente novamente.';

type ExameInterrompidoScreenProps = {
  /** Parâmetro `atendimento` da rota: o exame que acabou de ser interrompido. */
  atendimento: ParametroDeRota;
  repository: CredentialsRepository;
  carregar: (atendimentoId: number, profissionalId: number) => Promise<ExameInterrompido | null>;
  retomar: (atendimentoId: number, profissionalId: number) => Promise<RetomadaResultado>;
  /** Abre a instrução da tarefa em que o exame continua. */
  onRetomado: (tarefa: number) => void;
};

type Carga =
  | { estado: 'carregando' }
  | { estado: 'pronto'; exame: ExameInterrompido }
  | { estado: 'falhou' };

function descreverTarefa(numero: number) {
  const titulo = obterTarefa(String(numero))?.titulo;
  return titulo ? `Parou na tarefa ${numero}: ${titulo}` : `Parou na tarefa ${numero}`;
}

function Item({ texto, icone }: Readonly<{ texto: string; icone: 'check' | 'information' }>) {
  const styles = useMemo(() => createInterrupcaoStyles(), []);
  return (
    <View style={styles.item}>
      <MaterialCommunityIcons
        accessibilityElementsHidden
        importantForAccessibility="no"
        name={icone === 'check' ? 'check-circle-outline' : 'information-outline'}
        size={26}
        color={styles.paradaRotulo.color}
      />
      <Text style={styles.itemTexto}>{texto}</Text>
    </View>
  );
}

/**
 * Tela depois da desistência (#25). Ainda pode estar nas mãos do paciente, então
 * não mostra resultado e só volta à área do profissional com a senha dele, como
 * a tela final (#11). "Retomar exame" continua na primeira tarefa sem desenho.
 */
export default function ExameInterrompidoScreen({
  atendimento,
  repository,
  carregar,
  retomar,
  onRetomado,
}: Readonly<ExameInterrompidoScreenProps>) {
  const router = useRouter();
  const { professional } = useSession();
  const styles = useMemo(() => createInterrupcaoStyles(), []);
  const atendimentoId = Number(valorDoParametro(atendimento));
  const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
  const [retomando, setRetomando] = useState(false);
  const [falhaRetomada, setFalhaRetomada] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  useSemVoltar();

  const profissionalId = professional?.id;

  useEffect(() => {
    if (profissionalId === undefined) {
      returnToLogin(router);
      return;
    }
    let ativo = true;
    carregar(atendimentoId, profissionalId)
      .then((exame) => {
        if (!ativo) return;
        if (exame) setCarga({ estado: 'pronto', exame });
        else router.replace('/menu');
      })
      .catch(() => {
        if (ativo) setCarga({ estado: 'falhou' });
      });
    return () => {
      ativo = false;
    };
  }, [atendimentoId, carregar, profissionalId, router]);

  if (!professional) return null;

  async function retomarExame() {
    if (!professional || retomando) return;
    setRetomando(true);
    setFalhaRetomada(false);
    try {
      const resultado = await retomar(atendimentoId, professional.id);
      if (resultado.retomado) {
        onRetomado(resultado.tarefa);
        return;
      }
      setFalhaRetomada(true);
    } catch {
      setFalhaRetomada(true);
    } finally {
      setRetomando(false);
    }
  }

  async function confirmar() {
    if (!professional || conferindo) return;
    try {
      setConferindo(true);
      const resultado = await confirmarProfissional(senha, professional, repository);
      if (resultado.confirmado) {
        router.dismissTo('/menu');
        return;
      }
      setSenha('');
      setErro(resultado.mensagem);
    } catch {
      setErro(FALHA_NA_CONFERENCIA);
    } finally {
      setConferindo(false);
    }
  }

  function cancelar() {
    setConfirmando(false);
    setSenha('');
    setErro(null);
  }

  const exame = carga.estado === 'pronto' ? carga.exame : null;
  const podeRetomar = exame !== null && proximaTarefa(exame.tarefasGravadas) !== null;

  return (
    <SafeAreaView style={styles.tela}>
      <View style={styles.barra}>
        <Text numberOfLines={1} style={styles.barraPaciente}>
          {exame ? `${exame.nomePaciente} · Ficha ${exame.fichaPaciente}` : ' '}
        </Text>
        <Text style={styles.barraEstado}>{TITULO_INTERROMPIDO}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.conteudo}>
        <View style={styles.cartao}>
          <Text accessibilityRole="header" style={styles.cartaoTitulo}>
            {TITULO_INTERROMPIDO}
          </Text>

          {carga.estado === 'carregando' && <ActivityIndicator size="large" />}
          {carga.estado === 'falhou' && (
            <FeedbackMessage kind="error" message={FALHA_AO_CARREGAR} />
          )}
          {exame && (
            <>
              <Item
                icone="check"
                texto={
                  exame.motivo
                    ? `Desistência registrada. Motivo: ${ROTULO_MOTIVO[exame.motivo]}.`
                    : 'Desistência registrada, sem motivo informado.'
                }
              />
              <Item icone="check" texto={descreverTarefa(exame.tarefa)} />
              <Item
                icone="check"
                texto={`${exame.tarefasGravadas.length} de ${TOTAL_TAREFAS} desenhos salvos`}
              />
              <Item icone="information" texto={SEM_ANALISE} />
            </>
          )}

          <Text style={styles.aviso}>{AVISO_LOCAL}</Text>

          {falhaRetomada && <FeedbackMessage kind="error" message={FALHA_AO_RETOMAR} />}

          {confirmando ? (
            <>
              <Text style={styles.rotulo} nativeID="senha-profissional-interrompido">
                Senha do profissional
              </Text>
              <TextInput
                accessibilityLabel="Senha do profissional"
                accessibilityLabelledBy="senha-profissional-interrompido"
                autoFocus
                onChangeText={(texto) => {
                  setSenha(texto);
                  setErro(null);
                }}
                onSubmitEditing={confirmar}
                secureTextEntry
                style={styles.campo}
                value={senha}
              />
              {erro && <FeedbackMessage kind="error" message={erro} />}
              <View style={styles.acoes}>
                <Pressable
                  accessibilityRole="button"
                  onPress={cancelar}
                  style={({ pressed }) => [styles.botaoSecundario, pressed && styles.pressionado]}>
                  <Text style={styles.botaoSecundarioTexto}>Cancelar</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ busy: conferindo, disabled: conferindo }}
                  disabled={conferindo}
                  onPress={confirmar}
                  style={({ pressed }) => [styles.botaoPrincipal, pressed && styles.pressionado]}>
                  <Text style={styles.botaoPrincipalTexto}>
                    {conferindo ? 'Conferindo...' : 'Confirmar'}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.acoes}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setConfirmando(true)}
                style={({ pressed }) => [styles.botaoSecundario, pressed && styles.pressionado]}>
                <Text style={styles.botaoSecundarioTexto}>{BOTAO_PROFISSIONAL}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: retomando, disabled: !podeRetomar || retomando }}
                disabled={!podeRetomar || retomando}
                onPress={retomarExame}
                style={({ pressed }) => [
                  styles.botaoPrincipal,
                  (!podeRetomar || retomando) && styles.desabilitado,
                  pressed && styles.pressionado,
                ]}>
                <Text style={styles.botaoPrincipalTexto}>{BOTAO_RETOMAR}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
