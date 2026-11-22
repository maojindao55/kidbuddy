import { loadSpeechConfig } from '@/config/speechConfig';
import { CloudSynthesizer, RealtimeRecognizer, TokenPlanRecognizer } from './qwenSpeech';
import type { SpeechRecognizer, SpeechSynthesizer } from './types';
import { WebSpeechRecognizer, WebSpeechSynthesizer } from './webSpeech';

export type * from './types';
export { toSpeakableText } from './speechText';

let webRecognizer: SpeechRecognizer | null = null;
let webSynthesizer: SpeechSynthesizer | null = null;
let tokenPlanRecognizer: SpeechRecognizer | null = null;
let realtimeRecognizer: SpeechRecognizer | null = null;
let cloudSynthesizer: SpeechSynthesizer | null = null;

function getWebSynthesizer(): SpeechSynthesizer {
  webSynthesizer ??= new WebSpeechSynthesizer();
  return webSynthesizer;
}

/** 按家长设置选云端引擎（Token Plan 或百炼实时）；非桌面端预览等不支持云端时退回 Web Speech 兜底 */
export function getSpeechRecognizer(): SpeechRecognizer {
  const engine = loadSpeechConfig().asr.engine;
  if (engine === 'qwen') {
    realtimeRecognizer ??= new RealtimeRecognizer();
    if (realtimeRecognizer.supported) return realtimeRecognizer;
  } else {
    tokenPlanRecognizer ??= new TokenPlanRecognizer();
    if (tokenPlanRecognizer.supported) return tokenPlanRecognizer;
  }
  webRecognizer ??= new WebSpeechRecognizer();
  return webRecognizer;
}

export function getSpeechSynthesizer(): SpeechSynthesizer {
  cloudSynthesizer ??= new CloudSynthesizer(getWebSynthesizer());
  if (cloudSynthesizer.supported) return cloudSynthesizer;
  return getWebSynthesizer();
}
