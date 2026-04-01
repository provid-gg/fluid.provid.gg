export interface CountdownConfig {
  enabled: boolean;
  duration: number;
  position: 'full' | 'end';
  label: string;
  style: 'clean' | 'glow' | 'outline' | 'ring' | 'pill';
  color: string;
}

export type VideoEffect =
  | 'mesh'
  | 'aurora'
  | 'vortex'
  | 'wave'
  | 'plasma'
  | 'nebula'
  | 'pulse'
  | 'lava'
  | 'prism'
  | 'particles'
  | 'galaxy'
  | 'glitch';

export type VideoResolution = '1280x720' | '1920x1080' | '2560x1440' | '3840x2160';

export type VideoFPS = 24 | 30 | 60;

export interface VideoConfig {
  id: string;
  name: string;
  colors: string[];
  effect: VideoEffect;
  resolution: VideoResolution;
  fps: VideoFPS;
  duration: number;
  quality: 'draft' | 'standard' | 'high';
  speed: number;
  intensity: number;
  bgColor: string;
  vignette: boolean;
  perfectLoop?: boolean;
  countdown?: CountdownConfig;
  audioAmplitudes?: number[];
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface GenerationJob {
  id: string;
  config: VideoConfig;
  status: JobStatus;
  progress: number;
  frame: number;
  totalFrames: number;
  outputFile?: string;
  error?: string;
  eta?: number;
  createdAt: string;
  completedAt?: string;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
