/**
 * Configuração do Babel.
 *
 * O aplicativo roda sem este arquivo porque o Metro aplica o
 * `babel-preset-expo` por padrão. O Jest não tem esse padrão: sem a
 * configuração explícita ele não consegue interpretar os arquivos do React
 * Native, que usam anotações de tipo Flow. O preset é o mesmo que o Expo já
 * usaria, então o comportamento do aplicativo não muda.
 */
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
  };
};
