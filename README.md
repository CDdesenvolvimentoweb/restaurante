# Sistema de Gerenciamento de Restaurantes

Um sistema web completo para gerenciamento de restaurantes utilizando Next.js e Supabase.

## Funcionalidades Implementadas

### Autenticação e Controle de Acesso
- Sistema de login e autenticação integrado com Supabase Auth
- Controle de acesso baseado em papéis (super_admin, admin, manager, waiter)
- Página de cadastro para novos usuários com aprovação de administrador
- Sistema de redefinição de senha

### Gerenciamento de Usuários
- Cadastro de usuários com diferentes papéis
- Edição de informações de funcionários
- Desativação de funcionários com manutenção de histórico

### Gerenciamento de Mesas
- Cadastro, edição e exclusão de mesas
- Visualização do status das mesas (disponível, ocupada, reservada)
- Controle de ocupação de mesas

### Gerenciamento de Produtos
- Cadastro, edição e exclusão de produtos
- Categorização de produtos
- Definição de preços

### Gerenciamento de Comandas
- Abertura de comandas para mesas
- Adição de produtos às comandas
- Visualização de comandas ativas
- Filtro de comandas por status
- Histórico de comandas

### Interface Adaptada por Papel
- Dashboard específico para administradores com resumo de operações
- Interface para garçons com foco em comandas e mesas
- Painel para super administrador com gestão de restaurantes

## Tecnologias Utilizadas

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Autenticação, Armazenamento)
- **Segurança**: Row-Level Security (RLS) no Supabase

## Próximos Passos

### Relatórios e Análises
- Implementação de relatórios de vendas diárias, semanais e mensais
- Análise de desempenho de produtos
- Gráficos de ocupação por horário

### Reservas
- Sistema de reservas de mesas
- Gestão de agendamentos

### Pagamentos
- Integração com sistemas de pagamento
- Divisão de contas
- Registro de formas de pagamento

### Notificações em Tempo Real
- Alertas para novos pedidos
- Notificações para mesas que solicitam atendimento
- Uso do Supabase Realtime para atualizações em tempo real

### Aplicativo Móvel
- Versão mobile para garçons operarem remotamente
- Leitura de QR Code para acesso rápido às mesas

## Arquitetura do Sistema

O sistema segue uma arquitetura moderna baseada em:

1. **Componentes React reutilizáveis** - Para consistência da interface
2. **API Routes do Next.js** - Para operações seguras no servidor
3. **Supabase como backend** - Aproveitando recursos de banco de dados, autenticação e armazenamento
4. **Modelos de dados bem definidos** - Com relacionamentos claros entre entidades (restaurantes, mesas, comandas, produtos)
5. **Segurança por Row-Level Security** - Garantindo que cada usuário acesse apenas os dados permitidos para seu papel

## Como Executar o Projeto

### Pré-requisitos
- Node.js 14.x ou superior
- Conta no Supabase

### Configuração
1. Clone o repositório
2. Instale as dependências com `npm install`
3. Configure as variáveis de ambiente no arquivo `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_do_supabase
```
4. Execute o projeto em desenvolvimento com `npm run dev`
5. Acesse http://localhost:3000

## Estrutura do Banco de Dados

O banco de dados possui as seguintes tabelas principais:
- `restaurants` - Cadastro de restaurantes
- `users` - Usuários e funcionários
- `tables` - Mesas dos restaurantes
- `products` - Produtos do cardápio
- `commands` - Comandas de pedidos
- `command_items` - Itens adicionados às comandas

## Contribuições

Para contribuir com o projeto:
1. Faça um fork do repositório
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Faça commit das alterações (`git commit -m 'Adiciona nova feature'`)
4. Envie para o branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request
