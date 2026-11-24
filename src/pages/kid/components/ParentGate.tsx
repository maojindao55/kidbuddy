import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  checkChallengeAnswer,
  createArithmeticChallenge,
  hasParentPin,
  unlockParentArea,
  verifyParentPin,
} from '@/config/parentGate';
import { isLessonAreaUnlocked } from '@/config/lessonGate';

export const LONG_PRESS_MS = 1500;
/** 角标下的小字必须写「长按」，否则家长只会点一下，点了没反应就以为坏了 */
const BADGE_LABEL = '长按';

/** 长按到时间才触发；松手、移出、取消都会中断。pressing 用来画进度环 */
export function useLongPress(onComplete: () => void, ms: number = LONG_PRESS_MS) {
  const [pressing, setPressing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    setPressing(false);
  }, []);

  const start = useCallback(() => {
    setPressing(true);
    timer.current = setTimeout(() => {
      setPressing(false);
      onComplete();
    }, ms);
  }, [ms, onComplete]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { pressing, start, cancel };
}

/** 长按进度环：按住时金色边框 1.5 秒内由小变大 */
export function LongPressRing({ pressing, className = 'rounded-2xl' }: { pressing: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-0 border-4 border-amber-400 ${className}`}
      style={{
        opacity: pressing ? 1 : 0,
        transform: pressing ? 'scale(1)' : 'scale(0.6)',
        transition: pressing ? `all ${LONG_PRESS_MS}ms linear` : 'all 150ms ease-out',
      }}
    />
  );
}

/** 左上角的彩虹角标：长按 1.5 秒弹出家长验证，防止孩子误触，验证通过后进入家长中心 */
export function ParentCornerBadge() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { pressing, start, cancel } = useLongPress(() => setOpen(true));

  return (
    <>
      <button
        type="button"
        aria-label="家长中心（长按 1.5 秒进入）"
        title="长按 1.5 秒进入家长中心"
        data-testid="parent-corner"
        className="relative flex h-14 w-14 shrink-0 select-none flex-col items-center justify-center gap-0.5 rounded-2xl bg-white/80 shadow-sm"
        style={{ touchAction: 'none', WebkitTouchCallout: 'none' }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onKeyDown={(e) => {
          // 键盘用户没有「按住」，回车/空格直接弹验证，安全边界仍由验证把守
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span aria-hidden className="text-2xl leading-none">🌈</span>
        <span className="text-[10px] font-bold leading-none text-slate-400">{pressing ? '别松手' : BADGE_LABEL}</span>
        <LongPressRing pressing={pressing} />
      </button>
      {open && (
        <ParentGateDialog
          onClose={() => setOpen(false)}
          onSuccess={() => {
            unlockParentArea();
            setOpen(false);
            navigate('/parent');
          }}
        />
      )}
    </>
  );
}

interface ParentGateDialogProps {
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  description?: string;
}

export function ParentGateDialog({ onClose, onSuccess, title, description }: ParentGateDialogProps) {
  const navigate = useNavigate();
  const [pinMode] = useState(() => hasParentPin());
  const [challenge, setChallenge] = useState(() => createArithmeticChallenge());
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);

  const pass = () => {
    if (onSuccess) {
      onSuccess();
      return;
    }
    unlockParentArea();
    navigate('/parent');
  };

  const submit = () => {
    if (pinMode) {
      if (verifyParentPin(answer)) {
        pass();
        return;
      }
      setWrong(true);
      setAnswer('');
      return;
    }
    if (checkChallengeAnswer(challenge, answer)) {
      pass();
      return;
    }
    setWrong(true);
    setAnswer('');
    setChallenge(createArithmeticChallenge());
  };

  const heading = title || (pinMode ? '家长密码验证' : '家长验证');
  const subtitle = description || (pinMode ? '请输入 4 位家长密码进入家长中心。' : '请家长回答下面的算术题，进入家长中心。');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6" role="dialog" aria-modal="true" aria-labelledby="parent-gate-title">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        <h2 id="parent-gate-title" className="text-xl font-bold text-slate-800">{heading}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        {!pinMode && (
          <p className="mt-5 text-center text-3xl font-bold tracking-wide text-slate-800" data-testid="parent-question">{challenge.question}</p>
        )}
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            autoFocus
            type={pinMode ? 'password' : 'text'}
            inputMode="numeric"
            maxLength={pinMode ? 4 : undefined}
            placeholder={pinMode ? '••••' : undefined}
            aria-label={pinMode ? '家长密码' : '答案'}
            data-testid={pinMode ? 'parent-pin-input' : 'parent-answer'}
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              setWrong(false);
            }}
            className="h-14 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-center text-2xl tracking-widest text-slate-700 outline-none focus:border-amber-400"
          />
          {wrong && (
            <p className="mt-2 text-center text-sm text-rose-500">
              {pinMode ? '密码不对，请再试一次。' : '答案不对，换一道题再试试。'}
            </p>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose} className="h-12 rounded-2xl bg-slate-100 text-base font-semibold text-slate-600">
              取消
            </button>
            <button type="submit" className="h-12 rounded-2xl bg-amber-400 text-base font-semibold text-white">
              确定
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * 课堂入口守卫：没解锁就把人退回首页。
 * 路由层面兜底，避免通过历史返回、内部链接或手写路径绕过首页那张卡片。
 */
export function LessonGuard({ children }: { children: ReactNode }) {
  if (!isLessonAreaUnlocked()) return <Navigate to="/" replace />;
  return <>{children}</>;
}
