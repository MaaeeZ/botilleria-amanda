require('dotenv').config();
const nodemailer = require('nodemailer');
const { pool } = require('../database');

/**
 * Obtiene la fecha actual en formato local 'YYYY-MM-DD'
 */
function getFechaLocal(offsetDias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Consulta todas las métricas, ventas y productos de una fecha específica
 */
async function obtenerDatosCierre(fechaStr) {
  const fecha = fechaStr || getFechaLocal();

  // 1. Totales y conteo del día
  const resTotales = await pool.query(`
    SELECT 
      COALESCE(SUM(total), 0) AS total_ventas,
      COUNT(id_venta) AS cantidad_transacciones
    FROM "Venta"
    WHERE DATE(fecha) = $1
  `, [fecha]);

  const totalVentas = Number(resTotales.rows[0].total_ventas);
  const cantidadTransacciones = Number(resTotales.rows[0].cantidad_transacciones);
  const ticketPromedio = cantidadTransacciones > 0 ? Math.round(totalVentas / cantidadTransacciones) : 0;

  // 2. Desglose por método de pago
  const resMetodos = await pool.query(`
    SELECT 
      metodo_pago,
      COUNT(id_venta) AS cantidad,
      COALESCE(SUM(total), 0) AS total
    FROM "Venta"
    WHERE DATE(fecha) = $1
    GROUP BY metodo_pago
    ORDER BY total DESC
  `, [fecha]);

  // 3. Top 5 productos más vendidos del día
  const resTop = await pool.query(`
    SELECT 
      p.nombre_producto,
      SUM(dv.cantidad) AS total_vendido,
      SUM(dv.subtotal) AS total_recaudado
    FROM "DetalleVenta" dv
    JOIN "Venta" v ON dv.id_venta = v.id_venta
    JOIN "Producto" p ON dv.id_producto = p.id_producto
    WHERE DATE(v.fecha) = $1
    GROUP BY p.id_producto, p.nombre_producto
    ORDER BY total_vendido DESC
    LIMIT 5
  `, [fecha]);

  // 4. Lista detallada de todas las ventas del día para el archivo adjunto
  const resVentas = await pool.query(`
    SELECT 
      v.id_venta,
      v.numero_venta,
      v.fecha,
      v.total,
      v.metodo_pago,
      COALESCE(u.nombre_usuario, 'Sistema') AS usuario
    FROM "Venta" v
    LEFT JOIN "Usuario" u ON v.id_usuario = u.id_usuario
    WHERE DATE(v.fecha) = $1
    ORDER BY v.fecha ASC
  `, [fecha]);

  return {
    fecha,
    totalVentas,
    cantidadTransacciones,
    ticketPromedio,
    desgloseMetodos: resMetodos.rows,
    topProductos: resTop.rows,
    ventas: resVentas.rows
  };
}

/**
 * Consulta el estado del cierre para la fecha de hoy
 */
async function obtenerEstadoCierreHoy() {
  try {
    const hoy = getFechaLocal();
    const datosHoy = await obtenerDatosCierre(hoy);

    const resCierre = await pool.query(`
      SELECT * FROM "cierres_caja" WHERE fecha_cierre = $1
    `, [hoy]);

    const registro = resCierre.rows[0] || null;
    const destinatario = process.env.CIERRE_DESTINATARIO || 'administrador@botilleriaamanda.cl';

    return {
      success: true,
      fecha: hoy,
      yaCerrado: registro ? Boolean(registro.enviado_correo) : false,
      cierre: registro,
      resumen: datosHoy,
      destinatario,
      horaAuto: process.env.CIERRE_HORA_AUTO || '23:00'
    };
  } catch (error) {
    console.error('Error al obtener estado de cierre:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Genera el archivo plano CSV con codificación UTF-8 BOM
 */
function generarAdjuntoCSV(fechaStr, ventas, totalVentas) {
  const lineas = [
    'Numero_Ticket;Fecha_Hora;Cajero;Metodo_Pago;Total'
  ];

  ventas.forEach(v => {
    const d = new Date(v.fecha);
    const fechaFmt = `${d.toLocaleDateString('es-CL')} ${d.toLocaleTimeString('es-CL')}`;
    lineas.push(`"${v.numero_venta}";"${fechaFmt}";"${v.usuario}";"${v.metodo_pago}";${v.total}`);
  });

  lineas.push(`"TOTAL_RECAUDADO";"";"";"";${totalVentas}`);

  return '\uFEFF' + lineas.join('\r\n');
}

/**
 * Genera el cuerpo del correo en HTML responsivo y estilizado
 */
function generarPlantillaHTML(fechaStr, datos) {
  const [year, month, day] = fechaStr.split('-');
  const fechaChile = `${day}/${month}/${year}`;
  const horaEnvio = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

  let filasMetodos = '';
  datos.desgloseMetodos.forEach(m => {
    filasMetodos += `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">${m.metodo_pago}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 14px;">${m.cantidad} transac.</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 14px; font-weight: bold; color: #064e3b;">$${Number(m.total).toLocaleString('es-CL')}</td>
      </tr>
    `;
  });

  let filasTop = '';
  datos.topProductos.forEach((p, idx) => {
    filasTop += `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">#${idx + 1} ${p.nombre_producto}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 14px;">${p.total_vendido} un.</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 14px;">$${Number(p.total_recaudado).toLocaleString('es-CL')}</td>
      </tr>
    `;
  });

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Cierre de Caja - Botillería Amanda</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
      
      <!-- Cabecera -->
      <div style="background-color: #064e3b; padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.5px;">🍾 BOTILLERÍA AMANDA</h1>
        <p style="margin: 6px 0 0; font-size: 14px; color: #a7f3d0;">Cierre Oficial de Caja Diario</p>
        <p style="margin: 4px 0 0; font-size: 12px; color: #cbd5e1;">Fecha de Cuadratura: <strong>${fechaChile}</strong> | Envío: ${horaEnvio}</p>
      </div>

      <!-- Métricas Clave -->
      <div style="padding: 24px 20px 10px;">
        <table style="width: 100%; border-collapse: separate; border-spacing: 8px;">
          <tr>
            <td style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 14px; text-align: center;">
              <span style="font-size: 11px; color: #047857; text-transform: uppercase; font-weight: bold;">Total Recaudado</span>
              <div style="font-size: 22px; font-weight: bold; color: #064e3b; margin-top: 4px;">$${datos.totalVentas.toLocaleString('es-CL')}</div>
            </td>
            <td style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; text-align: center;">
              <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold;">Transacciones</span>
              <div style="font-size: 22px; font-weight: bold; color: #1e293b; margin-top: 4px;">${datos.cantidadTransacciones}</div>
            </td>
            <td style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; text-align: center;">
              <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold;">Ticket Promedio</span>
              <div style="font-size: 22px; font-weight: bold; color: #1e293b; margin-top: 4px;">$${datos.ticketPromedio.toLocaleString('es-CL')}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Desglose Métodos de Pago -->
      <div style="padding: 10px 24px;">
        <h3 style="margin: 0 0 10px; font-size: 15px; color: #1e293b; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px;">
          💳 Desglose por Método de Pago
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f8fafc; color: #64748b; font-size: 12px; text-align: left;">
              <th style="padding: 8px 12px;">Método</th>
              <th style="padding: 8px 12px; text-align: center;">Ventas</th>
              <th style="padding: 8px 12px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${filasMetodos || '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #94a3b8;">No se registraron ventas en esta fecha.</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- Top Productos -->
      <div style="padding: 10px 24px;">
        <h3 style="margin: 0 0 10px; font-size: 15px; color: #1e293b; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px;">
          ⭐ Top 5 Productos del Día
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f8fafc; color: #64748b; font-size: 12px; text-align: left;">
              <th style="padding: 8px 12px;">Producto</th>
              <th style="padding: 8px 12px; text-align: center;">Unidades</th>
              <th style="padding: 8px 12px; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${filasTop || '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #94a3b8;">Sin movimientos.</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- Nota de Adjunto -->
      <div style="margin: 20px 24px; padding: 12px 16px; background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; font-size: 13px; color: #1e40af;">
        📎 Se adjunta el archivo plano <strong>Cierre_Caja_${fechaStr}.csv</strong> con la auditoría de cada una de las boletas y transacciones del día.
      </div>

      <!-- Pie de Página -->
      <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        Este es un reporte automático generado por el Sistema POS de <strong>Botillería Amanda</strong>.<br>
        Por favor no responder directamente a este correo.
      </div>
    </div>
  </body>
  </html>
  `;
}

/**
 * Ejecuta el cierre de caja (manual o automático) y envía el correo por SMTP
 */
async function ejecutarCierre(fechaOpcional = null, esAutomatico = false) {
  try {
    const fecha = fechaOpcional || getFechaLocal();
    const datos = await obtenerDatosCierre(fecha);

    const destinatario = process.env.CIERRE_DESTINATARIO || 'administrador@botilleriaamanda.cl';
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    // Validación de configuración SMTP
    if (!smtpUser || !smtpPass || smtpUser.includes('tu_correo@') || smtpPass.includes('tu_contrasena')) {
      const errorMsg = '⚠️ Configuración SMTP incompleta en el archivo .env. Configura SMTP_USER y SMTP_PASS para enviar correos.';
      console.warn(errorMsg);
      return {
        success: false,
        message: errorMsg,
        requiereConfig: true
      };
    }

    // Configuración del transporte de Nodemailer
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    const [year, month, day] = fecha.split('-');
    const fechaChile = `${day}/${month}/${year}`;
    const asunto = `🍾 Cierre de Caja Diario [${fechaChile}] - Botillería Amanda`;
    const htmlBody = generarPlantillaHTML(fecha, datos);
    const csvContent = generarAdjuntoCSV(fecha, datos.ventas, datos.totalVentas);

    // Envío del correo
    const info = await transporter.sendMail({
      from: `"Botillería Amanda" <${smtpUser}>`,
      to: destinatario,
      subject: asunto,
      html: htmlBody,
      attachments: [
        {
          filename: `Cierre_Caja_${fecha}.csv`,
          content: csvContent,
          contentType: 'text/csv; charset=utf-8'
        }
      ]
    });

    console.log(`[Cierre Caja] Correo enviado exitosamente a ${destinatario}. MessageId: ${info.messageId}`);

    // Registro o actualización en la tabla cierres_caja
    await pool.query(`
      INSERT INTO "cierres_caja" (fecha_cierre, total_ventas, cantidad_transacciones, enviado_correo, fecha_envio, destinatario)
      VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP, $4)
      ON CONFLICT (fecha_cierre) 
      DO UPDATE SET 
        total_ventas = EXCLUDED.total_ventas,
        cantidad_transacciones = EXCLUDED.cantidad_transacciones,
        enviado_correo = true,
        fecha_envio = CURRENT_TIMESTAMP,
        destinatario = EXCLUDED.destinatario
    `, [fecha, datos.totalVentas, datos.cantidadTransacciones, destinatario]);

    return {
      success: true,
      message: `Cierre de caja enviado exitosamente a ${destinatario}`,
      destinatario,
      totalVentas: datos.totalVentas,
      cantidadTransacciones: datos.cantidadTransacciones,
      fecha
    };
  } catch (error) {
    console.error('[Cierre Caja] Error al ejecutar el cierre:', error);
    return {
      success: false,
      message: `Error al enviar correo: ${error.message}`
    };
  }
}

/**
 * Trigger Automático por Hora: Revisa si ya pasó la hora configurada (ej. 23:00) y envía el cierre
 */
async function verificarYEjecutarCierreAuto() {
  try {
    const horaConfigurada = process.env.CIERRE_HORA_AUTO || '23:00';
    const [horaTarget, minTarget] = horaConfigurada.split(':').map(Number);

    const now = new Date();
    const horaActual = now.getHours();
    const minActual = now.getMinutes();

    // Comprobar si ya es la hora o posterior
    const yaPasoHora = (horaActual > horaTarget) || (horaActual === horaTarget && minActual >= minTarget);

    if (yaPasoHora) {
      const hoy = getFechaLocal();
      const res = await pool.query('SELECT * FROM "cierres_caja" WHERE fecha_cierre = $1', [hoy]);
      const registro = res.rows[0];

      if (!registro || !registro.enviado_correo) {
        console.log(`[Trigger Automático] Hora alcanzada (${horaConfigurada}). Ejecutando cierre automático para ${hoy}...`);
        await ejecutarCierre(hoy, true);
      }
    }
  } catch (error) {
    console.error('[Trigger Automático] Error en la verificación periódica:', error);
  }
}

/**
 * Trigger de Respaldo al Iniciar la App: Verifica si el día de ayer tuvo ventas sin cierre enviado
 */
async function verificarCierrePendienteAyer() {
  try {
    const ayer = getFechaLocal(-1);

    // Verificar si ayer hubo ventas
    const resVentasAyer = await pool.query(`
      SELECT COUNT(id_venta) AS count FROM "Venta" WHERE DATE(fecha) = $1
    `, [ayer]);

    const ventasAyer = parseInt(resVentasAyer.rows[0]?.count || 0);

    if (ventasAyer > 0) {
      // Verificar si ayer ya fue cerrado
      const resCierreAyer = await pool.query(`
        SELECT * FROM "cierres_caja" WHERE fecha_cierre = $1 AND enviado_correo = true
      `, [ayer]);

      if (resCierreAyer.rows.length === 0) {
        console.log(`[Respaldo Inicio] Detectadas ${ventasAyer} ventas de ayer (${ayer}) sin cierre de caja enviado. Ejecutando cierre de respaldo...`);
        const resultado = await ejecutarCierre(ayer, true);
        if (resultado.success) {
          console.log(`[Respaldo Inicio] Cierre de ayer (${ayer}) completado y enviado con éxito.`);
        }
      }
    }
  } catch (error) {
    console.error('[Respaldo Inicio] Error al verificar cierre de ayer:', error);
  }
}

module.exports = {
  obtenerDatosCierre,
  obtenerEstadoCierreHoy,
  ejecutarCierre,
  verificarYEjecutarCierreAuto,
  verificarCierrePendienteAyer
};
