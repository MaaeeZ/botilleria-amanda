import { Injectable } from '@angular/core';

declare global {
  interface Window {
    require: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class ElectronService {
  private ipc: any;

  constructor() {
    if (window.require) {
      try {
        this.ipc = window.require('electron').ipcRenderer;
      } catch (e) {
        console.error('Electron IPC no disponible', e);
      }
    }
  }

  public async login(usuario: string, contrasena: string): Promise<any> {
    if (this.ipc) {
      return await this.ipc.invoke('login-usuario', { usuario, contrasena });
    }
    return { success: false, message: 'Electron no está conectado' };
  }

  public async obtenerProductos(): Promise<any[]> {
    if (this.ipc) {
      return await this.ipc.invoke('obtener-productos');
    }
    return [];
  }

  public async registrarVenta(ventaData: { items: any[], total: number, metodoPago: string, idUsuario: number }): Promise<any> {
    if (this.ipc) {
      return await this.ipc.invoke('registrar-venta', ventaData);
    }
    return { success: false, message: 'Electron no disponible' };
  }

  public async obtenerTodosProductos(): Promise<any[]> {
    if (this.ipc) {
      return await this.ipc.invoke('obtener-todos-productos');
    }
    return [];
  }

  public async crearProducto(prod: any): Promise<any> {
    if (this.ipc) {
      return await this.ipc.invoke('crear-producto', prod);
    }
    return { success: false };
  }

  public async editarProducto(prod: any): Promise<any> {
    if (this.ipc) {
      return await this.ipc.invoke('editar-producto', prod);
    }
    return { success: false };
  }

  public async eliminarProducto(id: number): Promise<any> {
    if (this.ipc) {
      return await this.ipc.invoke('eliminar-producto', id);
    }
    return { success: false };
  }

  public async obtenerHistorialVentas(): Promise<any[]> {
    if (this.ipc) {
      return await this.ipc.invoke('obtener-historial-ventas');
    }
    return [];
  }

  public async obtenerDetalleVenta(idVenta: number): Promise<any[]> {
    if (this.ipc) {
      return await this.ipc.invoke('obtener-detalle-venta', idVenta);
    }
    return [];
  }

  public async obtenerUsuarios(): Promise<any[]> {
    if (this.ipc) {
      return await this.ipc.invoke('obtener-usuarios');
    }
    return [];
  }

  public async crearUsuario(data: { usuario: string, contrasena: string, rol: string }): Promise<any> {
    if (this.ipc) {
      return await this.ipc.invoke('crear-usuario', data);
    }
    return { success: false };
  }

  public async eliminarUsuario(id: number): Promise<any> {
    if (this.ipc) {
      return await this.ipc.invoke('eliminar-usuario', id);
    }
    return { success: false };
  }

  public async obtenerMetricasDashboard(): Promise<any> {
    if (this.ipc) {
      return await this.ipc.invoke('obtener-metricas-dashboard');
    }
    return { ventasHoy: 0, transaccionesHoy: 0, totalProductos: 0, stockCritico: 0 };
  }

  public async obtenerAlertasStock(): Promise<any[]> {
    if (this.ipc) {
      return await this.ipc.invoke('obtener-alertas-stock');
    }
    return [];
  }

  public async obtenerTopProductos(): Promise<any[]> {
    if (this.ipc) {
      return await this.ipc.invoke('obtener-top-productos');
    }
    return [];
  }

}