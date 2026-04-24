export type Resolution = {
  width: number
  height: number
}

export type CaptureSettings = Resolution

export type CaptureResult = {
  url: string
  width: number
  height: number
  timestamp: string
}

export type CameraStatus = 'starting' | 'ready' | 'denied' | 'error'

export type TorchCapabilities = MediaTrackCapabilities & {
  torch?: boolean
}

export type TorchConstraintSet = MediaTrackConstraintSet & {
  torch?: boolean
}
