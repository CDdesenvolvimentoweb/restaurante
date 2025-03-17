'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/types';
import toast, { Toaster } from 'react-hot-toast';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        router.push('/login');
        return;
      }

      // Obter perfil do usuário
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error || !data) {
        console.error('Erro ao carregar perfil do usuário:', error);
        router.push('/login');
        return;
      }

      // Garantir que o usuário tenha um status, mesmo que não exista na tabela
      const userWithStatus = { 
        ...data, 
        status: data.status || 'active',
        // Mapear restaurant_id para restaurantId se necessário
        restaurantId: data.restaurantId || data.restaurant_id 
      };
      
      setUser(userWithStatus as User);
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success('Logout realizado com sucesso!');
    router.push('/login');
  };

  // Determinar itens de navegação com base no papel do usuário
  const getNavItems = () => {
    if (!user) return [];

    switch (user.role) {
      case 'super_admin':
        return [
          { name: 'Dashboard', href: '/super-admin', current: pathname === '/super-admin' },
          { name: 'Restaurantes', href: '/super-admin/restaurants', current: pathname.startsWith('/super-admin/restaurants') },
          { name: 'Usuários', href: '/super-admin/users', current: pathname.startsWith('/super-admin/users') },
        ];
      case 'admin':
        return [
          { name: 'Dashboard', href: '/admin', current: pathname === '/admin' },
          { name: 'Mesas', href: '/admin/tables', current: pathname.startsWith('/admin/tables') },
          { name: 'Produtos', href: '/admin/products', current: pathname.startsWith('/admin/products') },
          { name: 'Funcionários', href: '/admin/staff', current: pathname.startsWith('/admin/staff') },
          { name: 'Relatórios', href: '/admin/reports', current: pathname.startsWith('/admin/reports') },
        ];
      case 'manager':
        return [
          { name: 'Dashboard', href: '/manager', current: pathname === '/manager' },
          { name: 'Mesas', href: '/manager/tables', current: pathname.startsWith('/manager/tables') },
          { name: 'Relatórios', href: '/manager/reports', current: pathname.startsWith('/manager/reports') },
        ];
      case 'waiter':
        return [
          { name: 'Dashboard', href: '/waiter', current: pathname === '/waiter' },
          { name: 'Comandas', href: '/waiter/commands', current: pathname.startsWith('/waiter/commands') },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      
      {/* Barra de navegação */}
      <nav className="bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-white text-xl font-bold">RMS</span>
              </div>
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  {navItems.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`px-3 py-2 rounded-md text-sm font-medium ${
                        item.current
                          ? 'bg-blue-700 text-white'
                          : 'text-white hover:bg-blue-500'
                      }`}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="ml-4 flex items-center md:ml-6">
                <div className="relative">
                  <div className="flex items-center">
                    <span className="text-white mr-4">{user?.name}</span>
                    <button
                      onClick={handleSignOut}
                      className="bg-blue-700 p-1 rounded-full text-white hover:bg-blue-800 focus:outline-none"
                    >
                      <span className="px-2 py-1">Sair</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="-mr-2 flex md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="bg-blue-700 inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-blue-500 focus:outline-none"
              >
                <span className="sr-only">Abrir menu principal</span>
                {isMobileMenuOpen ? (
                  <svg
                    className="block h-6 w-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg
                    className="block h-6 w-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Menu mobile */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    item.current
                      ? 'bg-blue-700 text-white'
                      : 'text-white hover:bg-blue-500'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
            <div className="pt-4 pb-3 border-t border-blue-700">
              <div className="flex items-center px-5">
                <div className="ml-3">
                  <div className="text-base font-medium leading-none text-white">
                    {user?.name}
                  </div>
                  <div className="text-sm font-medium leading-none text-blue-200 mt-1">
                    {user?.email}
                  </div>
                </div>
              </div>
              <div className="mt-3 px-2 space-y-1">
                <button
                  onClick={handleSignOut}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-white hover:bg-blue-500"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Conteúdo principal */}
      <main className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
} 