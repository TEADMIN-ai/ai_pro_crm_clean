const path = require("node:path");

const repoRoot = path.resolve(__dirname);

/** @type {import("next").NextConfig} */
const nextConfig = {
  devIndicators: false,
  reactStrictMode: true,
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist", "pdf-parse", "tesseract.js", "tesseract.js-core"],
  turbopack: {
    root: repoRoot,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@": path.resolve(repoRoot, "src"),
    };
    return config;
  },
};

module.exports = nextConfig;
