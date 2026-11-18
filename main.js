const { app, BrowserWindow, ipcMain, shell, clipboard } = require('electron');
const { exec } = require('child_process');
const https = require('https');
const si = require('systeminformation');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 860,
    backgroundColor: '#060913',
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  win.loadFile('index.html');
}

ipcMain.handle('get-system-stats', async () => {
  const [cpu, mem, bat, disk] = await Promise.all([
    si.currentLoad(), si.mem(), si.battery(), si.fsSize()
  ]);
  return {
    cpu: Math.round(cpu.currentLoad),
    ram: Math.round((mem.active / mem.total) * 100),
    battery: bat.hasBattery ? bat.percent : 100,
    isCharging: bat.isCharging,
    disk: disk.length > 0 ? Math.round(disk[0].use) : 0
  };
});

// Bilgisayarda Açık Olan Pencereleri ve Tarayıcı Sekmelerini Okuma
ipcMain.handle('get-open-windows', () => {
  return new Promise((resolve) => {
    const cmd = `powershell -NoProfile -Command "Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object ProcessName, MainWindowTitle | ConvertTo-Json -Compress"`;
    exec(cmd, { encoding: 'utf8' }, (err, stdout) => {
      if (err || !stdout.trim()) return resolve([]);
      try {
        const parsed = JSON.parse(stdout);
        resolve(Array.isArray(parsed) ? parsed : [parsed]);
      } catch (e) {
        resolve([]);
      }
    });
  });
});

function findFirstYouTubeVideo(query) {
  return new Promise((resolve) => {
    const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const match = data.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
        if (match && match[1]) resolve('https://www.youtube.com/watch?v=' + match[1] + '&autoplay=1');
        else resolve(url);
      });
    }).on('error', () => resolve(url));
  });
}

ipcMain.handle('run-action', async (event, action) => {
  if (action.type === 'yt_play') {
    const directUrl = await findFirstYouTubeVideo(action.target);
    shell.openExternal(directUrl);
  } else if (action.type === 'url') {
    shell.openExternal(action.target);
  } else if (action.type === 'app') {
    exec(`start "" "${action.target}"`);
  } else if (action.type === 'close_app') {
    exec(`taskkill /IM "${action.target}.exe" /F`);
  } else if (action.type === 'vol_up') {
    exec(`powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]175);(New-Object -ComObject WScript.Shell).SendKeys([char]175);(New-Object -ComObject WScript.Shell).SendKeys([char]175)"`);
  } else if (action.type === 'vol_down') {
    exec(`powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]174);(New-Object -ComObject WScript.Shell).SendKeys([char]174);(New-Object -ComObject WScript.Shell).SendKeys([char]174)"`);
  } else if (action.type === 'vol_mute') {
    exec(`powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"`);
  } else if (action.type === 'screenshot') {
    exec(`start ms-screenclip:`);
  } else if (action.type === 'lock') {
    exec(`rundll32.exe user32.dll,LockWorkStation`);
  }
  return true;
});

ipcMain.handle('get-clipboard', () => clipboard.readText());

app.whenReady().then(createWindow);