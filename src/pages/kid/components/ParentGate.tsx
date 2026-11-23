import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  checkChallengeAnswer,
  createArithmeticChallenge,
  hasParentPin,
  unlockParentArea,
  verifyParentPin,
} from '@/config/parentGate';

const BADGE_LABEL = '家长';

/** 左上角的彩虹角标：点一下弹出家长验证，验证通过后进入家长中心 */
export function ParentCornerBadge() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="家长中心（需验证）"
        title="家长中心（需验证）"
        data-testid="parent-corner"
        className="flex h-14 w-14 shrink-0 select-none flex-col items-center justify-center gap-0.5 rounded-2xl bg-white/80 shadow-sm transition hover:bg-white active:scale-95"
        style={{ touchAction: 'manipulation' }}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden className="text-2xl leading-none">🌈</span>
        <span className="text-[10px] font-bold leading-none text-slate-400">{BADGE_LABEL}</span>
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
