/**
 * Plugin de configuração do Expo que impede a cópia dos dados do aplicativo
 * para fora do tablet no Android 12 ou mais novo (#62).
 *
 * Nessas versões, `allowBackup="false"` desliga o backup na nuvem, mas não a
 * transferência de aparelho para aparelho (por cabo ou na configuração de um
 * tablet novo). As regras de extração de dados excluem todos os domínios nos
 * dois casos.
 */
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('expo/config-plugins');

const RULES_RESOURCE = '@xml/data_extraction_rules';
const RULES_FILE = 'data_extraction_rules.xml';

// Todos os domínios de arquivo que o Android permite extrair, inclusive os do
// armazenamento protegido do aparelho (prefixo device_).
const DOMAINS = [
  'root',
  'file',
  'database',
  'sharedpref',
  'external',
  'device_root',
  'device_file',
  'device_database',
  'device_sharedpref',
];

function buildRulesXml() {
  const excludes = DOMAINS.map((domain) => `    <exclude domain="${domain}" />`).join('\n');
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<data-extraction-rules>',
    '  <cloud-backup>',
    excludes,
    '  </cloud-backup>',
    '  <device-transfer>',
    excludes,
    '  </device-transfer>',
    '</data-extraction-rules>',
    '',
  ].join('\n');
}

function setDataExtractionRules(androidManifest) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  application.$['android:dataExtractionRules'] = RULES_RESOURCE;
  return androidManifest;
}

function withDataExtractionRules(config) {
  const withManifest = withAndroidManifest(config, (modConfig) => {
    modConfig.modResults = setDataExtractionRules(modConfig.modResults);
    return modConfig;
  });

  return withDangerousMod(withManifest, [
    'android',
    async (modConfig) => {
      const xmlDir = path.join(modConfig.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      await fs.promises.mkdir(xmlDir, { recursive: true });
      await fs.promises.writeFile(path.join(xmlDir, RULES_FILE), buildRulesXml());
      return modConfig;
    },
  ]);
}

module.exports = withDataExtractionRules;
module.exports.buildRulesXml = buildRulesXml;
module.exports.setDataExtractionRules = setDataExtractionRules;
module.exports.DOMAINS = DOMAINS;
