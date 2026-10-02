/**
 * CUSTSTEP · /api/ocr  (Vercel Serverless Function)
 * 계약: POST {image:"data:image/jpeg;base64,..."} → {ok:true,name,company,role,phone,email,website,country,memo}
 *       실패 시 {ok:false,error:'NO_API_KEY'|'NO_IMAGE'|'PARSE'|'UPSTREAM',detail}
 * 환경변수: ANTHROPIC_API_KEY (필수, 대표님이 Vercel에 직접 입력) · OCR_MODEL (선택)
 */
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'METHOD' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(200).json({ ok: false, error: 'NO_API_KEY' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const img = (body && body.image) || '';
  const m = String(img).match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
  if (!m) return res.status(200).json({ ok: false, error: 'NO_IMAGE' });
  if (m[2].length > 7 * 1024 * 1024) return res.status(200).json({ ok: false, error: 'NO_IMAGE', detail: 'too large' });

  const prompt = [
    'This image is a business card (it may contain the front and back stacked vertically).',
    'Extract the card owner\'s details and reply with ONLY one JSON object, no prose:',
    '{"name":"","company":"","role":"","phone":"","email":"","website":"","country":"","memo":""}',
    'Rules: keep the original language (Korean names stay in Korean). If both Korean and English appear, prefer Korean for name/company/role.',
    'company = organization or ministry/agency name (e.g. 환경부 자원순환국). role = job title (e.g. 국장, 상무).',
    'phone = mobile first, else office. country = English country name if inferable, else "".',
    'memo = other useful info in one short line (department, address, second email). Empty string when unknown.'
  ].join('\n');

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.OCR_MODEL || 'claude-sonnet-4-5',
        max_tokens: 600,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } },
          { type: 'text', text: prompt }
        ] }]
      })
    });
    const j = await r.json();
    if (!r.ok) return res.status(200).json({ ok: false, error: 'UPSTREAM', detail: (j && j.error && j.error.message) || String(r.status) });
    const text = (j.content || []).map(c => c.text || '').join('');
    const jm = text.match(/\{[\s\S]*\}/);
    if (!jm) return res.status(200).json({ ok: false, error: 'PARSE' });
    const d = JSON.parse(jm[0]);
    const pick = k => (typeof d[k] === 'string' ? d[k].trim() : '');
    return res.status(200).json({ ok: true, name: pick('name'), company: pick('company'), role: pick('role'), phone: pick('phone'),
      email: pick('email').toLowerCase(), website: pick('website'), country: pick('country'), memo: pick('memo') });
  } catch (e) {
    return res.status(200).json({ ok: false, error: 'PARSE', detail: String(e && e.message || e).slice(0, 160) });
  }
};
