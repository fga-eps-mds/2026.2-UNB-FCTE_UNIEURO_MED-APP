/**
 * A seleção do daemon em gradle-daemon-jvm.properties prevalece sobre JAVA_HOME.
 * No ambiente local, ela apontava para JDK 25, cujos avisos de acesso nativo
 * fazem o Prefab do SQLCipher/OpenSSL falhar. Reaplica o JDK 17 usado no CI.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

module.exports = function withGradleJdk(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const gradleDir = path.join(modConfig.modRequest.platformProjectRoot, 'gradle');
      await fs.promises.mkdir(gradleDir, { recursive: true });
      // Não mantém toolchainUrl anteriores, que podem apontar para o JDK 25.
      await fs.promises.writeFile(
        path.join(gradleDir, 'gradle-daemon-jvm.properties'),
        '# JDK 17 requerido pelo build do SQLCipher. Instale-o antes de compilar.\ntoolchainVersion=17\n',
      );
      return modConfig;
    },
  ]);
};
