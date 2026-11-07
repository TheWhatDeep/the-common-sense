// A stand-in for the Gemini API so end-to-end tests never spend real quota.
// Markers in the situation text pick the reply: MALFORMED → junk, DANGER → safety_flag.
import { createServer } from 'node:http';

export function startMockGemini(port = 8790) {
  const calls = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      const prompt = parsed?.contents?.[0]?.parts?.[0]?.text ?? '';
      calls.push({ url: req.url, key: req.headers['x-goog-api-key'], prompt });
      let text;
      if (prompt.includes('MALFORMED')) text = 'this is not json';
      else
        text = JSON.stringify({
          pillars: [
            { pillar: 1, applies: true, read: 'No harm is involved. Attending as a guest is presence and support, not participation.' },
            { pillar: 2, applies: true, read: 'You’re weighing this rather than reacting. That’s the self-check doing its job.' },
            { pillar: 3, applies: false, read: 'Not a family matter. Doesn’t apply here.' },
            { pillar: 4, applies: true, read: 'Her wedding is her domain. Respecting it asks nothing of yours.' },
          ],
          bottom_line: 'Going as a guest fits your framework. Whether you go is your call.',
          safety_flag: prompt.includes('DANGER'),
        });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }));
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, calls })));
}
