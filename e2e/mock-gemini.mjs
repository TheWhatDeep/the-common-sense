// A stand-in for the Gemini API so end-to-end tests never spend real quota.
// Speaks streamGenerateContent (server-sent events) with thought summaries,
// paced so the browser can see them arrive.
// Markers in the situation text pick the reply: MALFORMED → junk, DANGER → safety_flag.
import { createServer } from 'node:http';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function startMockGemini(port = 8790, { thoughtDelayMs = 450 } = {}) {
  const calls = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      const parsed = JSON.parse(body || '{}');
      const prompt = parsed?.contents?.[0]?.parts?.[0]?.text ?? '';
      calls.push({ url: req.url, key: req.headers['x-goog-api-key'], prompt, config: parsed.generationConfig });
      const danger = prompt.includes('DANGER');
      const yesKeys = danger
        ? ['physical_harm', 'thought_through']
        : ['others_way_of_life', 'asked_to_act', 'can_be_present', 'thought_through', 'others_decision', 'can_accept'];
      const keys = ['physical_harm', 'berating', 'others_way_of_life', 'asked_to_act', 'can_be_present', 'thought_through', 'pressuring_others',
        'child_affected', 'child_unsafe', 'family_for_appearance', 'law_involved', 'others_decision', 'can_accept', 'response_would_attack'];
      const answer = prompt.includes('MALFORMED')
        ? 'this is not json'
        : JSON.stringify({
            facts: keys.map((key) => ({
              key,
              answer: yesKeys.includes(key) ? 'yes' : 'no',
              evidence: yesKeys.includes(key) ? (danger ? 'threatened to hurt me' : 'invited me to her wedding') : '',
            })),
            pillars: [
              { pillar: 1, read: 'No harm is involved. Attending as a guest is presence and support, not participation.' },
              { pillar: 2, read: 'You’re weighing this rather than reacting. That’s the self-check doing its job.' },
              { pillar: 3, read: 'Not a family matter, so this pillar doesn’t apply here.' },
              { pillar: 4, read: 'Her wedding is her domain. Respecting it asks nothing of yours.' },
            ],
            options: [
              { kind: 'attend_without_participating', text: 'You could attend as a guest; under Pillar 1, presence isn’t participation.' },
              { kind: 'decline_respectfully', text: 'You could decline while respecting her right to marry (Pillar 1).' },
              { kind: 'respect_their_choice', text: 'You could leave her choice to her; disagreement isn’t harm (Pillar 1).' },
            ],
            unclear_note: '',
            bottom_line: 'Going as a guest fits your framework. Whether you go is your call.',
            safety_flag: danger,
          });
      const chunk = (parts, finishReason) =>
        `data: ${JSON.stringify({ candidates: [{ content: { role: 'model', parts }, ...(finishReason ? { finishReason } : {}) }] })}\r\n\r\n`;

      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write(chunk([{ text: '**Checking for harm**\nThe user describes an invitation. No violence or berating is mentioned.', thought: true }]));
      await sleep(thoughtDelayMs);
      res.write(chunk([{ text: '\n\n**Weighing participation**\nAttending as a guest is presence and support, not participation.', thought: true }]));
      await sleep(thoughtDelayMs);
      res.write(chunk([{ text: '\n\n**Finding the domain**\nThe wedding belongs to the couple.', thought: true }]));
      await sleep(thoughtDelayMs);
      const half = Math.floor(answer.length / 2);
      res.write(chunk([{ text: answer.slice(0, half) }]));
      res.end(chunk([{ text: answer.slice(half) }], 'STOP'));
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, calls })));
}
