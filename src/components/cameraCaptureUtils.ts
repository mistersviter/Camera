import { CAMERA_REQUEST_RESOLUTION } from '../config/camera';
import type { CaptureSettings } from './types';

export type CaptureBlobResult = {
  blob: Blob;
  width: number;
  height: number;
};

export function buildVideoConstraints(): MediaTrackConstraints {
  return {
    facingMode: { ideal: 'environment' },
    width: { ideal: CAMERA_REQUEST_RESOLUTION.width },
    height: { ideal: CAMERA_REQUEST_RESOLUTION.height },
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
): Promise<CaptureBlobResult> {
  return renderSourceToBlob(video, settings);
}

export function downloadCapture(url: string, timestamp: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = `camera-shot-${timestamp}.jpg`;
  link.click();
}

function drawSourceToCanvas(
  source: CanvasImageSource,
  context: CanvasRenderingContext2D,
  targetWidth: number,
  targetHeight: number,
) {
  context.drawImage(source, 0, 0, targetWidth, targetHeight);
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

function getOutputDimensions(
  sourceWidth: number,
  sourceHeight: number,
  settings: CaptureSettings,
) {
  if (!sourceWidth || !sourceHeight) {
    throw new Error('Source dimensions are unavailable');
  }

  const scale = Math.min(settings.width / sourceWidth, settings.height / sourceHeight);

  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

async function renderSourceToBlob(
  source: CanvasImageSource,
  settings: CaptureSettings,
): Promise<CaptureBlobResult> {
  const { width: sourceWidth, height: sourceHeight } = readSourceDimensions(source);
  const output = getOutputDimensions(sourceWidth, sourceHeight, settings);

  const canvas = document.createElement('canvas');
  canvas.width = output.width;
  canvas.height = output.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas is unavailable');
  }

  drawSourceToCanvas(source, context, output.width, output.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.96);
  });

  if (!blob) {
    throw new Error('Failed to create image blob');
  }

  return {
    blob,
    width: output.width,
    height: output.height,
  };
}
