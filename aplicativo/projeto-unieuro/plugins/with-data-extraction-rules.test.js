const withDataExtractionRules = require('./with-data-extraction-rules');

const { buildRulesXml, setDataExtractionRules, DOMAINS } = withDataExtractionRules;

const manifestWithApplication = () => ({
  manifest: { $: {}, application: [{ $: { 'android:name': '.MainApplication' } }] },
});

describe('regras de extração de dados do Android', () => {
  it('exclui todos os domínios do backup na nuvem e da transferência entre aparelhos', () => {
    const xml = buildRulesXml();

    for (const section of ['cloud-backup', 'device-transfer']) {
      const content = xml.split(`<${section}>`)[1].split(`</${section}>`)[0];
      for (const domain of DOMAINS) {
        expect(content).toContain(`<exclude domain="${domain}" />`);
      }
    }
    expect(xml).not.toContain('<include');
  });

  it('cobre também o armazenamento protegido do aparelho', () => {
    expect(DOMAINS).toEqual(expect.arrayContaining(['device_database', 'device_file']));
  });

  it('aponta o manifesto para as regras', () => {
    const manifest = setDataExtractionRules(manifestWithApplication());

    expect(manifest.manifest.application[0].$['android:dataExtractionRules']).toBe(
      '@xml/data_extraction_rules',
    );
  });

  it('registra a alteração do manifesto e a gravação do arquivo de regras', () => {
    const config = withDataExtractionRules({ name: 'med', slug: 'med' });

    expect(config.mods.android.manifest).toEqual(expect.any(Function));
    expect(config.mods.android.dangerous).toEqual(expect.any(Function));
  });
});
