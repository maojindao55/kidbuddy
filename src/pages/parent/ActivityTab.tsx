import { useState } from 'react';
import { builtinAIMembers, companionMeta, type KidCompanionId } from '@/config/aiMembers';
import { clearKidChats, loadKidChat, type KidChatMessage } from '@/config/kidChatHistory';
import { clearKidMemory } from '@/config/kidMemory';
import { badgeDefinitions, emptyRewardStats, loadRewardStats, saveRewardStats } from '@/config/kidRewards';
import { PLAYGROUND_CHAT_ID } from '@/pages/kid/kidRoutes';
import { KID_SPEAKER_ID } from '@/pages/kid/hooks/useKidMessages';

const CHAT_CHANNELS: { id: string; label: string; emoji: string }[] = [
  { id: PLAYGROUND_CHAT_ID, label: '小伙伴乐园', emoji: '🎪' },
  ...builtinAIMembers.map((m) => ({
    id: m.id,
    label: m.name,
    emoji: companionMeta[m.id as KidCompanionId]?.emoji || '💬',
  })),
];

export default function ActivityTab() {
  const [rewards, setRewards] = useState(loadRewardStats);
  const [channelId, setChannelId] = useState<string>(PLAYGROUND_CHAT_ID);
  const [messages, setMessages] = useState<KidChatMessage[]>(() => loadKidChat(PLAYGROUND_CHAT_ID));
  const [confirmClear, setConfirmClear] = useState<'memory' | 'chats' | 'rewards' | null>(null);
  const [notice, setNotice] = useState('');

  const ownedBadges = new Set(rewards.badges);

  const switchChannel = (id: string) => {
    setChannelId(id);
    setMessages(loadKidChat(id));
  };

  const runClear = (target: 'memory' | 'chats' | 'rewards') => {
    if (confirmClear !== target) {
      setConfirmClear(target);
      return;
    }
    setConfirmClear(null);
    if (target === 'memory') {
      clearKidMemory();
      setNotice('已清除宝贝昵称与兴趣记忆。');
    } else if (target === 'chats') {
      clearKidChats();
      setMessages([]);
      setNotice('已清空所有本地聊天记录。');
    } else {
      const empty = emptyRewardStats();
      saveRewardStats(empty);
      setRewards(empty);
      setNotice('已重置星星与徽章进度。');
    }
  };

  return (
    <div className="space-y-6">
      {/* 成长概览与徽章墙 */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold text-slate-800">成长概览</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-amber-50 p-3.5 text-center">
            <div className="text-2xl font-extrabold text-amber-500">⭐ {rewards.stars}</div>
            <div className="mt-0.5 text-xs text-slate-500">累计星星</div>
          </div>
          <div className="rounded-2xl bg-sky-50 p-3.5 text-center">
            <div className="text-2xl font-extrabold text-sky-600">{rewards.messagesSent}</div>
            <div className="mt-0.5 text-xs text-slate-500">发送对话</div>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-3.5 text-center">
            <div className="text-2xl font-extrabold text-emerald-600">{rewards.gamesWon} / {rewards.gamesPlayed}</div>
            <div className="mt-0.5 text-xs text-slate-500">游戏通关 / 次数</div>
          </div>
          <div className="rounded-2xl bg-purple-50 p-3.5 text-center">
            <div className="text-2xl font-extrabold text-purple-600">{rewards.badges.length} / {badgeDefinitions.length}</div>
            <div className="mt-0.5 text-xs text-slate-500">已获徽章</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {badgeDefinitions.map((b) => {
            const earned = ownedBadges.has(b.id);
            return (
              <div
                key={b.id}
                className={`flex items-center gap-2.5 rounded-2xl border p-2.5 text-xs ${
                  earned ? 'border-amber-200 bg-amber-50/50 text-slate-800' : 'border-slate-100 bg-slate-50 text-slate-400'
                }`}
              >
                <span className="text-2xl" style={{ filter: earned ? undefined : 'grayscale(1)', opacity: earned ? 1 : 0.4 }}>
                  {b.emoji}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-bold">{b.name}</div>
                  <div className="truncate text-[11px]">{b.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 最近聊天记录回看 */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-slate-800">最近聊天记录回看</h2>
            <p className="text-xs text-slate-500">查看孩子最近和小伙伴们聊了些什么（每组最多保留最近 60 条本地记录）。</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {CHAT_CHANNELS.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => switchChannel(ch.id)}
              className={`h-9 rounded-xl px-3 text-xs font-bold transition ${
                channelId === ch.id
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {ch.emoji} {ch.label}
            </button>
          ))}
        </div>

        <div className="mt-4 max-h-80 space-y-2.5 overflow-y-auto rounded-2xl bg-slate-50 p-4">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">这个频道还没有本地聊天记录。</p>
          ) : (
            messages.map((m) => {
              const isKid = m.speakerId === KID_SPEAKER_ID;
              return (
                <div key={m.id} className="rounded-xl bg-white p-3 text-xs shadow-sm">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className={`font-bold ${isKid ? 'text-amber-600' : 'text-sky-600'}`}>
                      {isKid ? `🧒 ${m.speakerName || '宝贝'}` : `🤖 ${m.speakerName}`}
                    </span>
                    <span>{m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">{m.content}</p>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 数据管理 */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold text-slate-800">本机数据管理</h2>
        <p className="mt-1 text-xs text-slate-500">清空操作不可撤销，点击一次进入确认状态，再次点击执行。</p>
        {notice && <p className="mt-2 text-xs font-semibold text-emerald-600">{notice}</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => runClear('memory')}
            className={`h-10 rounded-xl px-4 text-xs font-bold ${
              confirmClear === 'memory' ? 'bg-rose-500 text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {confirmClear === 'memory' ? '确认清空昵称与兴趣？' : '清空宝贝记忆'}
          </button>
          <button
            type="button"
            onClick={() => runClear('chats')}
            className={`h-10 rounded-xl px-4 text-xs font-bold ${
              confirmClear === 'chats' ? 'bg-rose-500 text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {confirmClear === 'chats' ? '确认清空全部聊天记录？' : '清空聊天记录'}
          </button>
          <button
            type="button"
            onClick={() => runClear('rewards')}
            className={`h-10 rounded-xl px-4 text-xs font-bold ${
              confirmClear === 'rewards' ? 'bg-rose-500 text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {confirmClear === 'rewards' ? '确认重置星星与徽章？' : '重置星星和徽章'}
          </button>
          {confirmClear && (
            <button
              type="button"
              onClick={() => setConfirmClear(null)}
              className="h-10 rounded-xl px-3 text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              取消
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
