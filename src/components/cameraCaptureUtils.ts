import { CAMERA_REQUEST_RESOLUTION } from '../config/camera';
import type { CaptureSettings } from './types';

export function buildVideoConstraints(): MediaTrackConstraints {
  return {
    facingMode: { ideal: 'environment' },
    width: { ideal: CAMERA_REQUEST_RESOLUTION.width },
    height: { ideal: CAMERA_REQUEST_RESOLUTION.height },
    aspectRatio: { ideal: 0.75 },
  };
}

export function formatResolution(width?: number, height?: number) {
  if (!width || !height) {
    return '';
  }

  return `${width} x ${height}`;
}

export function formatAspectRatio(width?: number, height?: number) {
  if (!width || !height) {
    return '';
  }

  return (width / height).toFixed(2);
}

export async function captureFromPreview(
  video: HTMLVideoElement,
  settings: CaptureSettings,
) {
  return renderSourceToBlob(video, settings);
}

export function downloadCapture(url: string, timestamp: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = `camera-shot-${timestamp}.jpg`;
  link.click();
}

function drawContainedSourceToCanvas(
  source: CanvasImageSource,
  context: CanvasRenderingContext2D,
  targetWidth: number,
  targetHeight: number,
) {
  const { width: sourceWidth, height: sourceHeight } =
    readSourceDimensions(source);
  if (!sourceWidth || !sourceHeight) {
    throw new Error('Source dimensions are unavailable');
  }

  context.fillStyle = '#000000';
  context.fillRect(0, 0, targetWidth, targetHeight);

  const scale = Math.min(
    targetWidth / sourceWidth,
    targetHeight / sourceHeight,
  );
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const offsetX = (targetWidth - drawWidth) / 2;
  const offsetY = (targetHeight - drawHeight) / 2;

  context.drawImage(source, offsetX, offsetY, drawWidth, drawHeight);
}

function readSourceDimensions(source: CanvasImageSource) {
  if (source instanceof HTMLVideoElement) {
    return {
      width: source.videoWidth,
      height: source.videoHeight,
    };
  }

  if (source instanceof HTMLImageElement) {
    return {
      width: source.naturalWidth,
      height: source.naturalHeight,
    };
  }

  if (source instanceof ImageBitmap) {
    return {
      width: source.width,
      height: source.height,
    };
  }

  return {
    width: 0,
    height: 0,
  };
}

async function renderSourceToBlob(
  source: CanvasImageSource,
  settings: CaptureSettings,
) {
  const canvas = document.createElement('canvas');
  canvas.width = settings.width;
  canvas.height = settings.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas is unavailable');
  }

  drawContainedSourceToCanvas(source, context, settings.width, settings.height);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.96);
  });
}
