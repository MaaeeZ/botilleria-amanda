const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'botilleria_amanda',
  password: 'admin123',
  port: 5432,
});

async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Usuario" (
        id_usuario SERIAL PRIMARY KEY,
        nombre_usuario VARCHAR(100) UNIQUE NOT NULL,
        contrasena VARCHAR(255) NOT NULL,
        rol VARCHAR(50) NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Categoria" (
        id_categoria SERIAL PRIMARY KEY,
        nombre_categoria VARCHAR(100) NOT NULL,
        pasillo_ubicacion VARCHAR(100)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Marca" (
        id_marca SERIAL PRIMARY KEY,
        nombre_marca VARCHAR(100) NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Proveedor" (
        id_proveedor SERIAL PRIMARY KEY,
        rut VARCHAR(20) UNIQUE NOT NULL,
        razon_social VARCHAR(150) NOT NULL,
        dia_visita_vendedor VARCHAR(50)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Producto" (
        id_producto SERIAL PRIMARY KEY,
        codigo_barra VARCHAR(100) UNIQUE NOT NULL,
        nombre_producto VARCHAR(150) NOT NULL,
        precio_compra INT NOT NULL,
        precio_venta INT NOT NULL,
        stock_actual INT DEFAULT 0,
        stock_minimo INT DEFAULT 5,
        imagen_url TEXT,
        id_categoria INT REFERENCES "Categoria"(id_categoria),
        id_marca INT REFERENCES "Marca"(id_marca),
        id_proveedor INT REFERENCES "Proveedor"(id_proveedor)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Venta" (
        id_venta SERIAL PRIMARY KEY,
        numero_venta VARCHAR(50) UNIQUE NOT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total INT NOT NULL,
        metodo_pago VARCHAR(50) NOT NULL,
        id_usuario INT REFERENCES "Usuario"(id_usuario)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "DetalleVenta" (
        id_detalle SERIAL PRIMARY KEY,
        id_venta INT REFERENCES "Venta"(id_venta),
        id_producto INT REFERENCES "Producto"(id_producto),
        cantidad INT NOT NULL,
        subtotal INT NOT NULL
      );
    `);

    console.log("Base de datos PostgreSQL sincronizada e inicializada correctamente.");

    // Insertar productos de prueba si la tabla está vacía
    const resProd = await pool.query('SELECT COUNT(*) FROM "Producto"');
    if (parseInt(resProd.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO "Producto" (codigo_barra, nombre_producto, precio_compra, precio_venta, stock_actual, stock_minimo)
        VALUES 
          ('780123456789', 'Cerveza Corona 355ml', 900, 1500, 48, 12),
          ('780987654321', 'Pisco Alto del Carmen 35° 750ml', 4500, 7990, 24, 6),
          ('780111222333', 'Bebida Coca-Cola 2.5L', 1200, 2200, 30, 10),
          ('780444555666', 'Vino Gato Negro Cabernet 750ml', 1800, 3200, 15, 5);
      `);
      console.log("Productos de prueba creados por defecto.");
    }

  } catch (error) {
    console.error("Error al inicializar PostgreSQL:", error);
  }
}

module.exports = { pool, initDatabase };