import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isParentAreaUnlocked, lockParentArea } from '@/config/parentGate';
import SetupTab from './SetupTab';
import ChildTab from './ChildTab';
import ActivityTab from './ActivityTab';
import SecurityTab from './SecurityTab';

type ParentTabId = 'setup' | 'child' | 'activity' | 'security';

const TABS: { id: ParentTabId; label: string; emoji: string; desc: string }[] = [
  { id: 'setup', label: '服务配置', emoji: '🔑', desc: '千问 Token Plan 一键配齐' },
  { id: 'child', label: '宝贝与护眼', emoji: '🧒', desc: '档案、年龄段与时长管控' },
  { id: 'activity', label: '成长与记录', emoji: '📊', desc: '星星徽章与近期对话回看' },
  { id: 'security', label: '家长锁与关于', emoji: '🛡️', desc: '4 位 PIN 密码与隐私说明' },
];

export default function ParentArea() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ParentTabId>('setup');

  if (!isParentAreaUnlocked()) return <Navigate to="/" replace />;

  const handleBackToKids = () => {
    lockParentArea();
    navigate('/');
  };

  return (
    <div
      className="flex h-[100dvh] flex-col bg-slate-50 text-slate-800"
      style={{ fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif' }}
      data-testid="parent-center"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 pb-3 pt-[max(12px,env(safe-area-inset-top))] shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-2xl" aria-hidden>🌈</span>
          <div>
            <h1 className="text-lg font-extrabold text-slate-800">KidBuddy · 家长中心</h1>
            <p className="text-xs text-slate-500">管理模型服务、孩子档案、护眼时长与家长锁</p>
          </div>
        </div>
        <button
          type="button"
          data-testid="back-to-kids"
          onClick={handleBackToKids}
          className="flex h-10 items-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600 active:scale-[0.98]"
        >
          <span>←</span>
          <span>返回儿童端</span>
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="shrink-0 border-b border-slate-200 bg-white p-3 md:w-64 md:border-b-0 md:border-r md:p-4">
          <nav className="flex gap-2 overflow-x-auto md:flex-col" aria-label="家长中心导航">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`parent-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex shrink-0 items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left transition ${
                    active
                      ? 'bg-orange-50 text-orange-800 ring-1 ring-orange-200'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-xl" aria-hidden>{tab.emoji}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold">{tab.label}</div>
                    <div className="hidden truncate text-xs text-slate-400 md:block">{tab.desc}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-7">
          <div className="mx-auto max-w-4xl">
            {activeTab === 'setup' && <SetupTab />}
            {activeTab === 'child' && <ChildTab />}
            {activeTab === 'activity' && <ActivityTab />}
            {activeTab === 'security' && <SecurityTab />}
          </div>
        </main>
      </div>
    </div>
  );
}
