import { getItemAsync, setItemAsync } from 'expo-secure-store';

import type {
  AjustesDoTeste,
  AjustesDoTesteStore,
} from '@/features/acessibilidade/ajustes-do-teste';

export const CHAVE_AJUSTES = 'med.ajustes-do-teste.v1';

export type Armazenamento = {
  get(chave: string): Promise<string | null>;
  set(chave: string, valor: string): Promise<void>;
};

/**
 * A escolha fica no próprio tablet, no armazenamento do SecureStore que o aplicativo
 * já usa. Não é dado sensível: ele serve só para guardar dois valores sem precisar de
 * tabela nova no banco nem de migration.
 */
const armazenamentoDoTablet: Armazenamento = {
  get: (chave) => getItemAsync(chave),
  set: (chave, valor) => setItemAsync(chave, valor),
};

function lerAjustes(texto: string): AjustesDoTeste | null {
  try {
    const dados: unknown = JSON.parse(texto);
    if (
      typeof dados === 'object' &&
      dados !== null &&
      typeof (dados as AjustesDoTeste).altoContraste === 'boolean' &&
      typeof (dados as AjustesDoTeste).letrasMaiores === 'boolean'
    ) {
      const { altoContraste, letrasMaiores } = dados as AjustesDoTeste;
      return { altoContraste, letrasMaiores };
    }
  } catch {
    // Um valor estragado vale como "nada salvo": as telas ficam com o padrão.
  }
  return null;
}

/** Ajustes do teste guardados no tablet (#24). Valem para todos os profissionais dele. */
export function createAjustesStore(
  armazenamento: Armazenamento = armazenamentoDoTablet,
): AjustesDoTesteStore {
  return {
    async carregar() {
      const salvo = await armazenamento.get(CHAVE_AJUSTES);
      return salvo ? lerAjustes(salvo) : null;
    },
    salvar: (ajustes) => armazenamento.set(CHAVE_AJUSTES, JSON.stringify(ajustes)),
  };
}

export const ajustesDoTesteStore = createAjustesStore();
