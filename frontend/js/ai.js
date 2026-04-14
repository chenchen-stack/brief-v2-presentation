/**
 * ai.js — AI 对话 + DeepSeek API 集成 + 页面操作 + 富文本渲染
 */

/**
 * 产品内置默认大模型密钥（仅当未设置 localStorage「cf_ai_api_key」时生效，便于开箱即用）。
 * 密钥会出现在前端源码与网络请求中；公网部署请改为后端代理或自行轮换。
 */
var CF_DEFAULT_AI_API_KEY = 'sk-62b8f293509d46c4856593895e84c2af';

window.AI = {
  /** 浏览器直连大模型（OpenAI 兼容 /chat/completions）。优先走后端 /api/agent/chat。Key 存 localStorage: cf_ai_api_key */
  _dsConfig: {
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  },

  /** 启动时从 localStorage 与 window.__DEEPSEEK_API_KEY__ 合并 */
  loadStoredApiConfig: function () {
    try {
      var k = localStorage.getItem('cf_ai_api_key');
      if (k && String(k).trim()) {
        k = String(k).trim();
        this._dsConfig.apiKey = k;
        window.__DEEPSEEK_API_KEY__ = k;
      } else if (typeof CF_DEFAULT_AI_API_KEY === 'string' && CF_DEFAULT_AI_API_KEY.trim()) {
        k = CF_DEFAULT_AI_API_KEY.trim();
        this._dsConfig.apiKey = k;
        window.__DEEPSEEK_API_KEY__ = k;
      } else if (typeof window !== 'undefined' && window.__DEEPSEEK_API_KEY__) {
        this._dsConfig.apiKey = String(window.__DEEPSEEK_API_KEY__).trim();
      }
      var b = localStorage.getItem('cf_ai_base_url');
      if (b && String(b).trim()) this._dsConfig.baseUrl = String(b).trim().replace(/\/+$/, '');
      var m = localStorage.getItem('cf_ai_model');
      if (m && String(m).trim()) this._dsConfig.model = String(m).trim();
    } catch (e) {}
  },

  saveApiConfig: function (keyInput, baseUrl, model) {
    try {
      var existing = '';
      try { existing = localStorage.getItem('cf_ai_api_key') || ''; } catch (e2) {}
      var key = (keyInput && String(keyInput).trim()) ? String(keyInput).trim() : existing;
      if (key) {
        localStorage.setItem('cf_ai_api_key', key);
        this._dsConfig.apiKey = key;
        window.__DEEPSEEK_API_KEY__ = key;
      } else {
        localStorage.removeItem('cf_ai_api_key');
        this._dsConfig.apiKey = '';
        try { window.__DEEPSEEK_API_KEY__ = ''; } catch (e3) {}
      }
      var bu = (baseUrl && String(baseUrl).trim()) ? String(baseUrl).trim().replace(/\/+$/, '') : '';
      if (bu) {
        localStorage.setItem('cf_ai_base_url', bu);
        this._dsConfig.baseUrl = bu;
      } else {
        localStorage.removeItem('cf_ai_base_url');
        this._dsConfig.baseUrl = 'https://api.deepseek.com';
      }
      var mo = (model && String(model).trim()) ? String(model).trim() : '';
      if (mo) {
        localStorage.setItem('cf_ai_model', mo);
        this._dsConfig.model = mo;
      } else {
        localStorage.removeItem('cf_ai_model');
        this._dsConfig.model = 'deepseek-chat';
      }
    } catch (e) {}
  },

  _onAiKeyFile: function (ev) {
    var f = ev.target.files && ev.target.files[0];
    if (!f) return;
    var self = this;
    var r = new FileReader();
    r.onload = function () {
      var t = String(r.result || '').replace(/\r/g, '\n').split(/\n/)[0].trim();
      var inp = document.getElementById('ai-cfg-key');
      if (inp) inp.value = t;
      if (typeof Toast !== 'undefined') Toast.info('已从文件读取密钥，请点「保存」生效');
    };
    r.readAsText(f);
    try { ev.target.value = ''; } catch (e) {}
  },

  testApiConnection: function () {
    var keyEl = document.getElementById('ai-cfg-key');
    var baseEl = document.getElementById('ai-cfg-base');
    var modelEl = document.getElementById('ai-cfg-model');
    if (!keyEl || !baseEl || !modelEl) return;
    var key = (keyEl.value || '').trim();
    if (!key) {
      try { key = localStorage.getItem('cf_ai_api_key') || ''; } catch (e) {}
    }
    if (!key && typeof CF_DEFAULT_AI_API_KEY === 'string') key = CF_DEFAULT_AI_API_KEY.trim();
    if (!key) {
      if (typeof Toast !== 'undefined') Toast.warn('请先填写 API Key');
      return;
    }
    var base = (baseEl.value || '').trim().replace(/\/+$/, '') || 'https://api.deepseek.com';
    var model = (modelEl.value || '').trim() || 'deepseek-chat';
    if (typeof Toast !== 'undefined') Toast.info('正在测试连接…');
    var self = this;
    fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 8,
      }),
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t || String(r.status)); });
      return r.json();
    }).then(function () {
      if (typeof Toast !== 'undefined') Toast.success('连接成功，可保存配置');
    }).catch(function (err) {
      if (typeof Toast !== 'undefined') Toast.warn('失败：' + (err && err.message ? err.message : String(err)));
    });
  },

  openApiKeySettings: function () {
    if (typeof window.openModal !== 'function') {
      if (typeof Toast !== 'undefined') {
        Toast.warn('页面未就绪，请稍后重试');
      }
      return;
    }
    this.loadStoredApiConfig();
    var curKey = '';
    try { curKey = localStorage.getItem('cf_ai_api_key') || ''; } catch (e) {}
    var curBase = this._dsConfig.baseUrl || 'https://api.deepseek.com';
    var curModel = this._dsConfig.model || 'deepseek-chat';
    var activeKey = curKey || (this._dsConfig.apiKey || '');
    var masked = activeKey
      ? (curKey ? (activeKey.slice(0, 6) + '…' + activeKey.slice(-4)) : '产品内置默认（' + activeKey.slice(0, 6) + '…' + activeKey.slice(-4) + '）')
      : '未配置';
    var body =
      '<div class="form-group"><label>API Key</label>' +
      '<input type="password" class="form-input" id="ai-cfg-key" placeholder="sk-…" autocomplete="off" />' +
      '<p class="muted" style="font-size:11px;margin:6px 0 0;">当前生效：<strong>' + masked + '</strong> · 自定义密钥仅存本机 · 留空确认则保留当前生效密钥</p>' +
      '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">' +
      '<input type="file" id="ai-cfg-file" accept=".txt,.key,text/plain" style="display:none" />' +
      '<button type="button" class="btn btn-sm" id="ai-cfg-import">从文件导入</button>' +
      '<button type="button" class="btn btn-sm" id="ai-cfg-test">测试连接</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" id="ai-cfg-clear">清除本地密钥</button>' +
      '</div></div>' +
      '<div class="form-group"><label>Base URL（OpenAI 兼容）</label>' +
      '<input type="text" class="form-input" id="ai-cfg-base" value="' + String(curBase).replace(/"/g, '&quot;') + '" placeholder="https://api.deepseek.com" /></div>' +
      '<div class="form-group"><label>模型 ID</label>' +
      '<input type="text" class="form-input" id="ai-cfg-model" value="' + String(curModel).replace(/"/g, '&quot;') + '" placeholder="deepseek-chat" /></div>' +
      '<p class="muted" style="font-size:12px;line-height:1.55;margin:0;">保存后：密钥会随请求传给后端 <code>/api/agent/chat</code>（与服务器环境变量 <code>DEEPSEEK_API_KEY</code> 二选一），用于 DataAgent 完整推理；若后端仍不可用，协作区会回退为浏览器直连大模型。公网部署建议由后端代理以保护密钥。</p>';

    var self = this;
    window.openModal('AI 大模型 API', body, function () {
      var key = document.getElementById('ai-cfg-key').value.trim();
      var base = document.getElementById('ai-cfg-base').value.trim();
      var model = document.getElementById('ai-cfg-model').value.trim();
      self.saveApiConfig(key, base, model);
      window.closeModal();
      if (typeof Toast !== 'undefined') Toast.success('已保存');
    });

    setTimeout(function () {
      var imp = document.getElementById('ai-cfg-import');
      var fi = document.getElementById('ai-cfg-file');
      var tst = document.getElementById('ai-cfg-test');
      var clr = document.getElementById('ai-cfg-clear');
      if (fi && imp) {
        imp.addEventListener('click', function () { fi.click(); });
        fi.addEventListener('change', function (ev) { self._onAiKeyFile(ev); });
      }
      if (tst) tst.addEventListener('click', function () { self.testApiConnection(); });
      if (clr) {
        clr.addEventListener('click', function () {
          try {
            localStorage.removeItem('cf_ai_api_key');
            localStorage.removeItem('cf_ai_base_url');
            localStorage.removeItem('cf_ai_model');
          } catch (e) {}
          self.loadStoredApiConfig();
          window.closeModal();
          if (typeof Toast !== 'undefined') Toast.success('已清除本地自定义配置，恢复产品默认密钥');
        });
      }
    }, 0);
  },

  _history: [],
  _maxHistory: 10,

  _bodyEl: function () {
    return document.getElementById('copilot-messages') || document.getElementById('ai-body');
  },
  _inputEl: function () {
    return document.getElementById('copilot-input') || document.getElementById('ai-input');
  },
  _sendBtnEl: function () {
    return document.getElementById('copilot-send') || document.getElementById('ai-send-btn');
  },

  _parseAiPanelPx: function (shell) {
    var v = (getComputedStyle(shell).getPropertyValue('--ai-panel-w') || '').trim();
    var n = parseFloat(v);
    return isNaN(n) ? 440 : n;
  },

  /** 拖拽或窗口变化时更新右栏宽度（写入 --ai-panel-w 与 localStorage） */
  _applyAiPanelWidth: function (w) {
    var shell = document.getElementById('app-shell');
    if (!shell) return;
    var min = 260;
    var vw = window.innerWidth || document.documentElement.clientWidth || 1200;
    var max = Math.max(min, Math.min(720, vw - 300));
    w = Math.max(min, Math.min(max, Math.round(Number(w))));
    shell.style.setProperty('--ai-panel-w', w + 'px');
    try { localStorage.setItem('cf_ai_panel_w', String(w)); } catch (e) {}
  },

  _restoreAiPanelWidth: function () {
    var shell = document.getElementById('app-shell');
    if (!shell) return;
    var w = null;
    try {
      var s = localStorage.getItem('cf_ai_panel_w');
      if (s) w = parseInt(s, 10);
    } catch (e) {}
    if (w != null && !isNaN(w)) this._applyAiPanelWidth(w);
  },

  _resizeChartsAfterLayout: function (delay) {
    delay = typeof delay === 'number' ? delay : 400;
    setTimeout(function () {
      try {
        if (window.Charts && Charts._instances) {
          Object.keys(Charts._instances).forEach(function (k) {
            Charts._instances[k].resize();
          });
        }
      } catch (e) {}
    }, delay);
  },

  _initAiPanelResize: function () {
    var handle = document.getElementById('ai-resize-handle');
    var shell = document.getElementById('app-shell');
    if (!handle || !shell) return;
    var dragging = false;
    var startX = 0;
    var startW = 0;
    var self = this;
    function onMove(e) {
      if (!dragging) return;
      var w = startW - (e.clientX - startX);
      self._applyAiPanelWidth(w);
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      shell.classList.remove('ai-resizing');
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      self._resizeChartsAfterLayout(80);
    }
    handle.addEventListener('mousedown', function (e) {
      if (!shell.classList.contains('ai-open')) return;
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      var panel = document.getElementById('ai-panel');
      startW = panel ? panel.getBoundingClientRect().width : self._parseAiPanelPx(shell);
      shell.classList.add('ai-resizing');
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    var winResizeT;
    window.addEventListener('resize', function () {
      clearTimeout(winResizeT);
      winResizeT = setTimeout(function () {
        if (!shell.classList.contains('ai-open')) return;
        self._applyAiPanelWidth(self._parseAiPanelPx(shell));
      }, 120);
    });
  },

  /** 协作区消息内 [文字](cf-page:xxx) / [文字](cf-action:xxx) / 外链 的点击委托 */
  _bindCopilotMessageActions: function () {
    var body = document.getElementById('copilot-messages');
    if (!body || body._cfMsgBound) return;
    body._cfMsgBound = true;
    body.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-cf-page]');
      if (a) {
        e.preventDefault();
        var page = (a.getAttribute('data-cf-page') || '').replace(/[^a-z0-9_-]/gi, '');
        if (page) AI._exec({ action: 'navigate', page: page });
        return;
      }
      var btn = e.target.closest('button[data-cf-cmd]');
      if (btn) {
        e.preventDefault();
        var raw = btn.getAttribute('data-cf-cmd');
        if (!raw) return;
        try {
          var cmd = JSON.parse(decodeURIComponent(raw));
          AI._exec(cmd);
        } catch (err1) {
          try { AI._exec(JSON.parse(raw)); } catch (err2) {}
        }
      }
    });
  },

  init: function () {
    this.loadStoredApiConfig();
    this._restoreAiPanelWidth();
    this._initAiPanelResize();
    this._bindCopilotMessageActions();
    var floatBtn = document.getElementById('ai-float-toggle');
    if (floatBtn) {
      floatBtn.addEventListener('click', function () {
        AI.toggleDrawer(true);
        if (window.Copilot && Copilot.openTab) Copilot.openTab('chat');
      });
    }
    var closeBtn = document.getElementById('ai-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function () { AI.toggleDrawer(false); });
    var sendBtn = this._sendBtnEl();
    if (sendBtn) sendBtn.addEventListener('click', function () { AI.send(); });
    var inp = this._inputEl();
    if (inp) {
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); AI.send(); }
      });
    }
    var msgRoot = document.getElementById('copilot-messages');
    if (msgRoot) {
      msgRoot.addEventListener('click', function (ev) {
        var chip = ev.target && ev.target.closest ? ev.target.closest('.copilot-q-chip') : null;
        if (!chip || !msgRoot.contains(chip)) return;
        ev.preventDefault();
        var q = (chip.getAttribute('data-copilot-q') || chip.textContent || '').trim();
        if (!q) return;
        var ta = AI._inputEl();
        if (ta) {
          ta.value = q;
          ta.focus();
        }
        AI.send();
      });
    }
    try {
      var sp = new URLSearchParams(window.location.search || '');
      if (sp.get('ai') === '1') {
        setTimeout(function () {
          AI.toggleDrawer(true);
          if (window.Copilot && Copilot.openTab) Copilot.openTab('chat');
        }, 500);
      }
    } catch (e) {}
  },

  toggleDrawer: function (open) {
    var shell = document.getElementById('app-shell');
    if (open) {
      shell.classList.add('ai-open');
      this._applyAiPanelWidth(this._parseAiPanelPx(shell));
    } else {
      shell.classList.remove('ai-open');
    }
    this._resizeChartsAfterLayout(400);
  },

  _workbenchApiBase: function () {
    try {
      var sp = new URLSearchParams(window.location.search || '');
      var q = sp.get('workbenchApi');
      if (q) {
        var u = String(q).replace(/\/+$/, '');
        try { localStorage.setItem('cf_workbench_api', u); } catch (e) {}
        return u;
      }
      var ls = localStorage.getItem('cf_workbench_api');
      if (ls) return String(ls).replace(/\/+$/, '');
    } catch (e) {}
    return '';
  },

  _copilotAgentMode: function () {
    var sel = document.getElementById('copilot-agent-select');
    if (!sel) return 'data';
    var v = sel.value || 'data';
    if (v === 'prd') return 'prd';
    if (v === 'plan') return 'plan';
    return 'data';
  },

  send: async function () {
    var input = this._inputEl();
    if (!input) return;
    var msg = (input.value || '').trim();
    if (!msg) return;
    input.value = '';
    var welcomeEl = document.getElementById('copilot-welcome');
    if (welcomeEl) welcomeEl.remove();
    var priorHistory = this._history.slice();
    this._appendMsg(msg, 'user');
    this._history.push({ role: 'user', content: msg });
    this._setLoading(true);

    var wbBase = this._workbenchApiBase();
    try {
      if (wbBase) {
        try {
          var sess = (typeof window.__CF_WORKBENCH_SESSION__ === 'string' && window.__CF_WORKBENCH_SESSION__) ? window.__CF_WORKBENCH_SESSION__ : '';
          var wResp = await fetch(wbBase + '/api/workbench/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: msg,
              role: Auth.getRoleId(),
              history: priorHistory,
              session_id: sess || undefined,
              agent_mode: this._copilotAgentMode(),
            }),
          });
          if (!wResp.ok) {
            if (wResp.status === 404) try { window.__CF_WORKBENCH_SESSION__ = ''; } catch (e) {}
            throw new Error('workbench ' + wResp.status);
          }
          var wJson = await wResp.json();
          if (wJson.session_id) window.__CF_WORKBENCH_SESSION__ = wJson.session_id;
          this._onReply(wJson.reply || '(无回复)');
          this._setLoading(false);
          return;
        } catch (wbErr) {
          console.warn('Workbench 不可用，回退主服务 /api/agent/chat', wbErr);
        }
      }

      this.loadStoredApiConfig();
      var chatPayload = {
        message: msg,
        role: Auth.getRoleId(),
        history: priorHistory,
        system_prompt: this._buildSystemPrompt(),
      };
      var dk = (this._dsConfig.apiKey || '').trim();
      if (dk) chatPayload.deepseek_api_key = dk;
      var resp = await API.post('/api/agent/chat', chatPayload);
      var reply = resp.reply || '(无回复)';
      this._onReply(reply);
    } catch (_backendErr) {
      try {
        var dsReply = await this._callDeepSeek(msg);
        this._onReply(dsReply);
      } catch (_dsErr) {
        console.warn('DataAgent fallback chain:', _backendErr, _dsErr);
        var fallback = this._localFallback(msg);
        this._onReply(fallback);
      }
    }

    this._setLoading(false);
  },

  _onReply: function (text) {
    this._appendMsg(text, 'assistant');
    this._history.push({ role: 'assistant', content: text });
    if (this._history.length > this._maxHistory * 2) {
      this._history = this._history.slice(-this._maxHistory * 2);
    }
    this._parseCommands(text);
  },

  _buildSystemPrompt: function () {
    var s = AppData.stats || {};
    var role = Auth.getCurrentRole();
    var plans = AppData.plans || [];
    var alerts = (AppData.alertQueue || []).filter(function (a) { return a.status === '待处理'; });
    var health = AppData.systemHealth || {};
    var kpi = AppData.closedLoopKPI || {};

    var healthSummary = Object.keys(health).map(function (k) {
      return health[k].name + ':' + health[k].status;
    }).join(', ');

    var planSummary = plans.slice(0, 5).map(function (p) {
      return p.unit + ' ' + p.period_label + '(' + p.status + ')';
    }).join('; ');

    var alertSummary = alerts.slice(0, 3).map(function (a) {
      return a.title;
    }).join('; ');

    return [
      '你是 **DataAgent（数据智能体）**，服务于亿流科技「资金预测智能体」。你根据系统注入的实时数据回答问数类问题，并可通过 JSON 指令操作前端。',
      '当前用户角色: ' + (role ? role.name + '（' + role.id + '）' : '未知'),
      '当前用户可访问页面: ' + (role ? role.pages.join(', ') : '无'),
      '',
      '## 实时业务数据',
      '- 净头寸: ' + _fmtWan(s.net_position),
      '- 总流入: ' + _fmtWan(s.total_inflow) + '（已确认 ' + (s.confirmed || 0) + ' 笔）',
      '- 总流出: ' + _fmtWan(s.total_outflow) + '（预测 ' + (s.predicted || 0) + ' 笔，未确认 ' + (s.unconfirmed || 0) + ' 笔，待审核 ' + (s.pending_review || 0) + ' 笔）',
      '- 资金流记录: ' + (s.record_count || 0) + ' 笔',
      '- 资金计划: ' + plans.length + ' 个（' + planSummary + '）',
      '- 待处理预警: ' + alerts.length + ' 条' + (alertSummary ? '（' + alertSummary + '）' : ''),
      '- 闭环KPI: 偏差收敛' + (kpi.deviation_converge_months || '-') + '月, 预警处理' + (kpi.alert_handle_avg_hours || '-') + 'h, AI采纳率' + ((kpi.ai_adopt_rate || 0) * 100).toFixed(0) + '%',
      '- 系统健康: ' + healthSummary,
      '',
      '## 你可以执行的操作指令',
      '在回复中用 ```json 代码块包裹 JSON 指令，系统会自动执行：',
      '',
      '| 操作 | 指令格式 | 说明 |',
      '|------|---------|------|',
      '| 跳转页面 | {"action":"navigate","page":"dashboard"} | 可选: dashboard/cashflow/analysis/liquidity/basedata/integration |',
      '| 运行分析 | {"action":"run_analysis"} | 自动跳转到分析页并点击运行 |',
      '| 刷新看板 | {"action":"refresh_dashboard"} | 刷新Dashboard数据 |',
      '| 批量确认 | {"action":"batch_confirm"} | 批量确认未确认资金流 |',
      '| 导出数据 | {"action":"export_csv"} | 导出当前资金流为CSV |',
      '| 新建计划 | {"action":"new_plan"} | 打开新建计划弹窗 |',
      '| 获取数据 | {"action":"fetch_data"} | 从集成系统获取数据 |',
      '| 提示消息 | {"action":"toast","type":"success","message":"xxx"} | type: success/info/warn |',
      '',
      '## 重要规则',
      '1. 用中文回复，排版清晰，善用 **加粗** 和列表；可用 ## 作为小节标题',
      '2. 当用户请求操作时（如"帮我看看计划"、"去看板"、"运行分析"、"确认资金流"），必须附带对应的 JSON 指令',
      '3. 当用户问数据相关问题，引用上面的实时数据回答，并建议跳转到对应页面',
      '4. 在正文中可写 Markdown 链接（前端会渲染为可点击）：',
      '   - 站内：[打开分析预测](cf-page:analysis)、[资金流](cf-page:cashflow)、[总览看板](cf-page:dashboard)、[资金流预测](cf-page:liquidity)、[数据集成](cf-page:integration)',
      '   - 操作：[重新运行分析](cf-action:run_analysis)、[导出 CSV](cf-action:export_csv)、[批量确认](cf-action:batch_confirm)',
      '   - 外链：[说明](https://example.com)',
      '5. 分析/预测类回答在结论后建议附 1～2 个站内链接，便于用户跳转主台',
      '6. 回复不要过长，控制在 280 字以内，结构化展示',
      '7. 当用户说"你好"或打招呼，简短回复并介绍你的能力',
    ].join('\n');
  },

  _callDeepSeek: async function () {
    var cfg = this._dsConfig;
    if (!cfg.apiKey) {
      throw new Error('未配置 __DEEPSEEK_API_KEY__，且后端不可用');
    }
    var messages = [{ role: 'system', content: this._buildSystemPrompt() }];

    this._history.forEach(function (h) {
      messages.push({ role: h.role, content: h.content });
    });

    var resp = await fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.apiKey,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1024,
        stream: false,
      }),
    });

    if (!resp.ok) {
      var errText = '';
      try { errText = await resp.text(); } catch (_) {}
      throw new Error('DeepSeek API ' + resp.status + ': ' + errText);
    }

    var data = await resp.json();
    var choice = data.choices && data.choices[0];
    if (!choice || !choice.message || !choice.message.content) {
      throw new Error('DeepSeek 返回格式异常');
    }
    return choice.message.content;
  },

  /** 资金流分析页「AI 报告」专用系统提示（与协作区人设分离） */
  ANALYSIS_REPORT_SYSTEM_PROMPT:
    '你是资深司库资金分析师。用户将提供一段「资金流分析」的 JSON 摘要（含头寸、期间、单位等）。\n' +
    '请用中文撰写 2～4 段解读：可使用 ## 小节标题与 **加粗**；可含 Markdown 列表。\n' +
    '必须严格基于摘要中的数字与时段表述，不要编造未出现的金额或单位。\n' +
    '不要输出 JSON、不要输出 ``` 代码围栏；不要输出 ```json 指令块。\n' +
    '字数控制在 450 字内。可在文末用 [打开资金流管理](cf-page:cashflow) 引导核对单据。',

  /** 资金流预测页「风险预警」区块：基于 mvp-forecast 返回摘要生成解读 */
  LIQUIDITY_RISK_ALERT_SYSTEM_PROMPT:
    '你是资深司库流动性风险助手。用户会附上「滚动日余额预测」的 JSON 摘要（含警戒线、区间最低/最高、预警日期样本、关键日抽样、月度尾部、引擎 method_note 等）。\n' +
    '请用**自然对话**口吻回复（像同事当面或微信里说明风险），**先直接回答对方关心的问题**，再用 1～2 个简短段落补充：是否触警、大致时段、安全边际与可执行的审慎动作。\n' +
    '必须基于摘要中的数字与日期，显式引用关键数据；不要编造摘要里未出现的金额、单位或日期。\n' +
    '禁止使用「执行过程」「工具调用」「data.xxx」「步骤 1/2/3」或伪代码清单；不要用三个「##」小标题堆成报告模板（避免像系统日志）。\n' +
    '如需分段，用普通换行即可，可加 **加粗** 强调关键金额；必要时用 1 条短列表列出 2～3 条建议即可。\n' +
    '若摘要含 method_note / growth / 历史月数，可**一两句话**交代模型不确定性来源，勿长篇复述技术细节。\n' +
    '若 alert_days_in_sample > 0：结合 alert_sample_dates 说明关注时段与头寸安排；若为 0：说明未触警样本但仍需留意模型误差与极端情景。\n' +
    '预警天数样本条数以摘要为准（可能截断），勿臆测总天数。\n' +
    '总字数约 280～420 字。不要输出 JSON、不要输出 ``` 代码围栏。\n' +
    '不要写成具体投资建议或承诺收益。',

  /**
   * 单次对话（不写入亿流 Work 历史），用于分析页嵌入报告等。
   * 优先 POST /api/agent/chat，失败则浏览器直连 DeepSeek（需密钥）。
   */
  chatCompletionOneShot: async function (systemPrompt, userMessage, opts) {
    opts = opts || {};
    var maxTok = opts.max_tokens != null ? Math.min(4096, Math.max(256, Number(opts.max_tokens))) : 1024;
    this.loadStoredApiConfig();
    var sys = String(systemPrompt || '').trim();
    var usr = String(userMessage || '').trim();
    if (!usr) throw new Error('empty message');
    try {
      var chatPayload = {
        message: usr,
        role: typeof Auth !== 'undefined' && Auth.getRoleId ? Auth.getRoleId() : 'treasurer',
        history: [],
        system_prompt: sys,
      };
      var dk = (this._dsConfig.apiKey || '').trim();
      if (dk) chatPayload.deepseek_api_key = dk;
      var resp = await API.post('/api/agent/chat', chatPayload);
      var reply = resp && resp.reply ? String(resp.reply).trim() : '';
      if (reply) return reply;
    } catch (e) {
      console.warn('chatCompletionOneShot /api/agent/chat', e);
    }
    var cfg = this._dsConfig;
    if (!cfg.apiKey || !String(cfg.apiKey).trim()) {
      throw new Error('NO_AI_KEY');
    }
    var resp = await fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.apiKey,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: sys || '你是资金分析师，用中文简洁回答。' },
          { role: 'user', content: usr },
        ],
        temperature: 0.65,
        max_tokens: maxTok,
        stream: false,
      }),
    });
    if (!resp.ok) {
      var errText = '';
      try { errText = await resp.text(); } catch (_) {}
      throw new Error('DeepSeek ' + resp.status + ': ' + errText);
    }
    var data = await resp.json();
    var choice = data.choices && data.choices[0];
    if (!choice || !choice.message || !choice.message.content) {
      throw new Error('DeepSeek 返回格式异常');
    }
    return String(choice.message.content).trim();
  },

  /** 将 Markdown 转为 HTML（与协作区一致，不含协作区后处理） */
  renderMarkdown: function (text) {
    return this._renderMarkdown(text);
  },

  /** 与协作区相同：消息内 [文字](cf-page:xxx) / cf-action 点击 */
  bindInlineLinks: function (rootEl) {
    if (!rootEl || rootEl._cfAnReportBound) return;
    rootEl._cfAnReportBound = true;
    rootEl.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-cf-page]');
      if (a) {
        e.preventDefault();
        var page = (a.getAttribute('data-cf-page') || '').replace(/[^a-z0-9_-]/gi, '');
        if (page && typeof Router !== 'undefined' && Router.navigate) Router.navigate(page);
        return;
      }
      var btn = e.target.closest('button[data-cf-cmd]');
      if (btn) {
        e.preventDefault();
        var raw = btn.getAttribute('data-cf-cmd');
        if (!raw) return;
        try {
          var cmd = JSON.parse(decodeURIComponent(raw));
          if (typeof AI !== 'undefined' && AI._exec) AI._exec(cmd);
        } catch (err1) {
          try {
            if (typeof AI !== 'undefined' && AI._exec) AI._exec(JSON.parse(raw));
          } catch (err2) {}
        }
      }
    });
  },

  _localFallback: function (msg) {
    var s = AppData.stats || {};
    var lm = msg.toLowerCase();

    if (lm.indexOf('头寸') !== -1 || lm.indexOf('余额') !== -1 || lm.indexOf('position') !== -1) {
      return '**当前资金概况**\n- 净头寸: ' + _fmtWan(s.net_position) + '\n- 总流入: ' + _fmtWan(s.total_inflow) + '\n- 总流出: ' + _fmtWan(s.total_outflow) + '\n- 记录: ' + (s.record_count || 0) + ' 笔（已确认 ' + (s.confirmed || 0) + ' / 预测 ' + (s.predicted || 0) + '）\n```json\n{"action":"navigate","page":"dashboard"}\n```';
    }
    if (lm.indexOf('外汇') !== -1 || lm.indexOf('敞口') !== -1 || lm.indexOf('fx') !== -1) {
      return '当前版本已**下线外汇敞口独立页面**。若需汇率相关分析，请到**资金流分析**或**总览看板**查看多币种资金流。\n```json\n{"action":"navigate","page":"analysis"}\n```';
    }
    if (lm.indexOf('分析') !== -1 || lm.indexOf('预测') !== -1 || lm.indexOf('运行') !== -1) {
      return '## 资金预测分析\n\n正在为您**运行分析预测**（复合区间），稍后在主台图表中查看走势。\n\n**快捷操作** [打开分析预测页](cf-page:analysis) · [重新运行](cf-action:run_analysis)\n\n```json\n{"action":"run_analysis"}\n```';
    }
    if (lm.indexOf('确认') !== -1 && (lm.indexOf('资金') !== -1 || lm.indexOf('批量') !== -1)) {
      return '正在为您**批量确认**未确认的资金流记录...\n```json\n{"action":"batch_confirm"}\n```';
    }
    if (lm.indexOf('导出') !== -1 || lm.indexOf('export') !== -1) {
      return '正在为您**导出资金流数据**...\n```json\n{"action":"export_csv"}\n```';
    }
    if (lm.indexOf('计划') !== -1 || lm.indexOf('plan') !== -1) {
      var plans = AppData.plans || [];
      return '## 资金计划状态汇总\n\n**资金计划**（共 ' + plans.length + ' 个）\n' + plans.slice(0, 5).map(function (p) { return '- ' + p.unit + ' ' + p.period_label + '（' + p.status + '）'; }).join('\n') + '\n\n**快捷操作** [打开资金计划](cf-page:plan)\n\n```json\n{"action":"navigate","page":"plan"}\n```';
    }
    if (lm.indexOf('流入') !== -1 || lm.indexOf('流出') !== -1 || lm.indexOf('资金流') !== -1) {
      return '**资金流概况**\n- 总流入: ' + _fmtWan(s.total_inflow) + '\n- 总流出: ' + _fmtWan(s.total_outflow) + '\n\n跳转到资金流管理。\n```json\n{"action":"navigate","page":"cashflow"}\n```';
    }
    if (lm.indexOf('看板') !== -1 || lm.indexOf('概览') !== -1 || lm.indexOf('总览') !== -1 || lm.indexOf('dashboard') !== -1) {
      return '为您跳转到**总览看板**。\n```json\n{"action":"navigate","page":"dashboard"}\n```';
    }
    if (lm.indexOf('刷新') !== -1) {
      return '正在为您**刷新数据**...\n```json\n{"action":"refresh_dashboard"}\n```';
    }
    if (lm.indexOf('获取') !== -1 && lm.indexOf('数据') !== -1) {
      return '正在从集成系统**获取数据**...\n```json\n{"action":"fetch_data"}\n```';
    }
    if (lm.indexOf('帮助') !== -1 || lm.indexOf('help') !== -1 || lm.indexOf('你能') !== -1 || lm.indexOf('你会') !== -1) {
      return '**DataAgent 可以帮你：**\n- 📊 查询头寸、资金流（接后端工具读库）\n- 🔬 运行分析预测\n- 📈 资金流预测\n- ✅ 批量确认 / 导出\n- 🔗 跳转页面\n\n试试「**帮我看看头寸**」或「**运行分析**」。';
    }

    return '收到您的问题。当前在**离线模式**下运行，我可以帮您：\n- 查询头寸/余额\n- 运行分析预测\n- 资金流预测与集成配置\n- 导航到各页面\n\n请说得更具体些！';
  },

  /** 将 GFM 风格管道表格转为 HTML（单元格内已转义） */
  _markdownTableToHtml: function (rows) {
    var cellRich = function (s) {
      s = String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
      return s;
    };
    var splitRow = function (line) {
      var p = line.trim().split('|');
      if (p.length && p[0].trim() === '') p.shift();
      if (p.length && p[p.length - 1].trim() === '') p.pop();
      return p.map(function (x) { return x.trim(); });
    };
    var isSep = function (line) {
      var cells = splitRow(line);
      return (
        cells.length > 0 &&
        cells.every(function (c) {
          return /^[\s\-:]+$/.test(c);
        })
      );
    };
    if (!rows || rows.length < 2) return '';
    var header = splitRow(rows[0]);
    var dataStart = 1;
    if (rows.length > 1 && isSep(rows[1])) dataStart = 2;
    var body = rows.slice(dataStart).filter(function (r) {
      return !isSep(r);
    });
    var hLen = header.length;
    if (hLen === 0) return '';
    var sb =
      '<div class="ai-md-table-wrap"><table class="ai-md-table"><thead><tr>';
    header.forEach(function (h) {
      sb += '<th>' + cellRich(h) + '</th>';
    });
    sb += '</tr></thead><tbody>';
    body.forEach(function (r) {
      var cells = splitRow(r);
      sb += '<tr>';
      for (var c = 0; c < hLen; c++) {
        sb += '<td>' + cellRich(cells[c] !== undefined ? cells[c] : '') + '</td>';
      }
      sb += '</tr>';
    });
    sb += '</tbody></table></div>';
    return sb;
  },

  /**
   * 提取 Markdown 表格块（支持行首带列表符 `- ` 的误格式，会先剥离再识别）
   * 返回 { text: 带占位符的正文, tables: HTML 片段数组 }
   */
  _extractMarkdownTables: function (text) {
    var self = this;
    var tables = [];
    var lines = text.split(/\r?\n/);
    var out = [];
    var i = 0;
    while (i < lines.length) {
      var raw = lines[i];
      var stripped = raw.replace(/^\s*[-*]\s+/, '').trim();
      if (stripped.indexOf('|') !== -1 && /^\|/.test(stripped)) {
        var block = [];
        var j = i;
        while (j < lines.length) {
          var L = lines[j].replace(/^\s*[-*]\s+/, '').trim();
          if (L.indexOf('|') !== -1 && /^\|/.test(L)) {
            block.push(L);
            j++;
          } else break;
        }
        if (block.length >= 2) {
          tables.push(self._markdownTableToHtml(block));
          out.push('\uE010TBL' + (tables.length - 1) + '\uE011');
          i = j;
          continue;
        }
      }
      out.push(raw);
      i++;
    }
    return { text: out.join('\n'), tables: tables };
  },

  _renderMarkdown: function (text) {
    var clean = text.replace(/```json[\s\S]*?```/g, '').trim();
    if (!clean) clean = text;

    var links = [];
    clean = clean.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (match, label, url) {
      var i = links.length;
      links.push({ label: label, url: url.trim() });
      return '\uE000' + i + '\uE001';
    });

    var tabEx = this._extractMarkdownTables(clean);
    clean = tabEx.text;
    var mdTables = tabEx.tables;

    var html = clean
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^### (.+)$/gm, '<div class="ai-h3">$1</div>')
      .replace(/^## (.+)$/gm, '<div class="ai-h2">$1</div>')
      .replace(/\n/g, '<br>');

    html = html.replace(/((?:<br>)?- .+(?:<br>- .+)*)/g, function (block) {
      var items = block.split('<br>').filter(function (l) { return l.trim(); });
      return '<ul class="ai-list">' + items.map(function (item) {
        return '<li>' + item.replace(/^-\s*/, '').trim() + '</li>';
      }).join('') + '</ul>';
    });

    html = html.replace(/((?:<br>)?• .+(?:<br>• .+)*)/g, function (block) {
      var items = block.split('<br>').filter(function (l) { return l.trim(); });
      return '<ul class="ai-list">' + items.map(function (item) {
        return '<li>' + item.replace(/^•\s*/, '').trim() + '</li>';
      }).join('') + '</ul>';
    });

    html = html.replace(/<br><br>/g, '<br>');
    html = html.replace(/^<br>/, '').replace(/<br>$/, '');

    html = html.replace(/\uE010TBL(\d+)\uE011/g, function (m, num) {
      var idx = parseInt(num, 10);
      return mdTables[idx] || '';
    });

    html = html.replace(/\uE000(\d+)\uE001/g, function (m, numStr) {
      var ph = links[parseInt(numStr, 10)];
      if (!ph) return '';
      var labelEsc = ph.label
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      var u = ph.url;
      if (/^cf-page:/i.test(u)) {
        var page = u.slice(8).replace(/[^a-z0-9_-]/gi, '');
        return '<a href="#" class="ai-inline-link" data-cf-page="' + page + '">' + labelEsc + '</a>';
      }
      if (/^cf-action:/i.test(u)) {
        var act = u.slice(10).replace(/[^a-z0-9_]/gi, '');
        var cmd = JSON.stringify({ action: act });
        return '<button type="button" class="ai-inline-btn" data-cf-cmd="' + encodeURIComponent(cmd) + '">' + labelEsc + '</button>';
      }
      if (/^https?:\/\//i.test(u)) {
        var safe = u.replace(/[\s"'<>`]/g, '');
        return '<a href="' + safe.replace(/"/g, '&quot;') + '" class="ai-inline-link ai-inline-link-ext" target="_blank" rel="noopener noreferrer">' + labelEsc + '</a>';
      }
      return '<span class="ai-inline-muted">' + labelEsc + '</span>';
    });

    return html;
  },

  /** 协作区：关键金额与趋势词高亮（在 Markdown 生成之后执行） */
  _postprocessCopilotHtml: function (html) {
    if (!html) return html;
    try {
      html = html.replace(/(\d+(?:,\d{3})*(?:\.\d+)?[亿万](?:元)?)/g, '<span class="ai-kpi">$1</span>');
      html = html.replace(/(上升|增长|回升|走高|扩大|攀升)/g, '<span class="ai-trend ai-trend-up">$1</span>');
      html = html.replace(/(下降|回落|收窄|走低|减少|下滑)/g, '<span class="ai-trend ai-trend-down">$1</span>');
    } catch (e) {}
    return html;
  },

  _appendMsg: function (text, role) {
    var body = this._bodyEl();
    if (!body) return;
    var el = document.createElement('div');
    el.className = 'ai-msg ' + role + ' ai-msg-enter';

    if (role === 'assistant') {
      var richClass = body.id === 'copilot-messages' ? ' ai-msg-rich' : '';
      var avatarHtml = '<div class="ai-msg-avatar">🤖</div>';
      if (body.id === 'copilot-messages') {
        avatarHtml = '<div class="ai-msg-avatar copilot-msg-avatar-svg" aria-hidden="true"><svg width="22" height="22"><use href="#copilot-ico-agent"/></svg></div>';
      }
      var mdHtml = this._renderMarkdown(text);
      if (body.id === 'copilot-messages') mdHtml = this._postprocessCopilotHtml(mdHtml);
      el.innerHTML = avatarHtml + '<div class="ai-msg-content' + richClass + '">' + mdHtml + '</div>';
    } else {
      el.innerHTML = '<div class="ai-msg-content">' + text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
    }

    body.appendChild(el);
    requestAnimationFrame(function () { el.classList.remove('ai-msg-enter'); });
    var wrap = body.closest('.copilot-chat-scroll');
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
    else body.scrollTop = body.scrollHeight;
  },

  _setLoading: function (on) {
    var btn = this._sendBtnEl();
    var body = this._bodyEl();
    if (btn) {
      btn.disabled = on;
      if (btn.id === 'copilot-send') {
        if (on) {
          btn.textContent = '…';
        } else {
          btn.innerHTML = '<svg width="18" height="18" aria-hidden="true"><use href="#copilot-ico-send"/></svg>';
        }
      } else {
        btn.textContent = on ? '...' : '发送';
      }
    }

    var existing = document.getElementById('ai-typing');
    if (on && !existing && body) {
      var dot = document.createElement('div');
      dot.id = 'ai-typing';
      dot.className = 'ai-msg assistant ai-typing';
      var av = document.getElementById('copilot-messages') === body
        ? '<div class="ai-msg-avatar copilot-msg-avatar-svg" aria-hidden="true"><svg width="22" height="22"><use href="#copilot-ico-agent"/></svg></div>'
        : '<div class="ai-msg-avatar">🤖</div>';
      dot.innerHTML = av + '<div class="ai-msg-content"><span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span></div>';
      body.appendChild(dot);
      var wrap2 = body.closest('.copilot-chat-scroll');
      if (wrap2) wrap2.scrollTop = wrap2.scrollHeight;
      else body.scrollTop = body.scrollHeight;
    } else if (!on && existing) {
      existing.remove();
    }
  },

  /** 等待 DOM 上出现目标按钮后再 click，避免固定延时竞态 */
  _waitClickEl: function (elementId, maxAttempts, intervalMs) {
    maxAttempts = maxAttempts || 50;
    intervalMs = intervalMs || 40;
    var n = 0;
    function tick() {
      var el = document.getElementById(elementId);
      if (el) {
        try { el.click(); } catch (e) {}
        return;
      }
      n += 1;
      if (n < maxAttempts) setTimeout(tick, intervalMs);
    }
    tick();
  },

  _parseCommands: function (text) {
    var re = /```json\s*\n?([\s\S]*?)```/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      try { var cmd = JSON.parse(m[1]); this._exec(cmd); } catch (e) {}
    }
  },

  _exec: function (cmd) {
    if (!cmd || !cmd.action) return;
    switch (cmd.action) {
      case 'navigate':
        if (cmd.page && Auth.hasPage(cmd.page)) {
          Router.navigate(cmd.page);
          Toast.info('已跳转: ' + cmd.page);
        }
        break;
      case 'run_analysis':
        Router.ensurePageThen('analysis', function () {
          AI._waitClickEl('an-btn-run');
        });
        Toast.info('已打开资金流分析');
        break;
      case 'refresh_dashboard':
        Router.ensurePageThen('dashboard', function () {
          var run = function () {
            var btn = document.getElementById('dash-btn-refresh');
            if (btn) btn.click();
          };
          if (window.loadFromBackend) {
            window.loadFromBackend().then(run).catch(run);
          } else {
            run();
          }
        });
        Toast.info('已刷新看板');
        break;
      case 'batch_confirm':
        Router.ensurePageThen('cashflow', function () {
          AI._waitClickEl('cf-btn-batch-confirm');
        });
        Toast.info('已打开资金流管理');
        break;
      case 'export_csv':
        Router.ensurePageThen('cashflow', function () {
          AI._waitClickEl('cf-btn-export');
        });
        Toast.info('已打开资金流管理');
        break;
      case 'new_plan':
        Router.ensurePageThen('analysis', function () {
          AI._waitClickEl('plan-btn-new');
        });
        Toast.info('已打开资金流分析');
        break;
      case 'fetch_data':
        Router.ensurePageThen('cashflow', function () {
          AI._waitClickEl('cf-btn-fetch');
        });
        Toast.info('已打开资金流管理');
        break;
      case 'toast':
        Toast.show(cmd.type || 'info', cmd.message || '');
        break;
    }
  },
};

/** 供 app.html 内联 onclick 调用，避免侧栏叠层导致 addEventListener 不触发 */
window.__cfOpenAiSettings = function (e) {
  if (e && e.preventDefault) e.preventDefault();
  if (e && e.stopPropagation) e.stopPropagation();
  if (window.AI && typeof AI.openApiKeySettings === 'function') {
    AI.openApiKeySettings();
  } else if (typeof Toast !== 'undefined') {
    Toast.warn('AI 模块未就绪');
  }
};

function _fmtWan(v) {
  if (v == null || isNaN(v)) return '-';
  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + '亿';
  if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(1) + '万';
  return v.toLocaleString('zh-CN');
}

document.addEventListener('DOMContentLoaded', function () { AI.init(); });
