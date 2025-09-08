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
  try {
    await sql.connect(config);
    const batchSize = 100;
    let batch = [];
    let totalRows = 0;
    let totalInserted = 0;
    let totalErrores = 0;

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
        ], separator: ','
      }))
      .on('data', async (row) => {
        totalRows++;
        let fechaOriginal = row.Fecha;
        let fechaSQL = null;
        try {
          let [fecha, hora, ampm] = fechaOriginal.split(/\s+/);
          let [year, month, day] = fecha.split('-');
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
        // Truncar campos según definición de la tabla (ajusta los valores si tu tabla tiene otros límites)
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
        batch.push({
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
        if (batch.length === batchSize) {
          const inserted = await insertBatch(batch);
          totalInserted += inserted.success;
          totalErrores += inserted.error;
          batch = [];
        }
      })
      .on('end', async () => {
        if (batch.length > 0) {
          const inserted = await insertBatch(batch);
          totalInserted += inserted.success;
          totalErrores += inserted.error;
        }
        console.log('CSV procesado y registros almacenados en SQL Server.');
        console.log(`Total filas leídas: ${totalRows}`);
        console.log(`Total filas insertadas: ${totalInserted}`);
        console.log(`Total filas con error: ${totalErrores}`);
        sql.close();
      });

    async function insertBatch(batch) {
      if (batch.length === 0) return { success: 0, error: 0 };
      let success = 0;
      let error = 0;
      const values = batch.map(r => `(${r.Fecha ? `'${r.Fecha}'` : 'NULL'},'${r.Telefono}','${r.Nombre}','${r.Correo}','${r.Numero_del_contrato}','${r.Direccion}','${r.Barrio}','${r.Habeas_Data}','${r.Ciudad}')`).join(',');
      const query = `INSERT INTO TALE.ClientesContactoChatBot ([Fecha],[Telefono],[Nombre],[Correo],[Numero_del_contrato],[Direccion],[Barrio],[Habeas_Data],[Ciudad]) VALUES ${values}`;
      try {
        await new sql.Request().query(query);
        await new Promise(r => setTimeout(r, 500));
        success += batch.length;
      } catch (err) {
        console.error('Error al insertar lote:', err.message);
        // Registrar los datos del batch y el error en el archivo CSV
        const errorRows = batch.map(r => {
          return `"${err.message.replace(/"/g, '""')}",${r.Fecha || ''},${r.Telefono || ''},${r.Nombre || ''},${r.Correo || ''},${r.Numero_del_contrato || ''},${r.Direccion || ''},${r.Barrio || ''},${r.Habeas_Data || ''},${r.Ciudad || ''}`;
        }).join('\n');
        fs.appendFileSync(errorLogPath, errorRows + '\n');
        error += batch.length;
      }
      return { success, error };
    }
  } catch (err) {
    console.error('Error de conexión o procesamiento:', err.message);
    sql.close();
  }
}

main();
