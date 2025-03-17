'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Table, Command, User } from '@/types';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

// Tipo para as comandas com suas relações
interface CommandWithRelations extends Command {
  table: Table;
}

export default function WaiterDashboard() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [myCommands, setMyCommands] = useState<CommandWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const supabase = createClient();
        
        // Verificar autenticação
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.push('/login');
          return;
        }

        // Obter perfil e verificar se é garçom
        const { data: profile } = await supabase
          .from('users')
          .select('*, restaurant:restaurant_id(*)')
          .eq('id', authUser.id)
          .single();

        if (!profile || profile.role !== 'waiter') {
          toast.error('Você não tem permissão para acessar esta página');
          router.push('/login');
          return;
        }

        setUser(profile as User);
        setRestaurant(profile.restaurant);

        // Obter mesas do restaurante
        const { data: tablesData } = await supabase
          .from('tables')
          .select('*')
          .eq('restaurant_id', profile.restaurant_id)
          .order('number', { ascending: true });

        setTables(tablesData || []);

        // Obter comandas atendidas pelo garçom
        const { data: commandsData } = await supabase
          .from('commands')
          .select('*, table:table_id(*)')
          .eq('user_id', authUser.id)
          .eq('status', 'open')
          .order('created_at', { ascending: false });

        setMyCommands(commandsData as CommandWithRelations[] || []);
      } catch (error: any) {
        console.error('Erro ao carregar dados do dashboard:', error);
        toast.error('Erro ao carregar dados: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [router]);

  const handleNewCommand = async (tableId: string) => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      // Verificar se já existe uma comanda aberta para esta mesa
      const { data: existingCommands } = await supabase
        .from('commands')
        .select('*')
        .eq('table_id', tableId)
        .eq('status', 'open')
        .single();

      if (existingCommands) {
        toast.error('Já existe uma comanda aberta para esta mesa');
        return;
      }

      // Criar nova comanda
      const { data: command, error } = await supabase
        .from('commands')
        .insert({
          table_id: tableId,
          user_id: user?.id,
          status: 'open',
          total: 0
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Atualizar status da mesa
      await supabase
        .from('tables')
        .update({ status: 'occupied' })
        .eq('id', tableId);

      toast.success('Comanda aberta com sucesso!');
      router.push(`/waiter/commands/${command.id}`);
    } catch (error: any) {
      console.error('Erro ao abrir comanda:', error);
      toast.error('Erro ao abrir comanda: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div>
      <Toaster position="top-right" />
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard do Garçom</h1>
        <p className="text-gray-600">Bem-vindo, {user?.name}! Restaurante: {restaurant?.name}</p>
      </div>

      {/* Minhas comandas abertas */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <h2 className="text-lg leading-6 font-medium text-gray-900">Minhas Comandas Abertas</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Comandas que você está atendendo no momento</p>
          </div>
        </div>
        <div className="border-t border-gray-200">
          {myCommands.length === 0 ? (
            <div className="px-6 py-4 text-center text-sm text-gray-500">
              Você não tem comandas abertas no momento
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mesa
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Horário de Abertura
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {myCommands.map((command) => (
                    <tr key={command.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Mesa #{command.table?.number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(command.created_at).toLocaleTimeString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        R$ {command.total.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link href={`/waiter/commands/${command.id}`} className="text-blue-600 hover:text-blue-900 mr-3">
                          Ver Detalhes
                        </Link>
                        <Link href={`/waiter/commands/${command.id}/add-product`} className="text-green-600 hover:text-green-900">
                          Adicionar Produtos
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Listagem de mesas */}
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-900">Mesas Disponíveis</h2>
        <p className="text-sm text-gray-500 mb-4">Selecione uma mesa para abrir uma nova comanda</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {tables
            .filter(table => table.status === 'available')
            .map(table => (
              <button
                key={table.id}
                onClick={() => handleNewCommand(table.id)}
                className="p-4 bg-green-100 rounded-lg text-center hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <div className="font-medium text-green-800">Mesa #{table.number}</div>
                <div className="text-xs text-green-600">Capacidade: {table.capacity}</div>
              </button>
            ))}
        </div>

        {tables.filter(table => table.status === 'available').length === 0 && (
          <div className="py-4 text-center text-sm text-gray-500 bg-gray-50 rounded-lg">
            Não há mesas disponíveis no momento
          </div>
        )}
      </div>

      {/* Mesas ocupadas */}
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-900">Mesas Ocupadas</h2>
        <p className="text-sm text-gray-500 mb-4">Mesas que estão sendo atendidas atualmente</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {tables
            .filter(table => table.status === 'occupied')
            .map(table => (
              <div
                key={table.id}
                className="p-4 bg-red-100 rounded-lg text-center"
              >
                <div className="font-medium text-red-800">Mesa #{table.number}</div>
                <div className="text-xs text-red-600">Ocupada</div>
              </div>
            ))}
        </div>

        {tables.filter(table => table.status === 'occupied').length === 0 && (
          <div className="py-4 text-center text-sm text-gray-500 bg-gray-50 rounded-lg">
            Não há mesas ocupadas no momento
          </div>
        )}
      </div>

      {/* Mesas reservadas */}
      <div>
        <h2 className="text-lg font-medium text-gray-900">Mesas Reservadas</h2>
        <p className="text-sm text-gray-500 mb-4">Mesas com reservas programadas</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {tables
            .filter(table => table.status === 'reserved')
            .map(table => (
              <div
                key={table.id}
                className="p-4 bg-yellow-100 rounded-lg text-center"
              >
                <div className="font-medium text-yellow-800">Mesa #{table.number}</div>
                <div className="text-xs text-yellow-600">Reservada</div>
              </div>
            ))}
        </div>

        {tables.filter(table => table.status === 'reserved').length === 0 && (
          <div className="py-4 text-center text-sm text-gray-500 bg-gray-50 rounded-lg">
            Não há mesas reservadas no momento
          </div>
        )}
      </div>
    </div>
  );
} 