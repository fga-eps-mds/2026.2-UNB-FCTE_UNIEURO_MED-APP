import {
  gerarXmlDeExportacao,
  idadeNoExame,
  paraBase64,
  type CabecalhoExportacao,
  type ExameExportado,
  type PacienteExportado,
} from '@/features/exportacao/xml-exportacao';

import { validarNoEsquema } from '../../../test-support/esquema-exportacao';

const CABECALHO: CabecalhoExportacao = {
  geradaEm: '2026-11-12T17:30:00.000Z',
  versaoAplicativo: '1.4.0',
  escopo: 'todos',
  profissional: { crmNumero: '12345', crmUf: 'DF' },
};

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const exameConcluido = (extra: Partial<ExameExportado> = {}): ExameExportado => ({
  id: 12,
  inicio: '2026-10-06T12:00:00.000Z',
  estado: 'concluida',
  termo: {
    versao: 'TCLE v1.0',
    aceito: true,
    assinadoPor: 'paciente',
    dataHora: '2026-10-06T12:02:00.000Z',
    autorizaImagens: true,
    autorizaPesquisaFutura: false,
  },
  tarefas: [
    {
      ordem: 1,
      tipo: 'relogio',
      largura: 800,
      altura: 600,
      inicio: '2026-10-06T12:03:00.000Z',
      termino: '2026-10-06T12:05:00.000Z',
      desenho: { confirmadoEm: '2026-10-06T12:05:00.000Z', png: PNG },
      eventos: [
        {
          ordem: 1,
          tipo: 'inicio',
          ponteiro: 'caneta',
          x: 10.5,
          y: 20,
          instante: 0,
          pressao: 0.6,
          inclinacaoX: 12,
          inclinacaoY: -3,
        },
        {
          ordem: 2,
          tipo: 'desfazer',
          ponteiro: null,
          x: null,
          y: null,
          instante: 900,
          pressao: null,
          inclinacaoX: null,
          inclinacaoY: null,
        },
      ],
    },
  ],
  ...extra,
});

const paciente = (exames: ExameExportado[]): PacienteExportado => ({
  id: 3,
  dataNascimento: '1948-10-07',
  escolaridadeAnos: 5,
  sexo: 'masculino',
  exames,
});

describe('XML da exportação (#22)', () => {
  it('arquivo válido: o XML gerado passa no exportacao-v1.xsd', async () => {
    const recusado: ExameExportado = {
      id: 13,
      inicio: '2026-10-13T12:00:00.000Z',
      estado: 'cancelada',
      termo: {
        versao: 'TCLE v1.0',
        aceito: false,
        assinadoPor: 'responsavel_legal',
        dataHora: '2026-10-13T12:01:00.000Z',
        autorizaImagens: null,
        autorizaPesquisaFutura: null,
      },
      tarefas: [],
    };
    const xml = gerarXmlDeExportacao([paciente([exameConcluido(), recusado])], CABECALHO);

    await expect(validarNoEsquema(xml)).resolves.toEqual([]);
  });

  it('o esquema recusa um arquivo sem o id do exame', async () => {
    const xml = gerarXmlDeExportacao([paciente([exameConcluido()])], CABECALHO).replace(
      / id="12"/,
      '',
    );

    const erros = await validarNoEsquema(xml);

    expect(erros.join('\n')).toMatch(/attribute 'id' is required/);
  });

  it('registra a versão do esquema, do aplicativo, o escopo e o CRM de quem exportou', () => {
    const xml = gerarXmlDeExportacao([paciente([exameConcluido()])], CABECALHO);

    expect(xml).toContain(
      '<exportacao xmlns="urn:mnema:exportacao:v1" versaoEsquema="1" geradaEm="2026-11-12T17:30:00.000Z" versaoAplicativo="1.4.0" escopo="todos">',
    );
    expect(xml).toContain('<profissional crm="12345" uf="DF"/>');
  });

  it('identifica o paciente só pelo número interno, com a idade no dia do exame', () => {
    const xml = gerarXmlDeExportacao([paciente([exameConcluido()])], CABECALHO);

    expect(xml).toContain('<paciente id="3" escolaridadeAnos="5" sexo="masculino">');
    expect(xml).toContain('idadeAnos="77"');
    expect(xml).not.toContain('1948');
  });

  it('leva o termo, o traçado com os traços desfeitos e o desenho em base64', () => {
    const xml = gerarXmlDeExportacao([paciente([exameConcluido()])], CABECALHO);

    expect(xml).toContain(
      '<termo versao="TCLE v1.0" aceito="sim" assinadoPor="paciente" dataHora="2026-10-06T12:02:00.000Z" autorizaImagens="sim" autorizaPesquisaFutura="nao"/>',
    );
    expect(xml).toContain(
      '<evento ordem="1" tipo="inicio" ponteiro="caneta" x="10.5" y="20" instante="0" pressao="0.6" inclinacaoX="12" inclinacaoY="-3"/>',
    );
    expect(xml).toContain('<evento ordem="2" tipo="desfazer" instante="900"/>');
    expect(xml).toContain(
      '<desenho confirmadoEm="2026-10-06T12:05:00.000Z" tipoMidia="image/png">iVBORw0KGgo=</desenho>',
    );
    expect(xml).toContain('<resultado disponivel="nao"/>');
  });

  it('sem TCLE aceito, o exame leva só a data, o estado e a decisão, e o paciente vai sem dados', () => {
    const recusa = exameConcluido({
      estado: 'cancelada',
      termo: { ...exameConcluido().termo!, aceito: false },
    });
    const xml = gerarXmlDeExportacao([paciente([recusa])], CABECALHO);

    expect(xml).toContain('<paciente id="3">');
    expect(xml).not.toContain('idadeAnos');
    expect(xml).not.toContain('<tarefa');
    expect(xml).not.toContain('<resultado');
    expect(xml).toContain('aceito="nao"');
  });

  it('exame que ainda espera o termo vai sem o elemento do termo', () => {
    const xml = gerarXmlDeExportacao(
      [paciente([exameConcluido({ estado: 'aguardando_consentimento', termo: null })])],
      CABECALHO,
    );

    expect(xml).toContain('estado="aguardando_consentimento">\n    </exame>');
  });

  it('escapa os caracteres especiais do XML', () => {
    const xml = gerarXmlDeExportacao([paciente([exameConcluido()])], {
      ...CABECALHO,
      versaoAplicativo: `1.0 <beta> & "rc" 'x'`,
    });

    expect(xml).toContain('versaoAplicativo="1.0 &lt;beta&gt; &amp; &quot;rc&quot; &apos;x&apos;"');
  });
});

describe('paraBase64', () => {
  it('codifica imagens maiores que um bloco sem perder bytes', () => {
    const bytes = Uint8Array.from({ length: 20000 }, (_, i) => i % 256);

    const decodificado = Uint8Array.from(atob(paraBase64(bytes)), (c) => c.charCodeAt(0));

    expect(decodificado).toEqual(bytes);
  });
});

describe('idadeNoExame', () => {
  it('conta o aniversário só a partir do dia', () => {
    expect(idadeNoExame('1948-10-07', '2026-10-06T15:00:00')).toBe(77);
    expect(idadeNoExame('1948-10-07', '2026-10-07T15:00:00')).toBe(78);
    expect(idadeNoExame('1948-10-07', '2026-11-01T15:00:00')).toBe(78);
    expect(idadeNoExame('1948-10-07', '2026-09-30T15:00:00')).toBe(77);
  });
});
