module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  modulePaths: ['<rootDir>/node_modules'],
  moduleNameMapper: {
    '^react$': '<rootDir>/node_modules/react',
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
    '^@inzpo/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|@expo|@expo-google-fonts|@react-navigation|@gorhom))',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/dist/'],
  maxWorkers: 2,
  clearMocks: true,
};
