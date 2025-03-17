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
  // Campos adicionais que podem aparecer na resposta do Supabase
  table_number?: number;
  tableNumber?: number;
  table_id?: string;
  user_id?: string;
  client_name?: string;
  closed_at?: string;
}

export default function CommandsList() {
  const router = useRouter();
  const [commands, setCommands] = useState<CommandWithRelations[]>([]);
  const [filteredCommands, setFilteredCommands] = useState<CommandWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyMyCommands, setShowOnlyMyCommands] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

        // Obter perfil e verificar se é gerente
        const { data: profile } = await supabase
          .from('users')
          .select('*, restaurant:restaurant_id(*)')
          .eq('id', authUser.id)
          .single();

        if (!profile || profile.role !== 'manager') {
          toast.error('Você não tem permissão para acessar esta página');
          router.push('/login');
          return;
        }

        setUser(profile as User);
        const restaurantId = profile.restaurant_id || profile.restaurantId;

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
        
        // Determinar os nomes das colunas
        if (commandSample && commandSample.length > 0) {
          console.log('Colunas na tabela commands:', Object.keys(commandSample[0]));
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
            console.log(`Comandas encontradas diretamente (${directCommands.length})`, directCommands);
            await processCommandList(supabase, directCommands);
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
            console.log(`Comandas encontradas com restaurantId (${directCommands2.length})`, directCommands2);
            await processCommandList(supabase, directCommands2);
            setLoading(false);
            return;
          }
        } catch (directQueryError) {
          console.error('Erro ao tentar busca direta por ID do restaurante:', directQueryError);
        }
        
        // Se não encontrou, buscar através das mesas
        try {
          console.log('Buscando mesas para o restaurante...');
          const { data: tableData, error: tableError } = await supabase
            .from('tables')
            .select('id')
            .eq('restaurant_id', restaurantId);
            
          if (tableError) {
            console.error('Erro ao buscar mesas:', tableError);
            throw tableError;
          }
          
          if (!tableData || tableData.length === 0) {
            console.log('Nenhuma mesa encontrada para este restaurante');
            setCommands([]);
            setFilteredCommands([]);
            setLoading(false);
            return;
          }
          
          const tableIds = tableData.map(t => t.id);
          console.log(`Encontradas ${tableIds.length} mesas. Buscando comandas associadas...`);
          
          const { data: commandsData, error: commandsError } = await supabase
            .from('commands')
            .select('*, table:table_id(*), user:user_id(*)')
            .in('table_id', tableIds)
            .order('created_at', { ascending: false });
            
          if (commandsError) {
            console.error('Erro ao buscar comandas:', commandsError);
            throw commandsError;
          }
          
          console.log(`Encontradas ${commandsData?.length || 0} comandas`);
          await processCommandList(supabase, commandsData || []);
        } catch (error) {
          console.error('Erro ao buscar comandas via mesas:', error);
          setCommands([]);
          setFilteredCommands([]);
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

  // Função auxiliar para processar a lista de comandas
  const processCommandList = async (supabase: any, commandsList: any[]) => {
    // Carregar itens para cada comanda
    const commandsWithItems = await Promise.all(
      commandsList.map(async (command) => {
        let items = [];
        
        // Tentar buscar itens em command_products primeiro
        try {
          const { data, error } = await supabase
            .from('command_products')
            .select('*, product:product_id(*)')
            .eq('command_id', command.id);
            
          if (!error && data && data.length > 0) {
            items = data;
          } else {
            // Tentar com command_items
            const { data: altData, error: altError } = await supabase
              .from('command_items')
              .select('*, product:product_id(*)')
              .eq('command_id', command.id);
              
            if (!altError && altData) {
              items = altData;
            }
          }
        } catch (itemsError) {
          console.error(`Erro ao buscar itens para comanda ${command.id}:`, itemsError);
        }
        
        // Calcular total
        let total = command.total;
        
        // Se o total não estiver preenchido, calcular a partir dos itens
        if (!total || isNaN(total) || total <= 0) {
          total = items.reduce((sum: number, item: any) => {
            const quantity = item.quantity || 0;
            const price = item.price || 0;
            return sum + (price * quantity);
          }, 0);
          
          // Atualizar o total da comanda
          command.total = total;
        }
        
        return { ...command, items, total };
      })
    );

    setCommands(commandsWithItems as CommandWithRelations[]);
    applyFilters(commandsWithItems as CommandWithRelations[], filterStatus, searchTerm, showOnlyMyCommands, user?.id);
  };

  // Aplicar filtros às comandas
  const applyFilters = (commandsList: CommandWithRelations[], status: string, search: string, onlyMine: boolean, userId?: string) => {
    let filtered = [...commandsList];
    
    // Filtrar por status
    if (status !== 'all') {
      filtered = filtered.filter(command => command.status === status);
    }
    
    // Filtrar por pesquisa (mesa ou nome do cliente)
    if (search.trim()) {
      const lowerSearch = search.toLowerCase().trim();
      filtered = filtered.filter(command => {
        const tableNumber = command.table?.number || command.table_number || command.tableNumber;
        const tableStr = String(tableNumber || '');
        const clientName = command.client_name || '';
        
        return tableStr.includes(lowerSearch) || 
               clientName.toLowerCase().includes(lowerSearch);
      });
    }
    
    // Filtrar apenas minhas comandas
    if (onlyMine && userId) {
      filtered = filtered.filter(command => command.user_id === userId || command.userId === userId);
    }
    
    setFilteredCommands(filtered);
  };

  // Quando os filtros mudarem, aplicar aos comandas existentes
  useEffect(() => {
    applyFilters(commands, filterStatus, searchTerm, showOnlyMyCommands, user?.id);
  }, [filterStatus, searchTerm, showOnlyMyCommands, commands, user]);

  const handleCloseCommand = async (command: CommandWithRelations) => {
    if (!confirm(`Deseja realmente fechar a comanda da Mesa ${command.table?.number || command.table_number || command.tableNumber || 'desconhecida'}?`)) {
      return;
    }
    
    try {
      setSubmitting(true);
      const supabase = createClient();
      
      console.log('Tentando fechar comanda ID:', command.id);
      
      // Verificar a estrutura da comanda para garantir que estamos usando os campos corretos
      const { data: commandData, error: checkError } = await supabase
        .from('commands')
        .select('*')
        .eq('id', command.id)
        .single();
        
      if (checkError) {
        console.error('Erro ao verificar comanda antes de fechar:', checkError);
        throw new Error(`Erro ao verificar comanda: ${checkError.message || JSON.stringify(checkError)}`);
      }
      
      console.log('Verificando campos disponíveis na comanda:', Object.keys(commandData));
      
      // Determinar o nome correto dos campos
      let closedAtField = null;
      let statusField = 'status';
      
      // Verificar campo de status
      if (!Object.keys(commandData).includes('status') && Object.keys(commandData).includes('commandStatus')) {
        console.log('Usando commandStatus em vez de status');
        statusField = 'commandStatus';
      }
      
      // Verificar se algum campo de data de fechamento existe
      if (Object.keys(commandData).includes('closed_at')) {
        console.log('Campo closed_at encontrado');
        closedAtField = 'closed_at';
      } else if (Object.keys(commandData).includes('closedAt')) {
        console.log('Campo closedAt encontrado');
        closedAtField = 'closedAt';
      } else {
        console.log('AVISO: Nenhum campo para data de fechamento encontrado. Continuando apenas com status.');
      }
      
      // Preparar dados de atualização
      const updatePayload: any = {};
      updatePayload[statusField] = 'closed';
      
      // Adicionar data de fechamento apenas se o campo existir
      if (closedAtField) {
        updatePayload[closedAtField] = new Date().toISOString();
      }
      
      console.log('Enviando payload de atualização para comanda:', JSON.stringify(updatePayload));
      
      // Atualizar status da comanda para fechada
      const { data: updateResult, error: commandError } = await supabase
        .from('commands')
        .update(updatePayload)
        .eq('id', command.id)
        .select();

      if (commandError) {
        console.error('Erro detalhado ao fechar comanda:', commandError);
        console.error('Código do erro:', commandError.code);
        console.error('Mensagem do erro:', commandError.message);
        console.error('Detalhes do erro:', commandError.details);
        throw new Error(`Erro ao fechar comanda: ${commandError.message || JSON.stringify(commandError)}`);
      }
      
      console.log('Comanda fechada com sucesso:', updateResult);
      
      // Atualizar mesa associada para disponível
      const tableId = command.tableId || command.table_id;
      if (tableId) {
        const { error: tableError } = await supabase
          .from('tables')
          .update({ status: 'available' })
          .eq('id', tableId);

        if (tableError) {
          console.warn('Aviso: Não foi possível atualizar status da mesa:', tableError);
        }
      }

      toast.success('Comanda fechada com sucesso!');
      
      // Atualizar dados locais
      const updatedCommands = commands.map(cmd => {
        if (cmd.id === command.id) {
          return { 
            ...cmd, 
            status: 'closed' as const,
            closed_at: new Date().toISOString()
          };
        }
        return cmd;
      });
      
      setCommands(updatedCommands);
      applyFilters(updatedCommands, filterStatus, searchTerm, showOnlyMyCommands, user?.id);
    } catch (error: any) {
      console.error('Erro ao fechar comanda:', error);
      
      // Melhorar tratamento de erros
      let errorMessage = 'Erro desconhecido';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      }
      
      toast.error(`Erro ao fechar comanda: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div>
      <Toaster position="top-right" />
      
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Comandas</h1>
        <Link 
          href="/waiter/commands/new" 
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          Nova Comanda
        </Link>
      </div>
      
      {/* Filtros */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
            <div>
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                id="status-filter"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="all">Todos</option>
                <option value="open">Abertas</option>
                <option value="closed">Fechadas</option>
                <option value="paid">Pagas</option>
              </select>
            </div>
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">Buscar mesa ou cliente</label>
              <input
                id="search"
                type="text"
                placeholder="Número da mesa ou nome do cliente"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>
          <div className="flex items-center">
            <input
              id="my-commands"
              type="checkbox"
              checked={showOnlyMyCommands}
              onChange={(e) => setShowOnlyMyCommands(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="my-commands" className="ml-2 block text-sm text-gray-900">
              Mostrar apenas minhas comandas
            </label>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredCommands.length === 0 ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6 text-center">
          <p className="text-gray-500">Nenhuma comanda encontrada.</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mesa
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Garçom
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Abertura
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCommands.map(command => (
                  <tr key={command.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Mesa {command.table?.number || 
                            command.table_number || 
                            (typeof command.table === 'number' ? command.table : null) || 
                            command.tableNumber || 
                            'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(command.status)}`}>
                        {getStatusText(command.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {command.user?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(command.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {command.client_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(command.total || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <Link href={`/manager/commands/${command.id}`} className="text-blue-600 hover:text-blue-900">
                          Ver
                        </Link>
                        {command.status === 'open' && (
                          <button
                            onClick={() => handleCloseCommand(command)}
                            disabled={submitting}
                            className="text-yellow-600 hover:text-yellow-900"
                          >
                            Fechar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
} 