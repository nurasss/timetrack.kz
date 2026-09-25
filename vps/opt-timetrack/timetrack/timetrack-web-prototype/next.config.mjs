/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'api.dicebear.com' },
      { hostname: 'randomuser.me' },
    ],
  },
};

export default nextConfig;
