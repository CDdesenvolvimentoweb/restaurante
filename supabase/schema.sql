-- Esquema para o sistema de gerenciamento de restaurantes

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Definição de tabelas

-- Tabela de restaurantes
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de perfis de usuários
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'manager', 'waiter')),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de mesas
CREATE TABLE tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number INTEGER NOT NULL,
  capacity INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'occupied', 'reserved')) DEFAULT 'available',
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(number, restaurant_id)
);

-- Tabela de produtos
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  category TEXT NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de comandas
CREATE TABLE commands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'paid')) DEFAULT 'open',
  total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de produtos em comandas
CREATE TABLE command_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  command_id UUID NOT NULL REFERENCES commands(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Triggers para atualizar o timestamp de updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas as tabelas
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON restaurants
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON tables
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON commands
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON command_products
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Função para calcular o total da comanda quando produtos são adicionados/removidos
CREATE OR REPLACE FUNCTION update_command_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE commands
  SET total = (
    SELECT COALESCE(SUM(price * quantity), 0)
    FROM command_products
    WHERE command_id = NEW.command_id
  )
  WHERE id = NEW.command_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger para atualizar o total da comanda
CREATE TRIGGER update_command_total
AFTER INSERT OR UPDATE OR DELETE ON command_products
FOR EACH ROW
EXECUTE PROCEDURE update_command_total();

-- Configuração de segurança com Row Level Security (RLS)

-- Habilitar RLS em todas as tabelas
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_products ENABLE ROW LEVEL SECURITY;

-- Políticas para restaurantes
-- Super admin pode ver e gerenciar todos os restaurantes
CREATE POLICY "Super admin pode gerenciar todos os restaurantes"
  ON restaurants
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Outros usuários podem ver apenas seu próprio restaurante
CREATE POLICY "Usuários podem ver seu próprio restaurante"
  ON restaurants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.restaurant_id = restaurants.id
    )
  );

-- Políticas para usuários
-- Super admin pode ver e gerenciar todos os usuários
CREATE POLICY "Super admin pode gerenciar todos os usuários"
  ON users
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Admin pode ver e gerenciar usuários do seu restaurante
CREATE POLICY "Admin pode gerenciar usuários do seu restaurante"
  ON users
  USING (
    EXISTS (
      SELECT 1 FROM users admin
      WHERE admin.id = auth.uid()
      AND admin.role = 'admin'
      AND admin.restaurant_id = users.restaurant_id
    )
  );

-- Gerentes e garçons podem ver outros usuários do seu restaurante
CREATE POLICY "Gerentes e garçons podem ver usuários do seu restaurante"
  ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users viewer
      WHERE viewer.id = auth.uid()
      AND (viewer.role = 'manager' OR viewer.role = 'waiter')
      AND viewer.restaurant_id = users.restaurant_id
    )
  );

-- Políticas para mesas
-- Super admin pode ver todas as mesas
CREATE POLICY "Super admin pode ver todas as mesas"
  ON tables
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Usuários do restaurante podem ver e gerenciar mesas do seu restaurante
CREATE POLICY "Usuários podem gerenciar mesas do seu restaurante"
  ON tables
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.restaurant_id = tables.restaurant_id
    )
  );

-- Políticas para produtos
-- Super admin pode ver todos os produtos
CREATE POLICY "Super admin pode ver todos os produtos"
  ON products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Admin e gerentes podem gerenciar produtos do seu restaurante
CREATE POLICY "Admin e gerentes podem gerenciar produtos do seu restaurante"
  ON products
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'admin' OR users.role = 'manager')
      AND users.restaurant_id = products.restaurant_id
    )
  );

-- Garçons podem ver produtos do seu restaurante
CREATE POLICY "Garçons podem ver produtos do seu restaurante"
  ON products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'waiter'
      AND users.restaurant_id = products.restaurant_id
    )
  );

-- Políticas para comandas
-- Super admin pode ver todas as comandas
CREATE POLICY "Super admin pode ver todas as comandas"
  ON commands
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Usuários do restaurante podem ver e gerenciar comandas do seu restaurante
CREATE POLICY "Usuários podem gerenciar comandas do seu restaurante"
  ON commands
  USING (
    EXISTS (
      SELECT 1 FROM users
      JOIN tables ON tables.restaurant_id = users.restaurant_id
      WHERE users.id = auth.uid()
      AND tables.id = commands.table_id
    )
  );

-- Políticas para produtos em comandas
-- Super admin pode ver todos os produtos em comandas
CREATE POLICY "Super admin pode ver todos os produtos em comandas"
  ON command_products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Usuários do restaurante podem ver e gerenciar produtos em comandas do seu restaurante
CREATE POLICY "Usuários podem gerenciar produtos em comandas do seu restaurante"
  ON command_products
  USING (
    EXISTS (
      SELECT 1 FROM users
      JOIN commands ON commands.id = command_products.command_id
      JOIN tables ON tables.id = commands.table_id
      WHERE users.id = auth.uid()
      AND tables.restaurant_id = users.restaurant_id
    )
  ); 