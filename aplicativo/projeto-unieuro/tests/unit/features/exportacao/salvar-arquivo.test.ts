import { Directory } from 'expo-file-system';

import { salvarArquivoXml } from '@/features/exportacao/salvar-arquivo';

jest.mock('expo-file-system', () => ({ Directory: { pickDirectoryAsync: jest.fn() } }));

const escolherPasta = jest.mocked(Directory.pickDirectoryAsync);

describe('salvarArquivoXml', () => {
  it('cria o arquivo na pasta escolhida e grava o XML', async () => {
    const arquivo = { write: jest.fn() };
    const pasta = { createFile: jest.fn(() => arquivo) };
    escolherPasta.mockResolvedValue(pasta as unknown as Directory);

    await expect(salvarArquivoXml('exames.xml', '<exportacao/>')).resolves.toBe(true);

    expect(pasta.createFile).toHaveBeenCalledWith('exames.xml', 'application/xml');
    expect(arquivo.write).toHaveBeenCalledWith('<exportacao/>');
  });

  it('devolve false quando o profissional fecha o seletor', async () => {
    escolherPasta.mockRejectedValue(
      Object.assign(new Error('The file picker was cancelled by the user'), {
        code: 'ERR_PICKER_CANCELLED',
      }),
    );

    await expect(salvarArquivoXml('exames.xml', '<exportacao/>')).resolves.toBe(false);
  });

  it('repassa outras falhas do seletor', async () => {
    escolherPasta.mockRejectedValue(new Error('sem permissão'));

    await expect(salvarArquivoXml('exames.xml', '<exportacao/>')).rejects.toThrow('sem permissão');
  });
});
