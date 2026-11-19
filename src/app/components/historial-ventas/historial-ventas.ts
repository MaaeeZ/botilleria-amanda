import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ElectronService } from '../../services/electron';
import { ReportesService, ResumenVentas } from '../../services/reportes.service';

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
  
  // Modal de Detalle de Venta individual
  mostrarModal = false;
  ventaSeleccionada: any = null;
  detalles: any[] = [];

  // Modal de Vista Previa / Resumen general imprimible
  mostrarModalResumen = false;
  resumenVentas: ResumenVentas | null = null;
  fechaReporte: string = '';

  // Cierre de Caja Diario por Correo
  cierreHoy: any = null;
  mostrarModalCierre = false;
  cierreEnProceso = false;
  mensajeCierre: { tipo: 'exito' | 'error' | 'info'; texto: string } | null = null;

  constructor(
    private electronService: ElectronService,
    private reportesService: ReportesService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.cargarHistorial();
    await this.consultarEstadoCierre();
  }

  async cargarHistorial() {
    this.ventas = await this.electronService.obtenerHistorialVentas();
    this.cdr.detectChanges();
  }

  ventasFiltradas() {
    if (!this.busqueda.trim()) return this.ventas;
    const term = this.busqueda.toLowerCase();
    return this.ventas.filter(v => 
      v.numero_venta.toLowerCase().includes(term) ||
      v.metodo_pago.toLowerCase().includes(term) ||
      (v.usuario && v.usuario.toLowerCase().includes(term))
    );
  }

  volverAlDashboard() {
    this.router.navigate(['/dashboard']);
  }

  // --- Detalle Individual ---
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

  // =========================================================================
  // MÉTODOS DE GENERACIÓN Y EXPORTACIÓN DE REPORTES (4 OPCIONES)
  // =========================================================================

  exportarExcel() {
    const datos = this.ventasFiltradas();
    this.reportesService.exportarExcel(datos, 'Reporte_Ventas_Botilleria_Amanda');
  }

  exportarPDF() {
    const datos = this.ventasFiltradas();
    this.reportesService.exportarPDF(datos, 'Reporte_Ventas_Botilleria_Amanda');
  }

  exportarCSV() {
    const datos = this.ventasFiltradas();
    this.reportesService.exportarCSV(datos, 'Reporte_Ventas_Botilleria_Amanda');
  }

  abrirVistaPreviaResumen() {
    const datos = this.ventasFiltradas();
    if (!datos || datos.length === 0) {
      alert('No hay registros de ventas para generar la vista previa.');
      return;
    }
    this.resumenVentas = this.reportesService.calcularResumen(datos);
    this.fechaReporte = new Date().toLocaleString('es-CL');
    this.mostrarModalResumen = true;
    this.cdr.detectChanges();
  }

  cerrarModalResumen() {
    this.mostrarModalResumen = false;
  }

  imprimirResumen() {
    window.print();
  }

  // =========================================================================
  // CIERRE DE CAJA DIARIO POR CORREO
  // =========================================================================

  async consultarEstadoCierre() {
    const res = await this.electronService.obtenerEstadoCierreHoy();
    if (res && res.success) {
      this.cierreHoy = res;
    }
    this.cdr.detectChanges();
  }

  async abrirModalCierreCaja() {
    this.mensajeCierre = null;
    await this.consultarEstadoCierre();
    this.mostrarModalCierre = true;
    this.cdr.detectChanges();
  }

  cerrarModalCierre() {
    this.mostrarModalCierre = false;
    this.mensajeCierre = null;
  }

  async confirmarCierreCaja() {
    this.cierreEnProceso = true;
    this.mensajeCierre = null;
    this.cdr.detectChanges();

    const res = await this.electronService.ejecutarCierreManual();
    this.cierreEnProceso = false;

    if (res && res.success) {
      this.mensajeCierre = { tipo: 'exito', texto: res.message };
      await this.consultarEstadoCierre();
      await this.cargarHistorial();
    } else {
      this.mensajeCierre = { 
        tipo: 'error', 
        texto: res?.message || 'Error inesperado al ejecutar el cierre y enviar el correo.' 
      };
    }

    this.cdr.detectChanges();
  }
}
