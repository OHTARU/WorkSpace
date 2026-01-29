import { Platform } from 'react-native';

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  args: any[];
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 500; // 최대 500개 로그 저장
  private originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  init() {
    console.log = (...args) => {
      this.addLog('info', args);
      this.originalConsole.log(...args);
    };

    console.warn = (...args) => {
      this.addLog('warn', args);
      this.originalConsole.warn(...args);
    };

    console.error = (...args) => {
      this.addLog('error', args);
      this.originalConsole.error(...args);
    };
  }

  private addLog(level: LogLevel, args: any[]) {
    const entry: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      level,
      message: args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' '),
      args,
    };

    this.logs.unshift(entry); // 최신 로그가 위로
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
  }

  getLogs() {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
  }

  exportLogs() {
    const deviceHash = `${Platform.OS}-${Platform.Version}`;
    const header = `--- LOG EXPORT ---\nTime: ${new Date().toISOString()}\nDevice: ${deviceHash}\n\n`;
    const body = this.logs.map(log => 
      `[${log.timestamp.split('T')[1].slice(0, -1)}] [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n');
    
    return header + body;
  }
}

export const logger = new Logger();
