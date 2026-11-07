/* AiLocal website chat widget.
   <script src="https://YOUR-APP/widget.js" data-account="SUBACCOUNT_ID" data-color="#2563eb" async></script> */
(function () {
    var script = document.currentScript;
    if (!script || window.__ailocalChat) return;
    window.__ailocalChat = true;
    var account = script.getAttribute('data-account');
    var color = script.getAttribute('data-color') || '#2563eb';
    var api = new URL(script.src).origin + '/api/chat/' + account;
    var storeKey = 'ailocal-chat-' + account;

    function load() {
        try {
            return JSON.parse(localStorage.getItem(storeKey)) || {};
        } catch (e) {
            return {};
        }
    }
    function save(s) {
        try {
            localStorage.setItem(storeKey, JSON.stringify(s));
        } catch (e) {}
    }

    fetch(api)
        .then(function (r) {
            return r.ok ? r.json() : null;
        })
        .then(function (cfg) {
            if (cfg) mount(cfg);
        })
        .catch(function () {});

    function mount(cfg) {
        var host = document.createElement('div');
        host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483000';
        document.body.appendChild(host);
        var root = host.attachShadow({ mode: 'open' });
        root.innerHTML =
            '<style>' +
            '*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
            '.btn{width:56px;height:56px;border-radius:50%;border:0;background:' + color + ';color:#fff;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;margin-left:auto}' +
            '.panel{display:none;flex-direction:column;width:min(360px,calc(100vw - 32px));height:min(520px,calc(100vh - 100px));background:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.25);overflow:hidden;margin-bottom:12px}' +
            '.open .panel{display:flex}' +
            '.head{background:' + color + ';color:#fff;padding:14px 16px;font-weight:600;display:flex;justify-content:space-between;align-items:center}' +
            '.head button{background:none;border:0;color:#fff;font-size:20px;cursor:pointer;line-height:1}' +
            '.log{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#f8fafc}' +
            '.m{max-width:85%;padding:8px 12px;border-radius:12px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word}' +
            '.ai{background:#e2e8f0;color:#0f172a;align-self:flex-start}' +
            '.me{background:' + color + ';color:#fff;align-self:flex-end}' +
            '.typing{opacity:.6;font-style:italic}' +
            'form{display:flex;border-top:1px solid #e2e8f0}' +
            'input{flex:1;border:0;padding:12px;font-size:14px;outline:none}' +
            'form button{border:0;background:none;color:' + color + ';font-weight:600;padding:0 14px;cursor:pointer}' +
            '</style>' +
            '<div class="panel" role="dialog" aria-label="Chat"><div class="head"><span></span><button type="button" aria-label="Close">×</button></div>' +
            '<div class="log" aria-live="polite"></div>' +
            '<form><input maxlength="1000" placeholder="Type a message…" aria-label="Message"><button>Send</button></form></div>' +
            '<button class="btn" aria-label="Chat with us"><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z"/></svg></button>';

        var wrap = document.createElement('div');
        while (root.childNodes.length > 1) wrap.appendChild(root.childNodes[1]);
        root.appendChild(wrap);
        var log = root.querySelector('.log');
        var form = root.querySelector('form');
        var input = root.querySelector('input');
        root.querySelector('.head span').textContent = cfg.name;

        var state = load();
        state.history = state.history || [{ role: 'ai', text: cfg.greeting }];

        function add(role, text, extra) {
            var el = document.createElement('div');
            el.className = 'm ' + (role === 'ai' ? 'ai' : 'me') + (extra ? ' ' + extra : '');
            el.textContent = text;
            log.appendChild(el);
            log.scrollTop = log.scrollHeight;
            return el;
        }
        state.history.forEach(function (h) {
            add(h.role, h.text);
        });

        function toggle() {
            wrap.classList.toggle('open');
            if (wrap.classList.contains('open')) input.focus();
        }
        root.querySelector('.btn').addEventListener('click', toggle);
        root.querySelector('.head button').addEventListener('click', toggle);

        var busy = false;
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var text = input.value.trim();
            if (!text || busy) return;
            busy = true;
            input.value = '';
            add('me', text);
            state.history.push({ role: 'me', text: text });
            var typing = add('ai', 'Typing…', 'typing');
            fetch(api, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, sessionId: state.sessionId, token: state.token, page: location.href })
            })
                .then(function (r) {
                    return r.json();
                })
                .then(function (d) {
                    typing.remove();
                    if (d.error) {
                        add('ai', d.error);
                        if (/Session not found/.test(d.error)) {
                            state = { history: [{ role: 'ai', text: cfg.greeting }] };
                            save(state);
                        }
                        return;
                    }
                    state.sessionId = d.sessionId;
                    state.token = d.token;
                    add('ai', d.reply);
                    state.history.push({ role: 'ai', text: d.reply });
                    save(state);
                })
                .catch(function () {
                    typing.remove();
                    add('ai', 'Connection problem. Please try again.');
                })
                .finally(function () {
                    busy = false;
                });
        });
    }
})();
