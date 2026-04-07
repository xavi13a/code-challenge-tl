import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/apps'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.base.json' }]
  },
  moduleNameMapper: {
    '^@contracts/(.*)$': '<rootDir>/packages/contracts/$1',
    '^@shared/(.*)$': '<rootDir>/packages/shared/$1'
  },
  testMatch: ['**/*.spec.ts']
};

export default config;
