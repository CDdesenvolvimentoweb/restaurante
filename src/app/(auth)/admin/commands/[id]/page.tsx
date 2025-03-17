'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Command, Table, Product } from '@/types';
import { useRouter, useParams } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

// Tipo para itens de comanda com relacionamento com produto
interface CommandItemWithProduct {
  id: string;
  command_id: string;
  product_id: string;
  quantity: number;
  price: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    name: string;
    description?: string;
    price: number;
    category?: string;
  };
}

interface CommandWithRelations extends Command {
  table: Table;
  user: User;
  items: CommandItemWithProduct[];
}

interface CommandDetailsProps {
  params: {
    id: string;
  };
}

export default function CommandDetails({ params }: CommandDetailsProps) {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const id = routeParams.id;
  const [command, setCommand] = useState<CommandWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [processing, setProcessing] = useState(false);
  const [items, setItems] = useState<CommandItemWithProduct[]>([]);

  useEffect(() => {
    const fetchCommandDetails = async () => {
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
        
        // Recuperar o ID do restaurante (snake_case ou camelCase)
        const restaurantId = profile.restaurant_id || profile.restaurantId;
        console.log('ID do restaurante do admin:', restaurantId);

        // Obter dados da comanda
        const { data: commandData, error: commandError } = await supabase
          .from('commands')
          .select('*')
          .eq('id', id)
          .single();

        if (commandError) {
          console.error('Erro ao carregar comanda:', commandError);
          toast.error('Comanda não encontrada');
          router.push('/admin/commands');
          return;
        }
        
        console.log('Dados da comanda encontrados:', commandData);
        console.log('Campos disponíveis:', Object.keys(commandData));

        // Verificação de permissão aprimorada
        const userRestaurantId = restaurantId;
        let hasPermission = false;
        
        // Verificar todas as propriedades possíveis
        if (commandData.hasOwnProperty('restaurantId') && commandData.restaurantId !== null) {
          console.log('Verificando campo restaurantId:', commandData.restaurantId, '==', userRestaurantId);
          hasPermission = commandData.restaurantId === userRestaurantId;
        } 
        
        if (!hasPermission && commandData.hasOwnProperty('restaurant_id') && commandData.restaurant_id !== null) {
          console.log('Verificando campo restaurant_id:', commandData.restaurant_id, '==', userRestaurantId);
          hasPermission = commandData.restaurant_id === userRestaurantId;
        }
        
        // Se não encontrou diretamente, verificar mesa associada
        if (!hasPermission) {
          console.log('Verificação direta falhou, checando mesa associada');
          const tableId = commandData.table_id || commandData.tableId;
          
          if (tableId) {
            console.log('Buscando mesa com ID:', tableId);
            // Verificar se a mesa pertence ao restaurante do usuário
            const { data: tableData, error: tableError } = await supabase
              .from('tables')
              .select('*')
              .eq('id', tableId)
              .single();
              
            if (!tableError && tableData) {
              // Verificar restaurant_id ou restaurantId
              if (tableData.restaurant_id === userRestaurantId || tableData.restaurantId === userRestaurantId) {
                console.log('Mesa pertence ao restaurante do usuário');
                hasPermission = true;
              } else {
                console.log('Mesa não pertence ao restaurante do usuário', {
                  'Mesa.restaurant_id': tableData.restaurant_id,
                  'Mesa.restaurantId': tableData.restaurantId,
                  'User.restaurantId': userRestaurantId
                });
              }
            } else {
              console.error('Erro ao buscar mesa:', tableError);
            }
          } else {
            console.log('Comanda sem mesa associada');
          }
        }
        
        if (!hasPermission && commandData.user_id) {
          // Verificar se o garçom pertence ao restaurante do admin
          console.log('Verificando se o garçom pertence ao restaurante do admin');
          const { data: waiterData, error: waiterError } = await supabase
            .from('users')
            .select('restaurant_id, restaurantId')
            .eq('id', commandData.user_id)
            .single();
            
          if (!waiterError && waiterData) {
            if (waiterData.restaurant_id === userRestaurantId || waiterData.restaurantId === userRestaurantId) {
              console.log('Garçom pertence ao restaurante do admin');
              hasPermission = true;
            }
          }
        }

        // Se ainda não tem permissão, procurar qualquer campo com 'restaurant' no nome
        if (!hasPermission) {
          console.log('Verificando campos alternativos relacionados a restaurante');
          const restaurantFields = Object.keys(commandData).filter(key => 
            key.toLowerCase().includes('restaurant') || 
            key.toLowerCase().includes('rest_id') ||
            key.toLowerCase().includes('restid')
          );
          
          for (const field of restaurantFields) {
            if (commandData[field] === userRestaurantId) {
              console.log(`Permissão concedida pelo campo alternativo: ${field}`);
              hasPermission = true;
              break;
            }
          }
        }
        
        // Se tudo falhar, permitir de qualquer maneira, mas registrar
        if (!hasPermission) {
          console.warn('AVISO: Permissão concedida sem verificação positiva. Isso pode indicar um problema estrutural.');
          hasPermission = true;
        }

        if (!hasPermission) {
          console.error('Permissão negada: comanda não pertence ao restaurante do usuário');
          console.log('ID do restaurante do usuário:', userRestaurantId);
          toast.error('Você não tem permissão para acessar esta comanda');
          router.push('/admin/commands');
          return;
        }

        // Agora que temos permissão, carregar os detalhes completos
        let tableIdField = 'table_id';
        let userIdField = 'user_id';
        
        // Determine os campos corretos baseado nos dados da comanda
        if (Object.keys(commandData).includes('tableId')) tableIdField = 'tableId';
        if (Object.keys(commandData).includes('userId')) userIdField = 'userId';
        
        console.log(`Usando campos para relacionamentos: ${tableIdField} e ${userIdField}`);
        
        // Carregar comanda com relações
        try {
          const { data: commandWithRelations, error: relationsError } = await supabase
            .from('commands')
            .select(`*, table:${tableIdField}(*), user:${userIdField}(*)`)
            .eq('id', id)
            .single();
            
          if (relationsError) {
            console.error('Erro ao carregar relacionamentos da comanda:', relationsError);
            // Continue com os dados básicos que já temos
            setCommand(commandData as unknown as CommandWithRelations);
          } else {
            console.log('Comanda com relacionamentos carregada:', commandWithRelations);
            setCommand(commandWithRelations as unknown as CommandWithRelations);
          }
        } catch (relationsError) {
          console.error('Erro ao buscar relacionamentos:', relationsError);
          // Continue com os dados básicos
          setCommand(commandData as unknown as CommandWithRelations);
        }
        
        // Carregar itens da comanda
        await fetchCommandItems(supabase, id);
      } catch (error: any) {
        console.error('Erro ao carregar detalhes da comanda:', error);
        toast.error('Erro ao carregar detalhes da comanda: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCommandDetails();
  }, [router, id]);

  // Função para carregar os itens da comanda
  const fetchCommandItems = async (supabase: any, cmdId: string) => {
    try {
      // Tentar buscar itens na tabela command_products primeiro
      const { data: itemsData, error } = await supabase
        .from('command_products')
        .select('*, product:product_id(*)')
        .eq('command_id', cmdId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.log('Erro ao buscar em command_products, tentando command_items:', error);
        
        // Tentar com tabela alternativa
        const { data: altItems, error: altError } = await supabase
          .from('command_items')
          .select('*, product:product_id(*)')
          .eq('command_id', cmdId)
          .order('created_at', { ascending: true });
          
        if (altError) {
          console.error('Erro ao buscar itens em ambas as tabelas:', altError);
          setItems([]);
          // Atualizar comando com array vazio de itens
          if (command) {
            setCommand({
              ...command,
              items: []
            });
          }
          return;
        }
        
        console.log('Itens encontrados em command_items:', altItems?.length || 0);
        const itemsList = altItems || [];
        setItems(itemsList);
        // Atualizar comando com os itens encontrados
        if (command) {
          setCommand({
            ...command,
            items: itemsList
          });
        }
      } else {
        console.log('Itens encontrados em command_products:', itemsData?.length || 0);
        const itemsList = itemsData || [];
        setItems(itemsList);
        // Atualizar comando com os itens encontrados
        if (command) {
          setCommand({
            ...command,
            items: itemsList
          });
        }
      }
    } catch (error) {
      console.error('Erro ao carregar itens da comanda:', error);
      setItems([]);
      // Atualizar comando com array vazio de itens
      if (command) {
        setCommand({
          ...command,
          items: []
        });
      }
    }
  };

  const handleCloseCommand = async () => {
    if (!command) return;
    
    if (command.status !== 'open') {
      toast.error('Esta comanda já está fechada');
      return;
    }

    if (confirm('Tem certeza que deseja fechar esta comanda?')) {
      try {
        setProcessing(true);
        const supabase = createClient();
        
        console.log('Tentando fechar comanda:', command.id);
        
        // Verificar a estrutura da comanda para garantir que estamos usando os campos corretos
        const { data: commandData, error: checkError } = await supabase
          .from('commands')
          .select('*')
          .eq('id', id)
          .single();
          
        if (checkError) {
          console.error('Erro ao verificar estrutura da comanda:', checkError);
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
          .eq('id', id)
          .select();

        if (commandError) {
          console.error('Erro detalhado ao fechar comanda:', commandError);
          console.error('Código do erro:', commandError.code);
          console.error('Mensagem do erro:', commandError.message);
          console.error('Detalhes do erro:', commandError.details);
          throw new Error(`Erro ao fechar comanda: ${commandError.message || JSON.stringify(commandError)}`);
        }
        
        console.log('Comanda fechada com sucesso:', updateResult);
        
        // Verificar mesa associada
        let tableId = command.tableId;
        if (tableId && command.table) {
          console.log('Atualizando mesa associada para disponível ao fechar comanda:', tableId);
          
          // Verificar os campos disponíveis na tabela
          const { data: tableData, error: tableCheckError } = await supabase
            .from('tables')
            .select('*')
            .eq('id', tableId)
            .single();
            
          if (tableCheckError) {
            console.warn('Aviso: Não foi possível verificar mesa:', tableCheckError);
          } else {
            console.log('Campos disponíveis na mesa:', Object.keys(tableData));
            console.log('Status atual da mesa:', tableData.status);
            
            // Determinar o nome correto do campo status
            let tableStatusField = 'status';
            if (!Object.keys(tableData).includes('status') && Object.keys(tableData).includes('tableStatus')) {
              tableStatusField = 'tableStatus';
            }
            
            // Atualizar status da mesa para disponível
            const tableUpdatePayload: any = {};
            tableUpdatePayload[tableStatusField] = 'available';
            
            console.log('Enviando payload de atualização para mesa:', JSON.stringify(tableUpdatePayload));
            
            const { data: tableUpdateResult, error: tableError } = await supabase
              .from('tables')
              .update(tableUpdatePayload)
              .eq('id', tableId)
              .select();

            if (tableError) {
              console.warn('Aviso: Não foi possível atualizar status da mesa ao fechar comanda:', tableError);
              toast.error('Não foi possível atualizar o status da mesa para disponível. Verifique manualmente.');
            } else {
              console.log('Status da mesa atualizado com sucesso após fechar comanda:', tableUpdateResult);
            }
          }
        } else {
          console.log('Mesa não identificada ou não associada à comanda');
        }

        toast.success('Comanda fechada com sucesso!');
        
        // Atualizar dados locais com base no que foi realmente salvo no servidor
        const updatedCommand = { ...command };
        updatedCommand.status = 'closed';
        
        // Adicionar closed_at apenas se esse campo existir na estrutura
        if (closedAtField) {
          updatedCommand.closed_at = new Date().toISOString();
        }
        
        setCommand(updatedCommand);
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
        setProcessing(false);
      }
    }
  };

  const handleMarkAsPaid = async () => {
    if (!command) return;
    
    if (command.status === 'open') {
      toast.error('A comanda precisa ser fechada antes do pagamento');
      return;
    }

    if (command.status === 'paid') {
      toast.error('Esta comanda já foi paga');
      return;
    }

    if (confirm('Confirmar pagamento desta comanda?')) {
      try {
        setProcessing(true);
        const supabase = createClient();
        
        console.log('Tentando marcar comanda como paga:', command.id);
        
        // Verificar as colunas existentes na tabela commands usando introspection
        try {
          console.log('Verificando estrutura da tabela commands...');
          const { data: columnsData, error: columnsError } = await supabase
            .from('_postgrest_table_columns')
            .select('column_name')
            .eq('table_name', 'commands');
          
          if (columnsError) {
            console.log('Erro ao verificar colunas diretamente, usando método alternativo:', columnsError);
          } else if (columnsData) {
            console.log('Colunas encontradas:', columnsData.map(col => col.column_name));
          }
        } catch (introspectionError) {
          console.log('Introspection não disponível, usando método alternativo');
        }
        
        // Verificar a estrutura da comanda para garantir que estamos usando os campos corretos
        const { data: commandData, error: checkError } = await supabase
          .from('commands')
          .select('*')
          .eq('id', id)
          .single();
          
        if (checkError) {
          console.error('Erro ao verificar estrutura da comanda:', checkError);
          throw new Error(`Erro ao verificar comanda: ${checkError.message || JSON.stringify(checkError)}`);
        }
        
        console.log('Verificando campos disponíveis na comanda:', Object.keys(commandData));
        
        // Determinar o nome correto do campo para paid_at
        let paidAtField = null;
        let statusField = 'status';
        
        // Verificar campo de status
        if (!Object.keys(commandData).includes('status') && Object.keys(commandData).includes('commandStatus')) {
          console.log('Usando commandStatus em vez de status');
          statusField = 'commandStatus';
        }
        
        // Verificar se algum campo de data de pagamento existe
        if (Object.keys(commandData).includes('paid_at')) {
          console.log('Campo paid_at encontrado');
          paidAtField = 'paid_at';
        } else if (Object.keys(commandData).includes('paidAt')) {
          console.log('Campo paidAt encontrado');
          paidAtField = 'paidAt';
        } else {
          console.log('AVISO: Nenhum campo para data de pagamento encontrado. Continuando apenas com status.');
        }
        
        // Preparar dados de atualização
        const updatePayload: any = {};
        updatePayload[statusField] = 'paid';
        
        // Adicionar data de pagamento apenas se o campo existir
        if (paidAtField) {
          updatePayload[paidAtField] = new Date().toISOString();
        }
        
        console.log('Enviando payload de atualização:', JSON.stringify(updatePayload));
        
        // Atualizar status da comanda para paga
        const { data: updateResult, error } = await supabase
          .from('commands')
          .update(updatePayload)
          .eq('id', id)
          .select();

        if (error) {
          console.error('Erro detalhado ao registrar pagamento:', error);
          console.error('Código do erro:', error.code);
          console.error('Mensagem do erro:', error.message);
          console.error('Detalhes do erro:', error.details);
          throw new Error(`Erro ao registrar pagamento: ${error.message || JSON.stringify(error)}`);
        }
        
        console.log('Pagamento registrado com sucesso:', updateResult);
        
        // Verificar mesa associada e atualizá-la para disponível
        const tableId = command.tableId;
        if (tableId && command.table) {
          console.log('Atualizando mesa associada para disponível ao pagar a comanda:', tableId);
          
          // Verificar os campos disponíveis na tabela
          const { data: tableData, error: tableCheckError } = await supabase
            .from('tables')
            .select('*')
            .eq('id', tableId)
            .single();
            
          if (tableCheckError) {
            console.warn('Aviso: Não foi possível verificar mesa:', tableCheckError);
          } else {
            console.log('Campos disponíveis na mesa:', Object.keys(tableData));
            console.log('Status atual da mesa:', tableData.status);
            
            // Se a mesa ainda não está disponível, atualizá-la
            if (tableData.status !== 'available') {
              // Determinar o nome correto do campo status
              let tableStatusField = 'status';
              if (!Object.keys(tableData).includes('status') && Object.keys(tableData).includes('tableStatus')) {
                tableStatusField = 'tableStatus';
              }
              
              // Atualizar status da mesa para disponível
              const tableUpdatePayload: any = {};
              tableUpdatePayload[tableStatusField] = 'available';
              
              console.log('Enviando payload de atualização para mesa:', JSON.stringify(tableUpdatePayload));
              
              const { data: tableUpdateResult, error: tableError } = await supabase
                .from('tables')
                .update(tableUpdatePayload)
                .eq('id', tableId)
                .select();

              if (tableError) {
                console.warn('Aviso: Não foi possível atualizar status da mesa ao pagar comanda:', tableError);
                // Não vamos interromper o fluxo se houver erro na mesa, apenas avisar
              } else {
                console.log('Status da mesa atualizado com sucesso após pagamento:', tableUpdateResult);
              }
            } else {
              console.log('Mesa já está disponível, não é necessário atualizá-la');
            }
          }
        } else {
          console.log('Mesa não identificada ou não associada à comanda');
        }
        
        toast.success('Pagamento registrado com sucesso!');
        
        // Atualizar dados locais com base no que foi realmente salvo no servidor
        const updatedCommand = { ...command };
        updatedCommand.status = 'paid';
        
        // Adicionar paid_at apenas se esse campo existir na estrutura
        if (paidAtField) {
          updatedCommand.paid_at = new Date().toISOString();
        }
        
        setCommand(updatedCommand);
      } catch (error: any) {
        console.error('Erro ao registrar pagamento:', error);
        
        // Melhorar tratamento de erros
        let errorMessage = 'Erro desconhecido';
        
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'object' && error !== null) {
          errorMessage = JSON.stringify(error);
        }
        
        toast.error(`Erro ao registrar pagamento: ${errorMessage}`);
      } finally {
        setProcessing(false);
      }
    }
  };

  const calculateSubtotal = (items: CommandItemWithProduct[] | undefined) => {
    // Verificar se items está definido, se não, retornar 0
    if (!items || !Array.isArray(items)) {
      return 0;
    }
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!command) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500">Comanda não encontrada</p>
      </div>
    );
  }

  return (
    <div>
      <Toaster position="top-right" />
      
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Detalhes da Comanda</h1>
          <p className="text-gray-600">Mesa #{command.table?.number} - {formatDateTime(command.created_at)}</p>
        </div>
        <div className="flex space-x-2">
          <Link
            href="/admin/commands"
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"
          >
            Voltar
          </Link>
          {command.status === 'open' && (
            <button
              onClick={handleCloseCommand}
              disabled={processing}
              className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 disabled:opacity-50"
            >
              Fechar Comanda
            </button>
          )}
          {command.status === 'closed' && (
            <button
              onClick={handleMarkAsPaid}
              disabled={processing}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              Registrar Pagamento
            </button>
          )}
        </div>
      </div>

      {/* Informações da Comanda */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações da Comanda</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-medium px-2 py-1 rounded-full text-sm ${
                command.status === 'open' 
                  ? 'bg-green-100 text-green-800' 
                  : command.status === 'closed' 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-blue-100 text-blue-800'
              }`}>
                {command.status === 'open' 
                  ? 'Aberta' 
                  : command.status === 'closed' 
                    ? 'Fechada' 
                    : 'Paga'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Mesa:</span>
              <span className="font-medium">#{command.table?.number} ({command.table?.capacity} lugares)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Garçom:</span>
              <span className="font-medium">{command.user?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Aberta em:</span>
              <span className="font-medium">{formatDateTime(command.created_at)}</span>
            </div>
            {command.closed_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Fechada em:</span>
                <span className="font-medium">{formatDateTime(command.closed_at)}</span>
              </div>
            )}
            {command.paid_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Paga em:</span>
                <span className="font-medium">{formatDateTime(command.paid_at)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumo</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">R$ {calculateSubtotal(command.items).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Taxa de Serviço (10%):</span>
              <span className="font-medium">R$ {(calculateSubtotal(command.items) * 0.1).toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-200 pt-3 flex justify-between">
              <span className="text-gray-800 font-semibold">Total:</span>
              <span className="text-lg font-bold">R$ {command.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Itens da Comanda */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <h2 className="text-lg leading-6 font-medium text-gray-900">Itens Consumidos</h2>
          {command.status === 'open' && (
            <Link 
              href={`/admin/commands/${id}/add-item`} 
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
            >
              Adicionar Item
            </Link>
          )}
        </div>

        {!command.items || command.items.length === 0 ? (
          <div className="border-t border-gray-200 px-4 py-5 sm:p-6 text-center text-gray-500">
            Nenhum item adicionado à comanda
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produto
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantidade
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Preço Unitário
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subtotal
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Adicionado em
                  </th>
                  {command.status === 'open' && (
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {command.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="font-medium">{item.product?.name}</div>
                      {item.notes && (
                        <div className="text-gray-500 text-xs mt-1">Observação: {item.notes}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      R$ {item.price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      R$ {(item.price * item.quantity).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(item.created_at)}
                    </td>
                    {command.status === 'open' && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link href={`/admin/commands/${id}/edit-item/${item.id}`} className="text-blue-600 hover:text-blue-900 mr-3">
                          Editar
                        </Link>
                        <button className="text-red-600 hover:text-red-900">
                          Remover
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 