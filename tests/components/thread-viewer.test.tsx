/**
 * ThreadViewer: la hora de cada mensaje (campo TIMESTAMP sin zona, en UTC)
 * debe mostrarse convertida a la zona local, igual que si trajera "Z".
 */
import { render, screen } from "@testing-library/react";
import { ThreadViewer } from "@/app/components/thread-viewer";
import { formatoHora } from "@/lib/formato";
import type { MensajeOut } from "@/lib/types";

function msg(created_at: string): MensajeOut {
  return { id: 1, role: "user", content: "hola", created_at } as unknown as MensajeOut;
}

describe("ThreadViewer — hora de mensajes", () => {
  it("convierte un created_at sin zona como UTC", () => {
    render(<ThreadViewer mensajes={[msg("2026-10-09T18:30:00")]} adjuntoUrl={() => ""} />);
    expect(screen.getByText(formatoHora("2026-10-09T18:30:00Z"))).toBeInTheDocument();
  });

  it("deja igual un created_at que ya trae Z", () => {
    render(<ThreadViewer mensajes={[msg("2026-10-09T18:30:00Z")]} adjuntoUrl={() => ""} />);
    expect(screen.getByText(formatoHora("2026-10-09T18:30:00Z"))).toBeInTheDocument();
  });
});
