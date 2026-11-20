// Vercel: enter — المنطق كله في lib/handlers.mjs (مختبَر محليًا)
import { makeHandlers } from '../lib/handlers.mjs';
const h = makeHandlers();
export default function handler(req, res) { return h.enter(req, res); }
