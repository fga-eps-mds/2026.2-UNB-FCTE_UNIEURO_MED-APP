import { getDocumentAsync } from 'expo-document-picker';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

import { fileTransport } from '@/features/sincronizacao/file-transport';

const mockFiles = new Map<string, string>();
const mockFolders = new Set<string>();

jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(parent: { uri: string }, name: string) {
      this.uri = `${parent.uri}/${name}`;
    }
    get exists() {
      return mockFolders.has(this.uri);
    }
    create() {
      mockFolders.add(this.uri);
    }
    delete() {
      mockFolders.delete(this.uri);
      for (const uri of [...mockFiles.keys()])
        if (uri.startsWith(`${this.uri}/`)) mockFiles.delete(uri);
    }
  }
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/');
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    create() {
      mockFiles.set(this.uri, '');
    }
    write(contents: string) {
      mockFiles.set(this.uri, contents);
    }
    async text() {
      const contents = mockFiles.get(this.uri);
      if (contents === undefined) throw new Error('arquivo não existe');
      return contents;
    }
    delete() {
      mockFiles.delete(this.uri);
    }
  }
  return { Directory, File, Paths: { cache: { uri: 'file:///cache' } } };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

beforeEach(() => {
  mockFiles.clear();
  mockFolders.clear();
});

describe('envio', () => {
  it('grava o pacote no cache e abre o compartilhamento do Android', async () => {
    await fileTransport.send('med-sincronizacao.medsync', '{"cifrado":true}');

    const uri = 'file:///cache/sincronizacao/med-sincronizacao.medsync';
    expect(mockFiles.get(uri)).toBe('{"cifrado":true}');
    expect(shareAsync).toHaveBeenCalledWith(uri, {
      mimeType: 'application/octet-stream',
      dialogTitle: 'Enviar pacote de sincronização',
    });
  });

  it('mantém só o pacote mais recente no cache', async () => {
    await fileTransport.send('antigo.medsync', 'a');
    await fileTransport.send('novo.medsync', 'b');

    expect([...mockFiles.keys()]).toEqual(['file:///cache/sincronizacao/novo.medsync']);
  });

  it('avisa quando o aparelho não tem compartilhamento', async () => {
    jest.mocked(isAvailableAsync).mockResolvedValueOnce(false);

    await expect(fileTransport.send('x.medsync', 'a')).rejects.toThrow('não está disponível');
    expect(shareAsync).not.toHaveBeenCalled();
  });
});

describe('recebimento', () => {
  const CONTENT_URI = 'content://com.android.providers.downloads.documents/document/42';

  it('lê o arquivo escolhido direto do endereço do Android, sem copiar', async () => {
    mockFiles.set(CONTENT_URI, '{"pacote":1}');
    jest.mocked(getDocumentAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: CONTENT_URI, name: 'med-sincronizacao.medsync', lastModified: 0 }],
    });

    await expect(fileTransport.receive()).resolves.toBe('{"pacote":1}');
    expect(getDocumentAsync).toHaveBeenCalledWith({
      type: '*/*',
      copyToCacheDirectory: false,
      multiple: false,
    });
  });

  it('não apaga o arquivo do usuário depois de ler', async () => {
    mockFiles.set(CONTENT_URI, '{"pacote":1}');
    jest.mocked(getDocumentAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: CONTENT_URI, name: 'med-sincronizacao.medsync', lastModified: 0 }],
    });

    await fileTransport.receive();

    expect(mockFiles.has(CONTENT_URI)).toBe(true);
  });

  it('devolve null quando o profissional desiste', async () => {
    jest.mocked(getDocumentAsync).mockResolvedValueOnce({ canceled: true, assets: null });

    await expect(fileTransport.receive()).resolves.toBeNull();
  });

  it('repassa a falha de leitura', async () => {
    jest.mocked(getDocumentAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'content://sumiu/1', name: 'sumiu.medsync', lastModified: 0 }],
    });

    await expect(fileTransport.receive()).rejects.toThrow('não existe');
  });
});
