'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/types';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

export default function StaffList() {
  const router = useRouter();
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setLoading(true);
        const supabase = createClient();
        
        // Verificar autenticação
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.push('/login');
          return;
        }

        // Obter perfil e verificar se é admin
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (!profile || profile.role !== 'admin') {
          toast.error('Você não tem permissão para acessar esta página');
          router.push('/login');
          return;
        }

        setUser(profile as User);
        console.log('Perfil do administrador:', {
          id: profile.id,
          email: profile.email,
          role: profile.role,
          restaurant_id: profile.restaurant_id,
          restaurantId: profile.restaurantId
        });

        // Obter funcionários do restaurante (garçons e gerentes)
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('restaurant_id', profile.restaurant_id || profile.restaurantId)
          .in('role', ['waiter', 'manager'])
          .order('name', { ascending: true });

        if (error) {
          throw error;
        }

        setStaff(data || []);
      } catch (error: any) {
        console.error('Erro ao carregar funcionários:', error);
        toast.error(`Erro ao carregar funcionários: ${error.message || 'Verifique o console para mais detalhes'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchStaff();
  }, [router]);

  const handleDeleteStaff = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este funcionário? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();
      
      // Verificar se há comandas abertas por este funcionário
      const { data: commands } = await supabase
        .from('commands')
        .select('id')
        .eq('user_id', id)
        .eq('status', 'open')
        .limit(1);

      if (commands && commands.length > 0) {
        toast.error('Não é possível remover um funcionário que possui comandas abertas');
        setLoading(false);
        return;
      }

      // Atualizar o usuário para "desativado" ao invés de excluir completamente
      const { error } = await supabase
        .from('users')
        .update({ status: 'inactive' })
        .eq('id', id);

      if (error) {
        throw error;
      }

      // Atualizar lista de funcionários
      setStaff(staff.filter(s => s.id !== id));
      toast.success('Funcionário removido com sucesso!');
    } catch (error: any) {
      console.error('Erro ao remover funcionário:', error);
      toast.error(`Erro ao remover funcionário: ${error.message || 'Verifique o console para mais detalhes'}`);
    } finally {
      setLoading(false);
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'waiter':
        return 'Garçom';
      case 'manager':
        return 'Gerente';
      default:
        return role;
    }
  };

  return (
    <div>
      <Toaster position="top-right" />
      
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Funcionários</h1>
          <p className="text-gray-600">Gerencie os funcionários do seu restaurante</p>
        </div>
        <Link href="/admin/staff/new" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          Adicionar Funcionário
        </Link>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 mb-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total de Funcionários</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">{staff.length}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Garçons</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {staff.filter(s => s.role === 'waiter').length}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de funcionários */}
      {loading ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-500">Carregando funcionários...</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          {staff.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500">Nenhum funcionário cadastrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Função
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {staff.map((employee) => (
                    <tr key={employee.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {employee.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getRoleText(employee.role)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          employee.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {employee.status === 'active' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link href={`/admin/staff/${employee.id}/edit`} className="text-blue-600 hover:text-blue-900 mr-4">
                          Editar
                        </Link>
                        <button
                          onClick={() => handleDeleteStaff(employee.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 