/**
 * Reporte ejecutivo del embudo en PDF.
 *
 * `@react-pdf/renderer` dibuja el documento como JSX y lo rasteriza a vector
 * real (no una captura de pantalla), así que las gráficas de esta página se
 * hacen con `View`s de ancho proporcional en vez de una librería de charts:
 * para barras horizontales simples es más liviano y no pelea con el motor
 * de layout de la librería. Se importa dinámicamente adentro de la función
 * exportada por la misma razón que `exceljs` en `exportar-embudo.ts`: es
 * pesada y solo hace falta cuando alguien pulsa "Exportar a PDF".
 */
import type { ReactNode } from "react";
import type { MetricasPipelineOut, PipelineOut } from "./types";
import { fmtInt, formatoMonto, formatoPorcentaje, infoEstadoPipeline } from "./formato";
import { cssEtapa } from "./colores-etapa";
import { descargarArchivo, fechaArchivo } from "./descargar-archivo";
import { ESTADOS_CERRADOS } from "./formato";

const LOGO = "/imagenes/LOGO_OPERATIVAI.png";
const AZUL = "#3987E5";
const TEXTO = "#0F172A";
const TEXTO_SUAVE = "#64748B";
const BORDE = "#E2E8F0";

/** Solo las etapas que forman parte del recorrido secuencial del embudo. */
const ETAPAS_FUNNEL = [
  "nuevo",
  "contactado",
  "en_seguimiento",
  "cotizado",
  "negociacion",
  "ganado",
] as const;

const MAX_FILAS_TABLA = 20;

function aNumero(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined || valor === "") return 0;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isNaN(n) ? 0 : n;
}

function fechaLarga(d = new Date()): string {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Construye el documento. Recibe los componentes de `@react-pdf/renderer`
 * ya cargados (se los pasa `exportarEmbudoPDF` tras el import dinámico) en
 * vez de importarlos a nivel de módulo.
 */
function construirDocumento(
  RP: typeof import("@react-pdf/renderer"),
  leads: PipelineOut[],
  metricas: MetricasPipelineOut | undefined,
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

    h1: { fontFamily: "Helvetica-Bold", fontSize: 16, marginBottom: 14 },
    h2: { fontFamily: "Helvetica-Bold", fontSize: 12, marginBottom: 8, marginTop: 18 },

    kpisFila: { flexDirection: "row", gap: 12 },
    kpiCard: { flex: 1, borderRadius: 6, borderWidth: 1, borderColor: BORDE, padding: 16, gap: 4 },
    kpiLabel: { fontSize: 9, color: TEXTO_SUAVE, textTransform: "uppercase", letterSpacing: 0.5 },
    kpiValor: { fontFamily: "Courier-Bold", fontSize: 30 },
    kpiHint: { fontSize: 8, color: TEXTO_SUAVE },

    chipFila: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5 },
    chip: { borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6 },
    chipTexto: { fontSize: 8, fontFamily: "Helvetica-Bold" },
    chipEtiqueta: { fontSize: 9, flex: 1 },
    chipValor: { fontFamily: "Courier-Bold", fontSize: 9, width: 70, textAlign: "right" },

    tablaHeaderFila: {
      flexDirection: "row",
      borderBottom: `1px solid ${TEXTO}`,
      paddingBottom: 5,
      marginBottom: 4,
    },
    tablaFila: {
      flexDirection: "row",
      borderBottom: `0.5px solid ${BORDE}`,
      paddingVertical: 5,
      alignItems: "center",
    },
    thCliente: { flex: 3, fontSize: 8, fontFamily: "Helvetica-Bold", color: TEXTO_SUAVE },
    thEtapa: { flex: 2, fontSize: 8, fontFamily: "Helvetica-Bold", color: TEXTO_SUAVE },
    thVendedor: { flex: 2, fontSize: 8, fontFamily: "Helvetica-Bold", color: TEXTO_SUAVE },
    thMonto: { flex: 1.4, fontSize: 8, fontFamily: "Helvetica-Bold", color: TEXTO_SUAVE, textAlign: "right" },
    thFecha: { flex: 1.6, fontSize: 8, fontFamily: "Helvetica-Bold", color: TEXTO_SUAVE, textAlign: "right" },
    tdCliente: { flex: 3, fontSize: 9 },
    tdVendedor: { flex: 2, fontSize: 9, color: TEXTO_SUAVE },
    tdMonto: { flex: 1.4, fontSize: 9, fontFamily: "Courier", textAlign: "right" },
    tdFecha: { flex: 1.6, fontSize: 8, fontFamily: "Courier", color: TEXTO_SUAVE, textAlign: "right" },
    notaTabla: { fontSize: 8, color: TEXTO_SUAVE, marginTop: 10 },

    rankingHeaderFila: {
      flexDirection: "row",
      borderBottom: `1px solid ${TEXTO}`,
      paddingBottom: 5,
      marginBottom: 4,
    },
    rankingFila: { flexDirection: "row", alignItems: "center", paddingVertical: 6, gap: 8 },
    rankVendedor: { flex: 2, fontSize: 9 },
    rankNum: { width: 46, fontSize: 9, fontFamily: "Courier", textAlign: "right" },
    barraPista: { flex: 3, height: 10, backgroundColor: "#F1F5F9", borderRadius: 2, overflow: "hidden" },
    barraRelleno: { height: "100%", backgroundColor: AZUL, borderRadius: 2 },
    barraMonto: { width: 70, fontSize: 8, fontFamily: "Courier-Bold", textAlign: "right" },

    funnelFila: { marginBottom: 10 },
    funnelEtiquetaFila: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
    funnelEtiqueta: { fontSize: 9 },
    funnelValor: { fontSize: 9, fontFamily: "Courier-Bold" },
    funnelPista: { height: 16, backgroundColor: "#F1F5F9", borderRadius: 3 },
    funnelRelleno: { height: "100%", borderRadius: 3, justifyContent: "center", paddingLeft: 6 },
    funnelPorcentaje: { fontSize: 7, fontFamily: "Helvetica-Bold" },

    perdidoCallout: {
      marginTop: 16,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "#FCA5A5",
      backgroundColor: "#FEF2F2",
      padding: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
  });

  const HEADER_TITLE = "OperativAI · Reporte del Embudo";

  function Encabezado() {
    return (
      <View style={s.headerFixed} fixed>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf: dibuja en el PDF, no hay `alt` en su API */}
          <Image src={LOGO} style={s.headerLogo} />
          <Text style={s.headerTexto}>{HEADER_TITLE}</Text>
        </View>
        <Text style={s.headerTexto}>{fechaLarga()}</Text>
      </View>
    );
  }

  function Pie() {
    return (
      <View style={s.footerFixed} fixed>
        <Text style={s.footerTexto}>Generado por OperativAI</Text>
        <Text
          style={s.footerTexto}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
        />
      </View>
    );
  }

  function ChipEtapa({ estado }: { estado: string }) {
    const { fondo, texto } = cssEtapa(estado);
    return (
      <View style={[s.chip, { backgroundColor: fondo }]}>
        <Text style={[s.chipTexto, { color: texto }]}>{infoEstadoPipeline(estado).label}</Text>
      </View>
    );
  }

  // ------------------------------------------------------------
  // Datos derivados (los mismos que ya calcula el botón "Exportar a Excel")
  // ------------------------------------------------------------
  const totalClientes = metricas?.total_clientes ?? leads.length;
  const montoEnJuego = leads
    .filter((l) => !ESTADOS_CERRADOS.has(l.estado))
    .reduce((acc, l) => acc + aNumero(l.monto_estimado), 0);
  const tasaCierre = metricas?.tasa_conversion_global ?? null;

  const filasTabla = [...leads]
    .sort((a, b) => new Date(b.actualizado_en).getTime() - new Date(a.actualizado_en).getTime())
    .slice(0, MAX_FILAS_TABLA);

  const ranking = metricas?.ranking ?? [];
  const maxMontoRanking = Math.max(1, ...ranking.map((r) => aNumero(r.monto_ganado)));

  const etapasPorId = Object.fromEntries((metricas?.etapas ?? []).map((e) => [e.estado, e]));
  const maxTotalFunnel = Math.max(1, ...ETAPAS_FUNNEL.map((e) => etapasPorId[e]?.total ?? 0));
  const perdidos = etapasPorId["perdido"];

  return (
    <Document title={`Reporte del embudo — ${fechaLarga()}`} author="OperativAI">
      {/* Portada */}
      <Page size="A4" style={[s.page, { paddingTop: 0, paddingBottom: 0 }]}>
        <View style={s.portada}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf: dibuja en el PDF, no hay `alt` en su API */}
          <Image src={LOGO} style={s.logoPortada} />
          <Text style={s.tituloPortada}>Reporte del Embudo</Text>
          <Text style={s.subPortada}>Vendedores · CRM de OperativAI</Text>
          <Text style={s.fechaPortada}>{fechaLarga()}</Text>
        </View>
      </Page>

      {/* Resumen ejecutivo */}
      <Page size="A4" style={s.page}>
        <Encabezado />
        <Text style={s.h1}>Resumen ejecutivo</Text>

        <View style={s.kpisFila}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Total de clientes</Text>
            <Text style={s.kpiValor}>{fmtInt.format(totalClientes)}</Text>
            <Text style={s.kpiHint}>en el embudo</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Montos en juego</Text>
            <Text style={s.kpiValor}>{formatoMonto(montoEnJuego)}</Text>
            <Text style={s.kpiHint}>leads todavía abiertos</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Tasa de cierre</Text>
            <Text style={s.kpiValor}>{formatoPorcentaje(tasaCierre)}</Text>
            <Text style={s.kpiHint}>ganados sobre cerrados</Text>
          </View>
        </View>

        {metricas && (
          <>
            <Text style={s.h2}>Distribución por etapa</Text>
            <View>
              {metricas.etapas.map((e) => (
                <View key={e.estado} style={s.chipFila}>
                  <ChipEtapa estado={e.estado} />
                  <Text style={s.chipEtiqueta}>{infoEstadoPipeline(e.estado).label}</Text>
                  <Text style={s.chipValor}>
                    {fmtInt.format(e.total)} · {formatoPorcentaje(e.porcentaje)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Pie />
      </Page>

      {/* Tabla de clientes */}
      <Page size="A4" style={s.page}>
        <Encabezado />
        <Text style={s.h1}>Clientes en el embudo</Text>

        <View style={s.tablaHeaderFila}>
          <Text style={s.thCliente}>Cliente</Text>
          <Text style={s.thEtapa}>Etapa</Text>
          <Text style={s.thVendedor}>Vendedor</Text>
          <Text style={s.thMonto}>Monto</Text>
          <Text style={s.thFecha}>Última actividad</Text>
        </View>

        {filasTabla.map((l) => (
          <View key={l.id} style={s.tablaFila} wrap={false}>
            <Text style={s.tdCliente}>{l.cliente_nombre ?? l.cliente_handle ?? "Sin nombre"}</Text>
            <View style={s.thEtapa}>
              <ChipEtapa estado={l.estado} />
            </View>
            <Text style={s.tdVendedor}>{l.vendedor_nombre ?? "Sin asignar"}</Text>
            <Text style={s.tdMonto}>{formatoMonto(l.monto_estimado)}</Text>
            <Text style={s.tdFecha}>{fechaCorta(l.actualizado_en)}</Text>
          </View>
        ))}

        {leads.length > MAX_FILAS_TABLA && (
          <Text style={s.notaTabla}>
            Mostrando los {MAX_FILAS_TABLA} más recientes de {fmtInt.format(leads.length)} en total. La lista
            completa está en la exportación a Excel.
          </Text>
        )}
        {leads.length === 0 && <Text style={s.notaTabla}>Todavía no hay clientes en el embudo.</Text>}

        <Pie />
      </Page>

      {/* Ranking de vendedores */}
      {metricas && (
        <Page size="A4" style={s.page}>
          <Encabezado />
          <Text style={s.h1}>Ranking de vendedores</Text>

          <View style={s.rankingHeaderFila}>
            <Text style={[s.rankVendedor, { fontSize: 8, fontFamily: "Helvetica-Bold", color: TEXTO_SUAVE }]}>
              Vendedor
            </Text>
            <Text style={[s.rankNum, { fontFamily: "Helvetica-Bold", color: TEXTO_SUAVE }]}>Ganados</Text>
            <Text style={[s.rankNum, { fontFamily: "Helvetica-Bold", color: TEXTO_SUAVE }]}>Perdidos</Text>
            <Text style={[s.rankNum, { fontFamily: "Helvetica-Bold", color: TEXTO_SUAVE }]}>Tasa</Text>
          </View>
          {ranking.map((r) => (
            <View key={r.vendedor_id} style={s.rankingFila} wrap={false}>
              <Text style={[s.rankVendedor, !r.activo ? { color: TEXTO_SUAVE } : undefined]}>
                {r.nombre}
                {!r.activo ? " (inactivo)" : ""}
              </Text>
              <Text style={s.rankNum}>{fmtInt.format(r.ganados)}</Text>
              <Text style={s.rankNum}>{fmtInt.format(r.perdidos)}</Text>
              <Text style={s.rankNum}>{formatoPorcentaje(r.tasa_cierre)}</Text>
            </View>
          ))}

          <Text style={s.h2}>Monto ganado por vendedor</Text>
          {ranking.length === 0 ? (
            <Text style={s.notaTabla}>Todavía no hay vendedores.</Text>
          ) : (
            ranking.map((r) => {
              const monto = aNumero(r.monto_ganado);
              const pct = Math.max(2, (monto / maxMontoRanking) * 100);
              return (
                <View key={r.vendedor_id} style={s.rankingFila} wrap={false}>
                  <Text style={s.rankVendedor}>{r.nombre}</Text>
                  <View style={s.barraPista}>
                    <View style={[s.barraRelleno, { width: `${pct}%` }]} />
                  </View>
                  <Text style={s.barraMonto}>{formatoMonto(monto)}</Text>
                </View>
              );
            })
          )}

          <Pie />
        </Page>
      )}

      {/* Gráfico del embudo */}
      {metricas && (
        <Page size="A4" style={s.page}>
          <Encabezado />
          <Text style={s.h1}>Embudo por etapa</Text>
          <Text style={{ fontSize: 9, color: TEXTO_SUAVE, marginBottom: 16 }}>
            Ancho proporcional a la cantidad de leads en cada etapa secuencial. “Perdido” no forma parte del
            recorrido — es una salida, no una etapa más adentro del embudo — así que se muestra aparte.
          </Text>

          {ETAPAS_FUNNEL.map((estado) => {
            const etapa = etapasPorId[estado];
            const total = etapa?.total ?? 0;
            const pct = Math.max(4, (total / maxTotalFunnel) * 100);
            const { fondo, texto } = cssEtapa(estado);
            return (
              <View key={estado} style={s.funnelFila} wrap={false}>
                <View style={s.funnelEtiquetaFila}>
                  <Text style={s.funnelEtiqueta}>{infoEstadoPipeline(estado).label}</Text>
                  <Text style={s.funnelValor}>
                    {fmtInt.format(total)} · {formatoPorcentaje(etapa?.porcentaje ?? 0)}
                  </Text>
                </View>
                <View style={s.funnelPista}>
                  <View style={[s.funnelRelleno, { width: `${pct}%`, backgroundColor: fondo }]}>
                    {pct > 12 && <Text style={[s.funnelPorcentaje, { color: texto }]}>{fmtInt.format(total)}</Text>}
                  </View>
                </View>
              </View>
            );
          })}

          {perdidos && perdidos.total > 0 && (
            <View style={s.perdidoCallout}>
              <Text style={{ fontSize: 10, color: "#991B1B" }}>Perdidos (fuera del embudo)</Text>
              <Text style={{ fontSize: 14, fontFamily: "Courier-Bold", color: "#991B1B" }}>
                {fmtInt.format(perdidos.total)} · {formatoPorcentaje(perdidos.porcentaje)}
              </Text>
            </View>
          )}

          <Pie />
        </Page>
      )}
    </Document>
  );
}

/**
 * Arma el reporte del embudo en PDF y dispara la descarga en el navegador.
 * `metricas` es opcional: sin ella el reporte solo trae portada y la tabla
 * de clientes (los KPIs, el ranking y el embudo por etapa se calculan a
 * partir de `metricas`, así que esas páginas se omiten).
 */
export async function exportarEmbudoPDF(
  leads: PipelineOut[],
  metricas?: MetricasPipelineOut,
): Promise<void> {
  const RP = await import("@react-pdf/renderer");
  const documento = construirDocumento(RP, leads, metricas) as ReactNode;
  const blob = await RP.pdf(documento as Parameters<typeof RP.pdf>[0]).toBlob();
  descargarArchivo(blob, `embudo_${fechaArchivo()}.pdf`, "application/pdf");
}
