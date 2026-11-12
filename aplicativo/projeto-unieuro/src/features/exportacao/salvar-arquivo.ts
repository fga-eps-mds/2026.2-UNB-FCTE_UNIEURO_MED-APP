import { Directory } from 'expo-file-system';

import type { SalvarArquivo } from '@/features/exportacao/exportacao';

const desistiu = (erro: unknown) =>
  erro instanceof Error &&
  ((erro as Error & { code?: string }).code === 'ERR_PICKER_CANCELLED' ||
    /cancel/i.test(erro.message));

/**
 * Abre o seletor de pastas do Android e grava o XML na pasta escolhida. O
 * aplicativo não ganha acesso a outras pastas, só à que o profissional apontou.
 */
export const salvarArquivoXml: SalvarArquivo = async (nome, conteudo) => {
  let pasta: Directory;
  try {
    pasta = await Directory.pickDirectoryAsync();
  } catch (erro) {
    if (desistiu(erro)) return false;
    throw erro;
  }
  const arquivo = pasta.createFile(nome, 'application/xml');
  arquivo.write(conteudo);
  return true;
};
