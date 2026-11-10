/** Prepara imagens de assinaturas/carimbos para o limite de 200 KB da API. */
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_STORED_BYTES = 195 * 1024;

function sizeOfDataUrl(data: string): number {
  const encoded = data.split(",", 2)[1] || "";
  return Math.ceil((encoded.length * 3) / 4) - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
}

export async function prepareSignatureImage(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (
    !["image/png", "image/jpeg", "image/webp", ""].includes(file.type) ||
    !["png", "jpg", "jpeg", "webp"].includes(extension) ||
    file.size > MAX_FILE_SIZE ||
    file.size === 0
  ) {
    throw new Error("Seleccione uma imagem PNG, JPG ou WebP até 10 MB.");
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Não foi possível abrir a imagem. Converta-a para PNG ou JPG."));
      img.src = objectUrl;
    });
    const width = bitmap.naturalWidth;
    const height = bitmap.naturalHeight;
    if (!width || !height || width > 12000 || height > 12000)
      throw new Error("Dimensões de imagem inválidas.");

    const scale = Math.min(1, 1100 / width, 500 / height);
    let w = Math.max(1, Math.round(width * scale));
    let h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    for (let attempt = 0; attempt < 9; attempt++) {
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("O navegador não conseguiu preparar a imagem.");
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(bitmap, 0, 0, w, h);
      const transparent = canvas.toDataURL("image/png");
      if (sizeOfDataUrl(transparent) <= MAX_STORED_BYTES) return transparent;

      // JPEG pequeno e fundo branco para assinaturas digitalizadas em fotografias.
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      for (const quality of [0.85, 0.72, 0.6, 0.48]) {
        const compact = canvas.toDataURL("image/jpeg", quality);
        if (sizeOfDataUrl(compact) <= MAX_STORED_BYTES) return compact;
      }
      w = Math.max(1, Math.floor(w * 0.72));
      h = Math.max(1, Math.floor(h * 0.72));
    }
    throw new Error("Não foi possível reduzir a assinatura para o tamanho permitido. Recorte a imagem e tente novamente.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
