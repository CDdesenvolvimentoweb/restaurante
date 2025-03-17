'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User, Command, Product } from '@/types';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

interface SalesData {
  today: number;
  week: number;
  month: number;
  topProducts: {
    productId: string;
    productName: string;
    quantity: number;
    total: number;
  }[];
  dailySales: {
    date: string;
    total: number;
  }[];
  paymentMethods: {
    method: string;
    total: number;
    count: number;
  }[];
}

export default function ManagerReports() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [salesData, setSalesData] = useState<SalesData>({
    today: 0,
    week: 0,
    month: 0,
    topProducts: [],
    dailySales: [],
    paymentMethods: []
  });
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    const fetchReportData = async () => {
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

        setRestaurant(profile.restaurant);
        const restaurantId = profile.restaurant_id || profile.restaurantId;

        // Calcular datas
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - 7);
        
        const monthStart = new Date(today);
        monthStart.setMonth(monthStart.getMonth() - 1);
        
        const yearStart = new Date(today);
        yearStart.setFullYear(yearStart.getFullYear() - 1);
        
        // Verificar a estrutura da tabela commands
        const { data: commandSample } = await supabase
          .from('commands')
          .select('*')
          .limit(1);
          
        let closedAtField = 'closed_at';
        let paidAtField = 'paid_at';
        let paymentMethodField = 'payment_method';
        
        if (commandSample && commandSample.length > 0) {
          const columns = Object.keys(commandSample[0]);
          console.log('Colunas disponíveis na tabela commands:', columns);
          
          if (!columns.includes('closed_at') && columns.includes('closedAt')) {
            closedAtField = 'closedAt';
          }
          
          if (!columns.includes('paid_at') && columns.includes('paidAt')) {
            paidAtField = 'paidAt';
          }
          
          if (!columns.includes('payment_method') && columns.includes('paymentMethod')) {
            paymentMethodField = 'paymentMethod';
          }
        }
        
        // Inicializar array de comandas
        let commands: any[] = [];
        
        // Buscar comandas através das mesas (método mais seguro)
        try {
          console.log('Buscando mesas para o restaurante ID:', restaurantId);
          
          // Primeiro buscar todas as mesas do restaurante
          const { data: tableData, error: tableError } = await supabase
            .from('tables')
            .select('id')
            .eq('restaurant_id', restaurantId);
            
          if (tableError) {
            console.error('Erro ao buscar mesas:', tableError);
            throw new Error(`Erro ao buscar mesas: ${tableError.message}`);
          }
          
          if (!tableData || tableData.length === 0) {
            console.log('Nenhuma mesa encontrada para este restaurante');
            // Continuamos com commands vazio
          } else {
            const tableIds = tableData.map(t => t.id);
            console.log(`Encontradas ${tableIds.length} mesas. Buscando comandas associadas...`);
            
            const { data: commandsByTable, error: commandsError } = await supabase
              .from('commands')
              .select(`
                *,
                table:table_id(*),
                user:user_id(*)
              `)
              .in('table_id', tableIds)
              .eq('status', 'paid');
              
            if (commandsError) {
              console.error('Erro ao buscar comandas via mesas:', commandsError);
              console.error('Detalhes do erro:', JSON.stringify(commandsError));
            } else {
              console.log(`Encontradas ${commandsByTable?.length || 0} comandas via mesas`);
              commands = commandsByTable || [];
            }
          }
        } catch (error: any) {
          console.error('Erro na busca de comandas:', error);
          toast.error(`Erro ao buscar dados: ${error.message}`);
        }

        // Se não encontrou comandas, tenta outras abordagens
        if (commands.length === 0) {
          // Buscar todas as comandas com status 'paid' e filtrar manualmente
          try {
            console.log('Tentando abordagem alternativa: buscar todas as comandas pagas');
            
            const { data: allPaidCommands, error: allCommandsError } = await supabase
              .from('commands')
              .select(`
                *,
                table:table_id(*),
                user:user_id(*)
              `)
              .eq('status', 'paid');
              
            if (allCommandsError) {
              console.error('Erro ao buscar todas as comandas:', allCommandsError);
            } else if (allPaidCommands && allPaidCommands.length > 0) {
              // Tentar filtrar pelo usuário do restaurante
              const { data: restaurantUsers } = await supabase
                .from('users')
                .select('id')
                .eq('restaurant_id', restaurantId);
                
              if (restaurantUsers && restaurantUsers.length > 0) {
                const userIds = restaurantUsers.map(u => u.id);
                commands = allPaidCommands.filter(cmd => 
                  userIds.includes(cmd.user_id || cmd.userId)
                );
                console.log(`Filtradas ${commands.length} comandas via usuários do restaurante`);
              }
            }
          } catch (altError: any) {
            console.error('Erro na abordagem alternativa:', altError);
          }
        }
        
        // Para cada comanda, buscar seus itens
        const commandsWithItems = await Promise.all(
          commands.map(async (command: any) => {
            try {
              // Tentar buscar itens em command_products primeiro
              const { data: products } = await supabase
                .from('command_products')
                .select('*, product:product_id(*)')
                .eq('command_id', command.id);
                
              if (products && products.length > 0) {
                return { ...command, items: products };
              }
              
              // Se não encontrar, tentar com command_items
              const { data: items } = await supabase
                .from('command_items')
                .select('*, product:product_id(*)')
                .eq('command_id', command.id);
                
              return { ...command, items: items || [] };
            } catch (error) {
              console.error(`Erro ao buscar itens da comanda ${command.id}:`, error);
              return { ...command, items: [] };
            }
          })
        );
        
        // Calcular vendas
        let todaySales = 0;
        let weekSales = 0;
        let monthSales = 0;
        
        // Mapa de produtos (ID -> {nome, quantidade, total})
        const productMap = new Map();
        
        // Mapa de métodos de pagamento (método -> {total, contagem})
        const paymentMethodMap = new Map();
        
        // Mapa de vendas diárias (data -> total)
        const dailySalesMap = new Map();
        
        for (const command of commandsWithItems) {
          const paidDate = command[paidAtField] ? new Date(command[paidAtField]) : null;
          if (!paidDate) continue;
          
          // Formato para a data (YYYY-MM-DD)
          const dateStr = paidDate.toISOString().split('T')[0];
          
          // Calcular total da comanda
          let commandTotal = command.total;
          
          // Se o total não estiver preenchido, calcular a partir dos itens
          if (!commandTotal || isNaN(commandTotal) || commandTotal <= 0) {
            commandTotal = (command.items || []).reduce((sum: number, item: any) => {
              const quantity = item.quantity || 0;
              const price = item.price || 0;
              return sum + (price * quantity);
            }, 0);
          }
          
          // Adicionar às vendas diárias
          if (dailySalesMap.has(dateStr)) {
            dailySalesMap.set(dateStr, dailySalesMap.get(dateStr) + commandTotal);
          } else {
            dailySalesMap.set(dateStr, commandTotal);
          }
          
          // Verificar se a comanda foi paga hoje
          if (paidDate.getTime() >= today.getTime()) {
            todaySales += commandTotal;
          }
          
          // Verificar se a comanda foi paga na última semana
          if (paidDate.getTime() >= weekStart.getTime()) {
            weekSales += commandTotal;
          }
          
          // Verificar se a comanda foi paga no último mês
          if (paidDate.getTime() >= monthStart.getTime()) {
            monthSales += commandTotal;
          }
          
          // Registrar método de pagamento
          const paymentMethod = command[paymentMethodField] || 'Não especificado';
          if (paymentMethodMap.has(paymentMethod)) {
            const current = paymentMethodMap.get(paymentMethod);
            paymentMethodMap.set(paymentMethod, {
              total: current.total + commandTotal,
              count: current.count + 1
            });
          } else {
            paymentMethodMap.set(paymentMethod, {
              total: commandTotal,
              count: 1
            });
          }
          
          // Processar itens para o ranking de produtos
          for (const item of command.items || []) {
            const productId = item.product_id;
            const productName = item.product?.name || 'Produto desconhecido';
            const quantity = item.quantity || 0;
            const itemTotal = (item.price || 0) * quantity;
            
            if (productMap.has(productId)) {
              const current = productMap.get(productId);
              productMap.set(productId, {
                name: productName,
                quantity: current.quantity + quantity,
                total: current.total + itemTotal
              });
            } else {
              productMap.set(productId, {
                name: productName,
                quantity,
                total: itemTotal
              });
            }
          }
        }
        
        // Converter mapa de produtos para array e ordenar
        const topProducts = Array.from(productMap.entries())
          .map(([productId, data]) => ({
            productId,
            productName: data.name,
            quantity: data.quantity,
            total: data.total
          }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);
          
        // Converter mapa de métodos de pagamento para array
        const paymentMethods = Array.from(paymentMethodMap.entries())
          .map(([method, data]) => ({
            method,
            total: data.total,
            count: data.count
          }))
          .sort((a, b) => b.total - a.total);
          
        // Preparar dados de vendas diárias
        const dailySales = Array.from(dailySalesMap.entries())
          .map(([date, total]) => ({
            date,
            total
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
        // Limitar ao período selecionado
        let filteredDailySales = dailySales;
        const currentDate = new Date();
        
        if (dateRange === 'week') {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          filteredDailySales = dailySales.filter(
            item => new Date(item.date) >= weekAgo
          );
        } else if (dateRange === 'month') {
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          filteredDailySales = dailySales.filter(
            item => new Date(item.date) >= monthAgo
          );
        } else {
          const yearAgo = new Date();
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          filteredDailySales = dailySales.filter(
            item => new Date(item.date) >= yearAgo
          );
        }
        
        // Atualizar estado
        setSalesData({
          today: todaySales,
          week: weekSales,
          month: monthSales,
          topProducts,
          dailySales: filteredDailySales,
          paymentMethods
        });
      } catch (error: any) {
        console.error('Erro ao carregar relatórios:', error);
        toast.error('Erro ao carregar dados: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [router, dateRange]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const getPaymentMethodName = (method: string) => {
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

  return (
    <div>
      <Toaster position="top-right" />
      
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Relatórios</h1>
        <div>
          <Link 
            href="/manager" 
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300"
          >
            Voltar para Dashboard
          </Link>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Resumo de vendas */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Vendas de Hoje</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {formatCurrency(salesData.today)}
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Vendas da Semana</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {formatCurrency(salesData.week)}
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
                  <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Vendas do Mês</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {formatCurrency(salesData.month)}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Gráfico de vendas */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">Vendas por Período</h2>
              <div>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as 'week' | 'month' | 'year')}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="week">Última Semana</option>
                  <option value="month">Último Mês</option>
                  <option value="year">Último Ano</option>
                </select>
              </div>
            </div>
            
            {salesData.dailySales.length > 0 ? (
              <div className="relative h-64">
                <div className="absolute inset-0 flex items-center justify-between">
                  {salesData.dailySales.map((day, index) => (
                    <div key={index} className="flex flex-col items-center">
                      <div 
                        className="bg-blue-500 w-8 rounded-t-md" 
                        style={{ 
                          height: `${Math.max(5, (day.total / Math.max(...salesData.dailySales.map(d => d.total))) * 180)}px`
                        }}
                      ></div>
                      <span className="text-xs text-gray-500 mt-1">{formatDate(day.date)}</span>
                      <span className="text-xs font-medium">{formatCurrency(day.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-64 flex justify-center items-center">
                <p className="text-gray-500">Nenhum dado de venda disponível para o período selecionado.</p>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Produtos mais vendidos */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6">
                <h2 className="text-lg font-medium text-gray-900">Top 5 Produtos Mais Vendidos</h2>
              </div>
              <div className="border-t border-gray-200">
                {salesData.topProducts.length > 0 ? (
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
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {salesData.topProducts.map((product, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {product.productName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {product.quantity}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(product.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-4 py-5 sm:p-6 text-center">
                    <p className="text-gray-500">Nenhum produto vendido no período selecionado.</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Métodos de pagamento */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6">
                <h2 className="text-lg font-medium text-gray-900">Métodos de Pagamento</h2>
              </div>
              <div className="border-t border-gray-200">
                {salesData.paymentMethods.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Método
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Vendas
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {salesData.paymentMethods.map((method, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {getPaymentMethodName(method.method)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {method.count}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(method.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-4 py-5 sm:p-6 text-center">
                    <p className="text-gray-500">Nenhum método de pagamento registrado no período selecionado.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 