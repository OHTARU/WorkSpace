const { app, BrowserWindow, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');

let mainWindow;
let tray;
let isQuitting = false;

// 중복 실행 방지 (노션처럼 하나만 뜨게 함)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  const createWindow = () => {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 850,
      minWidth: 800,
      minHeight: 600,
      title: "WorkSync",
      // 노션처럼 깔끔한 디자인을 위해 상단 메뉴바 숨김
      autoHideMenuBar: true, 
      show: false, // 로딩 전 깜빡임 방지
      webPreferences: {
        nodeIntegration: false, // 보안 강화
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js') // 프리로드 스크립트 (필요시)
      }
    });

    // 배포된 URL 로드
    mainWindow.loadURL('https://work-space-vert.vercel.app/login');

    // 준비되면 화면 표시
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    // 'X' 버튼 클릭 시 앱을 종료하지 않고 트레이로 숨김 (노션 스타일)
    mainWindow.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault();
        mainWindow.hide();
      }
      return false;
    });

    // 외부 링크는 브라우저로 열기
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  };

  // 트레이 아이콘 설정
  const createTray = () => {
    // 아이콘이 없을 경우를 대비해 빈 이미지를 사용하거나 나중에 아이콘 파일 경로를 지정하세요.
    const icon = nativeImage.createEmpty(); 
    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'WorkSync 열기', click: () => mainWindow.show() },
      { type: 'separator' },
      { label: '종료', click: () => {
          isQuitting = true;
          app.quit();
        } 
      }
    ]);

    tray.setToolTip('WorkSync');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => mainWindow.show());
  };

  app.whenReady().then(() => {
    createWindow();
    createTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 종료 전에 트레이 아이콘 제거
app.on('before-quit', () => {
  isQuitting = true;
});
