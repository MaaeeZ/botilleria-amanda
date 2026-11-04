import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ElectronService } from '../../services/electron';

@Component({
  selector: 'app-historial-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historial-ventas.html',
  styleUrl: './historial-ventas.scss'
})
export class HistorialVentasComponent implements OnInit {
  ventas: any[] = [];
  busqueda = '';
  mostrarModal = false;
  ventaSeleccionada: any = null;
  detalles: any[] = [];

  constructor(
    private electronService: ElectronService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.cargarHistorial();
  }

  async cargarHistorial() {
    this.ventas = await this.electronService.obtenerHistorialVentas();
    this.cdr.detectChanges(); // <- Forzar repintado instantáneo
  }

  ventasFiltradas() {
    if (!this.busqueda.trim()) return this.ventas;
    return this.ventas.filter(v => 
      v.numero_venta.toLowerCase().includes(this.busqueda.toLowerCase()) ||
      v.metodo_pago.toLowerCase().includes(this.busqueda.toLowerCase())
    );
  }

  volverAlDashboard() {
    this.router.navigate(['/dashboard']);
  }

  async verDetalle(venta: any) {
    this.ventaSeleccionada = venta;
    this.detalles = await this.electronService.obtenerDetalleVenta(venta.id_venta);
    this.mostrarModal = true;
    this.cdr.detectChanges();
  }

  cerrarModal() {
    this.mostrarModal = false;
  }

  imprimirVoucher() {
    window.print();
  }
}