import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
  /** Falha da última decisão, mostrada perto dos botões e dentro da confirmação da recusa. */
  aviso?: string | null;
  /** Recebe o contexto (quem assina e a versão) quando os botões vêm da tela do termo. */
  onAssinar: (assinatura: AssinaturaTermo, contexto?: ContextoDecisao) => void | Promise<void>;
  onRecusar: (contexto?: ContextoDecisao) => void | Promise<void>;
  children: ReactNode;
};

type DecisaoContexto = {
  styles: DecisaoStyles;
  temTraco: boolean;
  quadro: ReturnType<typeof useRegistroTracado>['quadro'];
  limpar: ReturnType<typeof useRegistroTracado>['limpar'];
  ocupado: boolean;
  aviso: string | null;
  confirmandoRecusa: boolean;
  podeAssinar: boolean;
  assinar: (contexto?: ContextoDecisao) => void;
  pedirRecusa: (contexto?: ContextoDecisao) => void;
};

const CONVITE = 'Assine aqui com a caneta';
const DICA_ASSINAR = 'Assine na área acima para continuar';
const DICA_AUTORIZACAO = 'Escolha Sim ou Não para os dois itens de uso de dados antes de continuar';
const DICA_SEM_IMAGENS =
  'A autorização para uso das imagens é necessária para participar desta pesquisa';

const DecisaoReact = createContext<DecisaoContexto | null>(null);

function useDecisao() {
  const contexto = useContext(DecisaoReact);
  if (!contexto)
    throw new Error('Use a área de assinatura e os botões dentro do DecisaoTermoProvider.');
  return contexto;
}

/**
 * Guarda o estado da decisão (traços, confirmação da recusa, "ocupado") para que a área
 * de assinatura, dentro do cartão da declaração, e os botões, abaixo dele, andem juntos
 * mesmo ficando em lugares diferentes da tela.
 */
export function DecisaoTermoProvider({
  aviso = null,
  onAssinar,
  onRecusar,
  children,
}: Readonly<DecisaoTermoProviderProps>) {
  const theme = useTheme();
  const styles = useMemo(() => createDecisaoStyles(theme), [theme]);
  const registro = useRegistroTracado();
  // `null` é a confirmação fechada; aberta, guarda o contexto de quem pediu a recusa.
  const [recusa, setRecusa] = useState<{ contexto?: ContextoDecisao } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const emCurso = useRef(false);

  const { dimensoes, tracos, temTraco, quadro } = registro;
  const podeAssinar = temTraco && dimensoes !== null && !ocupado;

  const executar = useCallback(async (acao: () => void | Promise<void>) => {
    if (emCurso.current) return;
    emCurso.current = true;
    setOcupado(true);
    try {
      await acao();
    } catch {
      emCurso.current = false;
      setOcupado(false);
    }
  }, []);

  const assinar = useCallback(
    (contexto?: ContextoDecisao) => {
      if (!dimensoes) return;
      const assinatura = { tracos, dimensoes };
      void executar(() => (contexto ? onAssinar(assinatura, contexto) : onAssinar(assinatura)));
    },
    [dimensoes, tracos, executar, onAssinar],
  );

  const pedirRecusa = useCallback((contexto?: ContextoDecisao) => setRecusa({ contexto }), []);

  // O valor do contexto só muda quando muda o que a área e os botões usam (Sonar S6481).
  const valor = useMemo<DecisaoContexto>(
    () => ({
      styles,
      temTraco,
      quadro,
      limpar: registro.limpar,
      ocupado,
      aviso,
      confirmandoRecusa: recusa !== null,
      podeAssinar,
      assinar,
      pedirRecusa,
    }),
    [
      styles,
      temTraco,
      quadro,
      registro.limpar,
      ocupado,
      aviso,
      recusa,
      podeAssinar,
      assinar,
      pedirRecusa,
    ],
  );

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

/** A área de assinatura. Na tela do termo, fica dentro do cartão da declaração. */
export function AreaAssinatura() {
  const { styles, quadro, temTraco, ocupado, limpar } = useDecisao();

  return (
    <View style={styles.areaAssinatura}>
      <View style={styles.quadroAssinatura}>
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
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !temTraco || ocupado }}
        disabled={!temTraco || ocupado}
        onPress={limpar}
        style={({ pressed }) => [
          styles.botaoLimpar,
          pressed && styles.botaoPressionado,
          (!temTraco || ocupado) && styles.botaoLimparDesabilitado,
        ]}>
        <Text
          style={[
            styles.botaoLimparTexto,
            (!temTraco || ocupado) && styles.botaoLimparTextoDesabilitado,
          ]}>
          Apagar assinatura
        </Text>
      </Pressable>
    </View>
  );
}

/** Aviso de falha da decisão. Com a confirmação da recusa aberta, ele aparece dentro dela. */
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
  const escolhasCompletas =
    contexto === undefined ||
    (contexto.autorizaImagensPesquisa !== null &&
      contexto.autorizaDadosPesquisaFutura !== null &&
      contexto.autorizaImagensPesquisa);
  const podeConcluirAssinatura = podeAssinar && escolhasCompletas;

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
        accessibilityState={{ disabled: !podeConcluirAssinatura }}
        accessibilityHint={
          !temTraco
            ? DICA_ASSINAR
            : contexto?.autorizaImagensPesquisa === false
              ? DICA_SEM_IMAGENS
              : escolhasCompletas
                ? undefined
                : DICA_AUTORIZACAO
        }
        disabled={!podeConcluirAssinatura}
        onPress={() => assinar(contexto)}
        style={({ pressed }) => [
          styles.botaoPrincipal,
          pressed && styles.botaoPrincipalPressionado,
          !podeConcluirAssinatura && styles.botaoPrincipalDesabilitado,
        ]}>
        <Text
          style={[
            styles.botaoPrincipalTexto,
            !podeConcluirAssinatura && styles.botaoPrincipalTextoDesabilitado,
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
export function DecisaoTermo({ onAssinar, onRecusar }: Readonly<DecisaoTermoProps>) {
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
