# KidBuddy

> 面向 **5–10 岁**（兼顾 3–6 岁）的本地隐私优先 AI 语音陪伴桌面应用，基于 Tauri v2 构建，完全本地化运行。

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-v2-blue?logo=tauri" alt="Tauri v2" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Rust-2021-orange?logo=rust" alt="Rust" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/SQLite-Local-003B57?logo=sqlite" alt="SQLite" />
</p>

<p align="center">
  <a href="https://github.com/maojindao55/kidbuddy/releases/latest">
    <img src="https://img.shields.io/badge/⬇️%20立即下载-Download-FF6A00?style=for-the-badge" alt="立即下载" />
  </a>
  <a href="https://github.com/maojindao55/kidbuddy/releases">
    <img src="https://img.shields.io/github/v/release/maojindao55/kidbuddy?style=for-the-badge&label=最新版本&color=FFB300" alt="最新版本" />
  </a>
</p>

## ⬇️ 下载体验

无需配置开发环境，**下载安装包即可开箱即用**：

| 平台 | 下载 |
|------|------|
| 🍎 **macOS** | [下载 `.dmg`](https://github.com/maojindao55/kidbuddy/releases/latest)（区分 Apple Silicon / Intel） |
| 🪟 **Windows** | [下载 `.exe`](https://github.com/maojindao55/kidbuddy/releases/latest)（Windows 10 / 11 64 位） |
| 🐧 **Linux** | [下载 `.deb`](https://github.com/maojindao55/kidbuddy/releases/latest)（Ubuntu / Debian） |

> 首次打开应用，点击首页引导卡进入「家长中心」，**只需填入 1 个千问 Token Plan API Key**，即可一次配齐文本对话、云端语音朗读/识别、1v1 实时语音对话与绘本生图模型配置。

## ✨ 特性

### 儿童陪伴

- 🧸 **内置小伙伴** — 好奇博士、故事精灵、数学小熊、画画兔，各有固定人设、口头禅与专属音色；支持 1v1 对话，也支持在「小伙伴乐园」里多伙伴接话互动
- 📷 **多模态看图问答** — 支持选图、粘贴或拖拽照片/手绘画给伙伴，由支持视觉理解的模型（如 `qwen3.8-flash` / `qwen4-max`）按伙伴性格科普、讲故事或启发思路
- 🎨 **画画兔魔法画室** — 支持「说话变画」「涂鸦变魔术」4 种画风，作品保存到本地画廊后可语音夸夸、一键跳转共创绘本，还支持通过 `wan3.0-video` / `happyhorse-1.1-i2v` 「让画动起来」生成本地 MP4 动画
- 📖 **绘本魔法屋** — 共创 4 页角色一致有声绘本，支持单页重画、文字精修、逐页或整本 AI 动画化（`wan3.0-video` / `happyhorse-1.1-i2v`）、**🍿 影院模式有声连播**、生成中英双语对照，以及导出高清长图、**A4 可打印 PDF** 与 **完整有声动画视频**
- 💬 **说说小课堂** — 11 个语言表达目标、88 道 DTT 练习题，按 VB-MAPP 语言操作分层；教具槽位化（课前选一次、题面自动替换）、每节抽 4 道按「多久没练过」轮换、单题可加练或临时跳过；一节课自动生成三行记录、达标证据与家长可读的教练小结
- 🧩 **认知理解** — 12 个认知目标、96 道 DTT 练习题，从相同配对、同类配对一路到分类、特征功能、方位数量、顺序比较与因果推理；与说说小课堂共用同一套 DTT 引擎但各记一本账
- 🔒 **课堂入口门禁** — 两个训练模块都不让孩子自己进：长按 1.5 秒 + 家长/老师验证，30 分钟有效、关掉应用即重新上锁，底部导航也不放入口
- 👶 **年龄分层与儿童守则** — 3-6 岁 / 7-12 岁（5-10 岁推荐主档），所有伙伴统一前置安全守则 prompt，孩子端无法绕过
- 🎲 **合作小游戏** — 猜动物、词语接龙、故事接龙、拼图乐园（9 关 / 本地 SVG 切图），判定和星星在本地计算
- ⌨️ **PC 空格键语音 & 平板大触控** — 支持鼠标按住说话或 **PC 端长按空格键说话、松开发送**；触控区域不小于 48px
- ☁️ **千问云端语音与实时对话** —
  - **Token Plan 一码通**（`sk-sp-` Key）：`qwen3.8-flash` 等文本/视觉模型、`qwen-audio-3.0-tts-plus` 朗读、`qwen-audio-3.0-asr-flash` 识别、`qwen-audio-3.0-realtime-plus` 1v1 实时语音对话、`wan2.7-image` 插画与 `wan3.0-video` 动画
  - **百炼实时语音（可选）**：支持 `qwen-audio-3.1` / CosyVoice 童声与 Fun-ASR 边说边出字
  - API Key 经本地保险箱加密保存（浏览器预览等非桌面环境自动内部兜底 Web Speech）
- ⭐ **星星和徽章** — 过关得星星、解锁下一关，聊天和游戏里收集徽章（只存在本机）

### 家长中心

- 🔑 **一键服务配置** — 填入 1 个千问 Token Plan Key 即可完成全模态配置并实时测试连通性；高级设置可调整伙伴音色或接入其他 OpenAI 兼容服务
- ⏳ **每日护眼时长管控** — 可设每日使用时长（15–60 分钟），超时自动进入休息提醒层，需家长验证后方可延长
- 🔐 **4 位家长 PIN 锁** — 支持设置 4 位家长密码（未设置时默认使用乘法算术题拦截）
- 📊 **成长与聊天回看** — 查看星星徽章进度、回看近期聊天记录、按需清空本地数据

### 平台能力

- 🖥️ **原生桌面体验** — Tauri v2 构建，轻量高性能，内存占用远低于 Electron
- 💾 **完全本地化** — SQLite + 本地存储，数据不依赖云端，隐私安全
- 🔐 **密钥保险箱** — API Key 通过本地保险箱（Vault）加密存储，前端只引用密钥别名，不落明文

## 📦 技术栈

| 层级 | 技术 |
|------|------|
| **桌面框架** | Tauri v2 |
| **前端** | React 19 + TypeScript + Vite + TailwindCSS |
| **状态管理** | Zustand |
| **本地存储** | SQLite (rusqlite) + localStorage |
| **后端** | Rust（Tauri IPC Commands） |
| **LLM** | OpenAI 兼容多模态流式代理（Rust `llm_proxy.rs`） |
| **图像 / 视频** | Rust 千问代理（`image_http.rs` / `video_http.rs`）+ 本地 Canvas/PDF 合成导出 |
| **语音** | Rust 千问语音代理（Token Plan HTTP / 百炼实时 WebSocket / Realtime Dialog） |
| **Markdown** | 零依赖轻量儿童版解析器（`kidMarkdown.ts`，禁用 HTML / 公式 / Mermaid） |

## 💻 支持的系统

每次发版由 GitHub Actions 自动构建并在 [Releases](https://github.com/maojindao55/kidbuddy/releases) 提供以下安装包:

| 平台 | 架构 | 安装包 | 说明 |
|------|------|--------|------|
| 🍎 **macOS (Apple Silicon)** | aarch64 | `.dmg` | M1 / M2 / M3 / M4 芯片 Mac |
| 🍎 **macOS (Intel)** | x86_64 | `.dmg` | Intel 芯片 Mac |
| 🪟 **Windows** | x64 | `.exe` (NSIS) | Windows 10 / 11 64 位 |
| 🐧 **Linux** | amd64 | `.deb` | Ubuntu / Debian |

> **macOS 安装提示**:若提示「已损坏，无法打开」，在终端执行 `xattr -cr /Applications/KidBuddy.app` 后重试。
>
> **Windows 安装提示**:若 SmartScreen 弹出警告，点击「更多信息」→「仍要运行」即可。

## 🚀 从源码构建（开发者）

### 环境要求

- **Node.js** >= 18
- **Rust** >= 1.70 (通过 [rustup](https://rustup.rs/) 安装)
- **系统依赖** — 参考 [Tauri 环境配置](https://tauri.app/start/prerequisites/)

### 安装与运行

```bash
git clone https://github.com/maojindao55/kidbuddy.git
cd kidbuddy
npm install
npm run tauri dev
npm run tauri build
```

### 运行测试

```bash
npm test               # 运行全部前端单元测试
npm run test:llm       # LLM 客户端 / Markdown 渲染
npm run test:product   # 儿童端、Token Plan、时长与家长锁配置测试
npm run test:i18n      # 中英文翻译键对称性
```

## 📁 项目结构

```
kidbuddy/
├── src/                    # 前端源码 (React + TypeScript)
│   ├── components/         # 通用组件 (Markdown)
│   ├── config/             # 年龄分层、儿童守则、游戏、记忆、奖励、Token Plan、家长锁、护眼时长、语音配置
│   ├── hooks/              # 自定义 Hooks (use-theme, use-locale, use-app-version)
│   ├── i18n/               # 国际化资源 (zh-CN / en-US)
│   ├── layouts/            # 布局组件
│   ├── lib/                # 伙伴对话流、tokenPlanSetup、kidImage、pdfBuilder、visionImage、speech/ 语音抽象
│   ├── pages/
│   │   ├── kid/            # 儿童端：伙伴看图聊天、魔法画室、绘本魔法屋、说说小课堂、小游戏、星星、护眼休息层
│   │   └── parent/         # 家长中心：一键配置、模块/伙伴音色与视频模型、宝贝与护眼、成长记录、PIN 家长锁
│   ├── store/              # Zustand 状态 (aiMemberStore / providerStore)
│   ├── utils/              # 工具 (request, LLM 客户端, kidMarkdown, 凭证解析)
│   └── routes.tsx          # 路由配置
├── src-tauri/              # Rust 后端
│   └── src/
│       ├── lib.rs          # Tauri 入口 & IPC 命令注册
│       ├── db.rs           # SQLite 数据库操作
│       ├── api.rs          # 用户/成员/密钥等命令
│       ├── artworks.rs     # 魔法画室画作与绘本 SQLite 持久化
│       ├── image_http.rs   # 千问生图与沙箱图片代理
│       ├── video_http.rs   # 千问异步图生视频代理
│       ├── provider.rs     # 模型服务管理
│       ├── vault.rs        # 密钥保险箱 (API Key 加密存储)
│       ├── llm_proxy.rs    # LLM 多模态流式代理
│       ├── speech.rs       # 百炼实时语音 WebSocket 代理
│       ├── speech_http.rs  # Token Plan 语音 HTTP 代理（合成 / 识别）
│       ├── speech_dialog.rs# 1v1 实时语音对话代理
│       └── migrate.rs      # 数据迁移
├── package.json
├── tailwind.config.cjs
├── vite.config.ts
└── tsconfig.json
```

## 📄 License

MIT
