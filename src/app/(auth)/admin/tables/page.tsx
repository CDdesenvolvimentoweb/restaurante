'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Table, User } from '@/types';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

export default function TablesList() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchTables = async () => {
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
          .select('*, restaurant:restaurant_id(*)')
          .eq('id', authUser.id)
          .single();

        if (!profile || profile.role !== 'admin') {
          toast.error('Você não tem permissão para acessar esta página');
          router.push('/login');
          return;
        }

        setUser(profile as User);
        setRestaurant(profile.restaurant);

        // Obter mesas do restaurante
        let restaurantId = profile.restaurant_id;
        
        // Se não encontrar restaurant_id, tentar restaurantId
        if (!restaurantId && profile.restaurantId) {
          restaurantId = profile.restaurantId;
        }
        
        if (!restaurantId) {
          console.error('ID do restaurante não encontrado no perfil:', profile);
          toast.error('Não foi possível identificar o restaurante associado ao seu perfil.');
          setLoading(false);
          return;
        }
        
        console.log('Buscando mesas para o restaurante ID:', restaurantId);
        
        // Primeiro tentar buscar com restaurant_id (snake_case)
        try {
          const { data, error } = await supabase
            .from('tables')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('number', { ascending: true });
          
          if (error) {
            console.error('Erro na primeira tentativa com restaurant_id:', error);
            
            // Se falhar, tentar com restaurantId (camelCase)
            const { data: altData, error: altError } = await supabase
              .from('tables')
              .select('*')
              .eq('restaurantId', restaurantId)
              .order('number', { ascending: true });
              
            if (altError) {
              console.error('Erro na segunda tentativa com restaurantId:', altError);
              throw new Error('Não foi possível buscar as mesas do restaurante.');
            }
            
            setTables(altData || []);
          } else {
            setTables(data || []);
          }
        } catch (queryError: any) {
          console.error('Erro ao realizar consultas de mesas:', queryError);
          toast.error(`Erro ao buscar mesas: ${queryError.message || 'Tente novamente mais tarde'}`);
        }
      } catch (error: any) {
        console.error('Erro ao carregar mesas:', error);
        toast.error('Erro ao carregar mesas: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTables();
  }, [router]);

  const handleDeleteTable = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta mesa? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();
      
      // Verificar se existe alguma comanda aberta para esta mesa
      const { data: commands } = await supabase
        .from('commands')
        .select('id')
        .eq('table_id', id)
        .eq('status', 'open')
        .limit(1);

      if (commands && commands.length > 0) {
        toast.error('Não é possível excluir uma mesa com comandas abertas');
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('tables')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      // Atualizar lista de mesas
      setTables(tables.filter(table => table.id !== id));
      toast.success('Mesa excluída com sucesso!');
    } catch (error: any) {
      console.error('Erro ao excluir mesa:', error);
      toast.error('Erro ao excluir mesa: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'occupied':
        return 'bg-red-100 text-red-800';
      case 'reserved':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available':
        return 'Disponível';
      case 'occupied':
        return 'Ocupada';
      case 'reserved':
        return 'Reservada';
      default:
        return status;
    }
  };

  return (
    <div>
      <Toaster position="top-right" />
      
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mesas</h1>
          <p className="text-gray-600">Gerencie as mesas do seu restaurante</p>
        </div>
        <Link href="/admin/tables/new" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          Adicionar Mesa
        </Link>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total de Mesas</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">{tables.length}</div>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Mesas Disponíveis</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {tables.filter(table => table.status === 'available').length}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-red-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Mesas Ocupadas</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {tables.filter(table => table.status === 'occupied').length}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de mesas */}
      {loading ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-500">Carregando mesas...</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          {tables.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500">Nenhuma mesa cadastrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Número
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Capacidade
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
                  {tables.map((table) => (
                    <tr key={table.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Mesa #{table.number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {table.capacity} pessoas
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(table.status)}`}>
                          {getStatusText(table.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link href={`/admin/tables/${table.id}/edit`} className="text-blue-600 hover:text-blue-900 mr-4">
                          Editar
                        </Link>
                        <button
                          onClick={() => handleDeleteTable(table.id)}
                          className="text-red-600 hover:text-red-900"
                          disabled={table.status === 'occupied'}
                        >
                          Excluir
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