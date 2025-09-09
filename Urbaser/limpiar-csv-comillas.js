// limpiar-csv-comillas.js
// Uso: node limpiar-csv-comillas.js archivo-entrada.csv archivo-salida.csv

import fs from 'fs';

if (process.argv.length < 4) {
  console.log('Uso: node limpiar-csv-comillas.js archivo-entrada.csv archivo-salida.csv');
  process.exit(1);
}

const input = process.argv[2];
const output = process.argv[3];

const data = fs.readFileSync(input, 'utf8');

// Reemplaza saltos de línea dentro de comillas dobles por un espacio
const cleaned = data.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/gs, (match) => {
  return match.replace(/\r?\n/g, ' ');
});

fs.writeFileSync(output, cleaned, 'utf8');
console.log('Archivo limpio guardado en', output);
