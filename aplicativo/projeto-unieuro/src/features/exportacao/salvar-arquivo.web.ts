import type { SalvarArquivo } from '@/features/exportacao/exportacao';

// Na web (só para desenvolvimento) o navegador baixa o arquivo.
export const salvarArquivoXml: SalvarArquivo = async (nome, conteudo) => {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/xml' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
  return true;
};
