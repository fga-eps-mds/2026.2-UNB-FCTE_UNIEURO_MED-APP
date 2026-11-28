/**
 * Ligação manual do ONNX Runtime (#12). O pacote traz um `unimodule.json`, e por isso a
 * ligação automática do Expo o trata como módulo antigo do Expo e o deixa de fora da ligação
 * do React Native: o módulo nativo não entra no APK e o modelo não abre (IA,
 * docs/exportacao-do-modelo.md, issue 548 dos exemplos do ONNX Runtime). Aqui o pacote é
 * declarado com o que a ligação precisa. O produto é só Android.
 */
module.exports = {
  dependencies: {
    'onnxruntime-react-native': {
      platforms: {
        android: {
          sourceDir: 'android',
          packageImportPath: 'import ai.onnxruntime.reactnative.OnnxruntimePackage;',
          packageInstance: 'new OnnxruntimePackage()',
        },
        ios: null,
      },
    },
  },
};
