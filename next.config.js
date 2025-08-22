/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['s1.anilist.co', 's2.anilist.co', 's3.anilist.co', 's4.anilist.co'],
    remotePatterns: [{ protocol: 'https', hostname: '**.anilist.co' }],
  },
};

module.exports = nextConfig;
