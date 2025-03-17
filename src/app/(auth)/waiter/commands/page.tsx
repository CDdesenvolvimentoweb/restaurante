'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/types';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

type Command = {
  id: string;
  table_number?: number | null;
  table?: number | null;
  tableNumber?: number | null;
  table_id?: string | null;
  tableId?: string | null;
  restaurant_id?: string | null;
  restaurantId?: string | null;
  user_id?: string | null;
  userId?: string | null;
  status: string;
  created_at: string;
  closed_at?: string | null;
  total?: number;
  items?: CommandItem[];
  client_name?: string | null;
};

type CommandItem = {
  id: string;
  command_id: string;
  product_id: string;
  quantity: number;
  price: number;
  notes?: string | null;
  product_name?: string;
};

type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
};

export default function WaiterCommands() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [commands, setCommands] = useState<Command[]>([]);
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCommand, setSelectedCommand] = useState<Command | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItem, setNewItem] = useState({
    product_id: '',
    quantity: 1,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const checkAuthAndLoadCommands = async () => {
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
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (!profile || profile.role !== 'waiter') {
          toast.error('Você não tem permissão para acessar esta página');
          router.push('/login');
          return;
        }

        setUser(profile as User);
        const restaurantId = profile.restaurant_id || profile.restaurantId;

        if (!restaurantId) {
          toast.error('Usuário não está associado a um restaurante');
          return;
        }

        // Verificar estrutura das tabelas
        await checkTableStructure(supabase);

        // Obter comandas ativas do restaurante
        await fetchCommands(supabase, restaurantId);

        // Carregar produtos disponíveis
        await fetchProducts(supabase, restaurantId);
      } catch (error: any) {
        console.error('Erro ao verificar autenticação ou carregar dados:', error);
        toast.error(`Erro ao carregar dados: ${error.message || 'Verifique o console para mais detalhes'}`);
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoadCommands();
  }, [router]);

  const checkTableStructure = async (supabase: any) => {
    try {
      // Verificar estrutura da tabela de comandas
      const { data: commandSample, error: commandError } = await supabase
        .from('commands')
        .select('*')
        .limit(1);

      if (commandError) {
        console.error('Erro ao verificar tabela de comandas:', commandError);
        return;
      }

      // Verificar estrutura da tabela de itens de comanda
      const { data: itemSample, error: itemError } = await supabase
        .from('command_products')
        .select('*')
        .limit(1);

      if (itemError) {
        console.warn('Erro ao verificar tabela de itens de comanda:', itemError);
        console.warn('Tentando com nome alternativo: command_items');
        
        // Tentar com nome alternativo
        const { data: itemSample2, error: itemError2 } = await supabase
          .from('command_items')
          .select('*')
          .limit(1);
          
        if (itemError2) {
          console.error('Erro ao verificar tabelas de itens de comanda:', itemError2);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar estrutura das tabelas:', error);
    }
  };

  const fetchCommands = async (supabase: any, restaurantId: string) => {
    try {
      // Verificar se restaurantId é válido
      if (!restaurantId) {
        console.error('ID do restaurante inválido:', restaurantId);
        toast.error('ID do restaurante não encontrado. Verifique seu perfil de usuário.');
        return;
      }

      // Log do ID do restaurante para diagnóstico
      console.log('Tentando buscar comandas para o restaurante ID:', restaurantId);
      
      // Determinar nome correto da coluna
      let restaurantIdField = 'restaurant_id';
      
      // Verificar a estrutura da tabela commands
      const { data: commandSample, error: structureError } = await supabase
        .from('commands')
        .select('*')
        .limit(1);
      
      if (structureError) {
        console.error('Erro ao verificar estrutura da tabela commands:', structureError);
        console.error('Detalhes do erro:', JSON.stringify(structureError));
        toast.error(`Erro ao acessar tabela de comandas: ${structureError.message || 'Verifique o console e o banco de dados'}`);
        return;
      }
      
      console.log('Amostra da tabela commands:', commandSample);
      
      // Se não houver comandas, criar uma estrutura padrão para tentativa
      if (!commandSample || commandSample.length === 0) {
        console.log('Nenhuma comanda encontrada para verificar estrutura. Tentando formato padrão...');
        
        // Tentar buscar diretamente com ambos os formatos, sem usar o nome da coluna da amostra
        try {
          console.log('Tentando buscar comandas com restaurantId...');
          const { data: dataId, error: errorId } = await supabase
            .from('commands')
            .select('*')
            .eq('restaurantId', restaurantId)
            .eq('status', 'open')
            .limit(5);
            
          if (!errorId && dataId && dataId.length > 0) {
            console.log('Comandas encontradas usando restaurantId!');
            const commandsList = dataId as Command[];
            await processCommandList(supabase, commandsList);
            return;
          }
          
          console.log('Tentando buscar comandas com restaurant_id...');
          const { data: dataSnake, error: errorSnake } = await supabase
            .from('commands')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .eq('status', 'open')
            .limit(5);
            
          if (!errorSnake && dataSnake && dataSnake.length > 0) {
            console.log('Comandas encontradas usando restaurant_id!');
            const commandsList = dataSnake as Command[];
            await processCommandList(supabase, commandsList);
            return;
          }
          
          // Se ainda não houver comandas, verificar se a tabela existe
          try {
            // Em vez de consultar information_schema, apenas tentamos uma consulta simples
            // que retornaria sucesso se a tabela existir, mesmo sem resultados
            console.log('Verificando se a tabela commands existe...');
            const { error: tableCheckError } = await supabase
              .from('commands')
              .select('id')
              .limit(0);
              
            if (tableCheckError) {
              // Se der erro, a tabela provavelmente não existe
              console.error('Erro ao verificar existência da tabela commands:', 
                typeof tableCheckError === 'object' ? JSON.stringify(tableCheckError) : tableCheckError);
              toast.error('A tabela de comandas pode não existir no banco de dados.');
            } else {
              // Se não der erro, a tabela existe
              console.log('Tabela commands existe, mas não foram encontradas comandas para este restaurante.');
              toast.success('Não há comandas abertas para este restaurante.');
              setCommands([]);
              setFilteredCommands([]);
            }
          } catch (tableCheckError) {
            console.error('Erro ao verificar tabela:', 
              typeof tableCheckError === 'object' ? JSON.stringify(tableCheckError) : tableCheckError);
            toast.error('Erro ao verificar estrutura do banco de dados. Contate o suporte.');
          }
          return;
        } catch (directError: any) {
          console.error('Erro nas tentativas diretas:', directError);
          let errorMessage = 'Erro desconhecido';
          
          if (directError instanceof Error) {
            errorMessage = directError.message;
          } else if (typeof directError === 'object' && directError !== null) {
            errorMessage = JSON.stringify(directError);
          }
          
          toast.error(`Erro ao buscar comandas diretamente: ${errorMessage}`);
          return;
        }
      }
      
      const columns = Object.keys(commandSample[0]);
      console.log('Colunas disponíveis em commands:', columns);
      
      // Tentar encontrar coluna relacionada ao restaurante
      let restaurantColumnFound = true;
      if (columns.includes('restaurantId')) {
        restaurantIdField = 'restaurantId';
      } else if (columns.includes('restaurant_id')) {
        restaurantIdField = 'restaurant_id';
      } else {
        console.log('Procurando por outras colunas de restaurante:', columns);
        // Tentar identificar outras possíveis colunas
        const restaurantColumn = columns.find(col => 
          col.toLowerCase().includes('restaurant') || 
          col.toLowerCase().includes('rest_id') || 
          col.toLowerCase().includes('rest')
        );
        
        if (restaurantColumn) {
          restaurantIdField = restaurantColumn;
          console.log('Coluna de restaurante alternativa encontrada:', restaurantColumn);
        } else {
          console.warn('Nenhuma coluna de restaurante encontrada na tabela commands');
          console.log('Exemplo de registro da tabela commands:', commandSample[0]);
          toast.success('Não foi possível filtrar por restaurante. Mostrando todas as comandas abertas.');
          restaurantColumnFound = false;
        }
      }
      
      if (restaurantColumnFound) {
        console.log(`Usando coluna ${restaurantIdField} com valor ${restaurantId} para buscar comandas`);
      } else {
        console.log('Buscando todas as comandas abertas sem filtrar por restaurante');
      }

      // Obter comandas ativas
      try {
        let query = supabase
          .from('commands')
          .select('*')
          .eq('status', 'open')
          .order('created_at', { ascending: false });
        
        // Adicionar filtro de restaurante apenas se a coluna for encontrada
        if (restaurantColumnFound) {
          query = query.eq(restaurantIdField, restaurantId);
        }
        
        const { data, error } = await query;
  
        if (error) {
          console.error('Erro ao buscar comandas:', error);
          console.error('Detalhes do erro:', JSON.stringify(error));
          
          // Se der erro e temos uma coluna de restaurante, tentar com o nome alternativo
          if (restaurantColumnFound) {
            const alternativeField = restaurantIdField === 'restaurant_id' ? 'restaurantId' : 'restaurant_id';
            console.log(`Tentando novamente com ${alternativeField}...`);
            
            try {
              const { data: data2, error: error2 } = await supabase
                .from('commands')
                .select('*')
                .eq(alternativeField, restaurantId)
                .eq('status', 'open')
                .order('created_at', { ascending: false });
                
              if (error2) {
                console.error('Segunda tentativa falhou:', error2);
                console.error('Detalhes do erro na segunda tentativa:', JSON.stringify(error2));
                
                // Tentar buscar sem filtro de restaurante como último recurso
                console.log('Tentando buscar todas as comandas abertas sem filtrar por restaurante');
                const { data: allData, error: allError } = await supabase
                  .from('commands')
                  .select('*')
                  .eq('status', 'open')
                  .order('created_at', { ascending: false });
                  
                if (allError) {
                  console.error('Terceira tentativa falhou:', allError);
                  throw new Error(`Erro ao buscar comandas: ${allError.message}`);
                }
                
                if (allData && allData.length > 0) {
                  console.log('Comandas abertas encontradas (sem filtro de restaurante):', allData.length);
                  toast.success(`${allData.length} comanda(s) encontrada(s)`);
                  await processCommandList(supabase, allData);
                } else {
                  console.log('Nenhuma comanda aberta encontrada (sem filtro)');
                  setCommands([]);
                  setFilteredCommands([]);
                }
                return;
              }
              
              // Se der certo com nome alternativo
              if (data2 && data2.length > 0) {
                console.log(`Comandas encontradas usando ${alternativeField}:`, data2.length);
                await processCommandList(supabase, data2);
              } else {
                console.log(`Nenhuma comanda encontrada usando ${alternativeField}`);
                setCommands([]);
                setFilteredCommands([]);
              }
              return;
            } catch (alternativeError: any) {
              console.error('Erro na tentativa alternativa:', alternativeError);
              let errorMessage = 'Erro desconhecido';
              
              if (alternativeError instanceof Error) {
                errorMessage = alternativeError.message;
              } else if (typeof alternativeError === 'object' && alternativeError !== null) {
                errorMessage = JSON.stringify(alternativeError);
              }
              
              toast.error(`Erro na busca alternativa: ${errorMessage}`);
              setCommands([]);
              setFilteredCommands([]);
              return;
            }
          } else {
            // Se não temos coluna de restaurante, já estamos buscando tudo
            // mas deu erro do mesmo jeito
            toast.error(`Erro ao buscar comandas: ${error.message}`);
            setCommands([]);
            setFilteredCommands([]);
            return;
          }
        } else if (data && data.length > 0) {
          // Se der certo com a primeira tentativa
          console.log('Comandas encontradas:', data.length);
          
          // Processar comandas
          await processCommandList(supabase, data);
        } else {
          console.log('Nenhuma comanda encontrada');
          setCommands([]);
          setFilteredCommands([]);
        }
      } catch (queryError: any) {
        console.error('Erro inesperado na consulta:', queryError);
        let errorMessage = 'Erro desconhecido';
        
        if (queryError instanceof Error) {
          errorMessage = queryError.message;
        } else if (typeof queryError === 'object' && queryError !== null) {
          errorMessage = JSON.stringify(queryError);
        }
        
        toast.error(`Erro na consulta: ${errorMessage}`);
        setCommands([]);
        setFilteredCommands([]);
      }
      
    } catch (error: any) {
      console.error('Erro ao buscar comandas:', error);
      let errorMessage = 'Erro desconhecido';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      }
      
      toast.error(`Erro ao buscar comandas: ${errorMessage}`);
      setCommands([]);
      setFilteredCommands([]);
    }
  };

  // Função auxiliar para processar a lista de comandas
  const processCommandList = async (supabase: any, commandsList: Command[]) => {
    // Log para depuração dos dados das comandas
    console.log('Dados das comandas recebidas:', JSON.stringify(commandsList, null, 2));
    
    // Carregar itens para cada comanda
    const commandsWithItems = await Promise.all(
      commandsList.map(async (command) => {
        // Debug para verificar os valores relacionados à mesa
        console.log(`Comanda ID ${command.id} - Valores da mesa:`, {
          table_number: command.table_number,
          table: command.table,
          tableNumber: command.tableNumber,
          table_id: command.table_id,
          tableId: command.tableId
        });
        
        // Se temos o table_id/tableId mas não temos table_number, buscar a mesa pelo ID
        if ((command.table_id || command.tableId) && 
            !command.table_number && !command.table && !command.tableNumber) {
          try {
            const tableId = command.table_id || command.tableId;
            console.log(`Buscando mesa com ID: ${tableId}`);
            
            // Buscar mesa pelo ID
            const { data: tableData } = await supabase
              .from('tables')
              .select('number')
              .eq('id', tableId)
              .maybeSingle();
              
            if (tableData?.number) {
              console.log(`Mesa encontrada! Número: ${tableData.number}`);
              // Atualizar número da mesa
              command.table_number = tableData.number;
              command.table = tableData.number;
            }
          } catch (error) {
            console.error('Erro ao buscar mesa pelo ID:', error);
          }
        }
        
        const items = await fetchCommandItems(supabase, command.id);
        
        // Calcular total
        let total = 0;
        if (items && items.length > 0) {
          total = items.reduce((sum: number, item: CommandItem) => sum + (item.price * item.quantity), 0);
        }
        
        return { ...command, items, total };
      })
    );

    console.log('Comandas processadas com itens:', commandsWithItems);
    setCommands(commandsWithItems);
    setFilteredCommands(commandsWithItems);
  };

  const fetchCommandItems = async (supabase: any, commandId: string) => {
    try {
      // Tentar buscar na tabela command_products
      let { data: items, error } = await supabase
        .from('command_products')
        .select('*, products(name)')
        .eq('command_id', commandId);

      if (error) {
        console.log('Erro ao buscar em command_products, tentando command_items:', error);
        
        // Tentar com nome alternativo command_items
        const { data: items2, error: error2 } = await supabase
          .from('command_items')
          .select('*, products(name)')
          .eq('command_id', commandId);
          
        if (error2) {
          console.error('Erro ao buscar itens da comanda:', error2);
          return [];
        }
        
        items = items2;
      }
      
      if (!items || items.length === 0) {
        return [];
      }
      
      // Processar itens para incluir o nome do produto
      return items.map((item: any) => ({
        ...item,
        product_name: item.products?.name || 'Produto sem nome'
      }));
    } catch (error) {
      console.error('Erro ao buscar itens da comanda:', error);
      return [];
    }
  };

  const fetchProducts = async (supabase: any, restaurantId: string) => {
    try {
      // Determinar nome correto da coluna
      let restaurantIdField = 'restaurant_id';
      const { data: productSample } = await supabase
        .from('products')
        .select('*')
        .limit(1);
      
      if (productSample && productSample.length > 0) {
        const columns = Object.keys(productSample[0]);
        if (columns.includes('restaurantId')) {
          restaurantIdField = 'restaurantId';
        }
      }

      // Obter produtos
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq(restaurantIdField, restaurantId)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      setProducts(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar produtos:', error);
      toast.error(`Erro ao buscar produtos: ${error.message}`);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (!value.trim()) {
      setFilteredCommands(commands);
      return;
    }
    
    const filtered = commands.filter(cmd => 
      (cmd.table_number?.toString() || cmd.table?.toString() || '')
        .toLowerCase().includes(value.toLowerCase()) ||
      (cmd.client_name || '')
        .toLowerCase().includes(value.toLowerCase())
    );
    
    setFilteredCommands(filtered);
  };

  const handleAddItem = (command: Command) => {
    setSelectedCommand(command);
    setNewItem({
      product_id: '',
      quantity: 1,
      notes: '',
    });
    setShowAddItemModal(true);
  };

  const handleCloseCommand = async (command: Command) => {
    if (!confirm(`Deseja realmente fechar a comanda ${command.table_number || command.table || ''}?`)) {
      return;
    }
    
    try {
      setSubmitting(true);
      const supabase = createClient();
      
      const { error } = await supabase
        .from('commands')
        .update({ 
          status: 'closed',
          closed_at: new Date().toISOString() 
        })
        .eq('id', command.id);
        
      if (error) {
        throw error;
      }
      
      toast.success('Comanda fechada com sucesso!');
      
      // Recarregar comandas
      await fetchCommands(supabase, user?.restaurant_id || user?.restaurantId || '');
    } catch (error: any) {
      console.error('Erro ao fechar comanda:', error);
      toast.error(`Erro ao fechar comanda: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCommand || !newItem.product_id || newItem.quantity <= 0) {
      toast.error('Preencha todos os campos corretamente');
      return;
    }
    
    try {
      setSubmitting(true);
      const supabase = createClient();
      
      // Obter o produto selecionado
      const selectedProduct = products.find(p => p.id === newItem.product_id);
      if (!selectedProduct) {
        throw new Error('Produto não encontrado');
      }
      
      // Verificar a estrutura da tabela de itens
      const { data: tableSample, error: tableError } = await supabase
        .from('command_products')
        .select('*')
        .limit(1);
        
      let tableToUse = 'command_products';
      
      if (tableError) {
        console.log('Erro ao verificar command_products, tentando command_items:', tableError);
        
        // Tentar command_items
        const { data: tableSample2, error: tableError2 } = await supabase
          .from('command_items')
          .select('*')
          .limit(1);
          
        if (tableError2) {
          throw new Error('Não foi possível encontrar a tabela de itens de comanda');
        }
        
        tableToUse = 'command_items';
      }
      
      // Adicionar o item à comanda
      const { error } = await supabase
        .from(tableToUse)
        .insert({
          command_id: selectedCommand.id,
          product_id: newItem.product_id,
          quantity: newItem.quantity,
          price: selectedProduct.price,
          notes: newItem.notes.trim() || null
        });
        
      if (error) {
        throw error;
      }
      
      toast.success('Item adicionado com sucesso!');
      setShowAddItemModal(false);
      
      // Recarregar comandas
      await fetchCommands(supabase, user?.restaurant_id || user?.restaurantId || '');
    } catch (error: any) {
      console.error('Erro ao adicionar item:', error);
      toast.error(`Erro ao adicionar item: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewCommand = () => {
    router.push('/waiter/commands/new');
  };

  const handleViewCommand = (command: Command) => {
    router.push(`/waiter/commands/${command.id}`);
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
      
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Comandas Ativas</h1>
          <p className="text-gray-600">Gerencie as comandas abertas do restaurante</p>
        </div>
        <button
          onClick={handleNewCommand}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nova Comanda
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Buscar por mesa ou cliente..."
              value={searchTerm}
              onChange={handleSearch}
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        {filteredCommands.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma comanda ativa</h3>
            <p className="mt-1 text-sm text-gray-500">Crie uma nova comanda para começar.</p>
            <div className="mt-6">
              <button
                type="button"
                onClick={handleNewCommand}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Nova Comanda
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCommands.map(command => (
              <div key={command.id} className="border rounded-lg shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                  <div>
                    <span className="font-medium text-gray-900">
                      Mesa {command.table_number || command.table || command.tableNumber || 'N/A'}
                    </span>
                    {command.client_name && (
                      <span className="ml-2 text-sm text-gray-500">
                        - {command.client_name}
                      </span>
                    )}
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Aberta
                  </span>
                </div>
                
                <div className="px-4 py-3">
                  <div className="text-sm mb-2">
                    <span className="text-gray-500">Aberta em: </span>
                    <span className="font-medium">
                      {new Date(command.created_at).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  
                  <div className="text-sm mb-4">
                    <span className="text-gray-500">Itens: </span>
                    <span className="font-medium">
                      {command.items?.length || 0}
                    </span>
                  </div>
                  
                  <div className="mb-4">
                    <div className="font-semibold mb-2 border-b pb-1">Produtos:</div>
                    {command.items && command.items.length > 0 ? (
                      <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
                        {command.items.map(item => (
                          <li key={item.id} className="flex justify-between">
                            <span>{item.quantity}x {item.product_name}</span>
                            <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">Nenhum item adicionado</p>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center font-bold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span>R$ {command.total?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
                
                <div className="bg-gray-50 px-4 py-3 border-t flex justify-between">
                  <button
                    onClick={() => handleViewCommand(command)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Ver Detalhes
                  </button>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleAddItem(command)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm py-1 px-3 rounded"
                      disabled={submitting}
                    >
                      Adicionar Item
                    </button>
                    <button
                      onClick={() => handleCloseCommand(command)}
                      className="bg-green-600 hover:bg-green-700 text-white text-sm py-1 px-3 rounded"
                      disabled={submitting}
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal para adicionar item */}
      {showAddItemModal && selectedCommand && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg overflow-hidden shadow-xl max-w-md w-full">
            <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                Adicionar Item à Mesa {selectedCommand.table_number || selectedCommand.table || selectedCommand.tableNumber || 'N/A'}
              </h3>
              <button 
                onClick={() => setShowAddItemModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmitNewItem} className="p-4">
              <div className="mb-4">
                <label htmlFor="product" className="block text-sm font-medium text-gray-700 mb-1">
                  Produto *
                </label>
                <select
                  id="product"
                  value={newItem.product_id}
                  onChange={(e) => setNewItem({...newItem, product_id: e.target.value})}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                >
                  <option value="">Selecione um produto</option>
                  {products.length > 0 && (
                    <>
                      {/* Agrupar produtos por categoria */}
                      {Array.from(new Set(products.map(p => p.category))).map(category => (
                        <optgroup key={category} label={category}>
                          {products
                            .filter(p => p.category === category)
                            .map(product => (
                              <option key={product.id} value={product.id}>
                                {product.name} - R$ {product.price.toFixed(2)}
                              </option>
                            ))
                          }
                        </optgroup>
                      ))}
                    </>
                  )}
                </select>
              </div>
              
              <div className="mb-4">
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                  Quantidade *
                </label>
                <input
                  type="number"
                  id="quantity"
                  min="1"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({...newItem, quantity: parseInt(e.target.value) || 1})}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  id="notes"
                  value={newItem.notes}
                  onChange={(e) => setNewItem({...newItem, notes: e.target.value})}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  rows={3}
                  placeholder="Ex: Sem cebola, bem passado, etc."
                />
              </div>
              
              <div className="mt-5 sm:mt-6 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm disabled:opacity-50"
                >
                  {submitting ? 'Adicionando...' : 'Adicionar Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 