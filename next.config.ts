import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Hay un package-lock.json suelto en el home del usuario; sin esto Next
  // cree que la raíz del workspace es C:\Users\Usuario.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
