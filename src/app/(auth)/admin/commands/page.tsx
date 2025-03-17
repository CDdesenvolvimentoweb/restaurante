'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Command, Table } from '@/types';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

// Tipo para as comandas com suas relações
interface CommandWithRelations extends Command {
  table: Table;
  user: User;
}

export default function CommandsList() {
  const router = useRouter();
  const [commands, setCommands] = useState<CommandWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    const fetchCommands = async () => {
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

        // Obter comandas do restaurante
        const restaurantId = profile.restaurant_id || profile.restaurantId;
        console.log('ID do restaurante do admin:', restaurantId);
        
        // Verificar a estrutura da tabela commands
        const { data: commandSample, error: structureError } = await supabase
          .from('commands')
          .select('*')
          .limit(1);
          
        if (structureError) {
          console.error('Erro ao verificar estrutura da tabela commands:', structureError);
          toast.error(`Erro ao acessar tabela de comandas: ${structureError.message}`);
          setLoading(false);
          return;
        }
        
        if (commandSample && commandSample.length > 0) {
          console.log('Colunas na tabela commands:', Object.keys(commandSample[0]));
        } else {
          console.log('Nenhuma comanda encontrada para verificar estrutura');
        }
        
        // Tentar buscar comandas diretamente pelo restaurant_id/restaurantId
        try {
          console.log('Tentando buscar comandas pelo restaurant_id...');
          const { data: directCommands, error: directError } = await supabase
            .from('commands')
            .select('*, table:table_id(*), user:user_id(*)')
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: false });
            
          if (!directError && directCommands && directCommands.length > 0) {
            console.log(`Comandas encontradas diretamente (${directCommands.length}):`, directCommands);
            setCommands(directCommands as unknown as CommandWithRelations[]);
            setLoading(false);
            return;
          }
          
          console.log('Tentando com restaurantId...');
          const { data: directCommands2, error: directError2 } = await supabase
            .from('commands')
            .select('*, table:table_id(*), user:user_id(*)')
            .eq('restaurantId', restaurantId)
            .order('created_at', { ascending: false });
            
          if (!directError2 && directCommands2 && directCommands2.length > 0) {
            console.log(`Comandas encontradas com restaurantId (${directCommands2.length}):`, directCommands2);
            setCommands(directCommands2 as unknown as CommandWithRelations[]);
            setLoading(false);
            return;
          }
        } catch (directQueryError) {
          console.error('Erro ao tentar busca direta por ID do restaurante:', directQueryError);
        }
        
        // Continuar com a abordagem baseada em mesas
        console.log('Tentando abordagem baseada em mesas do restaurante...');
        
        // Buscar mesas primeiro com restaurant_id
        let tables;
        try {
          console.log('Buscando mesas com restaurant_id...');
          const { data: tableData1, error: tableError1 } = await supabase
            .from('tables')
            .select('id')
            .eq('restaurant_id', restaurantId);
            
          if (!tableError1 && tableData1 && tableData1.length > 0) {
            tables = tableData1;
            console.log(`Mesas encontradas com restaurant_id (${tables.length})`, tables);
          } else {
            // Tentar com restaurantId
            console.log('Tentando buscar mesas com restaurantId...');
            const { data: tableData2, error: tableError2 } = await supabase
              .from('tables')
              .select('id')
              .eq('restaurantId', restaurantId);
              
            if (!tableError2 && tableData2 && tableData2.length > 0) {
              tables = tableData2;
              console.log(`Mesas encontradas com restaurantId (${tables.length})`, tables);
            }
          }
        } catch (tableError) {
          console.error('Erro ao buscar mesas:', tableError);
        }

        // Verifique quais colunas existem na tabela commands
        let tableIdField = 'table_id';
        let userIdField = 'user_id';
        
        if (commandSample && commandSample.length > 0) {
          const columns = Object.keys(commandSample[0]);
          if (columns.includes('tableId')) tableIdField = 'tableId';
          if (columns.includes('userId')) userIdField = 'userId';
          console.log(`Usando campos: ${tableIdField} e ${userIdField}`);
        }
        
        if (tables && tables.length > 0) {
          const tableIds = tables.map(t => t.id);
          console.log('IDs das mesas para filtro:', tableIds);
          
          let query = supabase
            .from('commands')
            .select(`*, table:${tableIdField}(*), user:${userIdField}(*)`)
            .in(tableIdField, tableIds)
            .order('created_at', { ascending: false });

          const { data, error } = await query;

          if (error) {
            console.error('Erro na busca final:', error);
            throw error;
          }

          if (data && data.length > 0) {
            console.log(`Comandas encontradas via relação com mesas (${data.length}):`, data);
            setCommands(data as unknown as CommandWithRelations[] || []);
          } else {
            console.log('Nenhuma comanda encontrada via relação com mesas');
            setCommands([]);
          }
        } else {
          // Se não houver mesas, não deve haver comandas
          console.log('Nenhuma mesa encontrada para o restaurante:', restaurantId);
          setCommands([]);
        }
      } catch (error: any) {
        console.error('Erro ao carregar comandas:', error);
        toast.error('Erro ao carregar comandas: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCommands();
  }, [router]);

  // Filtrar comandas com base no status selecionado
  const filteredCommands = filterStatus === 'all'
    ? commands
    : commands.filter(command => command.status === filterStatus);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open':
        return 'Aberta';
      case 'closed':
        return 'Fechada';
      case 'paid':
        return 'Paga';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-yellow-100 text-yellow-800';
      case 'paid':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      <Toaster position="top-right" />
      
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Comandas</h1>
          <p className="text-gray-600">Gerencie as comandas do seu restaurante</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          <div>
            <label htmlFor="filterStatus" className="block text-sm font-medium text-gray-700 mb-1">
              Filtrar por Status
            </label>
            <select
              id="filterStatus"
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Todos os status</option>
              <option value="open">Abertas</option>
              <option value="closed">Fechadas</option>
              <option value="paid">Pagas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total de Comandas</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">{commands.length}</div>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Comandas Abertas</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {commands.filter(c => c.status === 'open').length}
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
              <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total de Vendas</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      R$ {commands.reduce((sum, command) => sum + command.total, 0).toFixed(2)}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de comandas */}
      {loading ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-500">Carregando comandas...</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          {filteredCommands.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500">Nenhuma comanda encontrada</p>
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
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCommands.map((command) => (
                    <tr key={command.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Mesa #{command.table?.number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {command.user?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(command.status)}`}>
                          {getStatusText(command.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        R$ {command.total.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(command.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link href={`/admin/commands/${command.id}`} className="text-blue-600 hover:text-blue-900">
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
      )}
    </div>
  );
} 