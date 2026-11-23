import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { unlockParentArea } from '@/config/parentGate';
import { KidProvider, useKid } from './KidContext';
import { ParentCornerBadge, ParentGateDialog } from './components/ParentGate';

const navItems = [
  { to: '/', label: '小伙伴', emoji: '🏠', end: true },
  { to: '/books', label: '绘本屋', emoji: '📖', end: false },
  { to: '/english', label: '英语岛', emoji: '🦜', end: false },
  { to: '/expression', label: '说说小课堂', emoji: '💬', end: false },
  { to: '/draw', label: '魔法画室', emoji: '🎨', end: false },
  { to: '/games', label: '小游戏', emoji: '🎲', end: false },
  { to: '/stars', label: '我的星星', emoji: '⭐', end: false },
];

function BadgeCelebration() {
  const { celebration, dismissCelebration } = useKid();

  useEffect(() => {
    if (!celebration.length) return;
    const timer = setTimeout(dismissCelebration, 4000);
    return () => clearTimeout(timer);
  }, [celebration, dismissCelebration]);

  if (!celebration.length) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="badge-celebration"
      className="pointer-events-none fixed right-4 top-20 z-40 flex min-h-16 items-center gap-3 rounded-3xl bg-white px-5 py-3 shadow-xl ring-4 ring-amber-200"
    >
      <span className="text-3xl" aria-hidden>{celebration[celebration.length - 1].emoji}</span>
      <span className="text-left">
        <span className="block text-sm text-amber-600">得到新徽章啦！</span>
        <span className="block text-lg font-bold text-slate-800">{celebration.map((b) => b.name).join('、')}</span>
      </span>
    </div>
  );
}

function TimeLimitOverlay() {
  const navigate = useNavigate();
  const { timeStatus, extendTodayTime } = useKid();
  const [gateAction, setGateAction] = useState<'extend' | 'parent' | null>(null);

  if (!timeStatus.enabled || !timeStatus.isExceeded) return null;

  const usedMinutes = Math.max(1, Math.round(timeStatus.usedSeconds / 60));

  return (
    <div
      data-testid="time-limit-overlay"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-amber-50 via-orange-50 to-sky-100 p-6 text-center"
    >
      <div className="max-w-md rounded-[36px] bg-white/95 p-8 shadow-xl ring-4 ring-amber-200/70">
        <div className="mb-3 text-6xl" aria-hidden>🌙</div>
        <h2 className="text-3xl font-extrabold text-slate-800">眼睛休息时间到啦</h2>
        <p className="mt-3 text-lg leading-relaxed text-slate-600">
          今天已经和小伙伴一起玩了 {usedMinutes} 分钟，快离开屏幕望望远处、喝口水休息一下吧～
        </p>
        <div className="mt-7 flex flex-col gap-3">
          <button
            type="button"
            data-testid="time-extend-btn"
            onClick={() => setGateAction('extend')}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 text-lg font-extrabold text-white shadow-md active:scale-[0.98]"
          >
            ⏰ 家长延长 15 分钟
          </button>
          <button
            type="button"
            data-testid="time-parent-btn"
            onClick={() => setGateAction('parent')}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 text-lg font-bold text-slate-600 active:scale-[0.98]"
          >
            ⚙️ 进入家长中心
          </button>
        </div>
      </div>

      {gateAction && (
        <ParentGateDialog
          title={gateAction === 'extend' ? '延长使用时间' : '进入家长中心'}
          description={gateAction === 'extend' ? '请家长验证后为孩子延长 15 分钟使用时间。' : '请家长验证后调整每日护眼时长。'}
          onClose={() => setGateAction(null)}
          onSuccess={() => {
            const action = gateAction;
            setGateAction(null);
            if (action === 'extend') {
              extendTodayTime(15);
            } else {
              unlockParentArea();
              navigate('/parent');
            }
          }}
        />
      )}
    </div>
  );
}

function KidShell() {
  const { rewards, profile, timeStatus } = useKid();
  const showRemaining = timeStatus.enabled && !timeStatus.isExceeded && timeStatus.remainingSeconds <= 300;
  const remainingMinutes = Math.max(1, Math.ceil(timeStatus.remainingSeconds / 60));

  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden bg-gradient-to-b from-amber-50 via-orange-50 to-sky-50 text-slate-800"
      style={{ fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif' }}
      data-age-band={profile.band}
    >
      <header className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <ParentCornerBadge />
        <nav className="flex min-w-0 flex-1 justify-center gap-1.5 overflow-x-auto xl:gap-2" aria-label="儿童导航">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-14 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[15px] font-bold transition xl:gap-1.5 xl:px-4 xl:text-lg ${
                  isActive ? 'bg-amber-400 text-white shadow-md' : 'bg-white/70 text-slate-600'
                }`
              }
            >
              <span aria-hidden>{item.emoji}</span>
              <span className="hidden md:inline">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        {showRemaining && (
          <div
            data-testid="time-remaining-pill"
            className="hidden h-12 shrink-0 items-center gap-1 rounded-2xl bg-sky-100 px-3 text-sm font-bold text-sky-700 sm:flex"
          >
            <span aria-hidden>⏳</span>
            <span>还剩 {remainingMinutes} 分钟</span>
          </div>
        )}
        <div className="flex h-14 shrink-0 items-center gap-1 rounded-2xl bg-white/80 px-4 text-xl font-bold text-amber-500 shadow-sm" data-testid="star-total" aria-label={`星星 ${rewards.stars} 颗`}>
          <span aria-hidden>⭐</span>
          {rewards.stars}
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
      <BadgeCelebration />
      <TimeLimitOverlay />
    </div>
  );
}

export default function KidLayout() {
  return (
    <KidProvider>
      <KidShell />
    </KidProvider>
  );
}
