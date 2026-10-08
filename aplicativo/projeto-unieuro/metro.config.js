const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite uses a WebAssembly module when the app runs in the browser.
config.resolver.assetExts.push('wasm');

module.exports = config;
