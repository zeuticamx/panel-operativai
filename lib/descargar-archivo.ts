/** Dispara la descarga de un archivo generado en el cliente (Excel, PDF, ...). */
export function descargarArchivo(datos: BlobPart, nombre: string, tipo: string): void {
  const blob = new Blob([datos], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** "2026-09-15": para nombrar archivos exportados, siempre en la zona local. */
export function fechaArchivo(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}
