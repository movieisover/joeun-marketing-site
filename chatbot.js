/* 조은마케팅 floating 챗봇 위젯 — 순수 JS, 프레임워크 없음.
 * document.body 에 독립적으로 마운트되어 디자인 캔버스(DC) 컴포넌트와 충돌하지 않는다.
 * 백엔드(/api/chat)는 node server.js 또는 Vercel 환경에서만 응답한다. */
(function () {
  'use strict';
  if (window.__joeunChatbotLoaded) return;
  window.__joeunChatbotLoaded = true;

  var BOT_NAME = '조은봇';
  var WELCOME =
    '안녕하세요! 저는 조은마케팅 상담 도우미 ' +
    BOT_NAME +
    '이에요. 🌱\n서비스, 요금, 진행 과정 등 궁금한 점을 편하게 물어보세요!';
  var HISTORY_LIMIT = 10; // 최근 10개(5턴) 유지

  // role: 'user' | 'assistant' 만 저장 (서버로 보낼 이력)
  var history = [];

  // ---------- 스타일 ----------
  var css =
    '#joeun-cb,#joeun-cb *{box-sizing:border-box;font-family:"Pretendard",-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Segoe UI",sans-serif;}' +
    '#joeun-cb{position:fixed;right:24px;bottom:24px;z-index:2147483000;}' +
    '#joeun-cb-btn{width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;background:#1F7A53;' +
    'box-shadow:0 8px 24px rgba(16,84,58,0.36);display:flex;align-items:center;justify-content:center;' +
    'transition:transform .2s ease,box-shadow .2s ease;}' +
    '#joeun-cb-btn:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 12px 30px rgba(16,84,58,0.44);}' +
    '#joeun-cb-btn svg{width:28px;height:28px;}' +
    '#joeun-cb-badge{position:absolute;top:-3px;right:-3px;width:16px;height:16px;border-radius:50%;background:#F5A623;' +
    'border:2px solid #fff;display:none;}' +
    '#joeun-cb-panel{position:absolute;right:0;bottom:74px;width:380px;max-width:calc(100vw - 40px);height:560px;' +
    'max-height:calc(100vh - 120px);background:#fff;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;' +
    'box-shadow:0 24px 60px -12px rgba(16,84,58,0.4);opacity:0;transform:translateY(16px) scale(.98);' +
    'pointer-events:none;transition:opacity .26s ease,transform .26s ease;}' +
    '#joeun-cb.open #joeun-cb-panel{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}' +
    '#joeun-cb-head{background:linear-gradient(135deg,#1F7A53,#10543A);color:#fff;padding:16px 18px;display:flex;' +
    'align-items:center;gap:11px;flex-shrink:0;}' +
    '#joeun-cb-head .ava{width:38px;height:38px;border-radius:11px;background:rgba(255,255,255,0.16);display:flex;' +
    'align-items:center;justify-content:center;flex-shrink:0;}' +
    '#joeun-cb-head .ava svg{width:20px;height:20px;}' +
    '#joeun-cb-head .tit{font-size:15.5px;font-weight:800;letter-spacing:-0.02em;line-height:1.2;}' +
    '#joeun-cb-head .sub{font-size:11.5px;color:#BFE0D0;margin-top:2px;display:flex;align-items:center;gap:5px;}' +
    '#joeun-cb-head .dot{width:6px;height:6px;border-radius:50%;background:#7CE0B0;display:inline-block;}' +
    '#joeun-cb-close{margin-left:auto;background:transparent;border:none;color:#fff;cursor:pointer;opacity:.85;' +
    'width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;}' +
    '#joeun-cb-close:hover{opacity:1;background:rgba(255,255,255,0.14);}' +
    '#joeun-cb-body{flex:1;overflow-y:auto;padding:18px 16px;background:#F7FAF8;display:flex;flex-direction:column;gap:12px;}' +
    '.joeun-row{display:flex;gap:8px;max-width:84%;}' +
    '.joeun-row.bot{align-self:flex-start;}' +
    '.joeun-row.user{align-self:flex-end;flex-direction:row-reverse;}' +
    '.joeun-bubble{padding:11px 14px;border-radius:15px;font-size:14.2px;line-height:1.55;white-space:pre-wrap;word-break:break-word;}' +
    '.joeun-row.bot .joeun-bubble{background:#fff;color:#1A1A1A;border:1px solid #EAF1ED;border-top-left-radius:5px;}' +
    '.joeun-row.user .joeun-bubble{background:#1F7A53;color:#fff;border-top-right-radius:5px;}' +
    '.joeun-row.err .joeun-bubble{background:#FEF2F2;color:#B42318;border:1px solid #FBD5D2;}' +
    '#joeun-cb-foot{padding:12px;background:#fff;border-top:1px solid #EEF3F0;flex-shrink:0;}' +
    '#joeun-cb-form{display:flex;align-items:flex-end;gap:8px;background:#F4FAF7;border:1.5px solid #DCEBE3;' +
    'border-radius:14px;padding:6px 6px 6px 14px;transition:border-color .15s ease;}' +
    '#joeun-cb-form:focus-within{border-color:#1F7A53;}' +
    '#joeun-cb-input{flex:1;border:none;background:transparent;resize:none;outline:none;font-size:14px;line-height:1.5;' +
    'max-height:96px;padding:6px 0;color:#1A1A1A;}' +
    '#joeun-cb-send{width:38px;height:38px;border-radius:10px;border:none;background:#1F7A53;cursor:pointer;flex-shrink:0;' +
    'display:flex;align-items:center;justify-content:center;transition:background .15s ease;}' +
    '#joeun-cb-send:hover{background:#10543A;}' +
    '#joeun-cb-send:disabled{background:#B9D4C7;cursor:not-allowed;}' +
    '#joeun-cb-send svg{width:18px;height:18px;}' +
    '.joeun-typing{display:flex;gap:4px;padding:13px 14px;}' +
    '.joeun-typing span{width:7px;height:7px;border-radius:50%;background:#9DBCAE;animation:joeunBlink 1.2s infinite ease-in-out;}' +
    '.joeun-typing span:nth-child(2){animation-delay:.2s;}' +
    '.joeun-typing span:nth-child(3){animation-delay:.4s;}' +
    '@keyframes joeunBlink{0%,60%,100%{opacity:.3;transform:translateY(0);}30%{opacity:1;transform:translateY(-3px);}}' +
    '#joeun-cb-foot .hint{margin-top:7px;text-align:center;font-size:10.5px;color:#9AA5B1;}' +
    '@media (max-width:480px){#joeun-cb{right:16px;bottom:16px;}#joeun-cb-panel{bottom:72px;height:calc(100vh - 110px);}}';

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ---------- 아이콘 ----------
  var ICON_CHAT =
    '<svg viewBox="0 0 24 24" fill="none"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H9l-4 4v-4H6.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="9" cy="9.7" r="1.1" fill="#F5A623"/><circle cx="12.5" cy="9.7" r="1.1" fill="#fff"/><circle cx="16" cy="9.7" r="1.1" fill="#fff"/></svg>';
  var ICON_CLOSE =
    '<svg viewBox="0 0 24 24" fill="none"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var ICON_BOT =
    '<svg viewBox="0 0 24 24" fill="none"><path d="M4 16.5 L9.5 10.5 L13.5 13.5 L20 6" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="6" r="2.4" fill="#F5A623"/></svg>';
  var ICON_SEND =
    '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12l16-7-7 16-2.5-6.5L4 12z" fill="#fff"/></svg>';

  // ---------- DOM ----------
  var root = document.createElement('div');
  root.id = 'joeun-cb';
  root.innerHTML =
    '<div id="joeun-cb-panel" role="dialog" aria-label="조은마케팅 상담 챗봇">' +
    '  <div id="joeun-cb-head">' +
    '    <span class="ava">' + ICON_BOT + '</span>' +
    '    <div><div class="tit">' + BOT_NAME + '</div>' +
    '      <div class="sub"><span class="dot"></span>조은마케팅 상담 도우미</div></div>' +
    '    <button id="joeun-cb-close" aria-label="닫기">' + ICON_CLOSE + '</button>' +
    '  </div>' +
    '  <div id="joeun-cb-body"></div>' +
    '  <div id="joeun-cb-foot">' +
    '    <form id="joeun-cb-form">' +
    '      <textarea id="joeun-cb-input" rows="1" placeholder="궁금한 점을 입력해 주세요…" autocomplete="off"></textarea>' +
    '      <button id="joeun-cb-send" type="submit" aria-label="보내기">' + ICON_SEND + '</button>' +
    '    </form>' +
    '    <div class="hint">첫 진단 상담은 무료입니다 · 답변은 참고용이에요</div>' +
    '  </div>' +
    '</div>' +
    '<button id="joeun-cb-btn" aria-label="상담 챗봇 열기">' + ICON_CHAT + '<span id="joeun-cb-badge"></span></button>';
  document.body.appendChild(root);

  var btn = root.querySelector('#joeun-cb-btn');
  var badge = root.querySelector('#joeun-cb-badge');
  var panel = root.querySelector('#joeun-cb-panel');
  var closeBtn = root.querySelector('#joeun-cb-close');
  var bodyEl = root.querySelector('#joeun-cb-body');
  var form = root.querySelector('#joeun-cb-form');
  var input = root.querySelector('#joeun-cb-input');
  var sendBtn = root.querySelector('#joeun-cb-send');

  var welcomed = false;
  var loading = false;

  // ---------- 헬퍼 ----------
  function scrollDown() {
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function addMessage(role, text, isError) {
    var row = document.createElement('div');
    row.className = 'joeun-row ' + (isError ? 'err' : role === 'user' ? 'user' : 'bot');
    var bubble = document.createElement('div');
    bubble.className = 'joeun-bubble';
    bubble.textContent = text;
    row.appendChild(bubble);
    bodyEl.appendChild(row);
    scrollDown();
    return row;
  }

  function showTyping() {
    var row = document.createElement('div');
    row.className = 'joeun-row bot';
    row.id = 'joeun-typing-row';
    row.innerHTML = '<div class="joeun-bubble" style="padding:0;"><div class="joeun-typing"><span></span><span></span><span></span></div></div>';
    bodyEl.appendChild(row);
    scrollDown();
  }
  function hideTyping() {
    var t = document.getElementById('joeun-typing-row');
    if (t) t.remove();
  }

  function openPanel() {
    root.classList.add('open');
    badge.style.display = 'none';
    if (!welcomed) {
      welcomed = true;
      addMessage('assistant', WELCOME);
    }
    setTimeout(function () { input.focus(); }, 260);
  }
  function closePanel() {
    root.classList.remove('open');
  }
  function togglePanel() {
    root.classList.contains('open') ? closePanel() : openPanel();
  }

  function setLoading(on) {
    loading = on;
    sendBtn.disabled = on;
    if (on) showTyping(); else hideTyping();
  }

  // ---------- 전송 ----------
  function send() {
    var text = input.value.trim();
    if (!text || loading) return;

    addMessage('user', text);
    history.push({ role: 'user', content: text });
    input.value = '';
    autoGrow();
    setLoading(true);

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-HISTORY_LIMIT) }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (r) {
        setLoading(false);
        if (r.ok && r.data && r.data.reply) {
          addMessage('assistant', r.data.reply);
          history.push({ role: 'assistant', content: r.data.reply });
          if (history.length > HISTORY_LIMIT) history = history.slice(-HISTORY_LIMIT);
        } else {
          var msg = (r.data && r.data.error) || '답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.';
          addMessage('assistant', msg, true);
        }
      })
      .catch(function () {
        setLoading(false);
        addMessage('assistant', '네트워크 오류로 연결하지 못했어요. 잠시 후 다시 시도해 주세요.', true);
      });
  }

  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 96) + 'px';
  }

  // ---------- 이벤트 ----------
  btn.addEventListener('click', togglePanel);
  closeBtn.addEventListener('click', closePanel);
  form.addEventListener('submit', function (e) { e.preventDefault(); send(); });
  input.addEventListener('input', autoGrow);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  // ---------- 환영 메시지: 로드 1초 후 채팅창 자동 오픈 ----------
  setTimeout(function () {
    if (!root.classList.contains('open')) openPanel();
  }, 1000);
})();
