import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configurações para melhoria de desempenho
  reactStrictMode: true,
  // Configuração para suporte a imagens remotas (caso necessário)
  images: {
    domains: ['gybwamrrlypjjplkpzsu.supabase.co'],
    // Configura limites recomendados para imagens
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Configurações para redirecionamentos 
  async redirects() {
    return [
      {
        source: '/login',
        destination: '/login',
        permanent: false,
      },
    ];
  },
  // Otimizações para deploy na Vercel
  poweredByHeader: false,
  // Desativar verificação do ESLint durante o build
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Configuração para saída standalone (para Docker)
  output: 'standalone',
};

export default nextConfig;
