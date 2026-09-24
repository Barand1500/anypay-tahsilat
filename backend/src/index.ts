import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authRouter } from './routes/auth.js';
import { modulesRouter } from './routes/modules.js';
import { rolesRouter } from './routes/roles.js';
import { usersRouter } from './routes/users.js';
import { sendError } from './utils/response.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3010);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Canlıda Vite build çıktısı public/ altında servis edilir
const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));

app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { ok: true, service: 'anypay-tahsilat' } });
});

app.use('/api/auth', authRouter);
app.use('/api/modules', modulesRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/users', usersRouter);

// SPA fallback (API dışı yollar)
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'), (err) => {
    if (err) sendError(res, 404, 'Arayüz henüz derlenmemiş');
  });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  sendError(res, 500, 'Sunucu hatası');
});

app.listen(port, () => {
  console.log(`API dinleniyor: http://127.0.0.1:${port}`);
});
