import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  ENGLISH_BUDDY,
  ENGLISH_SCENES,
  buildEnglishRoleplayPrompt,
  getEnglishScene,
  matchMissionAttempt,
  recordEnglishSceneWin,
  recordEnglishTurn,
  type EnglishScene,
} from '@/config/kidEnglish';
import { useKid, type KidCompanion } from './KidContext';
import { ChatBubble } from './components/ChatBubble';
import { KidInputBar } from './components/KidInputBar';
import { StarRow } from './components/StarRow';
import { KID_SPEAKER_ID, useKidMessages } from './hooks/useKidMessages';
import { useReadAloud } from './hooks/useReadAloud';
import { useRealtimeTalk } from './hooks/useRealtimeTalk';

function EnglishSceneSession({ scene, onReplay }: { scene: EnglishScene; onReplay: () => void }) {
  const navigate = useNavigate();
  const { profile, memory, voice, setVoicePrefs } = useKid();
  const { messages, messagesRef, push, askCompanion, startReply, busy, pendingId } = useKidMessages();
  const readAloud = useReadAloud();
  const listRef = useRef<HTMLDivElement>(null);

  const [missionIdx, setMissionIdx] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [showChineseHint, setShowChineseHint] = useState(true);
  const greeted = useRef(false);

  const currentMission = scene.missions[Math.min(missionIdx, scene.missions.length - 1)];
  const fontSize = profile.band === 'preschool' ? 21 : 18;

  const sunnyCompanion = useMemo<KidCompanion>(
    () => ({
      member: {
        id: ENGLISH_BUDDY.id,
        kind: 'llm',
        name: scene.roleName,
        description: `${scene.englishTitle} 向导`,
        source: 'builtin',
        providerId: '',
        model: '',
        customPrompt: buildEnglishRoleplayPrompt({
          scene,
          mission: completed ? undefined : currentMission,
          kidName: memory.nickname,
          band: profile.band,
          realtimeMode: true,
        }),
      },
      meta: {
        catchphrase: "Let's speak English!",
        greeting: scene.openingEn,
        color: ENGLISH_BUDDY.color,
        emoji: ENGLISH_BUDDY.emoji,
      },
    }),
    [scene, completed, currentMission, memory.nickname, profile.band],
  );

  const advanceMissionIfMatched = (text: string): number => {
    if (completed) return missionIdx;
    const mission = scene.missions[missionIdx];
    if (!mission || !matchMissionAttempt(text, mission)) return missionIdx;
    const nextIdx = missionIdx + 1;
    if (nextIdx >= scene.missions.length) {
      setMissionIdx(scene.missions.length);
      setCompleted(true);
      recordEnglishSceneWin(scene.id, 3);
    } else {
      setMissionIdx(nextIdx);
    }
    return nextIdx;
  };

  const realtime = useRealtimeTalk({
    companion: sunnyCompanion,
    allowed: !completed,
    autoReadAloud: voice.autoReadAloud,
    profile,
    memory,
    messagesRef,
    startReply,
    onPress: () => readAloud.cancel(),
    onKidSpoke: (text) => {
      if (text) {
        recordEnglishTurn(text);
        advanceMissionIfMatched(text);
      }
      push({
        speakerId: KID_SPEAKER_ID,
        speakerName: memory.nickname || '我',
        content: text || '🎤（说了一段英语）',
      });
    },
  });

  useEffect(() => {
    if (greeted.current) return;
    greeted.current = true;
    const opener = `${scene.openingEn}\n（${scene.openingZh}）`;
    push({ speakerId: ENGLISH_BUDDY.id, speakerName: scene.roleName, content: opener });
    if (voice.autoReadAloud) {
      readAloud.enqueue(scene.openingEn, ENGLISH_BUDDY.id, undefined, 'en-US');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, completed]);

  const handleSend = async (text: string) => {
    if (busy || completed) return;
    readAloud.cancel();
    recordEnglishTurn(text);
    push({ speakerId: KID_SPEAKER_ID, speakerName: memory.nickname || '我', content: text });

    const nextIdx = advanceMissionIfMatched(text);
    const nextMission = nextIdx < scene.missions.length ? scene.missions[nextIdx] : undefined;
    const roleplayPrompt = buildEnglishRoleplayPrompt({
      scene,
      mission: nextMission,
      kidName: memory.nickname,
      band: profile.band,
      realtimeMode: false,
    });

    const speech = voice.autoReadAloud ? readAloud.stream(ENGLISH_BUDDY.id, undefined, 'en-US') : null;
    const reply = await askCompanion({
      companion: sunnyCompanion,
      message: text,
      gamePrompt: roleplayPrompt,
      onText: speech?.onText,
    });
    speech?.finish(reply);
  };

  const nextScene = ENGLISH_SCENES.find((s) => s.order === scene.order + 1);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="english-play-page" data-scene={scene.id}>
      {/* 顶栏 */}
      <div className="flex shrink-0 items-center gap-3 px-4 pb-2">
        <Link to="/english" aria-label="返回冒险岛" className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
          ←
        </Link>
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-sm"
          style={{ backgroundColor: scene.bg }}
          aria-hidden
        >
          {scene.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold text-slate-800">
            {scene.title} · <span style={{ color: scene.accent }}>{scene.englishTitle}</span>
          </h1>
          <div className="text-xs text-slate-500">扮演角色：{scene.roleName}</div>
        </div>
        {readAloud.supported && (
          <button
            type="button"
            onClick={() => {
              if (voice.autoReadAloud) {
                readAloud.cancel();
                realtime.stopSpeaking();
              }
              setVoicePrefs({ autoReadAloud: !voice.autoReadAloud });
            }}
            className={`flex h-12 items-center gap-1.5 rounded-full px-4 text-sm font-bold shadow-sm ${
              voice.autoReadAloud ? 'bg-sky-400 text-white' : 'bg-white text-slate-500'
            }`}
          >
            <span aria-hidden>{voice.autoReadAloud ? '🔊' : '🔈'}</span>
            <span>{voice.autoReadAloud ? '自动朗读' : '朗读关'}</span>
          </button>
        )}
      </div>

      {/* 主体：左任务梯子 + 右对话 */}
      <div className="grid min-h-0 flex-1 gap-4 px-4 pb-2 lg:grid-cols-[0.95fr_1.15fr]">
        {/* 左侧任务卡与提示梯子 */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-[32px] bg-white p-4 shadow-md">
          <div className="rounded-2xl p-4" style={{ backgroundColor: scene.bg }}>
            <div className="text-sm font-bold" style={{ color: scene.accent }}>情景任务进度</div>
            <div className="mt-2.5 space-y-2">
              {scene.missions.map((m, idx) => {
                const done = completed || idx < missionIdx;
                const active = !completed && idx === missionIdx;
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-bold ${
                      done
                        ? 'bg-emerald-100/80 text-emerald-800'
                        : active
                          ? 'bg-white text-slate-800 ring-2 ring-emerald-400 shadow-sm'
                          : 'bg-white/60 text-slate-400'
                    }`}
                  >
                    <span>{done ? '✅' : active ? '👉' : `${idx + 1}.`}</span>
                    <span>{m.labelZh}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {!completed && currentMission && (
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-4 space-y-3" data-testid="english-hint-card">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-extrabold text-emerald-800">💡 不会说？点这里跟读提示句</span>
                <button
                  type="button"
                  onClick={() => setShowChineseHint((v) => !v)}
                  className="flex h-12 items-center rounded-xl bg-white px-3 text-xs font-bold text-slate-600 shadow-sm"
                >
                  {showChineseHint ? '隐藏中文' : '显示中文'}
                </button>
              </div>
              <div className="rounded-2xl bg-white p-3.5 shadow-sm">
                <div className="text-xl font-extrabold text-slate-800">{currentMission.hintEn}</div>
                {showChineseHint && (
                  <div className="mt-1 text-sm text-slate-500">{currentMission.hintZh}</div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {readAloud.supported && (
                  <button
                    type="button"
                    data-testid="listen-hint-btn"
                    onClick={() => readAloud.speakNow(currentMission.hintEn, ENGLISH_BUDDY.id, undefined, 'en-US')}
                    className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-sky-500 px-4 text-sm font-bold text-white shadow-sm"
                  >
                    🔊 听示范跟读
                  </button>
                )}
                <button
                  type="button"
                  data-testid="use-hint-btn"
                  disabled={busy}
                  onClick={() => void handleSend(currentMission.hintEn)}
                  className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-emerald-500 px-4 text-sm font-bold text-white shadow-sm disabled:opacity-50"
                >
                  ✨ 用这句来说
                </button>
              </div>
            </div>
          )}

          {completed && (
            <div className="flex flex-col items-center gap-3 rounded-3xl bg-amber-50 p-5 text-center" data-testid="english-complete-card">
              <div className="text-3xl font-extrabold text-slate-800">🎉 Mission Complete!</div>
              <StarRow count={3} size={36} />
              <p className="text-sm font-bold text-amber-700">太棒了！你用英语完成了「{scene.title}」的全部任务！</p>
              <div className="flex w-full gap-2 pt-1">
                <button
                  type="button"
                  onClick={onReplay}
                  className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-white text-base font-bold text-slate-600 shadow-sm"
                >
                  再练一次
                </button>
                {nextScene ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/english/${nextScene.id}`)}
                    className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-emerald-500 text-base font-bold text-white shadow-sm"
                  >
                    下一关 →
                  </button>
                ) : (
                  <Link
                    to="/english"
                    className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-emerald-500 text-base font-bold text-white shadow-sm"
                  >
                    回冒险岛
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 右侧聊天列表 */}
        <div className="flex min-h-0 flex-col rounded-[32px] bg-white/85 shadow-md">
          <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((m) => {
              const isKid = m.speakerId === KID_SPEAKER_ID;
              return (
                <ChatBubble
                  key={m.id}
                  isKid={isKid}
                  speakerName={m.speakerName}
                  content={m.content}
                  companion={isKid ? undefined : sunnyCompanion}
                  fontSize={fontSize}
                  pending={m.id === pendingId}
                  isError={m.isError}
                  onReadAloud={!isKid && readAloud.supported ? () => readAloud.speakNow(m.content, ENGLISH_BUDDY.id, undefined, 'en-US') : undefined}
                />
              );
            })}
          </div>
        </div>
      </div>

      {!completed && (
        <KidInputBar
          disabled={busy}
          talkDisabled={busy && !realtime.replying}
          placeholder="试着说一句英语，也可以问 Sunny 怎么说…"
          speechLang="en-US"
          onSend={(text) => void handleSend(text)}
          recognizer={realtime.recognizer ?? undefined}
          voiceRepliesItself={Boolean(realtime.recognizer)}
        />
      )}
    </div>
  );
}

export default function KidEnglishPlay() {
  const { sceneId } = useParams();
  const [replayKey, setReplayKey] = useState(0);
  const scene = getEnglishScene(sceneId);
  if (!scene) return <Navigate to="/english" replace />;
  return <EnglishSceneSession key={`${scene.id}-${replayKey}`} scene={scene} onReplay={() => setReplayKey((k) => k + 1)} />;
}
