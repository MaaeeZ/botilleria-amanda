import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { DashboardComponent } from './components/dashboard/dashboard';
import { VentasComponent } from './components/ventas/ventas';
import { ProductosComponent } from './components/productos/productos';
import { HistorialVentasComponent } from './components/historial-ventas/historial-ventas';
import { UsuariosComponent } from './components/usuarios/usuarios';
import { AlertasComponent } from './components/alertas/alertas';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'ventas', component: VentasComponent },
  { path: 'productos', component: ProductosComponent },
  { path: 'historial', component: HistorialVentasComponent },
  { path: 'usuarios', component: UsuariosComponent },
  { path: 'alertas', component: AlertasComponent },
  { path: '**', redirectTo: 'login' }
];