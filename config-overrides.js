module.exports = function override(config, env) {
  config.resolve.fallback = {
    fs: false,
    path: false,
    crypto: false,
  }

  return config;
}