import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ElectronService } from '../../services/electron';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit {
  usuarioActivo: any = null;
  metricas = {
    ventasHoy: 0,
    transaccionesHoy: 0,
    totalProductos: 0,
    stockCritico: 0
  };
  topProductos: any[] = [];

  constructor(
    public router: Router,
    private electronService: ElectronService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    const userStr = localStorage.getItem('usuario');
    if (userStr) {
      this.usuarioActivo = JSON.parse(userStr);
    }
    await this.cargarMetricas();
    await this.cargarTopProductos();
  }

  async cargarMetricas() {
    this.metricas = await this.electronService.obtenerMetricasDashboard();
    this.cdr.detectChanges();
  }

  async cargarTopProductos() {
    this.topProductos = await this.electronService.obtenerTopProductos();
    this.cdr.detectChanges();
  }

  logout() {
    localStorage.removeItem('usuario');
    this.router.navigate(['/login']);
  }
}