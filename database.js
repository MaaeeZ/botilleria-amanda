const Database = require('better-sqlite3');
const path = require('path');

// Crea o abre el archivo botilleria.db en la raíz del proyecto
const db = new Database(path.join(__dirname, 'botilleria.db'));

function initDatabase() {
  // 1. Tabla Usuario
  db.exec(`
    CREATE TABLE IF NOT EXISTS Usuario (
      id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_usuario TEXT UNIQUE NOT NULL,
      contrasena TEXT NOT NULL,
      rol TEXT NOT NULL
    );
  `);

  // 2. Tabla Categoria
  db.exec(`
    CREATE TABLE IF NOT EXISTS Categoria (
      id_categoria INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_categoria TEXT NOT NULL,
      pasillo_ubicacion TEXT
    );
  `);

  // 3. Tabla Marca
  db.exec(`
    CREATE TABLE IF NOT EXISTS Marca (
      id_marca INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_marca TEXT NOT NULL
    );
  `);

  // 4. Tabla Proveedor
  db.exec(`
    CREATE TABLE IF NOT EXISTS Proveedor (
      id_proveedor INTEGER PRIMARY KEY AUTOINCREMENT,
      rut TEXT UNIQUE NOT NULL,
      razon_social TEXT NOT NULL,
      dia_visita_vendedor TEXT
    );
  `);

  // 5. Tabla Producto
  db.exec(`
    CREATE TABLE IF NOT EXISTS Producto (
      id_producto INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_barra TEXT UNIQUE NOT NULL,
      nombre_producto TEXT NOT NULL,
      precio_compra INTEGER NOT NULL,
      precio_venta INTEGER NOT NULL,
      stock_actual INTEGER DEFAULT 0,
      stock_minimo INTEGER DEFAULT 5,
      id_categoria INTEGER,
      id_marca INTEGER,
      id_proveedor INTEGER,
      FOREIGN KEY (id_categoria) REFERENCES Categoria(id_categoria),
      FOREIGN KEY (id_marca) REFERENCES Marca(id_marca),
      FOREIGN KEY (id_proveedor) REFERENCES Proveedor(id_proveedor)
    );
  `);

  // 6. Tabla Venta
  db.exec(`
    CREATE TABLE IF NOT EXISTS Venta (
      id_venta INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_venta TEXT UNIQUE NOT NULL,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      total INTEGER NOT NULL,
      metodo_pago TEXT NOT NULL,
      id_usuario INTEGER,
      FOREIGN KEY (id_usuario) REFERENCES Usuario(id_usuario)
    );
  `);

  // 7. Tabla DetalleVenta
  db.exec(`
    CREATE TABLE IF NOT EXISTS DetalleVenta (
      id_detalle INTEGER PRIMARY KEY AUTOINCREMENT,
      id_venta INTEGER,
      id_producto INTEGER,
      cantidad INTEGER NOT NULL,
      subtotal INTEGER NOT NULL,
      FOREIGN KEY (id_venta) REFERENCES Venta(id_venta),
      FOREIGN KEY (id_producto) REFERENCES Producto(id_producto)
    );
  `);

  // Insertar usuario administrador inicial por defecto (si no existe)
  const stmt = db.prepare("SELECT COUNT(*) as count FROM Usuario");
  const row = stmt.get();
  if (row.count === 0) {
    const insertAdmin = db.prepare(
      "INSERT INTO Usuario (nombre_usuario, contrasena, rol) VALUES (?, ?, ?)"
    );
    insertAdmin.run('admin', 'admin123', 'Administrador');
    console.log("Usuario 'admin' creado por defecto (Clave: admin123).");
  }

  console.log("Base de datos e inicialización completadas correctamente.");
}

module.exports = { db, initDatabase };