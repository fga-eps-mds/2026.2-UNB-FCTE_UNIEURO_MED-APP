import type { PatientRecord } from '@/db/attendance-repository';
import { verifyPassword } from '@/features/auth/password';

import {
  abrirTabletSincronizavel,
  alterar,
  atender,
  cadastrar,
  enviarDireto,
  enviarPorArquivo,
  estado,
  type TabletSincronizavel,
} from '../test-support/sincronizacao';
import { ANA, BRUNO, CPF_DA_ANA, CPF_DO_BRUNO, SENHA_DE_TESTE } from '../test-support/tablet';

// Um banco e uma chave de CPF por tablet. Só o arquivo e o Nearby ficam de fora.

jest.mock('@/db/cpf-runtime', () => ({ cpfProtector: {} }));

jest.mock('expo-crypto', () => {
  const crypto = jest.requireActual('node:crypto');
  return {
    getRandomBytesAsync: async (size: number) => new Uint8Array(crypto.randomBytes(size)),
  };
});

const CARLA = {
  name: 'Carla Dias',
  email: 'carla.dias@unieuro.com.br',
  crmNumber: '33333',
  crmState: 'DF',
};
const CPF_DA_CARLA = '33344455506';

const JOSE: PatientRecord = {
  name: 'José Alves Martins',
  cpf: '52998224725',
  birthDate: '1948-03-14',
  schoolingYears: 5,
  sex: 'masculino',
};
const MARIA: PatientRecord = {
  name: 'Maria das Graças Lima',
  cpf: '39053344705',
  birthDate: '1950-07-02',
  schoolingYears: 8,
  sex: 'feminino',
};

const MENOR_UUID = '00000000-0000-4000-8000-000000000001';
const MAIOR_UUID = 'ffffffff-ffff-4fff-bfff-ffffffffffff';

const abertos: TabletSincronizavel[] = [];

async function tablets(quantidade: number) {
  const novos = [];
  for (let i = 0; i < quantidade; i += 1) novos.push(await abrirTabletSincronizavel());
  abertos.push(...novos);
  return novos;
}

afterEach(async () => {
  for (const tablet of abertos.splice(0)) await tablet.fechar();
});

const professionals = async (tablet: TabletSincronizavel) => (await estado(tablet)).profissionais;

const conflitos = (tablet: TabletSincronizavel) =>
  tablet.database.getAllAsync<{ tipo: string; tabela: string; motivo: string; dados: string }>(
    'SELECT tipo, tabela, motivo, dados FROM sync_conflito ORDER BY id',
  );

describe('profissionais', () => {
  it('profissional cadastrado em um tablet entra no outro com a mesma senha', async () => {
    const [tabletA, tabletB] = await tablets(2);
    await cadastrar(tabletA, ANA, CPF_DA_ANA);

    const result = await enviarPorArquivo(tabletA, tabletB);

    expect(result).toMatchObject({
      ok: true,
      summary: { professionals: { inserted: 1, updated: 0, unified: 0 }, quarantined: 0 },
    });
    const copied = await tabletB.repository.findByEmail(ANA.email);
    expect(copied).toMatchObject({ name: ANA.name, active: true });
    await expect(verifyPassword(SENHA_DE_TESTE, copied!.passwordHash)).resolves.toBe(true);
  });

  it('o CPF chega protegido com a chave do tablet que recebe, nunca em texto', async () => {
    const [tabletA, tabletB] = await tablets(2);
    await cadastrar(tabletA, ANA, CPF_DA_ANA);

    await enviarPorArquivo(tabletA, tabletB);

    const copied = await tabletB.repository.findByEmail(ANA.email);
    await expect(tabletB.repository.getCpf(copied!.id)).resolves.toBe(CPF_DA_ANA);
    await expect(tabletB.repository.cpfExists(CPF_DA_ANA)).resolves.toBe(true);
    const [fromA, fromB] = await Promise.all(
      [tabletA, tabletB].map((tablet) =>
        tablet.database.getFirstAsync<{ cpf_cifrado: string; cpf_indice: string }>(
          'SELECT cpf_cifrado, cpf_indice FROM profissional',
        ),
      ),
    );
    expect(fromB!.cpf_indice).not.toBe(fromA!.cpf_indice);
    expect(fromB!.cpf_cifrado).not.toBe(fromA!.cpf_cifrado);
    expect(tabletB.temp.rawContains(CPF_DA_ANA)).toBe(false);
  });

  it('dois tablets ficam iguais depois de trocar pacotes nos dois sentidos', async () => {
    const [tabletA, tabletB] = await tablets(2);
    await cadastrar(tabletA, ANA, CPF_DA_ANA);
    await cadastrar(tabletB, BRUNO, CPF_DO_BRUNO);

    await enviarPorArquivo(tabletA, tabletB);
    await enviarPorArquivo(tabletB, tabletA);

    const stateA = await estado(tabletA);
    expect(stateA.profissionais).toHaveLength(2);
    expect(await estado(tabletB)).toEqual(stateA);
  });

  it('importar o mesmo pacote duas vezes não muda nada na segunda vez', async () => {
    const [tabletA, tabletB] = await tablets(2);
    await cadastrar(tabletA, ANA, CPF_DA_ANA);
    const pacote = await tabletA.sync.exportPackage();

    await tabletB.sync.importPackage(pacote.contents, pacote.code);
    const before = await estado(tabletB);
    const second = await tabletB.sync.importPackage(pacote.contents, pacote.code);

    expect(second).toMatchObject({
      ok: true,
      summary: { professionals: { inserted: 0, updated: 0 }, skipped: 1 },
    });
    expect(await estado(tabletB)).toEqual(before);
  });

  it('três tablets convergem mesmo sem o primeiro e o último se encontrarem', async () => {
    const [a, b, c] = await tablets(3);
    await cadastrar(a, ANA, CPF_DA_ANA);
    await cadastrar(b, BRUNO, CPF_DO_BRUNO);
    await cadastrar(c, CARLA, CPF_DA_CARLA);

    await enviarDireto(a, b);
    await enviarDireto(b, c);
    await enviarDireto(c, b);
    await enviarDireto(b, a);

    const stateA = await estado(a);
    expect(stateA.profissionais).toHaveLength(3);
    expect(await estado(b)).toEqual(stateA);
    expect(await estado(c)).toEqual(stateA);
  });

  it('uma edição posterior chega ao outro tablet sem virar conflito', async () => {
    const [tabletA, tabletB] = await tablets(2);
    await cadastrar(tabletA, ANA, CPF_DA_ANA);
    await enviarDireto(tabletA, tabletB);

    await alterar(tabletA, 'profissional', { nome: 'Ana Souza Lima' }, 'email = ?', [ANA.email]);
    const result = await enviarDireto(tabletA, tabletB);

    expect(result).toMatchObject({
      ok: true,
      summary: { professionals: { updated: 1 }, conflicts: 0 },
    });
    expect(await estado(tabletB)).toEqual(await estado(tabletA));
  });

  it('edição concorrente termina na mesma versão, e a perdedora fica no tablet que viu as duas', async () => {
    const [tabletA, tabletB] = await tablets(2);
    await cadastrar(tabletA, ANA, CPF_DA_ANA);
    await enviarDireto(tabletA, tabletB);

    // Horas separadas, para não depender do desempate.
    const where = ['email = ?', [ANA.email]] as const;
    await alterar(tabletA, 'profissional', { nome: 'Ana no A' }, ...where, Date.now() + 1_000);
    await alterar(tabletB, 'profissional', { nome: 'Ana no B' }, ...where, Date.now() + 2_000);
    await enviarDireto(tabletA, tabletB);
    await enviarDireto(tabletB, tabletA);

    const stateA = await professionals(tabletA);
    expect(stateA).toEqual([expect.objectContaining({ nome: 'Ana no B' })]);
    expect(await professionals(tabletB)).toEqual(stateA);
    expect(await conflitos(tabletB)).toEqual([
      expect.objectContaining({
        tipo: 'versao_perdedora',
        dados: expect.stringContaining('Ana no A'),
      }),
    ]);
    expect(await conflitos(tabletA)).toEqual([]);
  });

  it('tablet com relógio atrasado não perde a edição que fez depois de receber os dados', async () => {
    const [tabletA, tabletB] = await tablets(2);
    await cadastrar(tabletA, ANA, CPF_DA_ANA);
    const where = ['email = ?', [ANA.email]] as const;
    await alterar(
      tabletA,
      'profissional',
      { nome: 'Adiantado' },
      ...where,
      Date.now() + 86_400_000,
    );
    await enviarDireto(tabletA, tabletB);

    // Relógio do B em 1970, mas a edição dele é posterior.
    await alterar(tabletB, 'profissional', { nome: 'Corrigido no B' }, ...where, 0);
    await enviarDireto(tabletB, tabletA);

    expect(await professionals(tabletA)).toEqual([
      expect.objectContaining({ nome: 'Corrigido no B' }),
    ]);
  });

  it('mesmo médico cadastrado nos dois tablets vira um registro só, com a criação mais antiga', async () => {
    const [tabletA, tabletB] = await tablets(2);
    await cadastrar(tabletB, ANA, CPF_DA_ANA, {
      uuid: MAIOR_UUID,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    await cadastrar(tabletA, { ...ANA, name: 'Ana S.' }, CPF_DA_ANA, {
      uuid: MENOR_UUID,
      createdAt: '2026-06-01T00:00:00.000Z',
    });

    const first = await enviarPorArquivo(tabletA, tabletB);
    await enviarPorArquivo(tabletB, tabletA);

    expect(first).toMatchObject({
      ok: true,
      summary: { professionals: { unified: 1, inserted: 0 } },
    });
    const stateA = await professionals(tabletA);
    expect(stateA).toEqual([
      expect.objectContaining({ uuid: MENOR_UUID, criacao: '2026-01-01T00:00:00.000Z' }),
    ]);
    expect(await professionals(tabletB)).toEqual(stateA);
  });

  it('cadastro unificado continua reconhecido pelo uuid antigo', async () => {
    const [tabletA, tabletB] = await tablets(2);
    await cadastrar(tabletA, ANA, CPF_DA_ANA, { uuid: MENOR_UUID });
    await cadastrar(tabletB, ANA, CPF_DA_ANA, { uuid: MAIOR_UUID });
    await enviarDireto(tabletB, tabletA);

    // O B ainda usa o uuid antigo. A hora explícita evita empatar com a
    // unificação gravada no A.
    await alterar(
      tabletB,
      'profissional',
      { nome: 'Ana editada no B' },
      'email = ?',
      [ANA.email],
      Date.now() + 1_000,
    );
    const result = await enviarDireto(tabletB, tabletA);

    expect(result).toMatchObject({
      ok: true,
      summary: { professionals: { updated: 1, unified: 0, inserted: 0 }, quarantined: 0 },
    });
    expect(await professionals(tabletA)).toEqual([
      expect.objectContaining({ uuid: MENOR_UUID, nome: 'Ana editada no B' }),
    ]);
  });

  it('CRM de um médico e e-mail de outro no mesmo registro vai para a quarentena, sem o CPF', async () => {
    const [tabletA, tabletB] = await tablets(2);
    await cadastrar(tabletA, { ...ANA, email: BRUNO.email }, CPF_DA_ANA);
    await cadastrar(tabletB, ANA, CPF_DA_ANA);
    await cadastrar(tabletB, BRUNO, CPF_DO_BRUNO);

    const result = await enviarDireto(tabletA, tabletB);

    expect(result).toMatchObject({ ok: true, summary: { quarantined: 1 } });
    expect(await professionals(tabletB)).toHaveLength(2);
    const [entry] = await conflitos(tabletB);
    expect(entry).toMatchObject({ tipo: 'quarentena', motivo: 'identidade_ambigua' });
    expect(entry.dados).not.toContain(CPF_DA_ANA);
  });

  it('edição que tomaria o e-mail de outro profissional vai para a quarentena', async () => {
    const [tabletA, tabletB] = await tablets(2);
    await cadastrar(tabletA, ANA, CPF_DA_ANA);
    await enviarDireto(tabletA, tabletB);
    await cadastrar(tabletB, { ...BRUNO, email: 'novo@unieuro.com.br' }, CPF_DO_BRUNO);
    await alterar(tabletA, 'profissional', { email: 'novo@unieuro.com.br' }, 'email = ?', [
      ANA.email,
    ]);

    const result = await enviarDireto(tabletA, tabletB);

    expect(result).toMatchObject({
      ok: true,
      summary: { quarantined: 1, professionals: { updated: 0 } },
    });
    expect(await conflitos(tabletB)).toEqual([expect.objectContaining({ motivo: 'email_em_uso' })]);
  });

  it('registro inválido vai para a quarentena e o resto do pacote entra', async () => {
    const [tabletA, tabletB] = await tablets(2);
    await cadastrar(tabletA, ANA, CPF_DA_ANA);
    await cadastrar(tabletA, BRUNO, CPF_DO_BRUNO);
    // O banco não valida o e-mail; o pacote valida.
    await alterar(tabletA, 'profissional', { email: 'sem-arroba' }, 'email = ?', [BRUNO.email]);

    const result = await enviarDireto(tabletA, tabletB);

    expect(result).toMatchObject({
      ok: true,
      summary: { professionals: { inserted: 1 }, quarantined: 1 },
    });
  });
});

describe('desativação', () => {
  const desativar = (tablet: TabletSincronizavel, email: string, agora?: number) =>
    alterar(tablet, 'profissional', { ativo: 0 }, 'email = ?', [email], agora);

  it('profissional desativado em um tablet fica desativado no outro', async () => {
    const [tabletA, tabletB] = await tablets(2);
    await cadastrar(tabletA, ANA, CPF_DA_ANA);
    await enviarDireto(tabletA, tabletB);

    await desativar(tabletA, ANA.email);
    await enviarDireto(tabletA, tabletB);

    await expect(tabletB.repository.findByEmail(ANA.email)).resolves.toMatchObject({
      active: false,
    });
    expect(await estado(tabletB)).toEqual(await estado(tabletA));
  });

  it.each([
    ['do tablet que desativou para o outro primeiro', 'A'],
    ['do tablet que editou para o outro primeiro', 'B'],
  ])(
    'vence uma edição feita depois em outro tablet que ainda não sabia, mandando %s',
    async (_caso, primeiro) => {
      const [tabletA, tabletB] = await tablets(2);
      await cadastrar(tabletA, ANA, CPF_DA_ANA);
      await enviarDireto(tabletA, tabletB);

      // O B troca a senha sem saber da desativação.
      await desativar(tabletA, ANA.email, Date.now() + 1_000);
      await alterar(
        tabletB,
        'profissional',
        { senha_hash: 'hash-novo' },
        'email = ?',
        [ANA.email],
        Date.now() + 2_000,
      );
      const [first, second] = primeiro === 'A' ? [tabletA, tabletB] : [tabletB, tabletA];
      await enviarDireto(first, second);
      await enviarDireto(second, first);

      const stateA = await professionals(tabletA);
      expect(stateA).toEqual([expect.objectContaining({ ativo: 0, senha_hash: 'hash-novo' })]);
      expect(await professionals(tabletB)).toEqual(stateA);
    },
  );

  it('a desativação chega a um terceiro tablet que já tinha a edição posterior', async () => {
    const [a, b, c] = await tablets(3);
    await cadastrar(a, ANA, CPF_DA_ANA);
    await enviarDireto(a, b);
    await desativar(a, ANA.email, Date.now() + 1_000);
    await alterar(
      b,
      'profissional',
      { nome: 'Ana editada' },
      'email = ?',
      [ANA.email],
      Date.now() + 2_000,
    );
    // O C recebe a edição antes de saber da desativação.
    await enviarDireto(b, c);

    await enviarDireto(a, b);
    await enviarDireto(b, c);

    await expect(c.repository.findByEmail(ANA.email)).resolves.toMatchObject({
      name: 'Ana editada',
      active: false,
    });
  });

  it('nenhum registro sincronizado pode ser apagado', async () => {
    const [tablet] = await tablets(1);
    const id = await cadastrar(tablet, ANA, CPF_DA_ANA);
    await atender(tablet, id, JOSE);

    for (const tabela of ['avaliacao', 'paciente', 'profissional']) {
      await expect(tablet.database.execAsync(`DELETE FROM ${tabela}`)).rejects.toThrow(
        /nao pode ser apagado/,
      );
    }
  });
});

describe('pacientes e atendimentos', () => {
  it('paciente e atendimento chegam ao outro tablet ligados ao mesmo profissional', async () => {
    const [tabletA, tabletB] = await tablets(2);
    const ana = await cadastrar(tabletA, ANA, CPF_DA_ANA);
    await atender(tabletA, ana, JOSE);

    const result = await enviarPorArquivo(tabletA, tabletB);

    expect(result).toMatchObject({
      ok: true,
      summary: {
        professionals: { inserted: 1 },
        patients: { inserted: 1 },
        attendances: { inserted: 1 },
      },
    });
    const stateA = await estado(tabletA);
    expect(stateA.atendimentos).toHaveLength(1);
    expect(await estado(tabletB)).toEqual(stateA);
    await expect(tabletB.atendimentos.findPatientByCpf(JOSE.cpf)).resolves.not.toBeNull();
    const [ficha] = await tabletB.database.getAllAsync<{ numero_ficha: string }>(
      'SELECT numero_ficha FROM paciente',
    );
    expect(ficha.numero_ficha).toBe('2026-0001');
    expect(tabletB.temp.rawContains(JOSE.cpf)).toBe(false);
  });

  it('mesmo paciente atendido nos dois tablets vira um só, e cada tablet mantém a sua ficha', async () => {
    const [tabletA, tabletB] = await tablets(2);
    const anaA = await cadastrar(tabletA, ANA, CPF_DA_ANA);
    const brunoB = await cadastrar(tabletB, BRUNO, CPF_DO_BRUNO);
    await atender(tabletB, brunoB, MARIA);
    await atender(tabletB, brunoB, JOSE);
    await atender(tabletA, anaA, JOSE);

    const first = await enviarDireto(tabletA, tabletB);
    await enviarDireto(tabletB, tabletA);

    expect(first).toMatchObject({ summary: { patients: { unified: 1, inserted: 0 } } });
    const stateA = await estado(tabletA);
    expect(stateA.pacientes).toHaveLength(2);
    expect(stateA.atendimentos).toHaveLength(3);
    expect(await estado(tabletB)).toEqual(stateA);
    const fichaDoJose = (tablet: TabletSincronizavel) =>
      tablet.database.getFirstAsync<{ numero_ficha: string }>(
        'SELECT numero_ficha FROM paciente WHERE nome = ?',
        [JOSE.name],
      );
    await expect(fichaDoJose(tabletA)).resolves.toEqual({ numero_ficha: '2026-0001' });
    await expect(fichaDoJose(tabletB)).resolves.toEqual({ numero_ficha: '2026-0002' });
  });

  it('paciente novo cuja ficha já está em uso no outro tablet ganha a próxima ficha de lá', async () => {
    const [tabletA, tabletB] = await tablets(2);
    await atender(tabletA, await cadastrar(tabletA, ANA, CPF_DA_ANA), JOSE);
    await atender(tabletB, await cadastrar(tabletB, BRUNO, CPF_DO_BRUNO), MARIA);

    await enviarDireto(tabletA, tabletB);
    await enviarDireto(tabletB, tabletA);

    const fichas = (tablet: TabletSincronizavel) =>
      tablet.database.getAllAsync('SELECT nome, numero_ficha FROM paciente ORDER BY nome');
    await expect(fichas(tabletB)).resolves.toEqual([
      { nome: JOSE.name, numero_ficha: '2026-0002' },
      { nome: MARIA.name, numero_ficha: '2026-0001' },
    ]);
    await expect(fichas(tabletA)).resolves.toEqual([
      { nome: JOSE.name, numero_ficha: '2026-0001' },
      { nome: MARIA.name, numero_ficha: '2026-0002' },
    ]);
    // Renumerar a ficha não gera versão nova.
    expect(await estado(tabletB)).toEqual(await estado(tabletA));
  });

  it('a mudança de estado do atendimento chega ao outro tablet', async () => {
    const [tabletA, tabletB] = await tablets(2);
    const id = await atender(tabletA, await cadastrar(tabletA, ANA, CPF_DA_ANA), JOSE);
    await enviarDireto(tabletA, tabletB);

    await alterar(tabletA, 'avaliacao', { estado: 'em_andamento' }, 'id = ?', [id]);
    const result = await enviarDireto(tabletA, tabletB);

    expect(result).toMatchObject({ summary: { attendances: { updated: 1, inserted: 0 } } });
    expect((await estado(tabletB)).atendimentos).toEqual([
      expect.objectContaining({ estado: 'em_andamento' }),
    ]);
  });

  it('edição concorrente do paciente guarda a versão perdedora sem dado que identifique o paciente', async () => {
    const [tabletA, tabletB] = await tablets(2);
    await atender(tabletA, await cadastrar(tabletA, ANA, CPF_DA_ANA), JOSE);
    await enviarDireto(tabletA, tabletB);

    const where = ['nome = ?', [JOSE.name]] as const;
    await alterar(tabletA, 'paciente', { escolaridade_anos: 6 }, ...where, Date.now() + 1_000);
    await alterar(tabletB, 'paciente', { escolaridade_anos: 7 }, ...where, Date.now() + 2_000);
    await enviarDireto(tabletA, tabletB);
    await enviarDireto(tabletB, tabletA);

    expect((await estado(tabletA)).pacientes).toEqual([
      expect.objectContaining({ escolaridade_anos: 7 }),
    ]);
    expect(await estado(tabletB)).toEqual(await estado(tabletA));
    const [entry] = await conflitos(tabletB);
    expect(entry).toMatchObject({ tipo: 'versao_perdedora', tabela: 'paciente' });
    expect(entry.dados).not.toContain(JOSE.name);
    expect(entry.dados).not.toContain(JOSE.cpf);
  });

  it('atendimento sem o profissional ou o paciente neste tablet vai para a quarentena', async () => {
    const [tabletA, tabletB] = await tablets(2);
    await atender(tabletA, await cadastrar(tabletA, ANA, CPF_DA_ANA), JOSE);
    const destino = await tabletB.sync.describeLocal();
    const pacote = JSON.parse(
      await tabletA.sync.preparePackageFor(destino.vector, destino.deviceId),
    );

    const result = await tabletB.sync.applyPackageJson(
      JSON.stringify({ ...pacote, profissionais: [], pacientes: [] }),
    );

    expect(result).toMatchObject({
      ok: true,
      summary: { quarantined: 1, attendances: { inserted: 0 } },
    });
    expect(await conflitos(tabletB)).toEqual([
      expect.objectContaining({ tabela: 'avaliacao', motivo: 'referencia_desconhecida' }),
    ]);
  });
});

describe('convergência com ordens sorteadas', () => {
  const pick = <T>(options: T[]) => options[Math.floor(Math.random() * options.length)];
  const randomDate = () =>
    new Date(Date.UTC(2026, 0, 1 + Math.floor(Math.random() * 200))).toISOString();
  const later = () => Date.now() + Math.floor(Math.random() * 120_000);

  // Sorteia edições, desativações e a ordem. Os tablets precisam terminar iguais.
  it.each(Array.from({ length: 12 }, (_, round) => round + 1))('rodada %i', async () => {
    const [tabletA, tabletB] = await tablets(2);
    const anaA = await cadastrar(tabletA, ANA, CPF_DA_ANA, { createdAt: randomDate() });
    const anaB = await cadastrar(tabletB, ANA, CPF_DA_ANA, { createdAt: randomDate() });
    const quemAtendeBruno = pick([tabletA, tabletB]);
    await cadastrar(quemAtendeBruno, BRUNO, CPF_DO_BRUNO);
    await atender(tabletA, anaA, JOSE);
    await atender(tabletB, anaB, pick([JOSE, MARIA]));

    for (const tablet of [tabletA, tabletB]) {
      const where = ['email = ?', [ANA.email]] as const;
      if (Math.random() < 0.5) {
        await alterar(tablet, 'profissional', { nome: `Ana ${Math.random()}` }, ...where, later());
      }
      if (Math.random() < 0.3)
        await alterar(tablet, 'profissional', { ativo: 0 }, ...where, later());
      if (Math.random() < 0.5) {
        await alterar(
          tablet,
          'paciente',
          { escolaridade_anos: 9 },
          'nome = ?',
          [JOSE.name],
          later(),
        );
      }
    }

    const [first, second] = pick([
      [tabletA, tabletB],
      [tabletB, tabletA],
    ]);
    await pick([enviarDireto, enviarPorArquivo])(first, second);
    await pick([enviarDireto, enviarPorArquivo])(second, first);

    const state = await estado(first);
    expect(state.profissionais).toHaveLength(2);
    expect(await estado(second)).toEqual(state);
  });
});

describe('pacotes recusados', () => {
  it('código errado não grava nada', async () => {
    const [tabletA, tabletB] = await tablets(2);
    await cadastrar(tabletA, ANA, CPF_DA_ANA);
    const pacote = await tabletA.sync.exportPackage();

    const result = await tabletB.sync.importPackage(pacote.contents, 'ZZZZ-ZZZZ-ZZZZ');

    expect(result).toEqual({ ok: false, reason: 'codigo_incorreto', message: expect.any(String) });
    expect(await professionals(tabletB)).toEqual([]);
  });

  it('pacote gerado no próprio tablet é recusado', async () => {
    const [tablet] = await tablets(1);
    const pacote = await tablet.sync.exportPackage();

    await expect(tablet.sync.importPackage(pacote.contents, pacote.code)).resolves.toMatchObject({
      ok: false,
      reason: 'mesmo_tablet',
    });
  });

  it('pacote de um tablet bloqueado é recusado', async () => {
    const [tabletA, tabletB] = await tablets(2);
    await cadastrar(tabletA, ANA, CPF_DA_ANA);
    await enviarDireto(tabletA, tabletB);
    await tabletB.database.runAsync(
      "UPDATE dispositivo SET revogado_em = '2026-10-10T00:00:00.000Z' WHERE local = 0",
    );
    await alterar(tabletA, 'profissional', { nome: 'Ana nova' }, 'email = ?', [ANA.email]);

    const result = await enviarDireto(tabletA, tabletB);

    expect(result).toMatchObject({ ok: false, reason: 'tablet_revogado' });
    expect(await professionals(tabletB)).toEqual([expect.objectContaining({ nome: ANA.name })]);
  });

  it('pacote de outra versão do banco é recusado sem gravar nada', async () => {
    const [tabletA, tabletB] = await tablets(2);
    await cadastrar(tabletA, ANA, CPF_DA_ANA);
    const pacote = JSON.parse(await tabletA.sync.preparePackageFor({}, 'tablet-b'));

    const result = await tabletB.sync.applyPackageJson(
      JSON.stringify({ ...pacote, versao_esquema: 99 }),
    );

    expect(result).toMatchObject({ ok: false, reason: 'versao_incompativel' });
    expect(await professionals(tabletB)).toEqual([]);
  });

  it('o histórico registra envios e recebimentos sem nenhum dado pessoal', async () => {
    const [tabletA, tabletB] = await tablets(2);
    await atender(tabletA, await cadastrar(tabletA, ANA, CPF_DA_ANA), JOSE);

    await enviarPorArquivo(tabletA, tabletB);
    await tabletB.sync.importPackage('não é pacote', 'ABCD-EFGH-JKLM');

    const logA = await tabletA.database.getAllAsync('SELECT * FROM sync_log');
    const logB = await tabletB.database.getAllAsync<{ resultado: string }>(
      'SELECT * FROM sync_log',
    );
    expect(logA).toEqual([expect.objectContaining({ direcao: 'envio', enviados: 3 })]);
    expect(logB.map((row) => row.resultado)).toEqual(['sucesso', 'recusado']);
    const text = JSON.stringify([logA, logB]);
    for (const dado of [ANA.name, ANA.email, CPF_DA_ANA, JOSE.name, JOSE.cpf]) {
      expect(text).not.toContain(dado);
    }
    await expect(tabletB.sync.lastReceivedAt()).resolves.toEqual(expect.any(String));
  });
});
