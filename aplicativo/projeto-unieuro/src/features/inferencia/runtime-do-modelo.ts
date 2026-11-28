import { Directory, File, Paths } from 'expo-file-system';
import { InferenceSession, Tensor } from 'onnxruntime-react-native';

import {
  prepararArquivoDoModelo,
  type ArquivosDoAparelho,
} from '@/features/inferencia/arquivo-do-modelo';
import { criarCarregadorDoModelo, type RuntimeOnnx } from '@/features/inferencia/modelo-onnx';

/**
 * Liga o modelo de IA ao aparelho: o sistema de arquivos do Expo e o ONNX Runtime. A regra fica
 * em `arquivo-do-modelo.ts` e `modelo-onnx.ts`; aqui só as chamadas nativas.
 */
export const arquivosDoAparelho: ArquivosDoAparelho = {
  async lerEmpacotado(caminho) {
    const arquivo = new File(Paths.bundle, caminho);
    return arquivo.exists ? arquivo.text() : null;
  },
  tamanhoLocal(caminho) {
    const arquivo = new File(Paths.document, caminho);
    return arquivo.exists ? arquivo.size : null;
  },
  listarLocais(pasta) {
    const diretorio = new Directory(Paths.document, pasta);
    return diretorio.exists ? diretorio.list().map((item) => item.name) : [];
  },
  async copiarEmpacotado(origem, destino) {
    const arquivo = new File(Paths.document, destino);
    arquivo.parentDirectory.create({ intermediates: true, idempotent: true });
    await new File(Paths.bundle, origem).copy(arquivo);
  },
  async moverLocal(origem, destino) {
    await new File(Paths.document, origem).move(new File(Paths.document, destino));
  },
  apagarLocal(caminho) {
    const arquivo = new File(Paths.document, caminho);
    if (arquivo.exists) arquivo.delete();
  },
  enderecoLocal(caminho) {
    return new File(Paths.document, caminho).uri;
  },
};

export const runtimeOnnx: RuntimeOnnx = {
  criarTensor: (dados, forma) => new Tensor('float32', dados, forma),
  async abrirSessao(endereco) {
    // Só a CPU: o tablet comum não garante aceleração, e o resultado precisa ser o mesmo em
    // qualquer aparelho.
    const sessao = await InferenceSession.create(endereco, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    });
    return {
      async run(entradas) {
        const saidas = await sessao.run(entradas as InferenceSession.FeedsType);
        // As três saídas do modelo são float32; outro tipo cai na conferência de formato.
        return Object.fromEntries(
          Object.entries(saidas).map(([nome, tensor]) => [
            nome,
            tensor.type === 'float32'
              ? { data: tensor.data as Float32Array, dims: tensor.dims }
              : undefined,
          ]),
        );
      },
    };
  },
};

export const carregarModeloDoTablet = criarCarregadorDoModelo(
  () => prepararArquivoDoModelo(arquivosDoAparelho),
  runtimeOnnx,
);
