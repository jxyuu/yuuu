'use strict';

/**
 * Electron 主进程
 *
 * 思路：
 *   1. 在本进程内 require 后端（Express 会自动 listen）
 *   2. 数据库放到系统用户目录，不写进应用安装包（asar 里是只读的）
 *   3. 窗口加载 http://127.0.0.1:<PORT>
 *
 * 支持 `--smoke`：启动后端、请求一次 /api/health、打印结果、退出。
 * 用于在无显示环境下验证打包产物是否真的能用。
 */

const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const PORT = Number(process.env.YUUU_PORT || 4317);
const HOST = '127.0.0.1';
const isSmoke = process.argv.includes('--smoke');

// ---------- 数据目录：放到系统用户目录 ----------
// 打包后 asar 是只读的，所以数据库不能放在应用目录里。
// YUUU_USER_DATA 可用于测试或临时指定。
if (process.env.YUUU_USER_DATA) {
  app.setPath('userData', process.env.YUUU_USER_DATA);
}
const userDataDir = app.getPath('userData');
fs.mkdirSync(userDataDir, { recursive: true });
process.env.YUUU_DB = process.env.YUUU_DB || path.join(userDataDir, 'yuuu.db');
process.env.PORT = String(PORT);
process.env.HOST = HOST;

// ---------- 启动后端 ----------
let serverStarted = false;
function startBackend() {
  if (serverStarted) return;
  serverStarted = true;
  // 直接在本进程运行 Express，省掉子进程和端口协商
  require(path.join(__dirname, '..', 'server', 'index.js'));
}

// ---------- 等待后端就绪 ----------
async function waitForServer(timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`http://${HOST}:${PORT}/api/health`);
      if (res.ok) return await res.json();
    } catch {
      /* 还没起来 */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`后端在 ${timeoutMs}ms 内没有就绪（端口 ${PORT}）`);
}

// ---------- 窗口 ----------
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#f8f5f0',
    title: '个人生活助手',
    autoHideMenuBar: true,
    webPreferences: {
      // 这个应用不需要 Node 能力，保持渲染进程沙箱化
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.loadURL(`http://${HOST}:${PORT}`);

  // 外链一律用系统浏览器打开，不在应用内跳走
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------- 生命周期 ----------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      startBackend();
      const health = await waitForServer();

      if (isSmoke) {
        // 打包后的 GUI 程序看不到 stdout，所以结果同时写文件
        const payload = { ok: true, health, db: process.env.YUUU_DB, electron: process.versions.electron };
        if (process.env.YUUU_SMOKE_OUT) {
          try {
            fs.writeFileSync(process.env.YUUU_SMOKE_OUT, JSON.stringify(payload, null, 2), 'utf8');
          } catch (e) {
            console.error('写自检结果失败：', e.message);
          }
        }
        console.log('SMOKE_OK ' + JSON.stringify(health));
        app.exit(0);
        return;
      }

      createWindow();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    } catch (err) {
      console.error('启动失败：', err.message);
      app.exit(1);
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
