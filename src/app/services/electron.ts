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
}