import { useState } from 'react';
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
}: {
  error: string;
  onBack: () => void;
  onRetry: () => void;
  status: CameraStatus;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  return (
    <div className="camera-screen__viewport">
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
