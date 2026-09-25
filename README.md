# 2026.2-UNB-FCTE_UNIEURO_MED-APP

Aplicativo mobile do projeto desenvolvido pela equipe de Engenharia de Produto de Software (EPS) em parceria com a **UNIEURO**. O app usa React Native, Expo e Expo Router. Atualmente, inclui as telas de login e cadastro; a autenticacao ainda nao esta integrada a um backend.

## Estrutura

``` text
aplicativo/projeto-unieuro/
  assets/                   Recursos visuais do aplicativo
  src/
    app/                    Rotas e configuracao de navegacao
      index.tsx             Tela inicial e login
      register.tsx          Tela de cadastro
      _layout.tsx           Layout e navegacao do Expo Router
    constants/              Constantes compartilhadas e tema
    features/auth/          Telas e estilos de autenticacao
    hooks/                  Hooks reutilizaveis
  app.json                  Configuracao do Expo
  package.json              Scripts e dependencias
```

## Rodando localmente

Requer Node.js e npm. Os comandos abaixo devem ser executados na pasta do aplicativo:

``` bash
cd aplicativo/projeto-unieuro
npm install
npm start
```

O Expo iniciara o servidor de desenvolvimento e mostrara as opcoes para abrir o app em um dispositivo ou emulador.

### Executar por plataforma

``` bash
npm run android
npm run ios
npm run web
```

- Android: requer um emulador Android ativo ou um dispositivo conectado.
- iOS: requer macOS com Xcode.
- Web: abre o aplicativo no navegador.

## Verificacao

Para verificar o codigo com o linter:

``` bash
npm run lint
```

Se houver problemas relacionados ao cache do Expo, reinicie o servidor limpando-o:

``` bash
npx expo start --clear
```

## Como contribuir

1. Crie uma branch a partir da branch principal do repositorio.
2. Faca as alteracoes no aplicativo em `aplicativo/projeto-unieuro/`.
3. Execute `npm run lint` dentro dessa pasta.
4. Abra um Pull Request seguindo as orientacoes de contribuicao do repositorio.

## Licenca

Consulte o arquivo [LICENSE](LICENSE).