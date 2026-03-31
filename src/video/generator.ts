import { createCanvas } from 'canvas';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { VideoConfig, GenerationJob } from '../types';
import { renderEffect, applyVignette, renderCountdown } from './effects';

export const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(process.cwd(), 'output');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

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

    const start = Date.now();
    (async () => {
      try {
        for (let i = 0; i < totalFrames; i++) {
          const t = (i / config.fps) * config.speed;

          ctx.fillStyle = config.bgColor || '#000000';
          ctx.fillRect(0, 0, width, height);

          renderEffect(ctx, t, width, height, config.colors, config.effect, config.intensity ?? 1.0);

          if (config.vignette) applyVignette(ctx, width, height);

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
