import { validateXML } from 'xmllint-wasm';

import { loadBuiltin } from './real-sqlite';

const { readFileSync } = loadBuiltin<{ readFileSync(path: string, encoding: 'utf8'): string }>(
  'node:fs',
);
const { cwd } = loadBuiltin<{ cwd(): string }>('node:process');

// O Jest roda na pasta do projeto Expo, a mesma do `package.json`.
const ESQUEMA = readFileSync(`${cwd()}/src/features/exportacao/exportacao-v1.xsd`, 'utf8');

/** Valida o XML contra o `exportacao-v1.xsd` com o libxml2, o mesmo motor do `xmllint`. */
export async function validarNoEsquema(xml: string): Promise<string[]> {
  const resultado = await validateXML({
    xml: [{ fileName: 'exportacao.xml', contents: xml }],
    schema: [{ fileName: 'exportacao-v1.xsd', contents: ESQUEMA }],
  });
  return resultado.errors.map((erro) => erro.rawMessage);
}
