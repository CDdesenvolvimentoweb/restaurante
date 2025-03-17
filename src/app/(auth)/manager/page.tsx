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
  user: User;
  // Campos adicionais que podem aparecer na resposta do Supabase
  table_number?: number;
  tableNumber?: number;
}

export default function ManagerDashboard() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [stats, setStats] = useState({
    totalTables: 0,
    availableTables: 0,
    occupiedTables: 0,
    reservedTables: 0,
    totalCommands: 0,
    openCommands: 0,
    todaySales: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentCommands, setRecentCommands] = useState<CommandWithRelations[]>([]);
  const [staffOnShift, setStaffOnShift] = useState<User[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const supabase = createClient();
        
        // Verificar autenticação
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        // Obter perfil e verificar se é gerente
        const { data: profile } = await supabase
          .from('users')
          .select('*, restaurant:restaurant_id(*)')
          .eq('id', user.id)
          .single();

        if (!profile || profile.role !== 'manager') {
          toast.error('Você não tem permissão para acessar esta página');
          router.push('/login');
          return;
        }

        setRestaurant(profile.restaurant);
        const restaurantId = profile.restaurant_id || profile.restaurantId;

        // Obter estatísticas de mesas
        const { data: tables } = await supabase
          .from('tables')
          .select('*')
          .eq('restaurant_id', restaurantId);

        const availableTables = tables?.filter(t => t.status === 'available').length || 0;
        const occupiedTables = tables?.filter(t => t.status === 'occupied').length || 0;
        const reservedTables = tables?.filter(t => t.status === 'reserved').length || 0;

        // Obter comandas do dia atual
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        
        // Usar a abordagem mais robusta que desenvolvemos para buscar comandas
        console.log('Buscando comandas do dia atual...');
        
        // Verificar estrutura da tabela
        let closedAtField = null;
        const { data: commandSample } = await supabase
          .from('commands')
          .select('*')
          .limit(1);
          
        if (commandSample && commandSample.length > 0) {
          const columns = Object.keys(commandSample[0]);
          if (columns.includes('closed_at')) closedAtField = 'closed_at';
          else if (columns.includes('closedAt')) closedAtField = 'closedAt';
          console.log('Campo de data de fechamento:', closedAtField);
        }
        
        let cmdQuery = supabase
          .from('commands')
          .select(`
            *,
            table:table_id(*),
            user:user_id(*)
          `);
          
        if (closedAtField) {
          cmdQuery = cmdQuery.gte(closedAtField, startOfDay.toISOString());
        }
          
        const { data: todayCommands } = await cmdQuery
          .eq('restaurant_id', restaurantId)
          .eq('status', 'closed');

        // Se não encontrar diretamente, tentar com restaurantId
        let commands = todayCommands;
        if (!commands || commands.length === 0) {
          const { data: altCommands } = await supabase
            .from('commands')
            .select(`
              *,
              table:table_id(*),
              user:user_id(*)
            `)
            .eq('restaurantId', restaurantId)
            .eq('status', 'closed');
            
          commands = altCommands;
        }
        
        // Calcular vendas do dia
        let todaySales = 0;
        if (commands && commands.length > 0) {
          todaySales = commands.reduce((sum, cmd) => {
            // Verificar se o total está preenchido corretamente
            if (cmd.total && !isNaN(cmd.total) && cmd.total > 0) {
              return sum + cmd.total;
            }
            // Se não estiver, tentar calcular a partir dos itens
            const items = cmd.items || cmd.command_products || [];
            if (Array.isArray(items) && items.length > 0) {
              const itemsTotal = items.reduce((itemSum, item) => {
                const quantity = item.quantity || item.quantidade || 0;
                const price = item.price || item.preco || 0;
                return itemSum + (price * quantity);
              }, 0);
              return sum + itemsTotal;
            }
            return sum;
          }, 0);
        }

        // Obter comandas abertas
        const { data: openCommandsData } = await supabase
          .from('commands')
          .select(`
            *,
            table:table_id(*),
            user:user_id(*)
          `)
          .eq('restaurant_id', restaurantId)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(5);

        // Obter funcionários ativos no turno
        const { data: activeStaff } = await supabase
          .from('users')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('status', 'active')
          .in('role', ['waiter', 'manager']);

        // Atualizar estados
        setStats({
          totalTables: tables?.length || 0,
          availableTables,
          occupiedTables,
          reservedTables,
          totalCommands: commands?.length || 0,
          openCommands: openCommandsData?.length || 0,
          todaySales
        });

        setRecentCommands(openCommandsData || []);
        setStaffOnShift(activeStaff || []);
      } catch (error: any) {
        console.error('Erro ao carregar dashboard:', error);
        toast.error('Erro ao carregar dados do dashboard: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [router]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div>
      <Toaster position="top-right" />
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard do Gerente</h1>
        <p className="text-gray-600">
          {restaurant ? `${restaurant.name}` : 'Carregando dados do restaurante...'}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cartões de estatísticas */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
                      <dt className="text-sm font-medium text-gray-500 truncate">Mesas Disponíveis</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {stats.availableTables} de {stats.totalTables}
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
                  <div className="flex-shrink-0 bg-orange-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Vendas de Hoje</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {formatCurrency(stats.todaySales)}
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
                  <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Comandas Fechadas Hoje</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {stats.totalCommands}
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Comandas Abertas</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {stats.openCommands}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Ações rápidas */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Ações Rápidas</h3>
              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Link href="/manager/commands" className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
                  Ver Comandas
                </Link>
                <Link href="/manager/reports" className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                  Relatórios
                </Link>
                <Link href="/manager/tables" className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700">
                  Gerenciar Mesas
                </Link>
              </div>
            </div>
          </div>

          {/* Seção de comandas abertas recentes */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Comandas Abertas Recentes</h3>
              <Link href="/manager/commands" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                Ver todas
              </Link>
            </div>
            {recentCommands.length === 0 ? (
              <div className="px-4 py-5 sm:p-6 text-center text-gray-500">
                Nenhuma comanda aberta no momento.
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
                        Garçom
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Horário de Abertura
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentCommands.map(command => (
                      <tr key={command.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          Mesa {command.table?.number || 
                                command.table_number || 
                                (typeof command.table === 'number' ? command.table : null) || 
                                command.tableNumber || 
                                'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {command.user?.name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(command.created_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <Link href={`/manager/commands/${command.id}`} className="text-blue-600 hover:text-blue-900">
                            Ver Detalhes
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Equipe no turno */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Equipe no Turno</h3>
            </div>
            {staffOnShift.length === 0 ? (
              <div className="px-4 py-5 sm:p-6 text-center text-gray-500">
                Nenhum funcionário ativo no momento.
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
                        Função
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {staffOnShift.map(staff => (
                      <tr key={staff.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {staff.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {staff.role === 'manager' ? 'Gerente' : 'Garçom'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {staff.email}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 