import { getDocumentAsync } from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

export type PackageTransport = {
  send(fileName: string, contents: string): Promise<void>;
  /** `null` se o usuário desistir. */
  receive(): Promise<string | null>;
};

const SHARE_FOLDER = 'sincronizacao';

// Envia pelo compartilhamento do Android e recebe pelo seletor de documentos.
export const fileTransport: PackageTransport = {
  async send(fileName, contents) {
    if (!(await isAvailableAsync())) {
      throw new Error('O compartilhamento de arquivos não está disponível neste aparelho.');
    }

    // Só o pacote mais recente fica no cache.
    const folder = new Directory(Paths.cache, SHARE_FOLDER);
    if (folder.exists) folder.delete();
    folder.create();

    const file = new File(folder, fileName);
    file.create();
    file.write(contents);

    await shareAsync(file.uri, {
      mimeType: 'application/octet-stream',
      dialogTitle: 'Enviar pacote de sincronização',
    });
  },

  // Lê direto do `content://`, sem copiar: no Expo Go a cópia fica fora da pasta
  // do projeto e a leitura é negada. O arquivo do usuário não é apagado.
  async receive() {
    const result = await getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: false,
      multiple: false,
    });
    if (result.canceled) return null;

    return new File(result.assets[0].uri).text();
  },
};
