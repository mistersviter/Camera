import { useEffect, useRef, useState } from 'react';
import { captureFromPreview, downloadCapture } from './cameraCaptureUtils';
import type { CameraStatus, CaptureResult, CaptureSettings } from './types';
import { useCameraSession } from './useCameraSession';
import { CAMERA_REQUEST_RESOLUTION } from '../config/camera';
import './CameraCapture.css';

type CameraCaptureProps = {
  settings: CaptureSettings;
  onBack: () => void;
  onClose: () => void;
  onCapture: (result: CaptureResult) => void;
};

export function CameraCapture({
  settings,
  onBack,
  onClose,
  onCapture,
}: CameraCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const {
    error,
    sourceResolution,
    sourceSize,
    startCamera,
    status,
    stopCamera,
    torchEnabled,
    torchSupported,
    toggleTorch,
    videoRef,
  } = useCameraSession();

  useEffect(() => {
    const video = videoRef.current;
    const viewport = viewportRef.current;

    if (!video || !viewport) {
      return;
    }

    const updateDebugInfo = () => {
      const videoRect = video.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      const vv = globalThis.visualViewport;

      setDebugInfo({
        requestedWidth: CAMERA_REQUEST_RESOLUTION.width,
        requestedHeight: CAMERA_REQUEST_RESOLUTION.height,
        streamWidth: video.videoWidth,
        streamHeight: video.videoHeight,
        sourceWidth: sourceSize.width,
        sourceHeight: sourceSize.height,
        renderedWidth: Math.round(videoRect.width),
        renderedHeight: Math.round(videoRect.height),
        viewportWidth: Math.round(viewportRect.width),
        viewportHeight: Math.round(viewportRect.height),
        visualWidth: vv ? Math.round(vv.width) : 0,
        visualHeight: vv ? Math.round(vv.height) : 0,
      });
    };

    const resizeObserver = new ResizeObserver(updateDebugInfo);
    resizeObserver.observe(video);
    resizeObserver.observe(viewport);

    video.addEventListener('loadedmetadata', updateDebugInfo);
    globalThis.addEventListener('resize', updateDebugInfo);
    globalThis.visualViewport?.addEventListener('resize', updateDebugInfo);
    updateDebugInfo();

    return () => {
      resizeObserver.disconnect();
      video.removeEventListener('loadedmetadata', updateDebugInfo);
      globalThis.removeEventListener('resize', updateDebugInfo);
      globalThis.visualViewport?.removeEventListener('resize', updateDebugInfo);
    };
  }, [sourceSize.height, sourceSize.width, status, videoRef]);

  async function handleCapture() {
    const video = videoRef.current;

    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    setIsCapturing(true);

    try {
      const photoBlob = await captureFromPreview(video, settings);

      if (!photoBlob) {
        throw new Error('Failed to create image');
      }

      const timestamp = new Date().toISOString().replaceAll(':', '-');
      const url = URL.createObjectURL(photoBlob);

      onCapture({
        url,
        width: settings.width,
        height: settings.height,
        timestamp,
      });

      downloadCapture(url, timestamp);
      stopCamera();
      onBack();
    } finally {
      setIsCapturing(false);
    }
  }

  return (
    <section className="camera-screen">
      <CameraTopbar
        onClose={onClose}
        onToggleTorch={() => void toggleTorch()}
        sourceResolution={sourceResolution}
        status={status}
        torchEnabled={torchEnabled}
        torchSupported={torchSupported}
      />

      <CameraViewport
        cameraError={error}
        cameraStatus={status}
        debugInfo={status === 'ready' ? debugInfo : null}
        error={error}
        onBack={onBack}
        onRetry={() => void startCamera()}
        sourceSize={sourceSize}
        status={status}
        torchEnabled={torchEnabled}
        torchSupported={torchSupported}
        videoRef={videoRef}
        viewportRef={viewportRef}
      />

      <CameraBottomBar
        isCapturing={isCapturing}
        isReady={status === 'ready'}
        onCapture={() => void handleCapture()}
      />
    </section>
  );
}

function CameraTopbar({
  onClose,
  onToggleTorch,
  sourceResolution,
  status,
  torchEnabled,
  torchSupported,
}: {
  onClose: () => void;
  onToggleTorch: () => void;
  sourceResolution: string;
  status: CameraStatus;
  torchEnabled: boolean;
  torchSupported: boolean;
}) {
  return (
    <div className="camera-screen__topbar">
      <div className="camera-screen__topbar-group">
        <button className="ghost-action" type="button" onClick={onClose}>
          X
        </button>

        {torchSupported && status === 'ready' && (
          <button
            className={`camera-toggle ${torchEnabled ? 'camera-toggle--active' : ''}`}
            type="button"
            onClick={onToggleTorch}
            aria-label={torchEnabled ? 'Выключить вспышку' : 'Включить вспышку'}
          >
            {torchEnabled ? 'Вспышка: вкл' : 'Вспышка'}
          </button>
        )}
      </div>

      <div className="camera-screen__quality-chip">
        {sourceResolution || 'Ожидание камеры'}
      </div>
    </div>
  );
}

function CameraViewport({
  cameraError,
  cameraStatus,
  debugInfo,
  error,
  onBack,
  onRetry,
  sourceSize,
  status,
  torchEnabled,
  torchSupported,
  videoRef,
  viewportRef,
}: {
  cameraError: string;
  cameraStatus: CameraStatus;
  debugInfo: DebugInfo | null;
  error: string;
  onBack: () => void;
  onRetry: () => void;
  sourceSize: { width: number; height: number };
  status: CameraStatus;
  torchEnabled: boolean;
  torchSupported: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  viewportRef: React.RefObject<HTMLDivElement | null>;
}) {
  const videoStyle =
    sourceSize.width && sourceSize.height
      ? {
          aspectRatio: `${sourceSize.width} / ${sourceSize.height}`,
        }
      : undefined;

  return (
    <div className="camera-screen__viewport" ref={viewportRef}>
      <video
        ref={videoRef}
        className="camera-screen__video"
        style={videoStyle}
        autoPlay
        muted
        playsInline
      />

      {debugInfo && (
        <CameraDebugOverlay
          cameraError={cameraError}
          cameraStatus={cameraStatus}
          debugInfo={debugInfo}
          torchEnabled={torchEnabled}
          torchSupported={torchSupported}
        />
      )}

      {status !== 'ready' && (
        <CameraFallback
          status={status}
          error={error}
          onBack={onBack}
          onRetry={onRetry}
        />
      )}
    </div>
  );
}

type DebugInfo = {
  requestedWidth: number;
  requestedHeight: number;
  streamWidth: number;
  streamHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  renderedWidth: number;
  renderedHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  visualWidth: number;
  visualHeight: number;
};

function CameraDebugOverlay({
  cameraError,
  cameraStatus,
  debugInfo,
  torchEnabled,
  torchSupported,
}: {
  cameraError: string;
  cameraStatus: CameraStatus;
  debugInfo: DebugInfo;
  torchEnabled: boolean;
  torchSupported: boolean;
}) {
  return (
    <div className="camera-screen__debug">
      <span>
        status {cameraStatus} | torch supported {String(torchSupported)} | torch enabled{' '}
        {String(torchEnabled)}
      </span>
      <span>camera error {cameraError || 'none'}</span>
      <span>
        request {debugInfo.requestedWidth} x {debugInfo.requestedHeight} (
        {formatRatio(debugInfo.requestedWidth, debugInfo.requestedHeight)})
      </span>
      <span>
        source {debugInfo.sourceWidth} x {debugInfo.sourceHeight} (
        {formatRatio(debugInfo.sourceWidth, debugInfo.sourceHeight)})
      </span>
      <span>
        stream {debugInfo.streamWidth} x {debugInfo.streamHeight} (
        {formatRatio(debugInfo.streamWidth, debugInfo.streamHeight)})
      </span>
      <span>
        video {debugInfo.renderedWidth} x {debugInfo.renderedHeight} (
        {formatRatio(debugInfo.renderedWidth, debugInfo.renderedHeight)})
      </span>
      <span>
        viewport {debugInfo.viewportWidth} x {debugInfo.viewportHeight} (
        {formatRatio(debugInfo.viewportWidth, debugInfo.viewportHeight)})
      </span>
      <span>
        visualViewport {debugInfo.visualWidth} x {debugInfo.visualHeight}
      </span>
    </div>
  );
}

function formatRatio(width: number, height: number) {
  if (!width || !height) {
    return '0.00';
  }

  return (width / height).toFixed(2);
}

function CameraFallback({
  error,
  onBack,
  onRetry,
  status,
}: {
  error: string;
  onBack: () => void;
  onRetry: () => void;
  status: CameraStatus;
}) {
  return (
    <div className="camera-screen__message">
      <strong>
        {status === 'starting'
          ? 'Подключаем камеру...'
          : status === 'denied'
            ? 'Доступ запрещен'
            : 'Камера недоступна'}
      </strong>
      <p>{error}</p>
      <div className="camera-screen__fallback-actions">
        {status !== 'starting' && (
          <button className="secondary-action" type="button" onClick={onRetry}>
            Повторить попытку
          </button>
        )}
        <button className="primary-action" type="button" onClick={onBack}>
          Вернуться назад
        </button>
      </div>
    </div>
  );
}

function CameraBottomBar({
  isCapturing,
  isReady,
  onCapture,
}: {
  isCapturing: boolean;
  isReady: boolean;
  onCapture: () => void;
}) {
  return (
    <div className="camera-screen__bottombar">
      <button
        className="capture-button"
        type="button"
        onClick={onCapture}
        disabled={!isReady || isCapturing}
        aria-label={isCapturing ? 'Сохраняем фото' : 'Сделать фото'}
      >
        <span className="capture-button__inner" />
      </button>
    </div>
  );
}
