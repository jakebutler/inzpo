const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const sharedRoot = path.resolve(__dirname, '../../packages/shared');

config.watchFolders = [sharedRoot];
// This is a standalone npm project. Never resolve the Next.js app's React.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@inzpo/shared') {
    return { type: 'sourceFile', filePath: path.join(sharedRoot, 'src/index.ts') };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
