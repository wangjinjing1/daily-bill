import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.dailybill.app",
  appName: "Bill",
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    cleartext: true
  }
};

export default config;
