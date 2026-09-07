"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard bloqueado (http sin https, permisos): no hacemos nada
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1 rounded p-1 text-text-600 hover:bg-bg-800 hover:text-text-100"
      aria-label={copied ? "Copiado" : label}
      title={copied ? "Copiado" : label}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}
