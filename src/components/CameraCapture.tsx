import { useEffect, useRef, useState } from 'react';
import { captureFromPreview, downloadCapture } from './cameraCaptureUtils';
import type { CameraStatus, CaptureResult, CaptureSettings } from './types';
import { useCameraSession } from './useCameraSession';
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
  const [renderMetrics, setRenderMetrics] = useState<RenderMetrics | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const {
    error,
    sourceResolution,
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

    const updateMetrics = () => {
      const videoRect = video.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();

      setRenderMetrics({
        streamWidth: video.videoWidth,
        streamHeight: video.videoHeight,
        renderedWidth: Math.round(videoRect.width),
        renderedHeight: Math.round(videoRect.height),
        viewportWidth: Math.round(viewportRect.width),
        viewportHeight: Math.round(viewportRect.height),
      });
    };

    const resizeObserver = new ResizeObserver(updateMetrics);
    resizeObserver.observe(video);
    resizeObserver.observe(viewport);

    video.addEventListener('loadedmetadata', updateMetrics);
    globalThis.addEventListener('resize', updateMetrics);
    updateMetrics();

    return () => {
      resizeObserver.disconnect();
      video.removeEventListener('loadedmetadata', updateMetrics);
      globalThis.removeEventListener('resize', updateMetrics);
    };
  }, [status, videoRef]);

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
        error={error}
        onBack={onBack}
        onRetry={() => void startCamera()}
        status={status}
        videoRef={videoRef}
        viewportRef={viewportRef}
      />

      <CameraBottomBar
        isCapturing={isCapturing}
        isReady={status === 'ready'}
        onCapture={() => void handleCapture()}
        renderMetrics={status === 'ready' ? renderMetrics : null}
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
          Х
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
  error,
  onBack,
  onRetry,
  status,
  videoRef,
  viewportRef,
}: {
  error: string;
  onBack: () => void;
  onRetry: () => void;
  status: CameraStatus;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  viewportRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="camera-screen__viewport" ref={viewportRef}>
      <video
        ref={videoRef}
        className="camera-screen__video"
        autoPlay
        muted
        playsInline
      />

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
  renderMetrics,
}: {
  isCapturing: boolean;
  isReady: boolean;
  onCapture: () => void;
  renderMetrics: RenderMetrics | null;
}) {
  return (
    <div className="camera-screen__bottombar">
      {renderMetrics && <CameraDebugInfo metrics={renderMetrics} />}
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

type RenderMetrics = {
  streamWidth: number;
  streamHeight: number;
  renderedWidth: number;
  renderedHeight: number;
  viewportWidth: number;
  viewportHeight: number;
};

function CameraDebugInfo({ metrics }: { metrics: RenderMetrics }) {
  return (
    <div className="camera-screen__debug">
      <span>
        stream {metrics.streamWidth} x {metrics.streamHeight} (
        {formatRatio(metrics.streamWidth, metrics.streamHeight)})
      </span>
      <span>
        video {metrics.renderedWidth} x {metrics.renderedHeight} (
        {formatRatio(metrics.renderedWidth, metrics.renderedHeight)})
      </span>
      <span>
        viewport {metrics.viewportWidth} x {metrics.viewportHeight}
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
