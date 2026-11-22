/**
 * 绘本有声动画视频合成导出（720P Canvas 逐帧渲染 + 云端 TTS 音轨混流 + MediaRecorder 录制）。
 *
 * 自动兼容：
 * - 已生成 AI 视频（videoPath）的分镜：通过 Tauri 读取同源 blob 后绘制循环动态画面
 * - 静态插画分镜：套用柔和 Ken Burns 推进/平移电影运镜
 * - 旁白音频：优先合成绘本专属音色，无桌面端/网络降级时自动按阅读时长生成默片字幕动画
 */
import type { KidStorybookRecord } from '@/config/kidArt';
import {
  buildStorybookMovieSlides,
  interpolateKenBurns,
  pickSupportedVideoMime,
  type MovieLangMode,
  type StorybookMovieSlide,
} from '@/config/storybookMoviePlan';
import { loadSpeechConfig, moduleVoiceKey, splitForSynthesis, voiceForSpeaker } from '@/config/speechConfig';
import { synthesizeCloud } from '@/lib/speech/qwenSpeech';
import { toSpeakableText } from '@/lib/speech';
import { isTauri } from '@/utils/isTauri';
import {
  drawCanvasRoundedRect,
  loadCanvasImage,
  readArtworkDataUrl,
  readArtworkVideoBlobUrl,
  triggerFileDownload,
  wrapCanvasText,
} from './kidImage';

const MOVIE_W = 1280;
const MOVIE_H = 720;
const FPS = 30;
const STORYBOOK_VOICE_SCOPE = moduleVoiceKey('storybook');

interface PreparedSlide {
  slide: StorybookMovieSlide;
  image: HTMLImageElement | null;
  video: HTMLVideoElement | null;
  audioBuffers: AudioBuffer[];
  durationMs: number;
}

function loadVideoElement(blobUrl: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = blobUrl;
    const cleanup = () => {
      video.oncanplay = null;
      video.onerror = null;
    };
    video.oncanplay = () => {
      cleanup();
      resolve(video);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('加载分镜动画视频失败'));
    };
    setTimeout(() => {
      cleanup();
      if (video.readyState >= 2) resolve(video);
      else reject(new Error('加载分镜动画视频超时'));
    }, 6000);
  });
}

function drawCoverFitMedia(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  scale = 1,
  offsetX = 0,
  offsetY = 0,
) {
  if (!srcW || !srcH) return;
  const baseScale = Math.max(boxW / srcW, boxH / srcH);
  const finalScale = baseScale * scale;
  const drawW = srcW * finalScale;
  const drawH = srcH * finalScale;
  const drawX = boxX + (boxW - drawW) / 2 + offsetX * boxW;
  const drawY = boxY + (boxH - drawH) / 2 + offsetY * boxH;
  ctx.drawImage(source, drawX, drawY, drawW, drawH);
}

function renderMovieFrame(
  ctx: CanvasRenderingContext2D,
  bookTitle: string,
  item: PreparedSlide,
  progress: number,
  elapsedMs: number,
) {
  // 温暖暗调影院幕布背景
  const bg = ctx.createLinearGradient(0, 0, MOVIE_W, MOVIE_H);
  bg.addColorStop(0, '#1E1B2E');
  bg.addColorStop(0.55, '#2A223D');
  bg.addColorStop(1, '#191626');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, MOVIE_W, MOVIE_H);

  // 顶部标题条
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = 'bold 22px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`📖 《${bookTitle}》`, 48, 42);

  ctx.fillStyle = 'rgba(251, 191, 36, 0.95)';
  ctx.font = 'bold 20px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(item.slide.label, MOVIE_W - 48, 42);

  // 主视觉框（16:9 中的柔和圆角舞台）
  const stageX = 110;
  const stageY = 62;
  const stageW = MOVIE_W - stageX * 2;
  const stageH = 492;

  const alpha = Math.min(1, Math.max(0.05, elapsedMs / 360));
  ctx.save();
  ctx.globalAlpha = alpha;
  drawCanvasRoundedRect(ctx, stageX, stageY, stageW, stageH, 28);
  ctx.clip();
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(stageX, stageY, stageW, stageH);

  if (item.video && item.video.readyState >= 2) {
    drawCoverFitMedia(
      ctx,
      item.video,
      item.video.videoWidth || stageW,
      item.video.videoHeight || stageH,
      stageX,
      stageY,
      stageW,
      stageH,
    );
  } else if (item.image) {
    const { scale, offsetX, offsetY } = interpolateKenBurns(item.slide.preset, progress);
    drawCoverFitMedia(
      ctx,
      item.image,
      item.image.naturalWidth || item.image.width,
      item.image.naturalHeight || item.image.height,
      stageX,
      stageY,
      stageW,
      stageH,
      scale,
      offsetX,
      offsetY,
    );
  }
  ctx.restore();

  // 精致暖金边框
  ctx.save();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
  ctx.lineWidth = 3;
  drawCanvasRoundedRect(ctx, stageX, stageY, stageW, stageH, 28);
  ctx.stroke();
  ctx.restore();

  // 底部双语字幕卡
  const subX = 72;
  const subY = 574;
  const subW = MOVIE_W - subX * 2;
  const subH = 122;
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  drawCanvasRoundedRect(ctx, subX, subY, subW, subH, 22);
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'center';
  if (item.slide.secondarySubtitle) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif';
    const line1 = wrapCanvasText(ctx, item.slide.primarySubtitle, subW - 56)[0] || '';
    ctx.fillText(line1, MOVIE_W / 2, subY + 46);

    ctx.fillStyle = '#7DD3FC';
    ctx.font = '600 22px "Plus Jakarta Sans", "PingFang SC", sans-serif';
    const line2 = wrapCanvasText(ctx, item.slide.secondarySubtitle, subW - 56)[0] || '';
    ctx.fillText(line2, MOVIE_W / 2, subY + 88);
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif';
    const lines = wrapCanvasText(ctx, item.slide.primarySubtitle, subW - 56).slice(0, 2);
    const startY = lines.length === 1 ? subY + 70 : subY + 48;
    lines.forEach((line, idx) => {
      ctx.fillText(line, MOVIE_W / 2, startY + idx * 42);
    });
  }
}

export async function exportStorybookMovie(
  book: KidStorybookRecord,
  options: {
    langMode: MovieLangMode;
    onProgress?: (status: string) => void;
    signal?: AbortSignal;
  },
): Promise<{ ext: 'mp4' | 'webm'; hasAudio: boolean }> {
  const slides = buildStorybookMovieSlides(book, options.langMode);
  if (!slides.length) {
    throw new Error('绘本还没有内容，无法导出动画');
  }
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('当前运行环境不支持视频录制导出，可以先使用「影院播放」观看。');
  }

  const canvas = document.createElement('canvas');
  canvas.width = MOVIE_W;
  canvas.height = MOVIE_H;
  const ctx = canvas.getContext('2d');
  const captureFn = (canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }).captureStream;
  if (!ctx || typeof captureFn !== 'function') {
    throw new Error('当前浏览器内核不支持画布视频流导出。');
  }

  const createdBlobUrls: string[] = [];
  const createdVideos: HTMLVideoElement[] = [];
  let audioCtx: AudioContext | null = null;
  let videoStream: MediaStream | null = null;

  try {
    const AudioCtxCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtxCtor) {
      audioCtx = new AudioCtxCtor();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => undefined);
      }
    }

    const speechCfg = loadSpeechConfig();
    const voice = voiceForSpeaker(speechCfg, 'kid-story-fairy', STORYBOOK_VOICE_SCOPE);
    const prepared: PreparedSlide[] = [];
    let totalAudioBuffers = 0;

    // 第一阶段：加载素材 & 合成旁白音频
    for (let i = 0; i < slides.length; i += 1) {
      if (options.signal?.aborted) throw new Error('已取消导出动画');
      const slide = slides[i];
      options.onProgress?.(`准备第 ${i + 1} / ${slides.length} 幕画面与配音…`);

      let image: HTMLImageElement | null = null;
      if (slide.imagePath) {
        try {
          const dataUrl = await readArtworkDataUrl(slide.imagePath);
          image = await loadCanvasImage(dataUrl);
        } catch {
          image = null;
        }
      }

      let video: HTMLVideoElement | null = null;
      if (slide.videoPath) {
        try {
          const blobUrl = await readArtworkVideoBlobUrl(slide.videoPath);
          if (blobUrl.startsWith('blob:')) createdBlobUrls.push(blobUrl);
          video = await loadVideoElement(blobUrl);
          createdVideos.push(video);
        } catch {
          video = null;
        }
      }

      const audioBuffers: AudioBuffer[] = [];
      if (audioCtx && isTauri) {
        for (const seg of slide.narrationSegments) {
          const speakable = toSpeakableText(seg.text);
          if (!speakable) continue;
          for (const piece of splitForSynthesis(speakable)) {
            if (options.signal?.aborted) throw new Error('已取消导出动画');
            try {
              const mp3Bytes = await synthesizeCloud(piece, voice, speechCfg);
              const decoded = await audioCtx.decodeAudioData(mp3Bytes.slice(0));
              audioBuffers.push(decoded);
              totalAudioBuffers += 1;
            } catch {
              // 云端配音不可用时静默降级为默片时长
            }
          }
        }
      }

      const audioDurationMs = audioBuffers.reduce((sum, b) => sum + b.duration * 1000 + 180, 0);
      const durationMs = Math.max(4200, Math.round(audioDurationMs > 0 ? audioDurationMs + 500 : slide.fallbackDurationMs));
      prepared.push({ slide, image, video, audioBuffers, durationMs });
    }

    // 第二阶段：启动 MediaRecorder 逐帧渲染并混入音频
    videoStream = captureFn.call(canvas, FPS);
    const audioDest = audioCtx && totalAudioBuffers > 0 ? audioCtx.createMediaStreamDestination() : null;
    const tracks = [
      ...videoStream.getVideoTracks(),
      ...(audioDest ? audioDest.stream.getAudioTracks() : []),
    ];
    const combinedStream = new MediaStream(tracks);
    const { mimeType, ext } = pickSupportedVideoMime((m) => MediaRecorder.isTypeSupported(m));
    const recorder = mimeType
      ? new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 3_500_000 })
      : new MediaRecorder(combinedStream);

    const chunks: BlobPart[] = [];
    const stoppedPromise = new Promise<void>((resolve, reject) => {
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onerror = () => reject(new Error('视频录制编码失败'));
      recorder.onstop = () => resolve();
    });

    recorder.start(250);

    for (let i = 0; i < prepared.length; i += 1) {
      if (options.signal?.aborted) {
        recorder.stop();
        await stoppedPromise.catch(() => undefined);
        throw new Error('已取消导出动画');
      }
      const item = prepared[i];
      options.onProgress?.(`正在录制第 ${i + 1} / ${prepared.length} 幕…`);

      if (item.video) {
        item.video.currentTime = 0;
        await item.video.play().catch(() => undefined);
      }

      // 调度这一页的所有旁白句段
      if (audioCtx && audioDest && item.audioBuffers.length > 0) {
        let offsetSec = audioCtx.currentTime + 0.08;
        for (const buf of item.audioBuffers) {
          const src = audioCtx.createBufferSource();
          src.buffer = buf;
          src.connect(audioDest);
          src.start(offsetSec);
          offsetSec += buf.duration + 0.16;
        }
      }

      const slideStart = performance.now();
      while (true) {
        if (options.signal?.aborted) {
          recorder.stop();
          await stoppedPromise.catch(() => undefined);
          throw new Error('已取消导出动画');
        }
        const elapsed = performance.now() - slideStart;
        const progress = Math.min(1, elapsed / item.durationMs);
        renderMovieFrame(ctx, book.title, item, progress, elapsed);
        if (elapsed >= item.durationMs) break;
        await new Promise((r) => setTimeout(r, 1000 / FPS));
      }

      if (item.video) {
        item.video.pause();
      }
    }

    recorder.stop();
    await stoppedPromise;

    const blob = new Blob(chunks, { type: mimeType || `video/${ext}` });
    const outUrl = URL.createObjectURL(blob);
    const safeTitle = (book.title || '我的绘本').replace(/[\\/:*?"<>|]/g, '_');
    triggerFileDownload(outUrl, `${safeTitle}-有声动画.${ext}`);
    setTimeout(() => URL.revokeObjectURL(outUrl), 8000);

    return { ext, hasAudio: totalAudioBuffers > 0 };
  } finally {
    createdVideos.forEach((v) => {
      v.pause();
      v.removeAttribute('src');
      v.load();
    });
    createdBlobUrls.forEach((u) => URL.revokeObjectURL(u));
    videoStream?.getTracks().forEach((t) => t.stop());
    if (audioCtx && audioCtx.state !== 'closed') {
      await audioCtx.close().catch(() => undefined);
    }
  }
}
