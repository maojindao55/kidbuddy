import { useState } from 'react';
import {
  clearParentPin,
  hasParentPin,
  isValidPin,
  normalizePinInput,
  setParentPin,
} from '@/config/parentGate';
import { useAppVersion } from '@/hooks/use-app-version';

export default function SecurityTab() {
  const version = useAppVersion();
  const [pinEnabled, setPinEnabled] = useState(hasParentPin);
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const a = normalizePinInput(pin1);
    const b = normalizePinInput(pin2);
    if (!isValidPin(a)) {
      setError('请输入 4 位纯数字密码。');
      return;
    }
    if (a !== b) {
      setError('两次输入的密码不一致，请重新确认。');
      return;
    }
    if (setParentPin(a)) {
      setPinEnabled(true);
      setPin1('');
      setPin2('');
      setSuccess('已保存 4 位家长密码，下次进入家长中心或延长时长将使用密码验证。');
    }
  };

  const handleClearPin = () => {
    clearParentPin();
    setPinEnabled(false);
    setError('');
    setSuccess('已清除家长密码，将恢复为乘法算术题验证。');
  };

  return (
    <div className="space-y-6">
      {/* 家长密码 */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-slate-800">家长锁密码（4 位数字 PIN）</h2>
            <p className="mt-1 text-xs text-slate-500">
              对于 5–10 岁能算乘法的孩子，建议设置 4 位家长密码，替代算术题拦截。
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-0.5 text-xs font-bold ${
              pinEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {pinEnabled ? '已启用 PIN 密码' : '当前使用算术题验证'}
          </span>
        </div>

        <form onSubmit={handleSavePin} className="mt-4 max-w-sm space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-600" htmlFor="pin-1">
              {pinEnabled ? '输入新 4 位密码' : '设置 4 位密码'}
            </label>
            <input
              id="pin-1"
              data-testid="pin-input-1"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin1}
              onChange={(e) => setPin1(e.target.value)}
              placeholder="4 位数字，如 2026"
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm tracking-widest text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600" htmlFor="pin-2">
              再次输入确认
            </label>
            <input
              id="pin-2"
              data-testid="pin-input-2"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin2}
              onChange={(e) => setPin2(e.target.value)}
              placeholder="再输一遍 4 位数字"
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm tracking-widest text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </div>
          {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
          {success && <p className="text-xs font-semibold text-emerald-600">{success}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              data-testid="pin-save-btn"
              className="h-10 rounded-xl bg-orange-500 px-5 text-sm font-bold text-white hover:bg-orange-600"
            >
              {pinEnabled ? '修改密码' : '开启家长密码'}
            </button>
            {pinEnabled && (
              <button
                type="button"
                data-testid="pin-clear-btn"
                onClick={handleClearPin}
                className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                清除密码
              </button>
            )}
          </div>
        </form>
      </section>

      {/* 关于与隐私说明 */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-extrabold text-slate-800">关于与隐私保护</h2>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
          <div>当前版本：<span className="font-mono font-bold text-slate-800">v{version}</span></div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
            <li>所有 API Key 均经由本机 Rust 密钥保险箱（Vault）加密存储，只在本机与模型服务商直连通信。</li>
            <li>孩子的昵称、兴趣记忆、聊天记录、星星和徽章全部存在本机，不上传到第三方统计或云盘。</li>
            <li>本阶段已完成家长中心重构与一键配 Key，下一步将接入绘本共创工坊与本地安全过滤。</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
