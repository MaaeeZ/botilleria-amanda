import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

  constructor(private electronService: ElectronService) {}

  async onLogin() {
    const res = await this.electronService.login(this.usuario, this.contrasena);
    if (res.success) {
      alert(`Bienvenido, ${res.user.nombre} (${res.user.rol})`);
    } else {
      this.errorMsj = res.message;
    }
  }
}