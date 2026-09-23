const MAX_EDGE = 1400;
const QUALITY = 0.72;
const SKIP_IF_UNDER = 160_000;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read chart image."));
    image.src = src;
  });
}

function pickSmaller(candidates: string[]) {
  return candidates.reduce((best, current) =>
    current.length < best.length ? current : best
  );
}

export function isChartDataUrl(value: string | null | undefined): value is string {
  return Boolean(value && value.startsWith("data:image"));
}

export async function compressChartImage(
  value: string | null | undefined
): Promise<string | null> {
  if (!value) return null;
  if (!isChartDataUrl(value) || value.length <= SKIP_IF_UNDER) return value;
  if (typeof document === "undefined") return value;

  const image = await loadImage(value);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return value;
  context.drawImage(image, 0, 0, width, height);

  const jpeg = canvas.toDataURL("image/jpeg", QUALITY);
  const webp = canvas.toDataURL("image/webp", QUALITY);
  return pickSmaller([value, jpeg, webp.startsWith("data:image/webp") ? webp : jpeg]);
}

export async function compressTradeCharts<
  T extends { beforeChart: string | null; afterChart: string | null },
>(data: T): Promise<T> {
  const [beforeChart, afterChart] = await Promise.all([
    compressChartImage(data.beforeChart),
    compressChartImage(data.afterChart),
  ]);
  if (beforeChart === data.beforeChart && afterChart === data.afterChart) {
    return data;
  }
  return { ...data, beforeChart, afterChart };
}

export function chartPayloadBytes(
  beforeChart: string | null | undefined,
  afterChart: string | null | undefined
) {
  return (beforeChart?.length ?? 0) + (afterChart?.length ?? 0);
}
