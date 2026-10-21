import {
  QUEM_ASSINA_OPCOES,
  TERMO_TCLE,
  descreverVersao,
  type TermoTcle,
} from '@/features/avaliacao/termo-tcle';

describe('termo do TCLE', () => {
  it('tem versão, título, pesquisador e ao menos uma seção com texto', () => {
    expect(TERMO_TCLE.versao).not.toBe('');
    expect(TERMO_TCLE.titulo).toBe('Termo de consentimento livre e esclarecido');
    expect(TERMO_TCLE.pesquisador).toContain('Pesquisador responsável');
    expect(TERMO_TCLE.secoes.length).toBeGreaterThan(0);
    for (const secao of TERMO_TCLE.secoes) {
      expect(secao.titulo).not.toBe('');
      expect(secao.paragrafos.length).toBeGreaterThan(0);
    }
  });

  it('usa o texto do cliente, identificado pela versão de 15/09/2026', () => {
    expect(TERMO_TCLE.provisorio).toBe(false);
    expect(descreverVersao(TERMO_TCLE)).toBe('Versão do termo: 15/09/2026 (versão simples)');
  });

  it('traz os itens do termo do cliente, de 1 a 12, e a declaração de consentimento', () => {
    const titulos = TERMO_TCLE.secoes.map((secao) => secao.titulo);

    for (let item = 1; item <= 12; item++) {
      expect(titulos.some((titulo) => titulo.startsWith(`${item}) `))).toBe(true);
    }
    expect(TERMO_TCLE.declaracao).toMatch(/^Declaro que li este termo/);
  });

  it('não repete parágrafo, para cada trecho aparecer uma vez na tela', () => {
    const paragrafos = TERMO_TCLE.secoes.flatMap((secao) => secao.paragrafos);

    expect(new Set(paragrafos).size).toBe(paragrafos.length);
  });

  it('marca o texto como provisório quando ele ainda não é o do cliente', () => {
    const rascunho: TermoTcle = { ...TERMO_TCLE, versao: 'rascunho', provisorio: true };

    expect(descreverVersao(rascunho)).toBe('Versão do termo: rascunho (texto provisório)');
  });

  it('oferece paciente e responsável legal como quem assina', () => {
    expect(QUEM_ASSINA_OPCOES.map((opcao) => opcao.valor)).toEqual([
      'paciente',
      'responsavel_legal',
    ]);
  });
});
