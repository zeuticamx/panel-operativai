/**
 * Reporte del dashboard de Reportes en PDF. Mismo enfoque que
 * `exportar-embudo-pdf.tsx`: las barras se dibujan con `View`s de ancho
 * proporcional en vez de una librería de charts, y `@react-pdf/renderer`
 * se importa dinámicamente porque solo hace falta al exportar.
 */
import type { ReactNode } from "react";
import type { ConversionPipelineOut, MetricasPipelineOut, TendenciaPipelineOut } from "./types";
import { fmtInt, formatoMes, formatoMonto, formatoPorcentaje, infoEstadoPipeline } from "./formato";
import { cssEtapa } from "./colores-etapa";
import { descargarArchivo, fechaArchivo } from "./descargar-archivo";

const LOGO = "/imagenes/LOGO_OPERATIVAI.png";
const AZUL = "#3987E5";
const NARANJA = "#D95926";
const TEXTO = "#0F172A";
const TEXTO_SUAVE = "#64748B";
const BORDE = "#E2E8F0";

function aNumero(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined || valor === "") return 0;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isNaN(n) ? 0 : n;
}

function fechaLarga(d = new Date()): string {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

function construirDocumento(
  RP: typeof import("@react-pdf/renderer"),
  metricas: MetricasPipelineOut,
  tendencia: TendenciaPipelineOut,
  conversion: ConversionPipelineOut,
  rango: { desde: string; hasta: string } | null,
) {
  const { Document, Page, View, Text, Image, StyleSheet } = RP;

  const s = StyleSheet.create({
    page: { paddingTop: 70, paddingBottom: 50, paddingHorizontal: 40, fontFamily: "Helvetica", color: TEXTO },
    portada: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
    logoPortada: { width: 160 },
    tituloPortada: { fontFamily: "Helvetica-Bold", fontSize: 26, marginTop: 8 },
    subPortada: { fontSize: 12, color: TEXTO_SUAVE },
    fechaPortada: { fontSize: 11, color: TEXTO_SUAVE, marginTop: 24 },

    headerFixed: {
      position: "absolute",
      top: 20,
      left: 40,
      right: 40,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: `1px solid ${BORDE}`,
      paddingBottom: 8,
    },
    headerLogo: { width: 20 },
    headerTexto: { fontSize: 9, color: TEXTO_SUAVE },
    footerFixed: {
      position: "absolute",
      bottom: 20,
      left: 40,
      right: 40,
      flexDirection: "row",
      justifyContent: "space-between",
      borderTop: `1px solid ${BORDE}`,
      paddingTop: 8,
    },
    footerTexto: { fontSize: 8, color: TEXTO_SUAVE },

    h1: { fontFamily: "Helvetica-Bold", fontSize: 16, marginBottom: 4 },
    h1Sub: { fontSize: 9, color: TEXTO_SUAVE, marginBottom: 14 },
    h2: { fontFamily: "Helvetica-Bold", fontSize: 12, marginBottom: 8, marginTop: 18 },

    chipFila: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5 },
    chip: { borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6 },
    chipTexto: { fontSize: 8, fontFamily: "Helvetica-Bold" },
    chipEtiqueta: { fontSize: 9, flex: 1 },
    chipValor: { fontFamily: "Courier-Bold", fontSize: 9, width: 90, textAlign: "right" },

    barraFila: { marginBottom: 9 },
    barraEtiquetaFila: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
    barraEtiqueta: { fontSize: 9 },
    barraValor: { fontFamily: "Courier-Bold", fontSize: 9 },
    barraPista: { height: 14, backgroundColor: "#F1F5F9", borderRadius: 3 },
    barraRelleno: { height: "100%", borderRadius: 3 },
    caidaTexto: { fontSize: 8, color: TEXTO_SUAVE, marginTop: 2 },

    tablaHeaderFila: { flexDirection: "row", borderBottom: `1px solid ${TEXTO}`, paddingBottom: 5, marginBottom: 4 },
    tablaFila: { flexDirection: "row", borderBottom: `0.5px solid ${BORDE}`, paddingVertical: 5 },
    th: { fontSize: 8, fontFamily: "Helvetica-Bold", color: TEXTO_SUAVE },
    td: { fontSize: 9 },
    colMes: { flex: 2 },
    colNum: { flex: 1.2, textAlign: "right", fontFamily: "Courier" },

    leyendaFila: { flexDirection: "row", gap: 16, marginBottom: 10 },
    leyendaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    leyendaDot: { width: 7, height: 7, borderRadius: 3.5 },
    leyendaTexto: { fontSize: 8, color: TEXTO_SUAVE },
  });

  function Encabezado() {
    return (
      <View style={s.headerFixed} fixed>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf: dibuja en el PDF, no hay `alt` en su API */}
          <Image src={LOGO} style={s.headerLogo} />
          <Text style={s.headerTexto}>OperativAI · Reportes del embudo</Text>
        </View>
        <Text style={s.headerTexto}>{fechaLarga()}</Text>
      </View>
    );
  }

  function Pie() {
    return (
      <View style={s.footerFixed} fixed>
        <Text style={s.footerTexto}>Generado por OperativAI</Text>
        <Text style={s.footerTexto} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      </View>
    );
  }

  // "T00:00:00" y no la fecha pelada: un string "YYYY-MM-DD" sin hora se
  // interpreta como medianoche UTC, y toLocaleDateString lo vuelve a mostrar
  // en la zona local — con UTC-6 (México) eso corre el día uno para atrás.
  const subtitulo = rango
    ? `Del ${new Date(`${rango.desde}T00:00:00`).toLocaleDateString("es-MX")} al ${new Date(`${rango.hasta}T00:00:00`).toLocaleDateString("es-MX")} · por fecha de alta en el embudo`
    : "Todo el histórico";

  const maxComparativa = Math.max(1, ...metricas.ranking.map((r) => r.ganados));
  const maxEmbudo = Math.max(1, ...metricas.etapas.map((e) => e.total));

  return (
    <Document title={`Reportes — ${fechaLarga()}`} author="OperativAI">
      {/* Portada */}
      <Page size="A4" style={[s.page, { paddingTop: 0, paddingBottom: 0 }]}>
        <View style={s.portada}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf: dibuja en el PDF, no hay `alt` en su API */}
          <Image src={LOGO} style={s.logoPortada} />
          <Text style={s.tituloPortada}>Reportes del Embudo</Text>
          <Text style={s.subPortada}>{subtitulo}</Text>
          <Text style={s.fechaPortada}>{fechaLarga()}</Text>
        </View>
      </Page>

      {/* Embudo por etapa */}
      <Page size="A4" style={s.page}>
        <Encabezado />
        <Text style={s.h1}>Embudo por etapa</Text>
        <Text style={s.h1Sub}>Cuántos leads hay en cada etapa ahora mismo, dentro del rango filtrado.</Text>

        {metricas.etapas.map((e) => {
          const pct = Math.max(3, (e.total / maxEmbudo) * 100);
          const { fondo } = cssEtapa(e.estado);
          return (
            <View key={e.estado} style={s.barraFila} wrap={false}>
              <View style={s.barraEtiquetaFila}>
                <Text style={s.barraEtiqueta}>{infoEstadoPipeline(e.estado).label}</Text>
                <Text style={s.barraValor}>
                  {fmtInt.format(e.total)} · {formatoPorcentaje(e.porcentaje)}
                </Text>
              </View>
              <View style={s.barraPista}>
                <View style={[s.barraRelleno, { width: `${pct}%`, backgroundColor: fondo }]} />
              </View>
            </View>
          );
        })}

        <Text style={s.h2}>Comparativa de vendedores</Text>
        {metricas.ranking.length === 0 ? (
          <Text style={s.caidaTexto}>Todavía no hay vendedores.</Text>
        ) : (
          [...metricas.ranking]
            .sort((a, b) => b.ganados - a.ganados)
            .map((r) => {
              const pct = Math.max(3, (r.ganados / maxComparativa) * 100);
              return (
                <View key={r.vendedor_id} style={s.barraFila} wrap={false}>
                  <View style={s.barraEtiquetaFila}>
                    <Text style={s.barraEtiqueta}>
                      {r.nombre}
                      {!r.activo ? " (inactivo)" : ""}
                    </Text>
                    <Text style={s.barraValor}>{fmtInt.format(r.ganados)} ganados</Text>
                  </View>
                  <View style={s.barraPista}>
                    <View style={[s.barraRelleno, { width: `${pct}%`, backgroundColor: AZUL }]} />
                  </View>
                </View>
              );
            })
        )}

        <Pie />
      </Page>

      {/* Conversión (waterfall) */}
      <Page size="A4" style={s.page}>
        <Encabezado />
        <Text style={s.h1}>Conversión entre etapas</Text>
        <Text style={s.h1Sub}>
          De los {fmtInt.format(conversion.total_leads)} leads del rango, cuántos llegaron a pisar cada etapa
          alguna vez.
        </Text>

        {conversion.etapas.map((e, i) => {
          const anterior = i > 0 ? conversion.etapas[i - 1] : null;
          const caida = anterior ? anterior.porcentaje - e.porcentaje : 0;
          const { fondo } = cssEtapa(e.estado);
          return (
            <View key={e.estado} style={s.barraFila} wrap={false}>
              <View style={s.barraEtiquetaFila}>
                <Text style={s.barraEtiqueta}>{infoEstadoPipeline(e.estado).label}</Text>
                <Text style={s.barraValor}>
                  {fmtInt.format(e.alcanzados)} · {formatoPorcentaje(e.porcentaje)}
                </Text>
              </View>
              <View style={s.barraPista}>
                <View style={[s.barraRelleno, { width: `${Math.max(3, e.porcentaje)}%`, backgroundColor: fondo }]} />
              </View>
              {anterior && caida > 0 && (
                <Text style={s.caidaTexto}>
                  −{Math.round(caida)}% no llegó aquí desde {infoEstadoPipeline(anterior.estado).label.toLowerCase()}
                </Text>
              )}
            </View>
          );
        })}

        <Pie />
      </Page>

      {/* Tendencia mensual */}
      <Page size="A4" style={s.page}>
        <Encabezado />
        <Text style={s.h1}>Tendencia mensual</Text>
        <Text style={s.h1Sub}>Últimos {tendencia.meses.length} meses. No depende del filtro de fecha de arriba.</Text>

        <View style={s.leyendaFila}>
          <View style={s.leyendaItem}>
            <View style={[s.leyendaDot, { backgroundColor: AZUL }]} />
            <Text style={s.leyendaTexto}>Nuevos</Text>
          </View>
          <View style={s.leyendaItem}>
            <View style={[s.leyendaDot, { backgroundColor: NARANJA }]} />
            <Text style={s.leyendaTexto}>Ganados</Text>
          </View>
        </View>

        <View style={s.tablaHeaderFila}>
          <Text style={[s.th, s.colMes]}>Mes</Text>
          <Text style={[s.th, s.colNum]}>Nuevos</Text>
          <Text style={[s.th, s.colNum]}>Ganados</Text>
          <Text style={[s.th, s.colNum]}>Perdidos</Text>
          <Text style={[s.th, s.colNum]}>Monto ganado</Text>
        </View>
        {tendencia.meses.map((m) => (
          <View key={m.periodo} style={s.tablaFila} wrap={false}>
            <Text style={[s.td, s.colMes]}>{formatoMes(m.periodo)}</Text>
            <Text style={[s.td, s.colNum]}>{fmtInt.format(m.nuevos)}</Text>
            <Text style={[s.td, s.colNum]}>{fmtInt.format(m.ganados)}</Text>
            <Text style={[s.td, s.colNum]}>{fmtInt.format(m.perdidos)}</Text>
            <Text style={[s.td, s.colNum]}>{formatoMonto(aNumero(m.monto_ganado))}</Text>
          </View>
        ))}

        <Pie />
      </Page>
    </Document>
  );
}

/** Arma el PDF del dashboard de reportes y dispara la descarga en el navegador. */
export async function exportarReportesPDF(
  metricas: MetricasPipelineOut,
  tendencia: TendenciaPipelineOut,
  conversion: ConversionPipelineOut,
  rango: { desde: string; hasta: string } | null,
): Promise<void> {
  const RP = await import("@react-pdf/renderer");
  const documento = construirDocumento(RP, metricas, tendencia, conversion, rango) as ReactNode;
  const blob = await RP.pdf(documento as Parameters<typeof RP.pdf>[0]).toBlob();
  descargarArchivo(blob, `reportes_${fechaArchivo()}.pdf`, "application/pdf");
}
