require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const { pool } = require('../database');

let cachedEsquema = null;
let lastEsquemaFetch = 0;

// Modelos candidatos en orden de velocidad y disponibilidad garantizada
// 'gemini-3.1-flash-lite' es ultrarrápido (1.5s) y no sufre los bloqueos por alta demanda de gemini-3.8-flash
const MODELOS_CANDIDATOS = [
  process.env.GEMINI_MODEL,
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash'
].filter(Boolean);

/**
 * Obtiene la API Key de Gemini:
 * 1. Primero busca en la tabla "configuracion_app" de la base de datos.
 * 2. Si no existe, busca en process.env.GEMINI_API_KEY.
 */
async function getGeminiApiKey() {
  try {
    const res = await pool.query(
      'SELECT valor FROM "configuracion_app" WHERE clave = $1',
      ['GEMINI_API_KEY']
    );
    if (res.rows.length > 0 && res.rows[0].valor && res.rows[0].valor.trim() !== '') {
      return { key: res.rows[0].valor.trim(), source: 'database' };
    }
  } catch (error) {
    console.warn('[Gemini Service] Advertencia al consultar configuracion_app:', error.message);
  }

  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
    return { key: process.env.GEMINI_API_KEY.trim(), source: 'env' };
  }

  return { key: null, source: 'none' };
}

/**
 * Guarda o actualiza la API Key de Gemini en la tabla configuracion_app
 */
async function saveGeminiApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    return { success: false, message: 'La API Key proporcionada está vacía o no es válida.' };
  }

  const cleanKey = apiKey.trim();

  try {
    await pool.query(`
      INSERT INTO "configuracion_app" (clave, valor, actualizado_en)
      VALUES ('GEMINI_API_KEY', $1, NOW())
      ON CONFLICT (clave)
      DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = NOW();
    `, [cleanKey]);

    return {
      success: true,
      message: 'API Key de Gemini guardada correctamente en la base de datos.',
      maskedKey: '••••••••' + cleanKey.slice(-4)
    };
  } catch (error) {
    console.error('[Gemini Service] Error al guardar API Key:', error);
    return { success: false, message: `Error al guardar en base de datos: ${error.message}` };
  }
}

/**
 * Comprueba el estado de configuración de la API Key (sin exponer la clave en texto plano)
 */
async function getGeminiStatus() {
  const { key, source } = await getGeminiApiKey();

  if (!key) {
    return {
      configured: false,
      maskedKey: '',
      source: 'none',
      message: 'No hay ninguna API Key de Gemini configurada.'
    };
  }

  const maskedKey = '••••••••' + key.slice(-4);
  return {
    configured: true,
    maskedKey,
    source,
    message: `API Key activa (origen: ${source === 'database' ? 'Base de Datos' : 'Archivo .env'})`
  };
}

/**
 * Introspección dinámica del esquema de PostgreSQL (tablas y columnas)
 * Con caché en memoria para no saturar la base de datos en cada consulta
 */
async function getEsquemaPostgres() {
  const now = Date.now();
  if (cachedEsquema && (now - lastEsquemaFetch < 1000 * 60 * 15)) {
    return cachedEsquema;
  }

  try {
    const res = await pool.query(`
      SELECT 
        table_name, 
        column_name, 
        data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name NOT IN ('configuracion_app')
      ORDER BY table_name, ordinal_position;
    `);

    const tablas = {};
    for (const fila of res.rows) {
      if (!tablas[fila.table_name]) {
        tablas[fila.table_name] = [];
      }
      tablas[fila.table_name].push(`${fila.column_name} (${fila.data_type})`);
    }

    let esquemaTexto = 'ESQUEMA ACTUAL DE LA BASE DE DATOS POSTGRESQL:\n';
    for (const [tabla, columnas] of Object.entries(tablas)) {
      esquemaTexto += `- Tabla "${tabla}": ${columnas.join(', ')}\n`;
    }

    cachedEsquema = esquemaTexto;
    lastEsquemaFetch = now;
    return esquemaTexto;
  } catch (error) {
    console.error('[Gemini Service] Error en introspección de esquema:', error);
    return `
    ESQUEMA DE BASE DE DATOS:
    - Tabla "Usuario": id_usuario (integer), nombre_usuario (varchar), contrasena (varchar), rol (varchar)
    - Tabla "Categoria": id_categoria (integer), nombre_categoria (varchar), pasillo_ubicacion (varchar)
    - Tabla "Marca": id_marca (integer), nombre_marca (varchar)
    - Tabla "Proveedor": id_proveedor (integer), rut (varchar), razon_social (varchar), dia_visita_vendedor (varchar)
    - Tabla "Producto": id_producto (integer), codigo_barra (varchar), nombre_producto (varchar), precio_compra (integer), precio_venta (integer), stock_actual (integer), stock_minimo (integer), imagen_url (text), id_categoria (integer), id_marca (integer), id_proveedor (integer)
    - Tabla "Venta": id_venta (integer), numero_venta (varchar), fecha (timestamp), total (integer), metodo_pago (varchar), id_usuario (integer)
    - Tabla "DetalleVenta": id_detalle (integer), id_venta (integer), id_producto (integer), cantidad (integer), subtotal (integer)
    - Tabla "cierres_caja": id (integer), fecha_cierre (date), total_ventas (numeric), cantidad_transacciones (integer), enviado_correo (boolean), fecha_envio (timestamp), destinatario (varchar)
    `;
  }
}

/**
 * Validador de Seguridad Estricta para consultas SQL (Solo Lectura)
 */
function validarYSanearSQL(sql) {
  if (!sql || typeof sql !== 'string') {
    throw new Error('No se generó una consulta SQL válida.');
  }

  let query = sql.trim();

  // Limpiar posibles bloques markdown ```sql ... ```
  query = query.replace(/^```(?:sql)?/i, '').replace(/```$/, '').trim();

  // Remover punto y coma final
  if (query.endsWith(';')) {
    query = query.slice(0, -1).trim();
  }

  // Prevenir inyección de consultas múltiples
  if (query.includes(';')) {
    throw new Error('Consulta bloqueada: No se permiten múltiples sentencias ni el caracter ";".');
  }

  // Validar inicio estricto con SELECT o WITH
  const esLectura = /^(\s*SELECT|\s*WITH)\b/i.test(query);
  if (!esLectura) {
    throw new Error('Consulta bloqueada: Solo se permiten consultas de lectura (SELECT o WITH).');
  }

  // Lista negra de palabras clave de modificación / DDL / DML
  const palabrasProhibidas = [
    /\bINSERT\b/i,
    /\bUPDATE\b/i,
    /\bDELETE\b/i,
    /\bDROP\b/i,
    /\bALTER\b/i,
    /\bTRUNCATE\b/i,
    /\bGRANT\b/i,
    /\bREVOKE\b/i,
    /\bCREATE\b/i,
    /\bEXEC\b/i,
    /\bEXECUTE\b/i,
    /\bVACUUM\b/i,
    /\bCOPY\b/i,
    /\bINTO\b/i
  ];

  for (const regex of palabrasProhibidas) {
    if (regex.test(query)) {
      throw new Error(`Consulta bloqueada por seguridad: Operación no permitida (${regex.source}).`);
    }
  }

  // Forzar límite si no tiene LIMIT
  if (!/\bLIMIT\b/i.test(query)) {
    query += ' LIMIT 50';
  }

  return query;
}

/**
 * Ejecuta la llamada a Gemini con reintento automático en modelos alternativos
 * si el principal sufre saturación de demanda (503), error 404 o rate limit (429).
 */
async function ejecutarLlamadaGemini(ai, contents, config, pasoNombre) {
  let ultimoError = null;
  for (const modelo of MODELOS_CANDIDATOS) {
    try {
      const t = Date.now();
      console.log(`[Gemini SQL] ⏱️ ${pasoNombre} usando modelo: ${modelo} (thinkingBudget: 0)...`);
      const res = await ai.models.generateContent({
        model: modelo,
        contents,
        config: {
          ...config,
          thinkingConfig: { thinkingBudget: 0 }
        }
      });
      console.log(`[Gemini SQL] ✓ ${pasoNombre} exitoso con ${modelo} en ${Date.now() - t}ms.`);
      return { res, modeloUsado: modelo };
    } catch (err) {
      ultimoError = err;
      const msg = err.message || '';
      console.warn(`[Gemini SQL] ⚠️ Modelo ${modelo} no disponible (${msg.slice(0, 120)}). Probando alternativa...`);
      if (msg.includes('503') || msg.includes('high demand') || msg.includes('404') || msg.includes('429')) {
        continue;
      } else {
        throw err;
      }
    }
  }
  throw ultimoError;
}

/**
 * Flujo Principal Text-to-SQL con Gemini Flash
 */
async function preguntarIA(preguntaUsuario) {
  if (!preguntaUsuario || typeof preguntaUsuario !== 'string' || preguntaUsuario.trim() === '') {
    return { success: false, message: 'La pregunta no puede estar vacía.' };
  }

  // 1. Obtener API Key
  const { key } = await getGeminiApiKey();
  if (!key) {
    return {
      success: false,
      necesitaConfig: true,
      message: 'No hay ninguna API Key de Gemini configurada. Por favor, ingresa tu clave en el panel de configuración.'
    };
  }

  try {
    const tInicio = Date.now();
    console.log(`[Gemini SQL] 🚀 Inicio de consulta: "${preguntaUsuario}"`);

    const ai = new GoogleGenAI({ apiKey: key });
    const esquema = await getEsquemaPostgres();
    const ahora = new Date();
    const fechaActual = ahora.toISOString().slice(0, 10);
    const horaActual = ahora.toLocaleTimeString('es-CL');

    // =======================================================================
    // PASO 1: GENERACIÓN DE CONSULTA SQL
    // =======================================================================
    const systemInstructionPaso1 = `
Eres un traductor experto de Lenguaje Natural a SQL para PostgreSQL.
Tu tarea es convertir la pregunta del usuario en una consulta SQL válida para PostgreSQL.

${esquema}

REGLAS ESTRICTAS DE GENERACIÓN SQL:
1. Devuelve ÚNICAMENTE la consulta SQL pura. NUNCA devuelvas bloques de código markdown (\`\`\`sql), explicaciones ni texto adicional.
2. La consulta DEBE ser exclusivamente de solo lectura (iniciar con SELECT o WITH).
3. IMPORTANTE DE SINTAXIS POSTGRESQL: Los nombres de tablas que contienen mayúsculas deben ir SIEMPRE entre comillas dobles. Ejemplo: FROM "Producto", FROM "Venta", FROM "DetalleVenta", FROM "Usuario", FROM "Categoria".
4. Fecha y hora actual del sistema: ${fechaActual} ${horaActual} (Zona horaria de Chile).
   - "Hoy" significa DATE(fecha) = CURRENT_DATE (o DATE('${fechaActual}')).
   - "Este mes" significa DATE_TRUNC('month', fecha) = DATE_TRUNC('month', CURRENT_DATE).
   - "Esta semana" significa DATE_TRUNC('week', fecha) = DATE_TRUNC('week', CURRENT_DATE).
5. No inventes tablas ni columnas que no existan en el esquema provisto.
`;

    const { res: resPaso1, modeloUsado } = await ejecutarLlamadaGemini(
      ai,
      preguntaUsuario,
      { systemInstruction: systemInstructionPaso1, temperature: 0.1 },
      'Paso 1 (Generar SQL)'
    );

    const rawSql = resPaso1.text;

    // =======================================================================
    // VALIDACIÓN DE SEGURIDAD ESTRICTA
    // =======================================================================
    let cleanSql;
    try {
      cleanSql = validarYSanearSQL(rawSql);
    } catch (segError) {
      console.error('[Gemini SQL] Error de seguridad en query:', segError.message);
      return {
        success: false,
        message: `⚠️ Validación de seguridad: ${segError.message}`,
        sql: rawSql
      };
    }

    // =======================================================================
    // EJECUCIÓN EN POSTGRESQL
    // =======================================================================
    const tPaso2 = Date.now();
    console.log(`[Gemini SQL] ⏱️ 2. Ejecutando SQL en PostgreSQL: ${cleanSql}`);
    let filas = [];
    try {
      const dbResult = await pool.query(cleanSql);
      filas = dbResult.rows;
      console.log(`[Gemini SQL] ✓ Paso 2 completado en ${Date.now() - tPaso2}ms. ${filas.length} filas encontradas.`);
    } catch (dbError) {
      console.error('[Gemini SQL] Error de base de datos:', dbError.message);
      return {
        success: false,
        message: `No se pudo consultar la base de datos: ${dbError.message}`,
        sql: cleanSql
      };
    }

    // =======================================================================
    // PASO 2: INTERPRETACIÓN HUMANIZADA
    // =======================================================================
    const systemInstructionPaso2 = `
Eres el Asistente Inteligente de Negocio de Botillería Amanda.
Tu labor es responder la pregunta del usuario utilizando los datos reales devueltos por la base de datos PostgreSQL.

REGLAS DE RESPUESTA:
1. Responde en español chileno / latinoamericano con tono amable, profesional y claro.
2. Formatea SIEMPRE los montos en Pesos Chilenos (ej: $1.500, $45.990, $1.200.000).
3. Si los resultados son productos o ventas, destaca las cifras relevantes usando listas o negritas.
4. Si la consulta devolvió 0 registros, explica amablemente que no hay movimientos o productos para ese criterio.
5. Sé conciso y directo, sin rodeos innecesarios.
`;

    const promptPaso2 = `
Pregunta del usuario: "${preguntaUsuario}"
Consulta SQL ejecutada:
${cleanSql}

Datos obtenidos de la Base de Datos (en formato JSON):
${JSON.stringify(filas.slice(0, 50))}

Total de filas encontradas: ${filas.length}

Por favor elabora la respuesta final para el usuario.
`;

    const { res: resPaso2 } = await ejecutarLlamadaGemini(
      ai,
      promptPaso2,
      { systemInstruction: systemInstructionPaso2, temperature: 0.3 },
      'Paso 2 (Redactar Respuesta)'
    );

    console.log(`[Gemini SQL] ✅ Flujo completado en ${Date.now() - tInicio}ms con modelo ${modeloUsado}.`);

    return {
      success: true,
      respuesta: resPaso2.text,
      sql: cleanSql,
      filasCount: filas.length,
      modelo: modeloUsado
    };

  } catch (error) {
    console.error('[Gemini SQL] Error en flujo de IA:', error);

    // Manejo de errores específicos de clave inválida o cuota
    if (error.message && (error.message.includes('API_KEY_INVALID') || error.message.includes('403') || error.message.includes('key not valid'))) {
      return {
        success: false,
        necesitaConfig: true,
        message: '⚠️ La API Key de Gemini configurada parece ser inválida. Por favor revísala en la configuración.'
      };
    }

    if (error.message && (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('429'))) {
      return {
        success: false,
        message: 'Has alcanzado el límite de cuota de Gemini. Por favor espera un momento y vuelve a intentar.'
      };
    }

    if (error.message && (error.message.includes('503') || error.message.includes('high demand'))) {
      return {
        success: false,
        message: 'Los servidores de Gemini están experimentando una alta demanda momentánea. Por favor intenta de nuevo en unos segundos.'
      };
    }

    return {
      success: false,
      message: `Error al procesar con IA: ${error.message || 'Error de conexión'}`
    };
  }
}

module.exports = {
  getGeminiApiKey,
  saveGeminiApiKey,
  getGeminiStatus,
  preguntarIA
};
