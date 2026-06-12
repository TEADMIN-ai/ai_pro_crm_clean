/** @type {import("next").NextConfig} */
const nextConfig = {
  devIndicators: false,
  reactStrictMode: true,
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist", "pdf-parse", "tesseract.js", "tesseract.js-core"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  }
};

module.exports = nextConfig;
