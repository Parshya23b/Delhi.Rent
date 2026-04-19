import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["mapbox-gl"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
