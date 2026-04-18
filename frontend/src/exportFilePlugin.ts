import { registerPlugin } from "@capacitor/core";

type ExportFilePlugin = {
  saveBase64File(options: {
    filename: string;
    mimeType: string;
    base64: string;
  }): Promise<{
    uri: string;
    filename: string;
  }>;
};

export const exportFilePlugin = registerPlugin<ExportFilePlugin>("ExportFile");
