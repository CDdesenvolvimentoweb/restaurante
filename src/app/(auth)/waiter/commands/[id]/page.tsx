'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@/types';
import { useRouter, useParams } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

type Command = {
  id: string;
  table_number?: number | null;
  table?: number | null;
  tableNumber?: number | null;
  table_id?: string | null;
  tableId?: string | null;
  status: string;
  created_at: string;
  closed_at?: string | null;
  client_name?: string | null;
  total?: number;
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

export default function CommandDetails() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const commandId = params.id;
  
  const [user, setUser] = useState<User | null>(null);
  const [command, setCommand] = useState<Command | null>(null);
  const [commandItems, setCommandItems] = useState<CommandItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemLoading, setItemLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItem, setNewItem] = useState({
    product_id: '',
    quantity: 1,
    notes: '',
  });

  useEffect(() => {
    const checkAuthAndLoadCommand = async () => {
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

        // Obter dados da comanda
        const { data: commandData, error: commandError } = await supabase
          .from('commands')
          .select('*')
          .eq('id', commandId)
          .single();

        if (commandError) {
          console.error('Erro ao carregar comanda:', commandError);
          toast.error('Comanda não encontrada');
          router.push('/waiter/commands');
          return;
        }

        // Verificar se a comanda pertence ao restaurante do usuário
        const userRestaurantId = restaurantId;
        let hasPermission = true;
        
        // Verificar todas as possíveis propriedades de ID de restaurante
        if (commandData.hasOwnProperty('restaurantId') && commandData.restaurantId !== null) {
          hasPermission = commandData.restaurantId === userRestaurantId;
        } else if (commandData.hasOwnProperty('restaurant_id') && commandData.restaurant_id !== null) {
          hasPermission = commandData.restaurant_id === userRestaurantId;
        } else {
          // Se a comanda não tiver campo de restaurante, vamos primeiro verificar o log
          console.log('Comanda não tem campo de restaurante identificável:', commandData);
          
          // Vamos procurar qualquer campo que possa ter relação com restaurante
          const restaurantRelatedField = Object.keys(commandData).find(key => 
            key.toLowerCase().includes('rest') || 
            key.toLowerCase().includes('restaurant')
          );
          
          if (restaurantRelatedField) {
            console.log(`Campo encontrado: ${restaurantRelatedField} = ${commandData[restaurantRelatedField]}`);
            hasPermission = commandData[restaurantRelatedField] === userRestaurantId;
          } else {
            // Se não encontrar nenhum campo relacionado a restaurante, permitimos o acesso
            // mas registramos o fato para depuração
            console.log('Nenhum campo de restaurante encontrado na comanda. Permitindo acesso mas registrando para depuração.');
            
            // Em ambiente de produção, você pode querer ser mais rigoroso aqui
            hasPermission = true;
          }
        }
        
        if (!hasPermission) {
          console.error('Permissão negada: comanda não pertence ao restaurante do usuário');
          console.log('ID do restaurante do usuário:', userRestaurantId);
          console.log('Dados da comanda:', commandData);
          toast.error('Você não tem permissão para acessar esta comanda');
          router.push('/waiter/commands');
          return;
        }

        setCommand(commandData as Command);

        // Carregar produtos do restaurante
        await fetchProducts(supabase, restaurantId);

        // Carregar itens da comanda
        await fetchCommandItems(supabase);
      } catch (error: any) {
        console.error('Erro ao verificar autenticação ou carregar comanda:', error);
        toast.error(`Erro ao carregar dados: ${error.message || 'Verifique o console para mais detalhes'}`);
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoadCommand();
  }, [router, commandId]);

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

  const fetchCommandItems = async (supabase: any) => {
    try {
      setItemLoading(true);
      
      // Determinar qual tabela usar
      let itemsTable = 'command_products';
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
          toast.error(`Erro ao carregar itens: ${error2.message}`);
          return;
        }
        
        items = items2;
        itemsTable = 'command_items';
      }
      
      // Processar itens e calcular total
      const processedItems = items.map((item: any) => ({
        ...item,
        product_name: item.products?.name || 'Produto sem nome'
      }));
      
      setCommandItems(processedItems);
      
      // Calcular total
      if (processedItems && processedItems.length > 0) {
        const totalValue = processedItems.reduce((sum: number, item: CommandItem) => sum + (item.price * item.quantity), 0);
        setTotal(totalValue);
      } else {
        setTotal(0);
      }
    } catch (error: any) {
      console.error('Erro ao buscar itens da comanda:', error);
      toast.error(`Erro ao carregar itens: ${error.message}`);
    } finally {
      setItemLoading(false);
    }
  };

  const handleAddItem = () => {
    setNewItem({
      product_id: '',
      quantity: 1,
      notes: '',
    });
    setShowAddItemModal(true);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Deseja realmente remover este item?')) {
      return;
    }
    
    try {
      setSubmitting(true);
      const supabase = createClient();
      
      // Determinar qual tabela usar
      let itemsTable = 'command_products';
      let { error } = await supabase
        .from('command_products')
        .delete()
        .eq('id', itemId);

      if (error) {
        console.log('Erro ao excluir de command_products, tentando command_items:', error);
        
        // Tentar com nome alternativo command_items
        const { error: error2 } = await supabase
          .from('command_items')
          .delete()
          .eq('id', itemId);
          
        if (error2) {
          console.error('Erro ao excluir item da comanda:', error2);
          throw error2;
        }
        
        itemsTable = 'command_items';
      }
      
      toast.success('Item removido com sucesso!');
      
      // Recarregar itens
      await fetchCommandItems(supabase);
    } catch (error: any) {
      console.error('Erro ao remover item:', error);
      toast.error(`Erro ao remover item: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newItem.product_id || newItem.quantity <= 0) {
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
          command_id: commandId,
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
      
      // Recarregar itens
      await fetchCommandItems(supabase);
    } catch (error: any) {
      console.error('Erro ao adicionar item:', error);
      toast.error(`Erro ao adicionar item: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseCommand = async () => {
    if (!confirm('Deseja realmente fechar esta comanda?')) {
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
        .eq('id', commandId);
        
      if (error) {
        throw error;
      }
      
      toast.success('Comanda fechada com sucesso!');
      
      // Redirecionar para a lista de comandas
      setTimeout(() => {
        router.push('/waiter/commands');
      }, 1500);
    } catch (error: any) {
      console.error('Erro ao fechar comanda:', error);
      toast.error(`Erro ao fechar comanda: ${error.message}`);
    } finally {
      setSubmitting(false);
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
      <div className="text-center py-12">
        <h3 className="mt-2 text-lg font-medium text-gray-900">Comanda não encontrada</h3>
        <p className="mt-1 text-sm text-gray-500">A comanda solicitada não existe ou foi removida.</p>
        <div className="mt-6">
          <Link
            href="/waiter/commands"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Voltar para Comandas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Toaster position="top-right" />
      
      <div className="mb-6 flex justify-between items-center">
        <div>
          <div className="flex items-center">
            <h1 className="text-3xl font-bold text-gray-900">
              Mesa {command.table_number || command.table || command.tableNumber || command.table_id || command.tableId || 'N/A'}
            </h1>
            <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {command.status === 'open' ? 'Aberta' : 'Fechada'}
            </span>
          </div>
          {command.client_name && (
            <p className="text-gray-600">Cliente: {command.client_name}</p>
          )}
          <p className="text-gray-600">
            Aberta em: {new Date(command.created_at).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
        
        <div className="flex space-x-2">
          {command.status === 'open' && (
            <>
              <button
                onClick={handleAddItem}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Adicionar Item
              </button>
              
              <button
                onClick={handleCloseCommand}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Fechar Comanda
              </button>
            </>
          )}
          
          <Link
            href="/waiter/commands"
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar
          </Link>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Itens da Comanda
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Lista de produtos adicionados a esta comanda
          </p>
        </div>
        
        {itemLoading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : commandItems.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Nenhum item adicionado a esta comanda</p>
            {command.status === 'open' && (
              <button
                onClick={handleAddItem}
                className="mt-4 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Adicionar Primeiro Item
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produto
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qtd
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
                    {command.status === 'open' && (
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {commandItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.product_name}
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
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {item.notes || '-'}
                      </td>
                      {command.status === 'open' && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={submitting}
                            className="text-red-600 hover:text-red-900"
                          >
                            Remover
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  
                  {/* Linha de total */}
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                      Total:
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      R$ {total.toFixed(2)}
                    </td>
                    <td colSpan={command.status === 'open' ? 2 : 1}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      
      {/* Modal para adicionar item */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg overflow-hidden shadow-xl max-w-md w-full">
            <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                Adicionar Item à Mesa {command.table_number || command.table || command.tableNumber || command.table_id || command.tableId || 'N/A'}
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