module.exports = function override(config, env) {
  // config.devtool = env === 'production' ? false : 'eval-source-map';
  config.resolve.fallback = {
    fs: false,
    path: false,
    crypto: false,
    child_process: false,
  }

  return config;
}