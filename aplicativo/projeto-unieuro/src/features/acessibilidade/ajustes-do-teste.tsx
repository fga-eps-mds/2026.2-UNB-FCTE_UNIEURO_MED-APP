import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * Ajustes do teste (#24): o profissional liga nas configurações, e eles valem para as
 * telas que o paciente usa. Só mudam a apresentação, nunca o desenho, os dados
 * capturados ou a pontuação.
 */
export type AjustesDoTeste = {
  altoContraste: boolean;
  letrasMaiores: boolean;
};

export const AJUSTES_PADRAO: AjustesDoTeste = { altoContraste: false, letrasMaiores: false };

/** Onde a escolha fica guardada no tablet. A tela de configurações é quem grava. */
export type AjustesDoTesteStore = {
  carregar(): Promise<AjustesDoTeste | null>;
  salvar(ajustes: AjustesDoTeste): Promise<void>;
};

type AjustesDoTesteContexto = {
  ajustes: AjustesDoTeste;
  definirAjustes(ajustes: AjustesDoTeste): void;
};

const Contexto = createContext<AjustesDoTesteContexto>({
  ajustes: AJUSTES_PADRAO,
  definirAjustes: () => undefined,
});

type AjustesDoTesteProviderProps = {
  children: ReactNode;
  /** Sem `store`, a escolha vale até o aplicativo fechar. */
  store?: AjustesDoTesteStore;
  inicial?: AjustesDoTeste;
};

export function AjustesDoTesteProvider({
  children,
  store,
  inicial = AJUSTES_PADRAO,
}: Readonly<AjustesDoTesteProviderProps>) {
  const [ajustes, setAjustes] = useState(inicial);
  // Se o profissional mudar a escolha antes de a leitura do tablet terminar, vale a dele.
  const alterado = useRef(false);

  useEffect(() => {
    if (!store) return;
    let ativo = true;
    store.carregar().then(
      (salvos) => {
        if (ativo && salvos && !alterado.current) setAjustes(salvos);
      },
      // Sem a escolha salva, as telas seguem com o padrão, que também é legível.
      () => undefined,
    );
    return () => {
      ativo = false;
    };
  }, [store]);

  const definirAjustes = useCallback(
    (novos: AjustesDoTeste) => {
      alterado.current = true;
      setAjustes(novos);
      // Uma falha ao gravar só faz o tablet voltar ao padrão na próxima abertura.
      store?.salvar(novos).catch(() => undefined);
    },
    [store],
  );

  const valor = useMemo(() => ({ ajustes, definirAjustes }), [ajustes, definirAjustes]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAjustesDoTeste(): AjustesDoTesteContexto {
  return useContext(Contexto);
}
