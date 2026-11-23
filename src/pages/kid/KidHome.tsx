import { Link, useNavigate } from 'react-router-dom';
import { unlockParentArea } from '@/config/parentGate';
import { useKid } from './KidContext';
import { CompanionAvatar } from './components/ChatBubble';
import { PLAYGROUND_CHAT_ID } from './kidRoutes';

export default function KidHome() {
  const navigate = useNavigate();
  const { companions, companionsLoading, memory, aiConfigured, aiConfigChecked } = useKid();
  const name = memory.nickname || '小朋友';

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-8 pt-2">
      <h1 className="mb-5 text-center text-3xl font-extrabold text-slate-800">
        嗨，{name}！今天想和谁玩？
      </h1>

      {aiConfigChecked && !aiConfigured && (
        <div
          data-testid="setup-guide-card"
          className="mx-auto mb-5 flex max-w-5xl flex-wrap items-center justify-between gap-4 rounded-[32px] border-2 border-amber-300 bg-white p-5 shadow-md"
        >
          <div className="min-w-0 flex-1">
            <div className="text-xl font-extrabold text-slate-800">🔑 欢迎！请爸爸妈妈先花 1 分钟配置服务</div>
            <p className="mt-1 text-base text-slate-500">
              只需填入 1 个千问 Token Plan Key，就能一次开启伙伴聊天、语音朗读、魔法画室与绘本共创。
            </p>
          </div>
          <button
            type="button"
            data-testid="go-quick-setup"
            onClick={() => {
              unlockParentArea();
              navigate('/parent');
            }}
            className="flex h-14 shrink-0 items-center gap-2 rounded-2xl bg-amber-400 px-6 text-lg font-extrabold text-white shadow-sm active:scale-[0.98]"
          >
            去一键配置 →
          </button>
        </div>
      )}

      {/* 主力创意与成长入口：绘本魔法屋、魔法画室 & 说说小课堂 */}
      <div className="mx-auto mb-5 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link
          to="/books"
          data-testid="books-card"
          className="flex items-center gap-3 rounded-[32px] bg-gradient-to-r from-violet-400 to-fuchsia-400 p-5 text-white shadow-lg transition active:scale-[0.99]"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl" aria-hidden>
            📖
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xl font-extrabold">绘本魔法屋</div>
            <div className="text-sm opacity-95">共创 4 页中英双语绘本</div>
          </div>
          <span className="text-2xl font-extrabold" aria-hidden>→</span>
        </Link>

        <Link
          to="/draw"
          data-testid="draw-card"
          className="flex items-center gap-3 rounded-[32px] bg-gradient-to-r from-sky-400 to-cyan-500 p-5 text-white shadow-lg transition active:scale-[0.99]"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl" aria-hidden>
            🎨
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xl font-extrabold">魔法画室</div>
            <div className="text-sm opacity-95">说话与涂鸦变成绘本插画</div>
          </div>
          <span className="text-2xl font-extrabold" aria-hidden>→</span>
        </Link>

        <Link
          to="/expression"
          data-testid="expression-card"
          className="flex items-center gap-3 rounded-[32px] bg-gradient-to-r from-rose-400 to-orange-400 p-5 text-white shadow-lg transition active:scale-[0.99]"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl" aria-hidden>
            💬
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xl font-extrabold">说说小课堂</div>
            <div className="text-sm opacity-95">练语言表达，留下记录</div>
          </div>
          <span className="text-2xl font-extrabold" aria-hidden>→</span>
        </Link>
      </div>

      <Link
        to={`/chat/${PLAYGROUND_CHAT_ID}`}
        data-testid="playground-card"
        className="mx-auto mb-5 flex max-w-5xl items-center gap-4 rounded-[32px] bg-gradient-to-r from-amber-300 to-orange-300 p-5 text-white shadow-lg active:scale-[0.99]"
      >
        <div className="flex -space-x-4">
          {companions.map((c) => (
            <CompanionAvatar key={c.member.id} companion={c} size={64} />
          ))}
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-extrabold">小伙伴乐园</div>
          <div className="text-base opacity-90">大家一起聊天，谁最懂就谁来回答</div>
        </div>
        <span className="ml-auto text-4xl" aria-hidden>🎪</span>
      </Link>

      {companionsLoading && companions.length === 0 ? (
        <p className="text-center text-lg text-slate-500">小伙伴们正在赶来……</p>
      ) : (
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 lg:grid-cols-4">
          {companions.map((c) => (
            <Link
              key={c.member.id}
              to={`/chat/${c.member.id}`}
              data-testid={`companion-card-${c.member.id}`}
              className="flex flex-col items-center gap-3 rounded-[32px] border-4 bg-white p-5 text-center shadow-md active:scale-[0.98]"
              style={{ borderColor: `${c.meta.color}55` }}
            >
              <CompanionAvatar companion={c} size={112} />
              <div className="text-2xl font-extrabold" style={{ color: c.meta.color }}>
                {c.meta.emoji} {c.member.name}
              </div>
              <div className="text-base leading-snug text-slate-500">{c.member.description}</div>
              <div className="rounded-full px-3 py-1 text-sm font-medium" style={{ background: `${c.meta.color}18`, color: c.meta.color }}>
                “{c.meta.catchphrase}”
              </div>
            </Link>
          ))}
        </div>
      )}

      <Link
        to="/games"
        className="mx-auto mt-5 flex max-w-5xl items-center justify-center gap-3 rounded-[32px] bg-white/80 p-5 text-2xl font-bold text-sky-600 shadow-md"
      >
        <span aria-hidden>🎲</span> 和小伙伴玩游戏
      </Link>
    </div>
  );
}
