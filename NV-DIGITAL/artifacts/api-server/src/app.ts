import path from "node:path";
import { existsSync } from "node:fs";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp, { type Options as PinoHttpOptions } from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app = express();

// pino-http publishes an export= declaration; the cast keeps the original middleware
// usable when Vercel type-checks this ESM package with Node16/NodeNext semantics.
const pinoHttpMiddleware = pinoHttp as unknown as (
  options?: PinoHttpOptions,
) => any;

const replitOrigins = (process.env.REPLIT_DOMAINS ?? "")
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean)
  .flatMap((d) => [`https://${d}`, `http://${d}`]);

const vercelOrigins = [
  process.env.VERCEL_URL,
  process.env.VERCEL_BRANCH_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
]
  .filter((d): d is string => Boolean(d))
  .map((d) => `https://${d}`);

const allowedOrigins = [
  ...new Set([
    ...replitOrigins,
    ...vercelOrigins,
    ...(
      process.env.ALLOWED_ORIGINS ||
      "http://localhost:3000,http://127.0.0.1:3000"
    )
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  ]),
];

// In development allow localhost; in production restrict to REPLIT_DOMAINS
const corsOptions: cors.CorsOptions = {
  origin: allowedOrigins,
  credentials: true,
};

app.use(
  pinoHttpMiddleware({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
  }),
);
app.use(cors(corsOptions));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Aguarde 15 minutos." },
  skip: () => process.env.NODE_ENV === "test",
});

// A API do hospital contém respostas privadas. O proxy da Netlify não deve guardá-las.
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Netlify-CDN-Cache-Control", "no-store");
  next();
});
app.use("/api/auth/login", loginLimiter);
app.use("/api", router);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
});
const webDist =
  process.env.WEB_DIST ||
  path.resolve(import.meta.dirname, "../../lab-results/dist/public");
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
}

app.use(
  (
    error: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logger.error({ code: error?.code }, "Falha na API");
    res.status(error?.code === "23503" ? 409 : 500).json({
      error:
        error?.code === "23503"
          ? "Registo relacionado inválido ou ainda em utilização."
          : "O servidor não confirmou a operação.",
    });
  },
);

export default app;
