/**
 * Configuração dos testes automatizados do aplicativo.
 *
 * Usa o preset do Android porque o produto roda apenas em tablet Android,
 * distribuído por APK. Restringir a suíte a essa plataforma mantém os testes
 * rápidos e alinhados ao alvo real, em vez de repetir cada caso em iOS e web.
 */
module.exports = {
  preset: 'jest-expo/android',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  moduleNameMapper: {
    // Precisa vir antes do alias `@/`, senão o Jest tenta interpretar o CSS.
    '\\.css$': '<rootDir>/__mocks__/style-mock.js',
    // Espelha os aliases declarados em `tsconfig.json`.
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    // As rotas apenas reexportam as telas, não há lógica a cobrir.
    '!src/app/**',
    // O produto é distribuído só como APK; as variantes web não são embarcadas.
    '!src/**/*.web.{ts,tsx}',
  ],
  coverageDirectory: 'coverage',
  // O `lcov` é o formato consumido pelo SonarCloud.
  coverageReporters: ['text-summary', 'lcov'],

  /**
   * Piso de cobertura, com folga sobre o número atual para não quebrar a
   * integração por variação pequena. A cada release o piso sobe até se
   * aproximar da cobertura real, conforme combinado na issue #27.
   */
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 80,
      functions: 90,
      lines: 90,
    },
  },
};
