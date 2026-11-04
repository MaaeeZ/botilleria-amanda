import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ElectronService } from '../../services/electron';

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ventas.html',
  styleUrl: './ventas.scss'
})
export class VentasComponent implements OnInit {
  productos: any[] = [];
  busqueda = '';
  carrito: any[] = [];
  metodoPago = 'Efectivo';

  constructor(
    private electronService: ElectronService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.cargarProductos();
  }

  volverAlDashboard() {
    this.router.navigate(['/dashboard']);
  }

  async cargarProductos() {
    this.productos = await this.electronService.obtenerProductos();
    this.cdr.detectChanges(); // <- Forzar repintado instantáneo
  }

  productosFiltrados() {
    if (!this.busqueda.trim()) return this.productos;
    return this.productos.filter(p => 
      p.nombre_producto.toLowerCase().includes(this.busqueda.toLowerCase()) ||
      p.codigo_barra.includes(this.busqueda)
    );
  }

  buscarOAgregarPorCodigo() {
    const prod = this.productos.find(p => p.codigo_barra === this.busqueda.trim());
    if (prod) {
      this.agregarAlCarrito(prod);
      this.busqueda = '';
    }
  }

  agregarAlCarrito(producto: any) {
    const existe = this.carrito.find(item => item.producto.id_producto === producto.id_producto);
    if (existe) {
      if (existe.cantidad < producto.stock_actual) {
        existe.cantidad++;
        existe.subtotal = existe.cantidad * producto.precio_venta;
      }
    } else {
      this.carrito.push({
        producto,
        cantidad: 1,
        subtotal: producto.precio_venta
      });
    }
  }

  cambiarCantidad(item: any, delta: number) {
    item.cantidad += delta;
    if (item.cantidad <= 0) {
      this.eliminarDelCarrito(item);
    } else {
      item.subtotal = item.cantidad * item.producto.precio_venta;
    }
  }

  eliminarDelCarrito(item: any) {
    this.carrito = this.carrito.filter(i => i.producto.id_producto !== item.producto.id_producto);
  }

  calcularTotal(): number {
    return this.carrito.reduce((acc, item) => acc + item.subtotal, 0);
  }

  limpiarCarrito() {
    this.carrito = [];
  }

  async finalizarVenta() {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const ventaData = {
      items: this.carrito,
      total: this.calcularTotal(),
      metodoPago: this.metodoPago,
      idUsuario: usuario.id || 1
    };

    const res = await this.electronService.registrarVenta(ventaData);
    if (res.success) {
      alert(`¡Venta realizada con éxito!\nNúmero de Ticket: ${res.numeroVenta}`);
      this.limpiarCarrito();
      await this.cargarProductos();
    } else {
      alert('Error al registrar la venta: ' + res.message);
    }
  }
}