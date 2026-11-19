import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ResumenVentas {
  totalTransacciones: number;
  montoTotal: number;
  ticketPromedio: number;
  porMetodo: { [metodo: string]: { cantidad: number; total: number } };
  fechaInicio?: string;
  fechaFin?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportesService {

  constructor() {}

  // =========================================================================
  // 1. EXPORTACIÓN A EXCEL (.XLSX)
  // =========================================================================
  public exportarExcel(ventas: any[], nombreArchivo: string = 'Reporte_Ventas'): void {
    if (!ventas || ventas.length === 0) {
      alert('No hay datos disponibles para exportar a Excel.');
      return;
    }

    const fechaHoy = new Date().toLocaleDateString('es-CL');
    const horaHoy = new Date().toLocaleTimeString('es-CL');

    // Mapeo de datos para la hoja
    const datosExcel = ventas.map((v, index) => ({
      'N°': index + 1,
      'N° Ticket': v.numero_venta,
      'Fecha y Hora': this.formatearFecha(v.fecha),
      'Cajero / Usuario': v.usuario || 'Sistema',
      'Método de Pago': v.metodo_pago,
      'Total ($)': Number(v.total)
    }));

    // Calcular totales
    const totalRecaudado = ventas.reduce((acc, curr) => acc + Number(curr.total || 0), 0);

    // Crear hoja de cálculo
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(datosExcel);

    // Añadir fila de totales al final
    XLSX.utils.sheet_add_json(ws, [
      {
        'N°': '',
        'N° Ticket': '',
        'Fecha y Hora': '',
        'Cajero / Usuario': '',
        'Método de Pago': 'TOTAL RECAUDADO:',
        'Total ($)': totalRecaudado
      }
    ], { skipHeader: true, origin: -1 });

    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 6 },  // N°
      { wch: 18 }, // N° Ticket
      { wch: 22 }, // Fecha
      { wch: 20 }, // Cajero
      { wch: 20 }, // Método de Pago
      { wch: 16 }  // Total
    ];

    // Crear libro y agregar hoja
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historial Ventas');

    // Guardar archivo
    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${nombreArchivo}_${timestamp}.xlsx`);
  }

  // =========================================================================
  // 2. EXPORTACIÓN A PDF FORMAL (.PDF)
  // =========================================================================
  public exportarPDF(ventas: any[], nombreArchivo: string = 'Reporte_Ventas'): void {
    if (!ventas || ventas.length === 0) {
      alert('No hay datos disponibles para exportar a PDF.');
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const totalRecaudado = ventas.reduce((acc, curr) => acc + Number(curr.total || 0), 0);
    const fechaEmision = new Date().toLocaleString('es-CL');

    // --- ENCABEZADO FORMAL DEL NEGOCIO ---
    doc.setFillColor(6, 78, 59); // Verde institucional #064e3b
    doc.rect(0, 0, 210, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('BOTILLERÍA AMANDA', 14, 12);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Reporte Oficial de Ventas y Transacciones', 14, 19);
    doc.text(`Fecha de Emisión: ${fechaEmision}`, 200, 19, { align: 'right' });

    // --- METADATOS Y RESUMEN RÁPIDO ---
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total de Transacciones: ${ventas.length}`, 14, 36);
    doc.text(`Monto Total Recaudado: $${totalRecaudado.toLocaleString('es-CL')}`, 200, 36, { align: 'right' });

    // --- TABLA DE DETALLES CON AUTOTABLE ---
    const columnas = ['N° Ticket', 'Fecha y Hora', 'Cajero', 'Método Pago', 'Total'];
    const filas = ventas.map(v => [
      v.numero_venta,
      this.formatearFecha(v.fecha),
      v.usuario || 'Sistema',
      v.metodo_pago,
      `$${Number(v.total).toLocaleString('es-CL')}`
    ]);

    autoTable(doc, {
      startY: 42,
      head: [columnas],
      body: filas,
      theme: 'striped',
      headStyles: {
        fillColor: [6, 78, 59],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 2.5
      },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 45 },
        2: { cellWidth: 38 },
        3: { cellWidth: 35 },
        4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
      },
      foot: [[
        'TOTAL GENERAL',
        '',
        '',
        `${ventas.length} transacciones`,
        `$${totalRecaudado.toLocaleString('es-CL')}`
      ]],
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [6, 78, 59],
        fontStyle: 'bold',
        fontSize: 9.5
      }
    });

    // Pie de página con numeración
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Botillería Amanda - Página ${i} de ${pageCount}`,
        105,
        290,
        { align: 'center' }
      );
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    doc.save(`${nombreArchivo}_${timestamp}.pdf`);
  }

  // =========================================================================
  // 3. EXPORTACIÓN A CSV PLANO CONTABLE (.CSV)
  // =========================================================================
  public exportarCSV(ventas: any[], nombreArchivo: string = 'Reporte_Ventas'): void {
    if (!ventas || ventas.length === 0) {
      alert('No hay datos disponibles para exportar a CSV.');
      return;
    }

    // Encabezados con delimitador ';' para compatibilidad contable en Chile / Excel en español
    const encabezados = ['Numero_Ticket', 'Fecha_Hora', 'Cajero', 'Metodo_Pago', 'Total'];
    const lineas = [encabezados.join(';')];

    ventas.forEach(v => {
      const fecha = this.formatearFecha(v.fecha);
      const linea = [
        `"${v.numero_venta}"`,
        `"${fecha}"`,
        `"${(v.usuario || 'Sistema').replace(/"/g, '""')}"`,
        `"${v.metodo_pago}"`,
        v.total
      ];
      lineas.push(linea.join(';'));
    });

    // Fila final de totales
    const totalRecaudado = ventas.reduce((acc, curr) => acc + Number(curr.total || 0), 0);
    lineas.push(['"TOTAL_RECAUDADO"', '""', '""', '""', totalRecaudado].join(';'));

    // UTF-8 BOM (\uFEFF) para que Excel abra acentos y caracteres especiales sin corromper
    const contenidoCSV = '\uFEFF' + lineas.join('\r\n');
    const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `${nombreArchivo}_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // =========================================================================
  // 4. GENERACIÓN DE DATOS PARA VISTA PREVIA IMPRIMIBLE / RESUMEN
  // =========================================================================
  public calcularResumen(ventas: any[]): ResumenVentas {
    const totalTransacciones = ventas.length;
    const montoTotal = ventas.reduce((acc, curr) => acc + Number(curr.total || 0), 0);
    const ticketPromedio = totalTransacciones > 0 ? Math.round(montoTotal / totalTransacciones) : 0;

    const porMetodo: { [metodo: string]: { cantidad: number; total: number } } = {
      'Efectivo': { cantidad: 0, total: 0 },
      'Débito': { cantidad: 0, total: 0 },
      'Crédito': { cantidad: 0, total: 0 }
    };

    ventas.forEach(v => {
      const metodo = v.metodo_pago || 'Otro';
      if (!porMetodo[metodo]) {
        porMetodo[metodo] = { cantidad: 0, total: 0 };
      }
      porMetodo[metodo].cantidad++;
      porMetodo[metodo].total += Number(v.total || 0);
    });

    return {
      totalTransacciones,
      montoTotal,
      ticketPromedio,
      porMetodo
    };
  }

  // Utilidad para dar formato a fechas ISO o Date
  private formatearFecha(fecha: any): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return String(fecha);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${hora}:${min}`;
  }
}
