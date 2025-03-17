'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Command, Table, Product } from '@/types';
import { useRouter, useParams } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

interface CommandItemWithProduct {
  id: string;
  command_id: string;
  product_id: string;
  quantity: number;
  price: number;
  notes?: string;
  created_at: string;
  product: Product;
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

        // Obter detalhes da comanda
        const { data: commandData, error: commandError } = await supabase
          .from('commands')
          .select('*, table:table_id(*), user:user_id(*)')
          .eq('id', id)
          .single();

        if (commandError || !commandData) {
          toast.error('Comanda não encontrada');
          router.push('/admin/commands');
          return;
        }

        // Verificar se a comanda pertence ao restaurante do admin
        const { data: tableData } = await supabase
          .from('tables')
          .select('restaurant_id')
          .eq('id', commandData.table_id)
          .single();

        if (tableData?.restaurant_id !== profile.restaurantId) {
          toast.error('Você não tem permissão para acessar esta comanda');
          router.push('/admin/commands');
          return;
        }

        // Obter itens da comanda
        const { data: itemsData, error: itemsError } = await supabase
          .from('command_items')
          .select('*, product:product_id(*)')
          .eq('command_id', id)
          .order('created_at', { ascending: true });

        if (itemsError) {
          console.error('Erro ao carregar itens da comanda:', itemsError);
        }

        // Combinar dados da comanda com itens
        const commandWithItems = {
          ...commandData,
          items: itemsData || []
        } as CommandWithRelations;

        setCommand(commandWithItems);
      } catch (error: any) {
        console.error('Erro ao carregar detalhes da comanda:', error);
        toast.error('Erro ao carregar detalhes: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCommandDetails();
  }, [id, router]);

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
        
        // Atualizar status da comanda para fechada
        const { error: commandError } = await supabase
          .from('commands')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString()
          })
          .eq('id', id);

        if (commandError) {
          throw commandError;
        }

        // Atualizar status da mesa para disponível
        const { error: tableError } = await supabase
          .from('tables')
          .update({
            status: 'available'
          })
          .eq('id', command.tableId);

        if (tableError) {
          throw tableError;
        }

        toast.success('Comanda fechada com sucesso!');
        
        // Atualizar dados locais
        setCommand({
          ...command,
          status: 'closed',
          closed_at: new Date().toISOString()
        });
      } catch (error: any) {
        console.error('Erro ao fechar comanda:', error);
        toast.error('Erro ao fechar comanda: ' + error.message);
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
        
        // Atualizar status da comanda para paga
        const { error } = await supabase
          .from('commands')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString()
          })
          .eq('id', id);

        if (error) {
          throw error;
        }

        toast.success('Pagamento registrado com sucesso!');
        
        // Atualizar dados locais
        setCommand({
          ...command,
          status: 'paid',
          paid_at: new Date().toISOString()
        });
      } catch (error: any) {
        console.error('Erro ao registrar pagamento:', error);
        toast.error('Erro ao registrar pagamento: ' + error.message);
      } finally {
        setProcessing(false);
      }
    }
  };

  const calculateSubtotal = (items: CommandItemWithProduct[]) => {
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

        {command.items.length === 0 ? (
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