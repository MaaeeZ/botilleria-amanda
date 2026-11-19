-- ==============================================================================
-- BASE DE DATOS: botilleria_amanda
-- Script DDL & Datos Iniciales para pgAdmin / PostgreSQL
-- ==============================================================================

-- 1. (Opcional) Si la base de datos no existe, ejecutar esta línea por separado:
-- CREATE DATABASE botilleria_amanda;

-- Asegurarse de estar conectado a la base de datos "botilleria_amanda" antes de continuar.

-- ==============================================================================
-- CREACIÓN DE TABLAS
-- ==============================================================================

-- Tabla 1: Usuarios del sistema
CREATE TABLE IF NOT EXISTS "Usuario" (
    id_usuario SERIAL PRIMARY KEY,
    nombre_usuario VARCHAR(100) UNIQUE NOT NULL,
    contrasena VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL -- 'Administrador' o 'Cajero'
);

-- Tabla 2: Categorías de productos
CREATE TABLE IF NOT EXISTS "Categoria" (
    id_categoria SERIAL PRIMARY KEY,
    nombre_categoria VARCHAR(100) NOT NULL,
    pasillo_ubicacion VARCHAR(100)
);

-- Tabla 3: Marcas
CREATE TABLE IF NOT EXISTS "Marca" (
    id_marca SERIAL PRIMARY KEY,
    nombre_marca VARCHAR(100) NOT NULL
);

-- Tabla 4: Proveedores
CREATE TABLE IF NOT EXISTS "Proveedor" (
    id_proveedor SERIAL PRIMARY KEY,
    rut VARCHAR(20) UNIQUE NOT NULL,
    razon_social VARCHAR(150) NOT NULL,
    dia_visita_vendedor VARCHAR(50)
);

-- Tabla 5: Productos (Inventario)
CREATE TABLE IF NOT EXISTS "Producto" (
    id_producto SERIAL PRIMARY KEY,
    codigo_barra VARCHAR(100) UNIQUE NOT NULL,
    nombre_producto VARCHAR(150) NOT NULL,
    precio_compra INT NOT NULL,
    precio_venta INT NOT NULL,
    stock_actual INT DEFAULT 0,
    stock_minimo INT DEFAULT 5,
    imagen_url TEXT,
    id_categoria INT REFERENCES "Categoria"(id_categoria) ON DELETE SET NULL,
    id_marca INT REFERENCES "Marca"(id_marca) ON DELETE SET NULL,
    id_proveedor INT REFERENCES "Proveedor"(id_proveedor) ON DELETE SET NULL
);

-- Tabla 6: Ventas (Cabecera)
CREATE TABLE IF NOT EXISTS "Venta" (
    id_venta SERIAL PRIMARY KEY,
    numero_venta VARCHAR(50) UNIQUE NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total INT NOT NULL,
    metodo_pago VARCHAR(50) NOT NULL, -- 'Efectivo', 'Débito', 'Crédito'
    id_usuario INT REFERENCES "Usuario"(id_usuario) ON DELETE RESTRICT
);

-- Tabla 7: Detalle de Venta (Líneas de transacción)
CREATE TABLE IF NOT EXISTS "DetalleVenta" (
    id_detalle SERIAL PRIMARY KEY,
    id_venta INT REFERENCES "Venta"(id_venta) ON DELETE CASCADE,
    id_producto INT REFERENCES "Producto"(id_producto) ON DELETE RESTRICT,
    cantidad INT NOT NULL,
    subtotal INT NOT NULL
);

-- Tabla 8: Cierres de Caja Diarios y Auditoría de Correo
CREATE TABLE IF NOT EXISTS "cierres_caja" (
    id SERIAL PRIMARY KEY,
    fecha_cierre DATE UNIQUE NOT NULL,
    total_ventas NUMERIC NOT NULL,
    cantidad_transacciones INT NOT NULL,
    enviado_correo BOOLEAN DEFAULT FALSE,
    fecha_envio TIMESTAMP,
    destinatario VARCHAR(150)
);

-- Tabla 9: Configuración General y Credenciales Portables de la App
CREATE TABLE IF NOT EXISTS "configuracion_app" (
    clave VARCHAR(100) PRIMARY KEY,
    valor TEXT,
    actualizado_en TIMESTAMP DEFAULT NOW()
);

-- ==============================================================================
-- DATOS INICIALES / SEMILLA (SEED DATA)
-- ==============================================================================

-- 1. Usuarios iniciales (admin y cajero)
INSERT INTO "Usuario" (nombre_usuario, contrasena, rol)
VALUES 
    ('admin', 'admin123', 'Administrador'),
    ('cajero', 'cajero123', 'Cajero')
ON CONFLICT (nombre_usuario) DO NOTHING;

-- 2. Categorías de ejemplo
INSERT INTO "Categoria" (nombre_categoria, pasillo_ubicacion)
VALUES 
    ('Cervezas', 'Pasillo 1 - Frío'),
    ('Destilados y Licores', 'Pasillo 2 - Estantería Central'),
    ('Bebidas y Jugos', 'Pasillo 3 - Mural'),
    ('Vinos', 'Pasillo 4 - Cavas')
ON CONFLICT DO NOTHING;

-- 3. Marcas de ejemplo
INSERT INTO "Marca" (nombre_marca)
VALUES 
    ('Corona'),
    ('Alto del Carmen'),
    ('Coca-Cola'),
    ('Gato Negro')
ON CONFLICT DO NOTHING;

-- 4. Proveedores de ejemplo
INSERT INTO "Proveedor" (rut, razon_social, dia_visita_vendedor)
VALUES 
    ('76.123.456-7', 'CCU Chile S.A.', 'Lunes'),
    ('77.654.321-0', 'Capel Distribuidora', 'Miércoles'),
    ('96.987.654-3', 'Coca-Cola Andina', 'Martes'),
    ('78.111.222-3', 'Viña San Pedro', 'Jueves')
ON CONFLICT (rut) DO NOTHING;

-- 5. Productos iniciales con stock
INSERT INTO "Producto" (codigo_barra, nombre_producto, precio_compra, precio_venta, stock_actual, stock_minimo, imagen_url, id_categoria, id_marca, id_proveedor)
VALUES 
    ('780123456789', 'Cerveza Corona 355ml', 900, 1500, 48, 12, 'https://images.unsplash.com/photo-1608270191795-3c4ff3ef1986?w=200', 1, 1, 1),
    ('780987654321', 'Pisco Alto del Carmen 35° 750ml', 4500, 7990, 24, 6, 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200', 2, 2, 2),
    ('780111222333', 'Bebida Coca-Cola 2.5L', 1200, 2200, 30, 10, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=200', 3, 3, 3),
    ('780444555666', 'Vino Gato Negro Cabernet 750ml', 1800, 3200, 15, 5, 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=200', 4, 4, 4),
    ('780777888999', 'Pack Cerveza Heineken 6x330ml', 4200, 6490, 3, 5, '', 1, 1, 1) -- Ejemplo con stock crítico para alertas
ON CONFLICT (codigo_barra) DO NOTHING;
