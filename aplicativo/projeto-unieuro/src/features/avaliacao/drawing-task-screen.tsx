import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { returnToLogin, useSession } from '@/features/auth/session';
import { CubeFigure } from '@/features/avaliacao/cube-figure';
import {
  DICA_CONFIRMAR,
  LEMBRETES,
  mostraFiguraDoCubo,
  temTelaDeDesenho,
} from '@/features/avaliacao/drawing-task';
import { CORES_DA_TAREFA, createDrawingTaskStyles } from '@/features/avaliacao/drawing-task.styles';
import {
  obterTarefa,
  valorDoParametro,
  type ParametroDeRota,
  type Tarefa,
} from '@/features/avaliacao/tarefas';
import { TaskTopBar } from '@/features/avaliacao/task-top-bar';
import { useSemVoltar } from '@/features/avaliacao/use-sem-voltar';
import { QuadroDesenho } from '@/features/captura/quadro-desenho';
import { useRegistroTracado, type RegistroTracado } from '@/features/captura/use-registro-tracado';

export type DrawingTaskScreenProps = {
  /** Parâmetro `tarefa` da rota: 1 (relógio) ou 2 (cubo). */
  tarefa: ParametroDeRota;
  /** Parâmetro `atendimento` da rota: a avaliação em andamento. */
  atendimento: ParametroDeRota;
  /**
   * Recebe o desenho confirmado. Quem navega decide o destino, e a captura do
   * traçado (#10) grava o registro a partir daqui.
   */
  onConfirmar: (tarefa: Tarefa, registro: RegistroTracado) => void;
};

/**
 * Tela de desenho do relógio e da cópia do cubo (história #9): o lembrete da tarefa,
 * o quadro de desenho e o "Confirmar", que só habilita depois do primeiro traço. Na
 * cópia do cubo, a figura de modelo fica ao lado do quadro durante toda a tarefa.
 *
 * Sem médico logado, volta ao login. Sem avaliação em andamento ou com uma tarefa
 * que não tem esta tela, volta ao início. O botão voltar do Android não sai da tarefa.
 */
export default function DrawingTaskScreen({
  tarefa: tarefaParam,
  atendimento,
  onConfirmar,
}: Readonly<DrawingTaskScreenProps>) {
  const router = useRouter();
  const { professional } = useSession();
  const styles = useMemo(() => createDrawingTaskStyles(), []);
  const registro = useRegistroTracado();
  // O segundo toque em "Confirmar" antes de a tela sair pularia uma tarefa.
  const confirmou = useRef(false);
  const [confirmado, setConfirmado] = useState(false);
  useSemVoltar();

  const tarefa = obterTarefa(tarefaParam);
  const valida = tarefa !== null && temTelaDeDesenho(tarefa);
  const emAndamento = Boolean(valorDoParametro(atendimento));

  useEffect(() => {
    if (!professional) returnToLogin(router);
    else if (!valida || !emAndamento) router.replace('/menu');
  }, [professional, valida, emAndamento, router]);

  if (!professional || !tarefa || !valida || !emAndamento) return null;

  const lembrete = LEMBRETES[tarefa.numero];
  const podeConfirmar = registro.temTraco && !confirmado;

  const confirmar = () => {
    if (confirmou.current) return;
    confirmou.current = true;
    setConfirmado(true);
    onConfirmar(tarefa, registro);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <TaskTopBar numero={tarefa.numero} cores={CORES_DA_TAREFA} />

      <View style={styles.corpo}>
        <View style={styles.ferramentas}>
          <View style={styles.lembrete}>
            <Text accessibilityRole="header" style={styles.lembreteTitulo}>
              {lembrete.titulo}
            </Text>
            <Text style={styles.lembreteFrase}>{lembrete.frase}</Text>
          </View>

          <View style={styles.confirmar}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !podeConfirmar }}
              accessibilityHint={registro.temTraco ? undefined : DICA_CONFIRMAR}
              disabled={!podeConfirmar}
              onPress={confirmar}
              style={({ pressed }) => [
                styles.botaoConfirmar,
                pressed && styles.botaoConfirmarPressionado,
                !podeConfirmar && styles.botaoConfirmarDesabilitado,
              ]}>
              <Text
                style={[
                  styles.textoConfirmar,
                  !podeConfirmar && styles.textoConfirmarDesabilitado,
                ]}>
                Confirmar
              </Text>
            </Pressable>
            {/* Depois do primeiro traço a dica some, mas continua ocupando o mesmo
                espaço: se o quadro mudasse de tamanho no meio do desenho, mudaria a
                escala das coordenadas. */}
            <Text
              accessibilityElementsHidden={registro.temTraco}
              importantForAccessibility={registro.temTraco ? 'no-hide-descendants' : 'auto'}
              style={[styles.dica, registro.temTraco && styles.dicaOculta]}>
              {DICA_CONFIRMAR}
            </Text>
          </View>
        </View>

        <View style={styles.area}>
          {mostraFiguraDoCubo(tarefa) && (
            <View style={styles.modelo}>
              <Text style={styles.modeloTitulo}>Copie esta figura</Text>
              <View style={styles.figura}>
                <CubeFigure />
              </View>
            </View>
          )}
          <View style={styles.quadro}>
            <QuadroDesenho
              {...registro.quadro}
              rotulo={`Área de desenho: ${lembrete.titulo.toLowerCase()}`}
              desabilitado={confirmado}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
