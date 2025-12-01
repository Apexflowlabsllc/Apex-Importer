/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev, isServer }) => {
    // We only want to enable polling in development mode
    if (dev && !isServer) {
      config.watchOptions = {
        // Use polling instead of file system events
        poll: 1000, // Check for changes every second
        // Tweak this value if you have performance issues
        aggregateTimeout: 200, // Delay the rebuild for 200ms after a change
      };
    }
    return config;
  },
};

export default nextConfig;

