// /api/chat — Vercel 서버리스 함수이자 로컬 server.js에서도 그대로 재사용하는 챗 핸들러.
// OpenAI 키는 이 서버 코드에서만 사용하며 클라이언트에 절대 노출되지 않는다.

const fs = require('fs');
const path = require('path');

const CHATBOT_NAME = '조은봇';
const MODEL = 'gpt-5.4-mini';
const HISTORY_LIMIT = 10; // 최근 10개 메시지(=5턴)만 유지

// uploads/*.md 를 읽어 시스템 프롬프트를 만든다. 모듈 스코프에 캐싱해
// (Vercel 웜 스타트 포함) 매 요청마다 디스크를 다시 읽지 않도록 한다.
let _systemPromptCache = null;

function findUploadsDir() {
  const candidates = [
    path.join(__dirname, '..', 'uploads'),
    path.join(process.cwd(), 'uploads'),
  ];
  for (const dir of candidates) {
    try {
      if (fs.statSync(dir).isDirectory()) return dir;
    } catch (_) {
      /* 다음 후보 시도 */
    }
  }
  return null;
}

function loadKnowledgeBase() {
  const dir = findUploadsDir();
  if (!dir) return '';
  let docs = [];
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.toLowerCase().endsWith('.md')) continue;
    // 디자인 캔버스 툴이 남긴 디자인 분석 스펙(DESIGN-*.md)은 회사 지식이 아니므로 제외한다.
    if (/^DESIGN-/i.test(file)) continue;
    const content = fs.readFileSync(path.join(dir, file), 'utf-8').trim();
    if (content) docs.push(`### 문서: ${file}\n${content}`);
  }
  return docs.join('\n\n---\n\n');
}

function buildSystemPrompt() {
  if (_systemPromptCache) return _systemPromptCache;

  const knowledge = loadKnowledgeBase();

  _systemPromptCache = `당신은 마케팅 대행사 "조은마케팅"의 웹사이트 상담 챗봇 "${CHATBOT_NAME}"입니다.

[역할]
- 홈페이지를 방문한 사장님(중소기업·소상공인)에게 조은마케팅의 서비스를 안내하고 상담을 돕습니다.
- 말투: 정중하되 친근한 존댓말. 신뢰감 70% + 친근함 30%. 어려운 전문 용어 대신 쉬운 우리말로 설명합니다.
- 답변은 간결하게(보통 2~4문장). 필요하면 짧은 목록을 사용합니다.

[답변 규칙 — 질문 유형에 따라 다르게 답합니다]
1) 자기소개·대화형 질문(예: "이름이 뭐야", "넌 뭐야", "안녕"):
   - 아래 문서가 아니라 당신의 정체성으로 자연스럽게 답합니다.
   - 예: "안녕하세요! 저는 조은마케팅 상담 도우미 ${CHATBOT_NAME}이에요. 서비스나 요금이 궁금하시면 편하게 물어보세요."
2) 서비스·요금·정책·회사 관련 질문:
   - 반드시 아래 [지식 베이스] 문서 내용만 근거로 답합니다.
   - 문서에 없는 내용은 절대 지어내지 말고, 이렇게 안내합니다:
     "그 부분은 제가 정확히 안내드리기 어려워요. 첫 진단 상담은 무료이니, 무료 상담을 신청하시면 담당자가 자세히 도와드릴게요!"
3) 서비스와 무관한 질문(예: 날씨, 일반 상식, 잡담):
   - 정중히 거절합니다: "죄송해요, 저는 조은마케팅 서비스 관련 질문만 도와드릴 수 있어요. 마케팅이나 상담이 궁금하시면 말씀해 주세요!"

[절대 금지]
- 지식 베이스 문서에 없는 가격·수치·정책·약속을 창작하지 않습니다.
- 확실하지 않으면 무료 상담을 안내합니다.

[지식 베이스]
${knowledge || '(문서가 비어 있습니다. 구체적 정보는 무료 상담을 안내하세요.)'}`;

  return _systemPromptCache;
}

// 요청 바디를 읽는다. Vercel은 req.body를 파싱해 주지만, 로컬 http 서버는
// 원시 스트림이므로 직접 읽어 파싱한다.
function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) reject(new Error('payload too large'));
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY 가 설정되지 않았습니다.');
    return sendJson(res, 500, { error: '서버 설정 오류로 잠시 후 다시 시도해 주세요.' });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (_) {
    return sendJson(res, 400, { error: '잘못된 요청입니다.' });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  // user/assistant 메시지만, 최근 10개(5턴)로 제한
  const history = incoming
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-HISTORY_LIMIT);

  if (history.length === 0) {
    return sendJson(res, 400, { error: '메시지가 비어 있습니다.' });
  }

  const messages = [{ role: 'system', content: buildSystemPrompt() }, ...history];

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: MODEL, messages }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      console.error('OpenAI API 오류:', resp.status, detail);
      return sendJson(res, 502, { error: '답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.' });
    }

    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return sendJson(res, 502, { error: '답변이 비어 있어요. 다시 시도해 주세요.' });
    }
    return sendJson(res, 200, { reply });
  } catch (e) {
    console.error('chat handler 예외:', e);
    return sendJson(res, 500, { error: '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' });
  }
};
