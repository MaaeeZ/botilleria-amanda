import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ElectronService } from '../../services/electron';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss'
})
export class UsuariosComponent implements OnInit {
  usuarios: any[] = [];
  mostrarModal = false;

  formUser = {
    usuario: '',
    contrasena: '',
    rol: 'Cajero'
  };

  constructor(
    private electronService: ElectronService,
    private router: Router,
    private cdr: ChangeDetectorRef // <- Inyectamos la herramienta
  ) {}

  async ngOnInit() {
    const usuarioActivo = JSON.parse(localStorage.getItem('usuario') || '{}');

    if (usuarioActivo.rol !== 'Administrador') {
      alert('⚠️ No tienes permisos de Administrador para acceder a la gestión de usuarios.');
      this.router.navigate(['/dashboard']);
      return;
    }

    await this.cargarUsuarios();
  }

  async cargarUsuarios() {
    this.usuarios = await this.electronService.obtenerUsuarios();
    this.cdr.detectChanges(); // <- Forzar repintado instantáneo
  }

  volverAlDashboard() {
    this.router.navigate(['/dashboard']);
  }

  abrirModalCrear() {
    this.formUser = { usuario: '', contrasena: '', rol: 'Cajero' };
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
  }

  async guardarUsuario(event: Event) {
    event.preventDefault();
    const res = await this.electronService.crearUsuario(this.formUser);
    if (res.success) {
      this.cerrarModal();
      await this.cargarUsuarios();
    } else {
      alert(res.message);
    }
  }

  async eliminar(id: number) {
    if (confirm('¿Deseas eliminar este usuario?')) {
      const res = await this.electronService.eliminarUsuario(id);
      if (res.success) {
        await this.cargarUsuarios();
      } else {
        alert(res.message);
      }
    }
  }
}