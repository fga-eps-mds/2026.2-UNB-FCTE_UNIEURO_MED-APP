import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ConfirmarRecusa } from '@/features/avaliacao/confirm-refusal-dialog';
import {
  createDecisaoStyles,
  type DecisaoStyles,
} from '@/features/avaliacao/consent-decision.styles';
import type { ContextoDecisao } from '@/features/avaliacao/termo-consentimento-screen';
import type { Traco } from '@/features/captura/eventos-tracado';
import { QuadroDesenho, type Dimensoes } from '@/features/captura/quadro-desenho';
import { useRegistroTracado } from '@/features/captura/use-registro-tracado';
import { useTheme } from '@/hooks/use-theme';

export type AssinaturaTermo = {
  tracos: readonly Traco[];
  dimensoes: Dimensoes;
};

type DecisaoTermoProviderProps = {
  aviso?: string | null;
  onAssinar: (assinatura: AssinaturaTermo, contexto?: ContextoDecisao) => void | Promise<void>;
  onRecusar: (contexto?: ContextoDecisao) => void | Promise<void>;
  children: ReactNode;
};

type DecisaoContexto = {
  styles: DecisaoStyles;
  temTraco: boolean;
  quadro: ReturnType<typeof useRegistroTracado>['quadro'];
  ocupado: boolean;
  aviso: string | null;
  confirmandoRecusa: boolean;
  podeAssinar: boolean;
  assinar: (contexto?: ContextoDecisao) => void;
  pedirRecusa: (contexto?: ContextoDecisao) => void;
};

const CONVITE = 'Assine aqui com a caneta';
const DICA_ASSINAR = 'Assine na área acima para continuar';

const DecisaoReact = createContext<DecisaoContexto | null>(null);

function useDecisao() {
  const contexto = useContext(DecisaoReact);
  if (!contexto)
    throw new Error('Use a área de assinatura e os botões dentro do DecisaoTermoProvider.');
  return contexto;
}

export function DecisaoTermoProvider({
  aviso = null,
  onAssinar,
  onRecusar,
  children,
}: DecisaoTermoProviderProps) {
  const theme = useTheme();
  const styles = useMemo(() => createDecisaoStyles(theme), [theme]);
  const registro = useRegistroTracado();
  // `null` é a confirmação fechada; aberta, guarda o contexto de quem pediu a recusa.
  const [recusa, setRecusa] = useState<{ contexto?: ContextoDecisao } | null>(null);
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

  function assinar(contexto?: ContextoDecisao) {
    if (!registro.dimensoes) return;
    const assinatura = { tracos: registro.tracos, dimensoes: registro.dimensoes };
    void executar(() => (contexto ? onAssinar(assinatura, contexto) : onAssinar(assinatura)));
  }

  const valor: DecisaoContexto = {
    styles,
    temTraco: registro.temTraco,
    quadro: registro.quadro,
    ocupado,
    aviso,
    confirmandoRecusa: recusa !== null,
    podeAssinar,
    assinar,
    pedirRecusa: (contexto) => setRecusa({ contexto }),
  };

  return (
    <DecisaoReact.Provider value={valor}>
      {children}
      <ConfirmarRecusa
        visible={recusa !== null}
        ocupado={ocupado}
        onVoltar={() => setRecusa(null)}
        onConfirmar={() => {
          const contexto = recusa?.contexto;
          void executar(() => (contexto ? onRecusar(contexto) : onRecusar()));
        }}
        aviso={aviso}
        styles={styles}
      />
    </DecisaoReact.Provider>
  );
}

export function AreaAssinatura() {
  const { styles, quadro, temTraco, ocupado } = useDecisao();

  return (
    <View style={styles.areaAssinatura}>
      <QuadroDesenho
        {...quadro}
        rotulo="Área de assinatura"
        dica="Assine com a caneta ou com o dedo"
        desabilitado={ocupado}
        estiloMoldura={styles.molduraAssinatura}
      />
      {!temTraco && (
        <View pointerEvents="none" style={styles.convite}>
          <Text style={styles.conviteTexto}>{CONVITE}</Text>
        </View>
      )}
    </View>
  );
}

export function AvisoDecisao() {
  const { styles, aviso, confirmandoRecusa } = useDecisao();
  if (!aviso || confirmandoRecusa) return null;

  return (
    <Text accessibilityRole="alert" style={styles.aviso}>
      {aviso}
    </Text>
  );
}

/** "Recusar" e "Assinar e iniciar". Na tela do termo, ficam abaixo do cartão. */
export function BotoesDecisao({ contexto }: Readonly<{ contexto?: ContextoDecisao }>) {
  const { styles, temTraco, ocupado, podeAssinar, assinar, pedirRecusa } = useDecisao();

  return (
    <View style={styles.botoes}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: ocupado }}
        disabled={ocupado}
        onPress={() => pedirRecusa(contexto)}
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
        accessibilityHint={temTraco ? undefined : DICA_ASSINAR}
        disabled={!podeAssinar}
        onPress={() => assinar(contexto)}
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
  );
}

type DecisaoTermoProps = {
  onAssinar: (assinatura: AssinaturaTermo) => void | Promise<void>;
  onRecusar: () => void | Promise<void>;
};

/** Área de assinatura e botões juntos, um sobre o outro, quando não há cartão para dividir. */
export function DecisaoTermo({ onAssinar, onRecusar }: DecisaoTermoProps) {
  return (
    <DecisaoTermoProvider onAssinar={onAssinar} onRecusar={onRecusar}>
      <PilhaDecisao />
    </DecisaoTermoProvider>
  );
}

function PilhaDecisao() {
  const { styles } = useDecisao();

  return (
    <View style={styles.raiz}>
      <AreaAssinatura />
      <BotoesDecisao />
    </View>
  );
}
