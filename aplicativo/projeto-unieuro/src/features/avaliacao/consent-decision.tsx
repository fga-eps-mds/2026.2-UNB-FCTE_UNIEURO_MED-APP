import { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ConfirmarRecusa } from '@/features/avaliacao/confirm-refusal-dialog';
import { createDecisaoStyles } from '@/features/avaliacao/consent-decision.styles';
import type { Traco } from '@/features/captura/eventos-tracado';
import { QuadroDesenho, type Dimensoes } from '@/features/captura/quadro-desenho';
import { useRegistroTracado } from '@/features/captura/use-registro-tracado';
import { useTheme } from '@/hooks/use-theme';

export type AssinaturaTermo = {
  tracos: readonly Traco[];
  dimensoes: Dimensoes;
};

type DecisaoTermoProps = {
  onAssinar: (assinatura: AssinaturaTermo) => void | Promise<void>;
  onRecusar: () => void | Promise<void>;
};

const CONVITE = 'Assine aqui com a caneta';
const DICA_ASSINAR = 'Assine na área acima para continuar';

export function DecisaoTermo({ onAssinar, onRecusar }: DecisaoTermoProps) {
  const theme = useTheme();
  const styles = useMemo(() => createDecisaoStyles(theme), [theme]);
  const registro = useRegistroTracado();
  const [confirmandoRecusa, setConfirmandoRecusa] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const emCurso = useRef(false);

  const podeAssinar = registro.temTraco && registro.dimensoes !== null && !ocupado;

  async function executar(acao: () => void | Promise<void>) {
    if (emCurso.current) return;
    emCurso.current = true;
    setOcupado(true);
    try {
      await acao();
    } catch {
      emCurso.current = false;
      setOcupado(false);
    }
  }

  function assinar() {
    if (!registro.dimensoes) return;
    const assinatura = { tracos: registro.tracos, dimensoes: registro.dimensoes };
    void executar(() => onAssinar(assinatura));
  }

  return (
    <View style={styles.raiz}>
      <View style={styles.areaAssinatura}>
        <QuadroDesenho
          {...registro.quadro}
          rotulo="Área de assinatura"
          dica="Assine com a caneta ou com o dedo"
          desabilitado={ocupado}
        />
        {!registro.temTraco && (
          <View pointerEvents="none" style={styles.convite}>
            <Text style={styles.conviteTexto}>{CONVITE}</Text>
          </View>
        )}
      </View>

      <View style={styles.botoes}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: ocupado }}
          disabled={ocupado}
          onPress={() => setConfirmandoRecusa(true)}
          style={({ pressed }) => [
            styles.botaoRecusar,
            pressed && styles.botaoPressionado,
            ocupado && styles.botaoOcupado,
          ]}>
          <Text style={styles.botaoRecusarTexto}>Recusar</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !podeAssinar }}
          accessibilityHint={registro.temTraco ? undefined : DICA_ASSINAR}
          disabled={!podeAssinar}
          onPress={assinar}
          style={({ pressed }) => [
            styles.botaoPrincipal,
            pressed && styles.botaoPrincipalPressionado,
            !podeAssinar && styles.botaoPrincipalDesabilitado,
          ]}>
          <Text
            style={[
              styles.botaoPrincipalTexto,
              !podeAssinar && styles.botaoPrincipalTextoDesabilitado,
            ]}>
            Assinar e iniciar
          </Text>
        </Pressable>
      </View>

      <ConfirmarRecusa
        visible={confirmandoRecusa}
        ocupado={ocupado}
        onVoltar={() => setConfirmandoRecusa(false)}
        onConfirmar={() => void executar(onRecusar)}
        styles={styles}
      />
    </View>
  );
}
