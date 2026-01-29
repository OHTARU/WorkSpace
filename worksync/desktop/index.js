const { app, BrowserWindow } = require('electron');
const path = require('path');

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "WorkSync",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // For simple prototype; secure apps usually enable this
    }
  });

  // 개발 중에는 로컬 웹 서버를 바라보게 설정합니다.
  // Next.js 앱이 3000번 포트에서 실행 중이어야 합니다.
  win.loadURL('http://localhost:3000');
  
  // 프로덕션 빌드 시에는 아래와 같이 정적 파일을 로드하도록 변경할 수 있습니다.
  // win.loadFile('path/to/web/out/index.html');
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
