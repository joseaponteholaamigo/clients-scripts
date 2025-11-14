    const errorLogPath = path.join(process.cwd(), 'errores-insercion.csv');
    // Si el archivo no existe, crea encabezado
    if (!fs.existsSync(errorLogPath)) {
      fs.writeFileSync(errorLogPath, 'Error,Fecha,Telefono,Nombre,Correo,Numero_del_contrato,Direccion,Barrio,Habeas_Data,Ciudad\n');
    }
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Configuración de conexión a SQL Server
const config = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  options: {
    encrypt: process.env.SQL_ENCRYPT === 'true',
    trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE === 'true',
    port: parseInt(process.env.SQL_PORT, 10) || 1433,
    enableArithAbort: true
  }
};

const csvFilePath = path.join(process.cwd(), 'data.csv');

async function main() {
    // Contar filas del CSV antes de procesar
    let totalLineasCSV = 0;
    await new Promise((resolve, reject) => {
      let stream = fs.createReadStream(csvFilePath);
      stream.on('error', reject);
      let leftover = '';
      stream.on('data', chunk => {
        let str = leftover + chunk.toString();
        let lines = str.split(/\r?\n/);
        leftover = lines.pop();
        totalLineasCSV += lines.length;
      });
      stream.on('end', () => {
        if (leftover) totalLineasCSV++;
        // Si hay cabecera, restar 1
        if (totalLineasCSV > 0) totalLineasCSV--;
        console.log(`Total de filas en el CSV (sin cabecera): ${totalLineasCSV}`);
        resolve();
      });
    });
  try {
    await sql.connect(config);
  const batchSize = 100;
  let batch = [];
  let processedCount = 0;

    const records = [];
    
    // Primero, leer todos los datos en memoria
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv({
          headers: [
            'Fecha',
            'Telefono',
            'Nombre',
            'Correo',
            'Numero_del_contrato',
            'Direccion',
            'Barrio',
            'Habeas_Data',
            'Ciudad'
          ],
          separator: ',',
          quote: '"'
        }))
        .on('data', (row) => {
          let fechaOriginal = row.Fecha;
          let fechaSQL = null;
          try {
            let [fecha, hora, ampm] = fechaOriginal.split(/\s+/);
            let [year, day, month] = fecha.split('-');
            let [horaStr, minStr] = hora.split(':');
            let hour = parseInt(horaStr, 10);
            if (ampm && ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
            if (ampm && ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
            if (
              year.length === 4 &&
              month.length === 2 &&
              day.length === 2 &&
              parseInt(month, 10) >= 1 && parseInt(month, 10) <= 12 &&
              parseInt(day, 10) >= 1 && parseInt(day, 10) <= 31
            ) {
              fechaSQL = `${year}-${month}-${day} ${hour.toString().padStart(2, '0')}:${minStr}:00`;
            } else {
              fechaSQL = null;
            }
          } catch (e) {
            fechaSQL = null;
          }
          // Función para escapar comillas simples
          const esc = v => v ? String(v).replace(/'/g, "''") : '';
          // Truncar campos según definición de la tabla
          const maxLen = {
            Telefono: 50,
            Nombre: 100,
            Correo: 100,
            Numero_del_contrato: 50,
            Direccion: 200,
            Barrio: 100,
            Habeas_Data: 10,
            Ciudad: 50
          };
          const truncate = (v, l) => v ? v.substring(0, l) : '';
          
          records.push({
            Fecha: fechaSQL,
            Telefono: truncate(esc(row.Telefono), maxLen.Telefono),
            Nombre: truncate(esc(row.Nombre), maxLen.Nombre),
            Correo: truncate(esc(row.Correo), maxLen.Correo),
            Numero_del_contrato: truncate(esc(row.Numero_del_contrato), maxLen.Numero_del_contrato),
            Direccion: truncate(esc(row.Direccion), maxLen.Direccion),
            Barrio: truncate(esc(row.Barrio), maxLen.Barrio),
            Habeas_Data: truncate(esc(row.Habeas_Data), maxLen.Habeas_Data),
            Ciudad: truncate(esc(row.Ciudad), maxLen.Ciudad)
          });
        })
        .on('end', () => {
          resolve();
        })
        .on('error', reject);
    });

    // Ahora procesar los registros en lotes de forma secuencial
    console.log(`Procesando ${records.length} registros en lotes de ${batchSize}...`);
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await insertBatch(batch);
      processedCount += batch.length;
      console.log(`Procesados ${processedCount}/${records.length} registros`);
    }
    
    console.log('CSV procesado y registros almacenados en SQL Server.');
    sql.close();

    async function insertBatch(batch) {
      if (batch.length === 0) return;
      
      console.log(`Insertando lote de ${batch.length} registros...`);
      
      // Insertar uno por uno para evitar el límite de 1000 valores
      for (const record of batch) {
        try {
          const request = new sql.Request();
          await request.query(`INSERT INTO TALE.ClientesContactoChatBot ([Fecha],[Telefono],[Nombre],[Correo],[Numero_del_contrato],[Direccion],[Barrio],[Habeas_Data],[Ciudad]) 
            VALUES (${record.Fecha ? `'${record.Fecha}'` : 'NULL'},'${record.Telefono}','${record.Nombre}','${record.Correo}','${record.Numero_del_contrato}','${record.Direccion}','${record.Barrio}','${record.Habeas_Data}','${record.Ciudad}')`);
        } catch (err) {
          console.error('Error al insertar registro:', err.message);
          // Registrar el error individual
          const errorRow = `"${err.message.replace(/"/g, '""')}",${record.Fecha || ''},${record.Telefono || ''},${record.Nombre || ''},${record.Correo || ''},${record.Numero_del_contrato || ''},${record.Direccion || ''},${record.Barrio || ''},${record.Habeas_Data || ''},${record.Ciudad || ''}`;
          fs.appendFileSync(errorLogPath, errorRow + '\n');
        }
      }
      
      await new Promise(r => setTimeout(r, 100)); // Pequeña pausa entre lotes
    }
  } catch (err) {
    console.error('Error de conexión o procesamiento:', err.message);
    sql.close();
  }
}

main();
