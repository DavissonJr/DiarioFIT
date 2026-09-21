// Sobe a mesma API do deploy em http://localhost:3001 para desenvolvimento.
// Uso: npm run api — o Vite já encaminha /api para cá.
// O "_" no nome impede a Vercel de publicar este arquivo como endpoint.
import 'dotenv/config';
import app from './index.js';

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API em http://localhost:${port}/api/health`));
