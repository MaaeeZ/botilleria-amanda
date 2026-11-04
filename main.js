const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { pool, initDatabase } = require('./database');

function createWindow() {
  initDatabase();

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, 'dist/botilleria-amanda/browser/index.html'));
}

// 1. Manejador para Login
ipcMain.handle('login-usuario', async (event, { usuario, contrasena }) => {
  try {
    const res = await pool.query(
      'SELECT * FROM "Usuario" WHERE nombre_usuario = $1 AND contrasena = $2',
      [usuario, contrasena]
    );
    
    if (res.rows.length > 0) {
      const user = res.rows[0];
      return { success: true, user: { id: user.id_usuario, nombre: user.nombre_usuario, rol: user.rol } };
    } else {
      return { success: false, message: 'Usuario o contraseña incorrectos' };
    }
  } catch (error) {
    return { success: false, message: 'Error de conexión a la Base de Datos' };
  }
});

// Obtener lista de productos con stock disponible
ipcMain.handle('obtener-productos', async () => {
  try {
    const res = await pool.query('SELECT * FROM "Producto" WHERE stock_actual > 0 ORDER BY nombre_producto ASC');
    return res.rows;
  } catch (error) {
    console.error('Error al obtener productos:', error);
    return [];
  }
});

// Obtener TODOS los productos (incluso con stock 0) para el módulo de inventario
ipcMain.handle('obtener-todos-productos', async () => {
  try {
    const res = await pool.query('SELECT * FROM "Producto" ORDER BY id_producto DESC');
    return res.rows;
  } catch (error) {
    console.error('Error al listar inventario:', error);
    return [];
  }
});

// Guardar un nuevo producto
ipcMain.handle('crear-producto', async (event, productoData) => {
  try {
    const { codigo_barra, nombre_producto, precio_compra, precio_venta, stock_actual, stock_minimo, imagen_url } = productoData;
    
    await pool.query(
      `INSERT INTO "Producto" (codigo_barra, nombre_producto, precio_compra, precio_venta, stock_actual, stock_minimo, imagen_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [codigo_barra, nombre_producto, precio_compra, precio_venta, stock_actual, stock_minimo || 5, imagen_url || '']
    );

    return { success: true };
  } catch (error) {
    console.error('Error al crear producto:', error);
    return { success: false, message: error.message };
  }
});

// Actualizar producto existente
ipcMain.handle('editar-producto', async (event, productoData) => {
  try {
    const { id_producto, codigo_barra, nombre_producto, precio_compra, precio_venta, stock_actual, stock_minimo, imagen_url } = productoData;

    await pool.query(
      `UPDATE "Producto" 
       SET codigo_barra = $1, nombre_producto = $2, precio_compra = $3, precio_venta = $4, stock_actual = $5, stock_minimo = $6, imagen_url = $7
       WHERE id_producto = $8`,
      [codigo_barra, nombre_producto, precio_compra, precio_venta, stock_actual, stock_minimo, imagen_url || '', id_producto]
    );

    return { success: true };
  } catch (error) {
    console.error('Error al editar producto:', error);
    return { success: false, message: error.message };
  }
});

// Eliminar un producto
ipcMain.handle('eliminar-producto', async (event, id_producto) => {
  try {
    await pool.query('DELETE FROM "Producto" WHERE id_producto = $1', [id_producto]);
    return { success: true };
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    return { success: false, message: error.message };
  }
});

// Registrar venta en PostgreSQL con Transacción
ipcMain.handle('registrar-venta', async (event, { items, total, metodoPago, idUsuario }) => {
  const client = await pool.connect();
  const numeroVenta = 'VEN-' + Date.now().toString().slice(-6);

  try {
    await client.query('BEGIN'); // Iniciar transacción

    // 1. Insertar cabecera de la venta
    const resVenta = await client.query(
      'INSERT INTO "Venta" (numero_venta, total, metodo_pago, id_usuario) VALUES ($1, $2, $3, $4) RETURNING id_venta',
      [numeroVenta, total, metodoPago, idUsuario]
    );
    const idVenta = resVenta.rows[0].id_venta;

    // 2. Insertar cada detalle de venta y descontar stock del producto
    for (const item of items) {
      await client.query(
        'INSERT INTO "DetalleVenta" (id_venta, id_producto, cantidad, subtotal) VALUES ($1, $2, $3, $4)',
        [idVenta, item.producto.id_producto, item.cantidad, item.subtotal]
      );

      await client.query(
        'UPDATE "Producto" SET stock_actual = stock_actual - $1 WHERE id_producto = $2',
        [item.cantidad, item.producto.id_producto]
      );
    }

    await client.query('COMMIT'); // Confirmar cambios
    return { success: true, idVenta, numeroVenta };
  } catch (error) {
    await client.query('ROLLBACK'); // Cancelar si hay falla
    console.error('Error al registrar venta:', error);
    return { success: false, message: error.message };
  } finally {
    client.release();
  }
});

// Obtener el historial completo de ventas
ipcMain.handle('obtener-historial-ventas', async () => {
  try {
    const res = await pool.query(`
      SELECT 
        v.id_venta,
        v.numero_venta,
        v.fecha,
        v.total,
        v.metodo_pago,
        u.nombre_usuario AS usuario
      FROM "Venta" v
      LEFT JOIN "Usuario" u ON v.id_usuario = u.id_usuario
      ORDER BY v.fecha DESC
    `);
    return res.rows;
  } catch (error) {
    console.error('Error al obtener historial de ventas:', error);
    return [];
  }
});

// Obtener los productos (detalle) de una venta particular
ipcMain.handle('obtener-detalle-venta', async (event, idVenta) => {
  try {
    const res = await pool.query(`
      SELECT 
        dv.cantidad,
        dv.subtotal,
        p.nombre_producto,
        p.precio_venta
      FROM "DetalleVenta" dv
      JOIN "Producto" p ON dv.id_producto = p.id_producto
      WHERE dv.id_venta = $1
    `, [idVenta]);
    return res.rows;
  } catch (error) {
    console.error('Error al obtener detalle de venta:', error);
    return [];
  }
});

// Obtener todos los usuarios
ipcMain.handle('obtener-usuarios', async () => {
  try {
    const res = await pool.query('SELECT id_usuario, nombre_usuario, rol FROM "Usuario" ORDER BY id_usuario ASC');
    return res.rows;
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    return [];
  }
});

// Crear nuevo usuario
ipcMain.handle('crear-usuario', async (event, { usuario, contrasena, rol }) => {
  try {
    await pool.query(
      'INSERT INTO "Usuario" (nombre_usuario, contrasena, rol) VALUES ($1, $2, $3)',
      [usuario, contrasena, rol]
    );
    return { success: true };
  } catch (error) {
    console.error('Error al crear usuario:', error);
    return { success: false, message: 'El nombre de usuario ya existe o hubo un error.' };
  }
});

// Eliminar usuario
ipcMain.handle('eliminar-usuario', async (event, idUsuario) => {
  try {
    await pool.query('DELETE FROM "Usuario" WHERE id_usuario = $1', [idUsuario]);
    return { success: true };
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    return { success: false, message: 'No se puede eliminar un usuario con ventas registradas.' };
  }
});

// Obtener métricas reales para las tarjetas del Dashboard
ipcMain.handle('obtener-metricas-dashboard', async () => {
  try {
    // 1. Ventas de hoy
    const resVentasHoy = await pool.query(`
      SELECT COALESCE(SUM(total), 0) AS ventas_hoy, COUNT(id_venta) AS transacciones_hoy 
      FROM "Venta" 
      WHERE DATE(fecha) = CURRENT_DATE
    `);

    // 2. Total de productos en inventario
    const resProductos = await pool.query('SELECT COUNT(id_producto) AS total_productos FROM "Producto"');

    // 3. Cantidad de productos con stock crítico
    const resStockBajo = await pool.query('SELECT COUNT(id_producto) AS stock_critico FROM "Producto" WHERE stock_actual <= stock_minimo');

    return {
      ventasHoy: parseInt(resVentasHoy.rows[0].ventas_hoy),
      transaccionesHoy: parseInt(resVentasHoy.rows[0].transacciones_hoy),
      totalProductos: parseInt(resProductos.rows[0].total_productos),
      stockCritico: parseInt(resStockBajo.rows[0].stock_critico)
    };
  } catch (error) {
    console.error('Error al obtener métricas del dashboard:', error);
    return { ventasHoy: 0, transaccionesHoy: 0, totalProductos: 0, stockCritico: 0 };
  }
});

// Obtener la lista detallada de productos con stock bajo (Alertas)
ipcMain.handle('obtener-alertas-stock', async () => {
  try {
    const res = await pool.query(`
      SELECT * FROM "Producto" 
      WHERE stock_actual <= stock_minimo 
      ORDER BY stock_actual ASC
    `);
    return res.rows;
  } catch (error) {
    console.error('Error al obtener alertas de stock:', error);
    return [];
  }
});

// Obtener el Top 5 de productos más vendidos
ipcMain.handle('obtener-top-productos', async () => {
  try {
    const res = await pool.query(`
      SELECT 
        p.nombre_producto,
        SUM(dv.cantidad) AS total_vendido,
        SUM(dv.subtotal) AS total_recaudado
      FROM "DetalleVenta" dv
      JOIN "Producto" p ON dv.id_producto = p.id_producto
      GROUP BY p.id_producto, p.nombre_producto
      ORDER BY total_vendido DESC
      LIMIT 5
    `);
    return res.rows;
  } catch (error) {
    console.error('Error al obtener Top Productos:', error);
    return [];
  }
});

app.whenReady().then(createWindow);