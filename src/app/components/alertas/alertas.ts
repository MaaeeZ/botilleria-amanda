import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ElectronService } from '../../services/electron';

@Component({
  selector: 'app-alertas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alertas.html',
  styleUrl: './alertas.scss'
})
export class AlertasComponent implements OnInit {
  alertas: any[] = [];

  constructor(
    private electronService: ElectronService,
    private router: Router,
    private cdr: ChangeDetectorRef // <- Inyectamos la herramienta de renderizado
  ) {}

  async ngOnInit() {
    this.alertas = await this.electronService.obtenerAlertasStock();
    this.cdr.detectChanges(); // <- Obliga a Angular a actualizar la pantalla de inmediato
  }

  volverAlDashboard() {
    this.router.navigate(['/dashboard']);
  }

  irAInventario() {
    this.router.navigate(['/productos']);
  }
}