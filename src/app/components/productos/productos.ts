import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ElectronService } from '../../services/electron';

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './productos.html',
  styleUrl: './productos.scss'
})
export class ProductosComponent implements OnInit {
  productos: any[] = [];
  busqueda = '';
  mostrarModal = false;
  editando = false;
  esAdmin = false; // Variable para controlar permisos

  formProducto: any = {
    id_producto: null,
    codigo_barra: '',
    nombre_producto: '',
    precio_compra: 0,
    precio_venta: 0,
    stock_actual: 0,
    stock_minimo: 5,
    imagen_url: ''
  };

  constructor(
    private electronService: ElectronService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    // Validar si el usuario activo es Administrador
    const usuarioActivo = JSON.parse(localStorage.getItem('usuario') || '{}');
    this.esAdmin = usuarioActivo.rol === 'Administrador';

    await this.cargarProductos();
  }

  async cargarProductos() {
    this.productos = await this.electronService.obtenerTodosProductos();
    this.cdr.detectChanges();
  }

  productosFiltrados() {
    if (!this.busqueda.trim()) return this.productos;
    return this.productos.filter(p =>
      p.nombre_producto.toLowerCase().includes(this.busqueda.toLowerCase()) ||
      p.codigo_barra.includes(this.busqueda)
    );
  }

  volverAlDashboard() {
    this.router.navigate(['/dashboard']);
  }

  abrirModalCrear() {
    if (!this.esAdmin) return;
    this.editando = false;
    this.formProducto = { id_producto: null, codigo_barra: '', nombre_producto: '', precio_compra: 0, precio_venta: 0, stock_actual: 0, stock_minimo: 5, imagen_url: '' };
    this.mostrarModal = true;
  }

  abrirModalEditar(prod: any) {
    if (!this.esAdmin) return;
    this.editando = true;
    this.formProducto = { ...prod };
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
  }

  async guardarProducto(event: Event) {
    event.preventDefault();
    if (!this.esAdmin) return;

    let res;
    if (this.editando) {
      res = await this.electronService.editarProducto(this.formProducto);
    } else {
      res = await this.electronService.crearProducto(this.formProducto);
    }

    if (res.success) {
      this.cerrarModal();
      await this.cargarProductos();
    } else {
      alert('Error al guardar el producto: ' + (res.message || 'Error desconocido'));
    }
  }

  async eliminar(id: number) {
    if (!this.esAdmin) return;
    if (confirm('¿Estás seguro de que deseas eliminar este producto del inventario?')) {
      const res = await this.electronService.eliminarProducto(id);
      if (res.success) {
        await this.cargarProductos();
      } else {
        alert('No se puede eliminar el producto porque tiene ventas asociadas.');
      }
    }
  }

  alSeleccionarImagen(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('La imagen es muy pesada. Por favor selecciona una imagen de menos de 2MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        this.formProducto.imagen_url = reader.result as string;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

}