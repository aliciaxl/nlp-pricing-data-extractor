const webpack = require("webpack");

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };

      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^fs$/,
        })
      );
    }
    return config;
  },
};

module.exports = nextConfig;
