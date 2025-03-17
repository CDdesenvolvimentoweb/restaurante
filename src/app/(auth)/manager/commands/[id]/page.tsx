'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Command, Table, Product } from '@/types';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

interface CommandItem {
  id: string;
  command_id: string;
  product_id: string;
  quantity: number;
  price: number;
  notes?: string;
  product: Product;
}

// Tipo estendido para incluir relacionamentos e campos variantes
interface CommandWithRelations extends Command {
  table: Table;
  user: User;
  items: CommandItem[];
  // Campos adicionais que podem aparecer
  table_number?: number;
  tableNumber?: number;
  table_id?: string;
  user_id?: string;
  client_name?: string;
  closed_at?: string;
  payment_method?: string;
  paid_amount?: number;
  paid_at?: string;
}

export default function CommandDetails({ params }: { params: { id: string } }) {
  const router = useRouter();
  
  // TODO: Em uma versão futura do Next.js, será necessário usar React.use(params) para acessar os parâmetros
  const { id } = params;
  
  const [command, setCommand] = useState<CommandWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [showPaymentForm, setShowPaymentForm] = useState(false);

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

        // Obter perfil do usuário e verificar se é gerente
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (!profile || profile.role !== 'manager') {
          toast.error('Você não tem permissão para acessar esta página');
          router.push('/login');
          return;
        }

        setUser(profile as User);
        
        // Buscar detalhes da comanda
        const { data: commandData, error: commandError } = await supabase
          .from('commands')
          .select('*, table:table_id(*), user:user_id(*)')
          .eq('id', id)
          .single();
          
        if (commandError) {
          console.error('Erro ao buscar comanda:', commandError);
          toast.error(`Erro ao buscar detalhes da comanda: ${commandError.message}`);
          router.push('/manager/commands');
          return;
        }
        
        if (!commandData) {
          toast.error('Comanda não encontrada');
          router.push('/manager/commands');
          return;
        }
        
        // Buscar itens da comanda - tentar em command_products primeiro
        let items: CommandItem[] = [];
        
        try {
          const { data: productsData, error: productsError } = await supabase
            .from('command_products')
            .select('*, product:product_id(*)')
            .eq('command_id', id);
            
          if (!productsError && productsData && productsData.length > 0) {
            items = productsData as unknown as CommandItem[];
          } else {
            // Se não encontrar, tentar em command_items
            const { data: itemsData, error: itemsError } = await supabase
              .from('command_items')
              .select('*, product:product_id(*)')
              .eq('command_id', id);
              
            if (!itemsError && itemsData) {
              items = itemsData as unknown as CommandItem[];
            }
          }
        } catch (itemsError) {
          console.error('Erro ao buscar itens da comanda:', itemsError);
        }
        
        // Calcular total (caso não esteja preenchido)
        let total = commandData.total;
        
        if (!total || isNaN(total) || total <= 0) {
          total = items.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
          }, 0);
          
          // Atualizar o total na comanda
          const { error: updateError } = await supabase
            .from('commands')
            .update({ total })
            .eq('id', id);
            
          if (updateError) {
            console.warn('Não foi possível atualizar o total da comanda:', updateError);
          }
        }
        
        setCommand({ ...commandData, items, total } as CommandWithRelations);
        setPaymentAmount(total.toString());
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
    
    if (!confirm(`Deseja realmente fechar a comanda da Mesa ${getTableNumber()}?`)) {
      return;
    }
    
    try {
      setSubmitting(true);
      const supabase = createClient();
      
      // Verificar a estrutura da comanda
      const { data: commandData, error: checkError } = await supabase
        .from('commands')
        .select('*')
        .eq('id', command.id)
        .single();
        
      if (checkError) {
        console.error('Erro ao verificar comanda:', checkError);
        throw new Error(`Erro ao verificar comanda: ${checkError.message}`);
      }
      
      console.log('Verificando campos disponíveis na comanda:', Object.keys(commandData));
      
      // Determinar o nome correto dos campos
      let closedAtField = null;
      let statusField = 'status';
      
      if (!Object.keys(commandData).includes('status') && Object.keys(commandData).includes('commandStatus')) {
        statusField = 'commandStatus';
      }
      
      if (Object.keys(commandData).includes('closed_at')) {
        closedAtField = 'closed_at';
      } else if (Object.keys(commandData).includes('closedAt')) {
        closedAtField = 'closedAt';
      }
      
      // Preparar dados de atualização
      const updatePayload: any = {};
      updatePayload[statusField] = 'closed';
      
      if (closedAtField) {
        updatePayload[closedAtField] = new Date().toISOString();
      }
      
      // Atualizar comanda
      const { error: updateError } = await supabase
        .from('commands')
        .update(updatePayload)
        .eq('id', command.id);
        
      if (updateError) {
        console.error('Erro ao fechar comanda:', updateError);
        throw new Error(`Erro ao fechar comanda: ${updateError.message}`);
      }
      
      // Atualizar mesa para disponível
      const tableId = command.tableId || command.table_id;
      if (tableId) {
        await supabase
          .from('tables')
          .update({ status: 'available' })
          .eq('id', tableId);
      }
      
      toast.success('Comanda fechada com sucesso!');
      
      // Atualizar estado local
      setCommand({
        ...command,
        status: 'closed' as const,
        closed_at: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Erro ao fechar comanda:', error);
      toast.error(`Erro ao fechar comanda: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkAsPaid = async (e: FormEvent) => {
    e.preventDefault();
    if (!command) return;
    
    try {
      setSubmitting(true);
      const supabase = createClient();
      
      // Converter valor para número
      const paidAmount = parseFloat(paymentAmount.replace(',', '.'));
      
      if (isNaN(paidAmount)) {
        toast.error('Valor de pagamento inválido');
        return;
      }
      
      // Verificar a estrutura da comanda
      const { data: commandData, error: checkError } = await supabase
        .from('commands')
        .select('*')
        .eq('id', command.id)
        .single();
        
      if (checkError) {
        console.error('Erro ao verificar comanda:', checkError);
        throw new Error(`Erro ao verificar comanda: ${checkError.message}`);
      }
      
      // Determinar o nome correto dos campos
      let paidAtField = null;
      let statusField = 'status';
      let paymentMethodField = 'payment_method';
      let paidAmountField = 'paid_amount';
      
      if (!Object.keys(commandData).includes('status') && Object.keys(commandData).includes('commandStatus')) {
        statusField = 'commandStatus';
      }
      
      if (Object.keys(commandData).includes('paid_at')) {
        paidAtField = 'paid_at';
      } else if (Object.keys(commandData).includes('paidAt')) {
        paidAtField = 'paidAt';
      }
      
      if (!Object.keys(commandData).includes('payment_method') && Object.keys(commandData).includes('paymentMethod')) {
        paymentMethodField = 'paymentMethod';
      }
      
      if (!Object.keys(commandData).includes('paid_amount') && Object.keys(commandData).includes('paidAmount')) {
        paidAmountField = 'paidAmount';
      }
      
      // Preparar dados de atualização
      const updatePayload: any = {};
      updatePayload[statusField] = 'paid';
      updatePayload[paymentMethodField] = paymentMethod;
      updatePayload[paidAmountField] = paidAmount;
      
      if (paidAtField) {
        updatePayload[paidAtField] = new Date().toISOString();
      }
      
      // Atualizar comanda
      const { error: updateError } = await supabase
        .from('commands')
        .update(updatePayload)
        .eq('id', command.id);
        
      if (updateError) {
        console.error('Erro ao marcar comanda como paga:', updateError);
        throw new Error(`Erro ao marcar comanda como paga: ${updateError.message}`);
      }
      
      toast.success('Comanda marcada como paga com sucesso!');
      
      // Atualizar estado local
      setCommand({
        ...command,
        status: 'paid' as const,
        payment_method: paymentMethod,
        paid_amount: paidAmount,
        paid_at: new Date().toISOString()
      });
      
      setShowPaymentForm(false);
    } catch (error: any) {
      console.error('Erro ao marcar comanda como paga:', error);
      toast.error(`Erro ao marcar comanda como paga: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getTableNumber = () => {
    if (!command) return 'N/A';
    return command.table?.number || 
           command.table_number || 
           (typeof command.table === 'number' ? command.table : null) || 
           command.tableNumber || 
           'N/A';
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

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'cash':
        return 'Dinheiro';
      case 'credit':
        return 'Cartão de Crédito';
      case 'debit':
        return 'Cartão de Débito';
      case 'pix':
        return 'PIX';
      default:
        return method;
    }
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
      <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6 text-center">
        <p className="text-gray-500">Comanda não encontrada.</p>
        <Link href="/manager/commands" className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
          Voltar para comandas
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Toaster position="top-right" />
      
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Comanda #{command.id.slice(0, 8)} - Mesa {getTableNumber()}
        </h1>
        <div className="flex space-x-2">
          <Link 
            href="/manager/commands" 
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
          >
            Voltar
          </Link>
        </div>
      </div>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Detalhes da Comanda
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Informações da comanda e itens consumidos
            </p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(command.status)}`}>
            {getStatusText(command.status)}
          </span>
        </div>
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Mesa</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {getTableNumber()}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Cliente</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {command.client_name || '-'}
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Garçom</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {command.user?.name || 'N/A'}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Data de Abertura</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatDate(command.created_at)}
              </dd>
            </div>
            {command.closed_at && (
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Data de Fechamento</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {formatDate(command.closed_at)}
                </dd>
              </div>
            )}
            {command.paid_at && (
              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Data de Pagamento</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {formatDate(command.paid_at)}
                </dd>
              </div>
            )}
            {command.payment_method && (
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Método de Pagamento</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {getPaymentMethodText(command.payment_method)}
                </dd>
              </div>
            )}
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Total</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900 sm:mt-0 sm:col-span-2">
                {formatCurrency(command.total || 0)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Itens Consumidos
          </h3>
        </div>
        <div className="border-t border-gray-200">
          {command.items && command.items.length > 0 ? (
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
                      Preço Unit.
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subtotal
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Observações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {command.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.product?.name || 'Produto desconhecido'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(item.price * item.quantity)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.notes || '-'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                      Total:
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {formatCurrency(command.total || 0)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-5 sm:px-6 text-center">
              <p className="text-gray-500">Nenhum item encontrado.</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Ações */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Ações
          </h3>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {command.status === 'open' && (
              <button
                onClick={handleCloseCommand}
                disabled={submitting}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                {submitting ? 'Fechando...' : 'Fechar Comanda'}
              </button>
            )}
            
            {command.status === 'closed' && !showPaymentForm && (
              <button
                onClick={() => setShowPaymentForm(true)}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Registrar Pagamento
              </button>
            )}
          </div>
          
          {showPaymentForm && command.status === 'closed' && (
            <div className="mt-6 p-4 bg-gray-50 rounded-md">
              <form onSubmit={handleMarkAsPaid}>
                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  <div className="sm:col-span-3">
                    <label htmlFor="paymentAmount" className="block text-sm font-medium text-gray-700">
                      Valor do Pagamento
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        name="paymentAmount"
                        id="paymentAmount"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="sm:col-span-3">
                    <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700">
                      Método de Pagamento
                    </label>
                    <div className="mt-1">
                      <select
                        id="paymentMethod"
                        name="paymentMethod"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      >
                        <option value="cash">Dinheiro</option>
                        <option value="credit">Cartão de Crédito</option>
                        <option value="debit">Cartão de Débito</option>
                        <option value="pix">PIX</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="mt-5 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowPaymentForm(false)}
                    className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {submitting ? 'Salvando...' : 'Salvar Pagamento'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 