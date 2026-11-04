import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ElectronService } from '../../services/electron';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  usuario = '';
  contrasena = '';
  errorMsj = '';

  constructor(
    private electronService: ElectronService,
    private router: Router
  ) {}

  async onLogin() {
    const res = await this.electronService.login(this.usuario, this.contrasena);
    if (res.success) {
      // Guardar el usuario activo
      localStorage.setItem('usuario', JSON.stringify(res.user));
      // Redirigir al Dashboard
      this.router.navigate(['/dashboard']);
    } else {
      this.errorMsj = res.message;
    }
  }
}