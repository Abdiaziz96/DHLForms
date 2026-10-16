import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // exceljs is a large CommonJS package; keep it external on the server bundle.
  serverExternalPackages: ['exceljs'],
  experimental: {
    // The XLSX workbook is read/written at runtime, never bundled.
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
