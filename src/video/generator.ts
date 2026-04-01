import { createCanvas } from 'canvas';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { VideoConfig, GenerationJob } from '../types';
import { renderEffect, applyVignette, renderCountdown } from './effects';

export const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(process.cwd(), 'output');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const MAX_AGE_MS = 2 * 60 * 60 * 1000;
const cutoff = Date.now() - MAX_AGE_MS;
for (const f of fs.readdirSync(OUTPUT_DIR)) {
  if (!f.endsWith('.mp4')) continue;
  const fp = path.join(OUTPUT_DIR, f);
  try {
    if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp);
  } catch {}
}

function parseRes(res: string): { width: number; height: number } {
  const [w, h] = res.split('x').map(Number);
  return { width: w, height: h };
}
function crf(q: VideoConfig['quality']): string  { return { draft:'28', standard:'18', high:'14' }[q]; }
function preset(q: VideoConfig['quality']): string { return { draft:'ultrafast', standard:'fast', high:'slow' }[q]; }
const jobs = new Map<string, GenerationJob>();
const queue: string[] = [];
let runningCount = 0;
let maxParallel = Math.max(1, Math.min(8, parseInt(process.env.MAX_PARALLEL ?? '2', 10)));

type ProgressCb = (j: GenerationJob) => void;
let onProgress: ProgressCb = () => {};

export function setProgressCallback(fn: ProgressCb): void { onProgress = fn; }
export function getMaxParallel(): number { return maxParallel; }
export function getRunningCount(): number { return runningCount; }
export function getQueueLength(): number { return queue.length; }
export function setMaxParallel(n: number): void {
  maxParallel = Math.max(1, Math.min(8, n));
  processQueue();
}

export function getJob(id: string): GenerationJob | undefined { return jobs.get(id); }
export function getAllJobs(): GenerationJob[] {
  return [...jobs.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
export function deleteJob(id: string): boolean {
  const j = jobs.get(id);
  if (!j || j.status === 'processing') return false;
  if (j.outputFile) { try { fs.unlinkSync(j.outputFile); } catch {} }
  jobs.delete(id);
  const qi = queue.indexOf(id);
  if (qi >= 0) queue.splice(qi, 1);
  return true;
}

export function enqueueJob(config: Omit<VideoConfig, 'id'>): GenerationJob {
  const id = uuidv4();
  const full: VideoConfig = { ...config, id };
  const job: GenerationJob = {
    id, config: full,
    status: 'pending', progress: 0, frame: 0,
    totalFrames: Math.round(config.duration * config.fps),
    createdAt: new Date().toISOString(),
  };
  jobs.set(id, job);
  queue.push(id);
  processQueue();
  return job;
}

function processQueue(): void {
  while (runningCount < maxParallel && queue.length > 0) {
    const id = queue.shift()!;
    const job = jobs.get(id);
    if (!job) continue;

    runningCount++;
    job.status = 'processing';
    onProgress(job);

    generate(job)
      .then(f => { job.status='completed'; job.progress=1; job.outputFile=f; job.completedAt=new Date().toISOString(); })
      .catch(e => { job.status='failed'; job.error=String(e?.message??e); })
      .finally(() => { onProgress(job); runningCount--; processQueue(); });
  }
}

async function generate(job: GenerationJob): Promise<string> {
  const { config } = job;
  const { width, height } = parseRes(config.resolution);
  const totalFrames = Math.round(config.duration * config.fps);
  const outputFile = path.join(OUTPUT_DIR, `${config.id}.mp4`);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const blendFrames = config.perfectLoop ? Math.min(Math.round(config.fps * 1.2), Math.round(totalFrames * 0.12)) : 0;
  const blendCanvas = config.perfectLoop && blendFrames > 0 ? createCanvas(width, height) : null;
  const blendCtx    = blendCanvas ? blendCanvas.getContext('2d') : null;
  const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';
  const pixFmt = process.env.FFMPEG_PIX_FMT ?? 'bgra';

  const args = [
    '-y', '-f','rawvideo', '-vcodec','rawvideo',
    '-s', `${width}x${height}`, '-pix_fmt', pixFmt,
    '-r', `${config.fps}`, '-i', 'pipe:0',
    '-c:v','libx264', '-pix_fmt','yuv420p',
    '-preset', preset(config.quality), '-crf', crf(config.quality),
    '-movflags', '+faststart', outputFile,
  ];

  return new Promise<string>((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ['pipe','ignore','pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('error', e => reject(new Error(`FFmpeg start failed: ${e.message}. Set FFMPEG_PATH or install ffmpeg.`)));
    proc.on('close', code => code === 0 ? resolve(outputFile) : reject(new Error(`FFmpeg code ${code}:\n${stderr.slice(-2000)}`)));

    const audioTimes: number[] | null = (() => {
      const amps = config.audioAmplitudes;
      if (!amps || amps.length === 0) return null;
      const smooth = new Array(amps.length);
      smooth[0] = amps[0];
      for (let k = 1; k < amps.length; k++) smooth[k] = 0.5 * amps[k] + 0.5 * smooth[k - 1];
      const dt = 1 / config.fps;
      const times = new Array(amps.length);
      times[0] = 0;
      for (let k = 1; k < amps.length; k++) times[k] = times[k - 1] + dt * config.speed * (0.15 + smooth[k] * 4.0);
      return times;
    })();

    const start = Date.now();
    (async () => {
      try {
        for (let i = 0; i < totalFrames; i++) {
          const t = audioTimes
            ? (audioTimes[i] ?? audioTimes[audioTimes.length - 1])
            : (i / config.fps) * config.speed;

          ctx.fillStyle = config.bgColor || '#000000';
          ctx.fillRect(0, 0, width, height);

          renderEffect(ctx, t, width, height, config.colors, config.effect, config.intensity ?? 1.0);

          if (config.vignette) applyVignette(ctx, width, height);

          if (config.perfectLoop && blendCtx && blendCanvas && i >= totalFrames - blendFrames) {
            const blendAlpha = blendFrames > 1 ? (i - (totalFrames - blendFrames)) / (blendFrames - 1) : 1;
            blendCtx.fillStyle = config.bgColor || '#000000';
            blendCtx.fillRect(0, 0, width, height);
            renderEffect(blendCtx, 0, width, height, config.colors, config.effect, config.intensity ?? 1.0);
            if (config.vignette) applyVignette(blendCtx, width, height);
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, blendAlpha));
            ctx.drawImage(blendCanvas as unknown as import('canvas').Canvas, 0, 0);
            ctx.restore();
          }

          if (config.countdown?.enabled) {
            const cd      = config.countdown;
            const elapsed = i / config.fps;
            let remaining: number | null = null;

            if (cd.position === 'end') {
              const showFrom = config.duration - cd.duration;
              if (elapsed >= showFrom) {
                remaining = Math.max(0, config.duration - elapsed);
              }
            } else {
              const rem = cd.duration - elapsed;
              if (rem > 0) remaining = rem;
            }

            if (remaining !== null) {
              renderCountdown(ctx, remaining, cd.duration, width, height, cd);
            }
          }

          const ok = proc.stdin.write(canvas.toBuffer('raw'));
          if (!ok) await new Promise<void>(r => proc.stdin.once('drain', r));

          job.frame = i + 1;
          job.progress = (i + 1) / totalFrames;
          const elapsed = (Date.now() - start) / 1000;
          job.eta = (elapsed / job.progress) * (1 - job.progress);
          onProgress(job);
        }
        proc.stdin.end();
      } catch (e) { proc.stdin.destroy(); reject(e); }
    })();
  });
}
