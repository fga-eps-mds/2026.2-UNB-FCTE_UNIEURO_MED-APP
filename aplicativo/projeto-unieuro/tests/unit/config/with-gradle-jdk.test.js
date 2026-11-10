const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('expo/config-plugins', () => ({
  withDangerousMod: (_config, [platform, action]) => ({ platform, action }),
}));

const withGradleJdk = require('../../../plugins/with-gradle-jdk');
const appJson = require('../../../app.json');

it('substitui a seleção do JDK 25 e seus links em todo prebuild Android', async () => {
  const projectRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'med-gradle-jdk-'));
  try {
    const gradleDir = path.join(projectRoot, 'gradle');
    const properties = path.join(gradleDir, 'gradle-daemon-jvm.properties');
    await fs.promises.mkdir(gradleDir);
    await fs.promises.writeFile(
      properties,
      'toolchainVersion=25\ntoolchainUrl.LINUX.X86_64=https://example.com/jdk25\n',
    );
    const plugin = withGradleJdk({});
    const config = { modRequest: { platformProjectRoot: projectRoot } };

    await plugin.action(config);
    const first = await fs.promises.readFile(properties, 'utf8');
    await plugin.action(config);

    expect(plugin.platform).toBe('android');
    expect(first).toContain('toolchainVersion=17\n');
    expect(first).not.toContain('toolchainUrl');
    expect(await fs.promises.readFile(properties, 'utf8')).toBe(first);
    expect(appJson.expo.plugins).toContain('./plugins/with-gradle-jdk');
  } finally {
    await fs.promises.rm(projectRoot, { recursive: true, force: true });
  }
});
