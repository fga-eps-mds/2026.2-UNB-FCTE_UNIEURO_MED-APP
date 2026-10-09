import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Profissional autenticado, como as telas o enxergam.
 *
 * Guarda só o que as telas mostram ou usam para filtrar dados: id, nome,
 * e-mail e CRM. O CPF e o hash da senha ficam fora, para não circularem pela
 * interface. A sessão vive apenas na memória: ao fechar o aplicativo, o
 * profissional entra de novo.
 */
export type SessionProfessional = {
  id: number;
  name: string;
  email: string;
  crmNumber: string;
  crmState: string;
};

type SessionContextValue = {
  professional: SessionProfessional | null;
  signIn: (professional: SessionProfessional) => void;
  signOut: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

type SessionProviderProps = {
  children: ReactNode;
  /** Profissional já autenticado ao montar. Serve aos testes das telas. */
  initialProfessional?: SessionProfessional | null;
};

export function SessionProvider({ children, initialProfessional = null }: SessionProviderProps) {
  const [professional, setProfessional] = useState<SessionProfessional | null>(
    initialProfessional && toSessionProfessional(initialProfessional),
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      professional,
      signIn: (next) => setProfessional(toSessionProfessional(next)),
      signOut: () => setProfessional(null),
    }),
    [professional],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession precisa ser usado dentro de SessionProvider.');
  }
  return value;
}

/**
 * Copia só os campos da sessão. O login entrega o registro inteiro do banco,
 * com CPF e hash da senha, e é aqui que eles ficam para trás.
 */
export function toSessionProfessional(source: SessionProfessional): SessionProfessional {
  return {
    id: source.id,
    name: source.name,
    email: source.email,
    crmNumber: source.crmNumber,
    crmState: source.crmState,
  };
}

/** O que `returnToLogin` usa do roteador do Expo Router. */
type LoginNavigator = {
  canDismiss: () => boolean;
  dismissAll: () => void;
  replace: (href: '/') => void;
};

/**
 * Volta para o login sem deixar telas da sessão encerrada na pilha.
 *
 * Ao sair pelas configurações, a tela inicial continua montada embaixo. Só o
 * `replace` trocaria a tela do topo, e o botão voltar do Android levaria a uma
 * tela inicial vazia. Fechar a pilha antes evita isso.
 */
export function returnToLogin(router: LoginNavigator): void {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/');
}

/** CRM no formato das telas, por exemplo "12345/DF". */
export function formatCrm({
  crmNumber,
  crmState,
}: Pick<SessionProfessional, 'crmNumber' | 'crmState'>): string {
  return `${crmNumber}/${crmState}`;
}
