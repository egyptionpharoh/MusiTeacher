// Vercel: health — فحص جاهزية الربط مع MusiTeacher (لا يكشف أي سر). افتح /api/health في المتصفح.
import { makeHandlers } from '../lib/handlers.mjs';
const h = makeHandlers();
export default function handler(req, res) { return h.health(req, res); }
