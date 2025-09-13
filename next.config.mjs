/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        child_process: false,
        fs: false,
        net: false,
        tls: false,
      };
      // optional: alias mongodb client-side require paths to false to be extra safe
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        // Prevent bundling of mongodb's client-side-encryption helpers in client builds
        "mongodb/lib/client-side-encryption/mongocryptd_manager": false,
      };
    }
    return config;
  },
};

export default nextConfig;
