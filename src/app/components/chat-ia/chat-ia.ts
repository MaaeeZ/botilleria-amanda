import { Component, OnInit, ChangeDetectorRef, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ElectronService } from '../../services/electron';

export interface MensajeChat {
  emisor: 'usuario' | 'ia';
  texto: string;
  sql?: string;
  fecha: Date;
  error?: boolean;
}

@Component({
  selector: 'app-chat-ia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-ia.html',
  styleUrl: './chat-ia.scss'
})
export class ChatIaComponent implements OnInit {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  abierto = false;
  modoConfiguracion = false;
  cargando = false;
  guardandoKey = false;

  inputPregunta = '';
  inputApiKey = '';
  mensajeKey: { tipo: 'exito' | 'error'; texto: string } | null = null;

  geminiStatus: { configured: boolean; maskedKey: string; source: string; message?: string } = {
    configured: false,
    maskedKey: '',
    source: 'none'
  };

  historial: MensajeChat[] = [
    {
      emisor: 'ia',
      texto: '¡Hola! Soy tu Asistente de Negocio impulsado por Google Gemini. Puedo consultar en tiempo real las ventas, el inventario, los productos y clientes de Botillería Amanda. ¿En qué te puedo ayudar hoy?',
      fecha: new Date()
    }
  ];

  preguntasRapidas: string[] = [
    '¿Cuánto vendimos hoy?',
    '¿Qué productos tienen stock bajo?',
    '¿Cuál es el top de productos más vendidos?',
    'Resumen de ventas de este mes'
  ];

  constructor(
    private electronService: ElectronService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  async ngOnInit() {
    await this.cargarEstadoKey();
  }

  async cargarEstadoKey() {
    const res = await this.electronService.getGeminiStatus();
    this.ngZone.run(() => {
      if (res) {
        this.geminiStatus = res;
      }
      this.cdr.detectChanges();
    });
  }

  toggleChat() {
    this.abierto = !this.abierto;
    if (this.abierto) {
      if (!this.geminiStatus.configured) {
        this.modoConfiguracion = true;
      }
      this.scrollToBottom();
    }
    this.cdr.detectChanges();
  }

  toggleConfiguracion() {
    this.modoConfiguracion = !this.modoConfiguracion;
    this.mensajeKey = null;
    this.cdr.detectChanges();
  }

  async guardarApiKey() {
    if (!this.inputApiKey.trim()) {
      this.mensajeKey = { tipo: 'error', texto: 'Por favor ingresa una API Key válida.' };
      return;
    }

    this.guardandoKey = true;
    this.mensajeKey = null;
    this.cdr.detectChanges();

    const res = await this.electronService.saveGeminiKey(this.inputApiKey);

    this.ngZone.run(async () => {
      this.guardandoKey = false;

      if (res && res.success) {
        this.mensajeKey = { tipo: 'exito', texto: '¡API Key guardada y conectada con éxito!' };
        this.inputApiKey = '';
        await this.cargarEstadoKey();
        setTimeout(() => {
          this.ngZone.run(() => {
            this.modoConfiguracion = false;
            this.mensajeKey = null;
            this.cdr.detectChanges();
          });
        }, 1500);
      } else {
        this.mensajeKey = { tipo: 'error', texto: res?.message || 'Error al guardar la clave.' };
      }
      this.cdr.detectChanges();
    });
  }

  seleccionarPreguntaRapida(pregunta: string) {
    this.inputPregunta = pregunta;
    this.enviarPregunta();
  }

  async enviarPregunta() {
    const query = this.inputPregunta.trim();
    if (!query || this.cargando) return;

    // Agregar mensaje del usuario al historial y activar loading de inmediato
    this.historial.push({
      emisor: 'usuario',
      texto: query,
      fecha: new Date()
    });

    this.inputPregunta = '';
    this.cargando = true;
    this.cdr.detectChanges();
    this.scrollToBottom();

    try {
      // Consulta a la IA a través de Electron IPC
      const res = await this.electronService.askAI(query);

      this.ngZone.run(() => {
        if (res && res.success) {
          this.historial.push({
            emisor: 'ia',
            texto: res.respuesta,
            sql: res.sql,
            fecha: new Date()
          });
        } else if (res && res.necesitaConfig) {
          this.historial.push({
            emisor: 'ia',
            texto: res.message || 'Se requiere configurar la API Key de Gemini para utilizar el asistente.',
            fecha: new Date(),
            error: true
          });
          this.modoConfiguracion = true;
        } else {
          this.historial.push({
            emisor: 'ia',
            texto: res?.message || 'Ocurrió un error al procesar tu consulta con la base de datos.',
            fecha: new Date(),
            error: true
          });
        }
        this.cdr.detectChanges();
        this.scrollToBottom();
      });

    } catch (err: any) {
      this.ngZone.run(() => {
        this.historial.push({
          emisor: 'ia',
          texto: 'Error de comunicación: ' + (err?.message || 'No se pudo conectar con el servicio de IA.'),
          fecha: new Date(),
          error: true
        });
        this.cdr.detectChanges();
        this.scrollToBottom();
      });
    } finally {
      // Garantizar SIEMPRE el apagado del indicador de carga y refresco visual
      this.ngZone.run(() => {
        this.cargando = false;
        this.cdr.detectChanges();
        this.scrollToBottom();
      });
    }
  }

  private scrollToBottom() {
    setTimeout(() => {
      try {
        if (this.scrollContainer) {
          this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
        }
      } catch (err) {}
    }, 100);
  }
}
