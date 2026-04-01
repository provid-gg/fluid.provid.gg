import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import multer from 'multer';
import {
  enqueueJob, getJob, getAllJobs, deleteJob,
  setProgressCallback, OUTPUT_DIR,
  getMaxParallel, setMaxParallel, getRunningCount, getQueueLength,
} from './video/generator';
import { GenerationJob, VideoConfig, VideoEffect, CountdownConfig } from './types';

const VALID_EFFECTS: VideoEffect[] = ['mesh','aurora','vortex','wave','plasma','nebula','pulse','lava','prism','particles','galaxy','glitch'];

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(file.originalname) ||
             file.mimetype.startsWith('audio/'));
  },
});

function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobePath = process.env.FFPROBE_PATH ?? 'ffprobe';
    const proc = spawn(ffprobePath, ['-v','quiet','-print_format','json','-show_format', filePath],
      { stdio: ['ignore','pipe','pipe'] });
    let out = '';
    proc.stdout.on('data', (d: Buffer) => { out += d.toString(); });
    proc.stderr.on('data', () => {});
    proc.on('error', reject);
    proc.on('close', () => {
      try {
        const dur = parseFloat(JSON.parse(out).format?.duration ?? '0');
        dur > 0 ? resolve(dur) : reject(new Error('Could not read audio duration'));
      } catch { reject(new Error('ffprobe parse failed')); }
    });
  });
}

function extractAmplitudes(filePath: string, fps: number, duration: number): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';
    const proc = spawn(ffmpegPath, [
      '-i', filePath, '-vn', '-ac', '1', '-ar', String(fps), '-f', 'f32le', 'pipe:1',
    ], { stdio: ['ignore','pipe','pipe'] });
    const chunks: Buffer[] = [];
    proc.stdout.on('data', (d: Buffer) => chunks.push(d));
    proc.stderr.on('data', () => {});
    proc.on('error', reject);
    proc.on('close', () => {
      const buf = Buffer.concat(chunks);
      const count = Math.floor(buf.length / 4);
      const amps: number[] = new Array(count);
      let maxVal = 0;
      for (let i = 0; i < count; i++) {
        amps[i] = Math.abs(buf.readFloatLE(i * 4));
        if (amps[i] > maxVal) maxVal = amps[i];
      }
      if (maxVal > 0) for (let i = 0; i < count; i++) amps[i] /= maxVal;
      const totalFrames = Math.round(duration * fps);
      while (amps.length < totalFrames) amps.push(0);
      resolve(amps.slice(0, totalFrames));
    });
  });
}

export function createApp() {
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  setProgressCallback((job: GenerationJob) => { io.emit('job:update', job); });

  io.on('connection', socket => {
    socket.emit('jobs:init', getAllJobs());
    socket.emit('settings:init', { maxParallel: getMaxParallel() });
  });

  app.get('/internal-api/heartbeat', (_req, res) => res.json({ ok: true }));

  app.get('/api/settings', (_req, res) => {
    res.json({ ok: true, data: { maxParallel: getMaxParallel(), runningCount: getRunningCount(), queueLength: getQueueLength() } });
  });

  app.patch('/api/settings', (req: Request, res: Response) => {
    const n = Number((req.body as { maxParallel?: unknown }).maxParallel);
    if (!Number.isInteger(n) || n < 1 || n > 8) {
      res.status(400).json({ ok: false, error: 'maxParallel must be an integer 1–8' }); return;
    }
    setMaxParallel(n);
    io.emit('settings:update', { maxParallel: getMaxParallel() });
    res.json({ ok: true, data: { maxParallel: getMaxParallel() } });
  });
  app.get('/api/jobs', (_req, res) => res.json({ ok: true, data: getAllJobs() }));

  app.get('/api/jobs/:id', (req: Request, res: Response) => {
    const j = getJob(req.params.id as string);
    if (!j) { res.status(404).json({ ok: false, error: 'Not found' }); return; }
    res.json({ ok: true, data: j });
  });

  app.post('/api/generate', upload.single('audio'), async (req: Request, res: Response) => {
    const audioFile = (req as Request & { file?: Express.Multer.File }).file;

    let rawBody: Partial<VideoConfig>;
    if (audioFile) {
      try { rawBody = JSON.parse((req.body as { config?: string }).config ?? '{}'); }
      catch { fs.unlink(audioFile.path, () => {}); res.status(400).json({ ok:false, error:'Invalid config JSON' }); return; }
    } else {
      rawBody = req.body as Partial<VideoConfig>;
    }

    const b = rawBody;

    const colors: string[] = Array.isArray(b.colors) && b.colors.length >= 2 ? b.colors : ['#facc15','#22d3ee','#2563eb'];

    const fps: VideoConfig['fps'] = ([24,30,60] as const).includes(Number(b.fps) as never) ? Number(b.fps) as VideoConfig['fps'] : 30;

    let audioDuration: number | undefined;
    let audioAmplitudes: number[] | undefined;
    if (audioFile) {
      try {
        audioDuration = await getAudioDuration(audioFile.path);
        audioDuration = Math.max(1, Math.min(3600, audioDuration));
        audioAmplitudes = await extractAmplitudes(audioFile.path, fps, audioDuration);
      } catch (err) {
        fs.unlink(audioFile.path, () => {});
        res.status(422).json({ ok:false, error:`Audio processing failed: ${(err as Error).message}` });
        return;
      } finally {
        fs.unlink(audioFile.path, () => {});
      }
    }

    const config: Omit<VideoConfig, 'id'> = {
      name:       (typeof b.name === 'string' && b.name.trim()) ? b.name.trim() : 'Untitled',
      colors,
      effect:     VALID_EFFECTS.includes(b.effect as VideoEffect) ? b.effect as VideoEffect : 'mesh',
      resolution: (['1280x720','1920x1080','2560x1440','3840x2160'] as const).includes(b.resolution as never)
                  ? b.resolution as VideoConfig['resolution'] : '1920x1080',
      fps,
      duration:   audioDuration ?? Math.max(1, Math.min(3600, Number(b.duration) || 10)),
      quality:    (['draft','standard','high'] as const).includes(b.quality as never) ? b.quality as VideoConfig['quality'] : 'standard',
      speed:      Math.max(0.25, Math.min(3.0, Number(b.speed) || 1.0)),
      intensity:  Math.max(0.3, Math.min(1.5, Number(b.intensity) || 1.0)),
      bgColor:    (typeof b.bgColor === 'string' && /^#[0-9a-f]{6}$/i.test(b.bgColor)) ? b.bgColor : '#000000',
      vignette:   Boolean(b.vignette),
      perfectLoop: !audioAmplitudes && Boolean(b.perfectLoop),
      audioAmplitudes,
    };

    const bcd = b.countdown as Partial<CountdownConfig> | undefined;
    const cdPosition: CountdownConfig['position'] = (['full','end'] as const).includes(bcd?.position as never)
      ? bcd!.position as CountdownConfig['position'] : 'end';
    const countdown: CountdownConfig | undefined = bcd?.enabled ? {
      enabled:  true,
      position: cdPosition,
      duration: cdPosition === 'full'
        ? config.duration
        : Math.max(1, Math.min(config.duration, Number(bcd!.duration) || 60)),
      label:    (typeof bcd.label === 'string' ? bcd.label.trim().slice(0, 60) : ''),
      style:    (['clean','glow','outline','ring','pill'] as const).includes(bcd.style as never)
                  ? bcd.style as CountdownConfig['style'] : 'glow',
      color:    (typeof bcd.color === 'string' && /^#[0-9a-f]{6}$/i.test(bcd.color))
                  ? bcd.color : '#ffffff',
    } : undefined;

    const job = enqueueJob({ ...config, countdown });
    io.emit('job:update', job);
    res.status(202).json({ ok: true, data: job });
  });

  app.delete('/api/jobs/:id', (req: Request, res: Response) => {
    if (!deleteJob(req.params.id as string)) { res.status(400).json({ ok: false, error: 'Cannot delete' }); return; }
    io.emit('job:deleted', req.params.id);
    res.json({ ok: true });
  });

  app.get('/api/download/:id', (req: Request, res: Response) => {
    const j = getJob(req.params.id as string);
    if (!j || j.status !== 'completed' || !j.outputFile || !fs.existsSync(j.outputFile)) {
      res.status(404).json({ ok: false, error: 'Not ready or file missing' }); return;
    }
    const filename = `${j.config.name.replace(/[^a-z0-9_-]/gi,'_')}_${j.id.slice(0,8)}.mp4`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'video/mp4');
    fs.createReadStream(j.outputFile).pipe(res);
  });

  app.get('/api/preview/:id', (req: Request, res: Response) => {
    const j = getJob(req.params.id as string);
    if (!j || j.status !== 'completed' || !j.outputFile || !fs.existsSync(j.outputFile)) {
      res.status(404).end(); return;
    }
    const stat = fs.statSync(j.outputFile);
    const range = req.headers.range;
    if (range) {
      const [s, e] = range.replace(/bytes=/,'').split('-');
      const start = parseInt(s,10), end = e ? parseInt(e,10) : stat.size-1;
      res.writeHead(206, {'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Accept-Ranges':'bytes','Content-Length':end-start+1,'Content-Type':'video/mp4'});
      fs.createReadStream(j.outputFile, {start,end}).pipe(res);
    } else {
      res.writeHead(200, {'Content-Length':stat.size,'Content-Type':'video/mp4','Accept-Ranges':'bytes'});
      fs.createReadStream(j.outputFile).pipe(res);
    }
  });

  app.delete('/api/cleanup', (_req, res) => {
    const cutoff = Date.now() - 5 * 60 * 1000;
    let removed = 0, skipped = 0;
    for (const j of getAllJobs()) {
      if (j.status === 'processing' || j.status === 'pending') continue;
      const ts = new Date(j.completedAt ?? j.createdAt).getTime();
      if (ts < cutoff) {
        deleteJob(j.id);
        removed++;
      } else {
        skipped++;
      }
    }
    res.json({ ok: true, data: { removed, skipped } });
  });

  setInterval(() => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const j of getAllJobs()) {
      if (j.status === 'processing' || j.status === 'pending') continue;
      const ts = new Date(j.completedAt ?? j.createdAt).getTime();
      if (ts < cutoff) {
        deleteJob(j.id);
        io.emit('job:deleted', j.id);
      }
    }
  }, 10 * 60 * 1000);

  app.get('*', (_req, res) => res.sendFile(path.join(__dirname,'..','public','index.html')));

  return { app, httpServer, io };
}
