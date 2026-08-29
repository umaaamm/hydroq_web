import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('mqtt');
    }
    return config;
  },
  turbopack: {
    resolveAlias: {
      mqtt: 'mqtt',
    },
  },
};

export default nextConfig;
