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

const csvFilePath = path.join(process.cwd(), 'Urbaser', 'data.csv');

async function main() {
  try {
    await sql.connect(config);
    const requests = [];

    fs.createReadStream(csvFilePath)
      .pipe(csv({ headers: [
        'Fecha',
        'Telefono',
        'Nombre',
        'Correo',
        'Numero_del_contrato',
        'Direccion',
        'Barrio',
        'Habeas_Data',
        'Ciudad'
      ], separator: ',' }))
      .on('data', (row) => {
        // Validar y transformar Fecha a formato YYYY-MM-DD HH:MM:SS, si no es válida insertar NULL
        let fechaOriginal = row.Fecha;
        let fechaSQL = null;
        try {
          let [fecha, hora, ampm] = fechaOriginal.split(/\s+/);
          let [year, month, day] = fecha.split('-');
          let [horaStr, minStr] = hora.split(':');
          let hour = parseInt(horaStr, 10);
          if (ampm && ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
          if (ampm && ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
          // Validar año, mes, día
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
        const request = new sql.Request();
        requests.push(
          request.query(
            `INSERT INTO dbo.ClientesContactoChatBot ([Fecha],[Telefono],[Nombre],[Correo],[Numero_del_contrato],[Direccion],[Barrio],[Habeas_Data],[Ciudad]) VALUES (${fechaSQL ? `'${fechaSQL}'` : 'NULL'},'${row.Telefono}','${row.Nombre}','${row.Correo}','${row.Numero_del_contrato}','${row.Direccion}','${row.Barrio}','${row.Habeas_Data}','${row.Ciudad}')`
          ).catch(err => {
            console.error('Error al insertar registro:', err.message);
          })
        );
      })
      .on('end', async () => {
        await Promise.all(requests);
        console.log('CSV procesado y registros almacenados en SQL Server.');
        sql.close();
      });
  } catch (err) {
    console.error('Error de conexión o procesamiento:', err.message);
    sql.close();
  }
}

main();
