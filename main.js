const { app, BrowserWindow, ipcMain } = require('electron'); // <- Importar ipcMain
const path = require('path');
const { db, initDatabase } = require('./database');

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

  // Abre la consola de inspección de Electron para ver errores de renderizado
  // win.webContents.openDevTools();
}

// Escuchar evento de login desde Angular
ipcMain.handle('login-usuario', async (event, { usuario, contrasena }) => {
  const stmt = db.prepare('SELECT * FROM Usuario WHERE nombre_usuario = ? AND contrasena = ?');
  const user = stmt.get(usuario, contrasena);
  
  if (user) {
    return { success: true, user: { id: user.id_usuario, nombre: user.nombre_usuario, rol: user.rol } };
  } else {
    return { success: false, message: 'Usuario o contraseña incorrectos' };
  }
});

app.whenReady().then(createWindow);