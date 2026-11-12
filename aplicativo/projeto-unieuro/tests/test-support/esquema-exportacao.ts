import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { validateXML } from 'xmllint-wasm';

const ESQUEMA = readFileSync(
  join(__dirname, '../../src/features/exportacao/exportacao-v1.xsd'),
  'utf8',
);

/** Valida o XML contra o `exportacao-v1.xsd` com o libxml2, o mesmo motor do `xmllint`. */
export async function validarNoEsquema(xml: string): Promise<string[]> {
  const resultado = await validateXML({
    xml: [{ fileName: 'exportacao.xml', contents: xml }],
    schema: [{ fileName: 'exportacao-v1.xsd', contents: ESQUEMA }],
  });
  return resultado.errors.map((erro) => erro.rawMessage);
}
