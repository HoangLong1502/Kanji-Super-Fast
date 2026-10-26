/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["adm-zip", "unpdf", "pdfjs-dist", "@prisma/client"],
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb"
    }
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"]
    };
    return config;
  }
};

export default nextConfig;
