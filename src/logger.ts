import fs from "node:fs";
import path from "node:path";
import pino from "pino";

// logsディレクトリを作成
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ログファイル名（日付付き）
const logFileName = `app-${new Date().toISOString().split("T")[0]}.log`;
const logFilePath = path.join(logsDir, logFileName);

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    targets: [
      {
        target: "pino-pretty",
        level: "debug",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      },
      {
        target: "pino/file",
        level: "info",
        options: {
          destination: logFilePath,
          mkdir: true,
        },
      },
    ],
  },
});
