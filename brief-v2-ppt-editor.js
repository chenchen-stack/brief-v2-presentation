/**
 * brief-v2.html：幻灯片编辑器（排序 / 删除 / 导出）+ 演示视图 + 投屏提词器同步
 * 依赖：deck.js 先加载，本脚本覆盖其键盘与点击导航。
 */
(function () {
  var deck = document.getElementById("deck");
  if (!deck) return;

  var CHANNEL = "yiliu-brief-v2-deck";
  var bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;

  function postSlideIndex(i) {
    if (bc) bc.postMessage({ type: "slide", index: i });
    try {
      localStorage.setItem("ylBriefV2Slide", String(i));
    } catch (e) {}
  }

  /* ── 仅提词器窗口（?prompter=1）：可点击 / 键盘翻页，并反向同步主讲窗口 ── */
  if (document.documentElement.classList.contains("ppt-prompter-root")) {
    var layout = document.getElementById("ppt-editor-layout");
    if (layout) layout.style.display = "none";
    var panel = document.getElementById("ppt-prompter-panel");
    if (panel) panel.style.display = "flex";
    var idxEl = document.getElementById("ppt-prompter-idx");
    var bodyEl = document.getElementById("ppt-prompter-body");
    var curI = 0;
    /** 与 brief-v2-讲稿 + 章节扉页口播 同步（brief-v2-transcript.json，页数与 deck 一致） */
    var transcriptList = null;
    var LS_OVR = "ylBriefV2PrompterOverrides";
    var prompterOverrides = {};

    function loadPrompterOverrides() {
      try {
        var raw = localStorage.getItem(LS_OVR);
        if (raw) {
          var o = JSON.parse(raw);
          if (o && typeof o === "object" && !Array.isArray(o)) prompterOverrides = o;
        }
      } catch (e) {}
    }

    function savePrompterOverrides() {
      try {
        localStorage.setItem(LS_OVR, JSON.stringify(prompterOverrides));
      } catch (e) {}
    }

    loadPrompterOverrides();
    var prompterDirty = false;

    function visibleSlides() {
      return [].slice.call(deck.querySelectorAll(".slide")).filter(function (s) {
        return !s.classList.contains("slide--deleted");
      });
    }

    function baseTranscriptText(i, slideEl) {
      var t = "";
      if (transcriptList && transcriptList[i] != null) {
        t = String(transcriptList[i]).trim();
      }
      if (t) return t;
      var note = slideEl ? slideEl.querySelector(".slide__notes") : null;
      return note ? note.textContent.trim() : "";
    }

    function displayLineForSlide(i, slideEl) {
      var k = String(i);
      if (Object.prototype.hasOwnProperty.call(prompterOverrides, k)) {
        return String(prompterOverrides[k]);
      }
      var line = baseTranscriptText(i, slideEl);
      return line || "（本页暂无台词）";
    }

    function flushPrompterEditor() {
      if (!bodyEl || !prompterDirty) return;
      prompterDirty = false;
      var slides = visibleSlides();
      if (!slides.length || curI < 0 || curI >= slides.length) return;
      var s = slides[curI];
      var base = baseTranscriptText(curI, s);
      var defaultShown = base || "（本页暂无台词）";
      var v = bodyEl.value;
      if (v === defaultShown) {
        delete prompterOverrides[String(curI)];
      } else {
        prompterOverrides[String(curI)] = v;
      }
      savePrompterOverrides();
    }

    if (bodyEl) {
      bodyEl.addEventListener("input", function () {
        prompterDirty = true;
      });
      bodyEl.addEventListener("blur", function () {
        flushPrompterEditor();
      });
    }

    function renderSlide(i) {
      flushPrompterEditor();
      var slides = visibleSlides();
      i = Math.max(0, Math.min(i, slides.length - 1));
      curI = i;
      var s = slides[i];
      if (idxEl) idxEl.textContent = i + 1 + " / " + slides.length;
      if (bodyEl) {
        bodyEl.value = displayLineForSlide(i, s);
        prompterDirty = false;
      }
    }

    function parseInlineTranscript() {
      var el = document.getElementById("brief-v2-transcript-inline");
      if (!el || !el.textContent) return null;
      try {
        var arr = JSON.parse(el.textContent.trim());
        return Array.isArray(arr) ? arr : null;
      } catch (e) {
        return null;
      }
    }

    function loadTranscriptThen(cb) {
      var url = new URL("brief-v2-transcript.json", window.location.href).href;
      fetch(url)
        .then(function (r) {
          if (!r.ok) throw new Error("no transcript json");
          return r.json();
        })
        .then(function (arr) {
          transcriptList = Array.isArray(arr) ? arr : null;
        })
        .catch(function () {
          transcriptList = parseInlineTranscript();
        })
        .then(function () {
          if (!transcriptList) transcriptList = parseInlineTranscript();
          cb();
        });
    }

    function pushRemoteToMain() {
      if (bc) bc.postMessage({ type: "slide-remote", index: curI });
      try {
        localStorage.setItem("ylBriefV2Slide", String(curI));
      } catch (e) {}
    }

    function advance(delta) {
      var slides = visibleSlides();
      if (!slides.length) return;
      renderSlide(curI + delta);
      pushRemoteToMain();
    }

    if (bc) {
      bc.onmessage = function (ev) {
        if (ev.data && ev.data.type === "slide" && typeof ev.data.index === "number") {
          renderSlide(ev.data.index);
          try {
            lastLs = String(ev.data.index);
          } catch (e) {}
        }
      };
    }
    var lastLs = null;
    setInterval(function () {
      try {
        var x = localStorage.getItem("ylBriefV2Slide");
        if (x !== null && x !== lastLs) {
          lastLs = x;
          var n = parseInt(x, 10);
          if (!isNaN(n)) renderSlide(n);
        }
      } catch (e) {}
    }, 300);

    document.addEventListener(
      "keydown",
      function (e) {
        if (e.target.closest("input, textarea, select")) return;
        var k = e.key;
        if (k === "ArrowRight" || k === " " || k === "PageDown" || k === "Enter") {
          e.preventDefault();
          e.stopImmediatePropagation();
          advance(1);
        } else if (k === "ArrowLeft" || k === "PageUp") {
          e.preventDefault();
          e.stopImmediatePropagation();
          advance(-1);
        } else if (k === "Home") {
          e.preventDefault();
          e.stopImmediatePropagation();
          renderSlide(0);
          pushRemoteToMain();
        } else if (k === "End") {
          e.preventDefault();
          e.stopImmediatePropagation();
          var sl = visibleSlides();
          renderSlide(sl.length - 1);
          pushRemoteToMain();
        }
      },
      true
    );

    if (panel) {
      panel.style.cursor = "pointer";
      panel.addEventListener("click", function (e) {
        if (e.target.closest("a, button, input, textarea")) return;
        e.preventDefault();
        if (e.shiftKey || e.button === 1) advance(-1);
        else advance(1);
      });
    }

    loadTranscriptThen(function () {
      renderSlide(0);
    });
    return;
  }

  /* ── 主编辑器 ── */
  var allSlides = [].slice.call(deck.querySelectorAll(".slide"));
  var deletedStack = [];
  var btnDel = document.getElementById("btn-delete-slide");
  var btnUndo = document.getElementById("btn-undo-delete");
  var btnExport = document.getElementById("btn-export-clean");
  var countEl = document.getElementById("deck-deleted-count");
  var bar = document.querySelector(".deck-progress > span");
  var idxEl = document.getElementById("deck-idx");
  var slideListEl = document.getElementById("ppt-slide-list");
  var btnPresent = document.getElementById("btn-present-toggle");
  var btnPrompter = document.getElementById("btn-open-prompter");
  var btnCollapse = document.getElementById("ppt-sidebar-collapse");
  var btnShowSidebar = document.getElementById("btn-show-sidebar");
  var btnViewList = document.getElementById("ppt-view-btn-list");
  var btnViewGrid = document.getElementById("ppt-view-btn-grid");
  var VIEW_KEY = "pptSidebarViewMode";
  var sidebarViewMode =
    typeof localStorage !== "undefined" && localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";

  function refreshSlidesFromDom() {
    allSlides = [].slice.call(deck.querySelectorAll(".slide"));
  }

  function ensureSlideIds() {
    allSlides.forEach(function (s, i) {
      if (!s.dataset.pptId) s.dataset.pptId = "ppt-" + i + "-" + Math.random().toString(36).slice(2, 9);
    });
  }

  function visible() {
    return allSlides.filter(function (s) {
      return !s.classList.contains("slide--deleted");
    });
  }

  function curIdx() {
    var v = visible();
    for (var j = 0; j < v.length; j++) {
      if (v[j].classList.contains("is-on")) return j;
    }
    return 0;
  }

  function go(n) {
    var v = visible();
    n = Math.max(0, Math.min(n, v.length - 1));
    allSlides.forEach(function (s) {
      s.classList.remove("is-on");
    });
    if (v[n]) v[n].classList.add("is-on");
    if (bar) bar.style.width = ((100 * (n + 1)) / v.length).toFixed(2) + "%";
    if (idxEl) idxEl.textContent = n + 1 + " / " + v.length;
    postSlideIndex(n);
    syncThumbActive();
  }

  /* 提词器窗口反向控制主讲页码（BroadcastChannel）；localStorage 作跨页签兜底 */
  if (bc) {
    bc.addEventListener("message", function (ev) {
      if (!ev.data || ev.data.type !== "slide-remote" || typeof ev.data.index !== "number") return;
      go(ev.data.index);
    });
  }
  window.addEventListener("storage", function (e) {
    if (e.key !== "ylBriefV2Slide" || e.newValue == null) return;
    var n = parseInt(e.newValue, 10);
    if (isNaN(n) || n === curIdx()) return;
    go(n);
  });

  function syncThumbActive() {
    if (!slideListEl) return;
    var v = visible();
    var cur = v[curIdx()];
    var pid = cur && cur.dataset.pptId;
    [].forEach.call(slideListEl.querySelectorAll("li"), function (li) {
      li.classList.toggle("is-active", pid && li.dataset.pptSlideId === pid);
    });
  }

  function slideTitlePreview(slideEl) {
    var h = slideEl.querySelector("h1.headline-sm, h1, .story-line, .hero-line__accent");
    if (h && h.textContent.trim()) return h.textContent.trim().replace(/\s+/g, " ").slice(0, 42);
    var hook = slideEl.querySelector(".story-hook");
    if (hook && hook.textContent.trim()) return hook.textContent.trim().slice(0, 42);
    return "幻灯片";
  }

  function cloneSlideForThumb(slideEl) {
    var c = slideEl.cloneNode(true);
    c.classList.remove("is-on");
    c.setAttribute("aria-hidden", "true");
    c.querySelectorAll("[id]").forEach(function (el) {
      el.removeAttribute("id");
    });
    c.querySelectorAll('iframe,object,embed').forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    c.querySelectorAll("aside.slide__notes").forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    return c;
  }

  function applySidebarViewClass() {
    document.body.classList.toggle("ppt-sidebar-view-grid", sidebarViewMode === "grid");
    document.body.classList.toggle("ppt-sidebar-view-list", sidebarViewMode !== "grid");
    if (btnViewList) btnViewList.classList.toggle("is-active", sidebarViewMode === "list");
    if (btnViewGrid) btnViewGrid.classList.toggle("is-active", sidebarViewMode === "grid");
  }

  function setSidebarViewMode(mode) {
    sidebarViewMode = mode === "grid" ? "grid" : "list";
    try {
      localStorage.setItem(VIEW_KEY, sidebarViewMode);
    } catch (e) {}
    applySidebarViewClass();
    rebuildSidebar();
  }

  function wireThumbFrame(frame, slideEl) {
    var inner = document.createElement("div");
    inner.className = "ppt-slide-card__scale";
    inner.appendChild(cloneSlideForThumb(slideEl));
    frame.appendChild(inner);
    function fit() {
      var w = frame.clientWidth;
      var h = frame.clientHeight || (w * 9) / 16;
      if (!w) return;
      var s = Math.min(w / 1280, h / 720);
      inner.style.transform = "scale(" + s + ")";
      inner.style.transformOrigin = "top left";
      inner.style.width = "1280px";
      inner.style.height = "720px";
    }
    fit();
    if (typeof ResizeObserver !== "undefined") {
      var ro = new ResizeObserver(fit);
      ro.observe(frame);
    }
  }

  var dragFromIdx = null;

  function rebuildSidebar() {
    if (!slideListEl) return;
    ensureSlideIds();
    applySidebarViewClass();
    slideListEl.innerHTML = "";
    var v = visible();
    var isGrid = sidebarViewMode === "grid";
    v.forEach(function (slideEl, idx) {
      var li = document.createElement("li");
      li.className = isGrid ? "ppt-slide-card ppt-slide-card--grid" : "ppt-slide-card ppt-slide-card--list";
      li.draggable = true;
      li.dataset.pptSlideId = slideEl.dataset.pptId;
      li.dataset.index = String(idx);
      var num = document.createElement("span");
      num.className = "ppt-slide-list__num";
      num.textContent = String(idx + 1);
      var cap = document.createElement("span");
      cap.className = "ppt-slide-list__cap";
      cap.textContent = slideTitlePreview(slideEl);
      if (isGrid) {
        var frame = document.createElement("div");
        frame.className = "ppt-slide-card__frame";
        wireThumbFrame(frame, slideEl);
        var bar = document.createElement("div");
        bar.className = "ppt-slide-card__bar";
        bar.appendChild(num);
        bar.appendChild(cap);
        li.appendChild(frame);
        li.appendChild(bar);
      } else {
        li.appendChild(num);
        li.appendChild(cap);
      }
      li.addEventListener("click", function (e) {
        e.stopPropagation();
        if (e.target.closest("button")) return;
        go(idx);
      });
      li.addEventListener("dragstart", function (e) {
        dragFromIdx = idx;
        li.classList.add("is-dragging");
        e.dataTransfer.setData("text/plain", String(idx));
        e.dataTransfer.effectAllowed = "move";
      });
      li.addEventListener("dragend", function () {
        li.classList.remove("is-dragging");
        dragFromIdx = null;
        [].forEach.call(slideListEl.querySelectorAll("li"), function (x) {
          x.classList.remove("is-drag-over");
        });
      });
      li.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        li.classList.add("is-drag-over");
      });
      li.addEventListener("dragleave", function () {
        li.classList.remove("is-drag-over");
      });
      li.addEventListener("drop", function (e) {
        e.preventDefault();
        li.classList.remove("is-drag-over");
        var fromStr = e.dataTransfer.getData("text/plain");
        var from = dragFromIdx != null ? dragFromIdx : parseInt(fromStr, 10);
        var to = idx;
        if (isNaN(from) || from === to) return;
        reorderVisibleSlide(from, to);
      });
      slideListEl.appendChild(li);
    });
    syncThumbActive();
  }

  function reorderVisibleSlide(fromIdx, toIdx) {
    var v = visible();
    if (fromIdx < 0 || fromIdx >= v.length || toIdx < 0 || toIdx >= v.length) return;
    var el = v[fromIdx];
    var ref = v[toIdx];
    if (fromIdx < toIdx) {
      deck.insertBefore(el, ref.nextSibling);
    } else {
      deck.insertBefore(el, ref);
    }
    refreshSlidesFromDom();
    ensureSlideIds();
    rebuildSidebar();
    var newIdx = visible().indexOf(el);
    if (newIdx >= 0) go(newIdx);
  }

  function updateUI() {
    var n = deletedStack.length;
    if (countEl) {
      countEl.textContent = n > 0 ? "已删除 " + n + " 页" : "";
      countEl.style.display = n > 0 ? "" : "none";
    }
    if (btnUndo) btnUndo.disabled = n === 0;
    if (btnExport) btnExport.disabled = n === 0;
    rebuildSidebar();
  }

  document.addEventListener(
    "keydown",
    function (e) {
      if (e.target.closest("input, textarea, select")) return;
      if (e.key === "Escape" && document.body.classList.contains("ppt-present-mode")) {
        e.preventDefault();
        document.body.classList.remove("ppt-present-mode");
        if (btnPresent) btnPresent.textContent = "演示";
        return;
      }
      var handled = true;
      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "PageDown":
        case "Enter":
          go(curIdx() + 1);
          break;
        case "ArrowLeft":
        case "PageUp":
          go(curIdx() - 1);
          break;
        case "Home":
          go(0);
          break;
        case "End":
          go(visible().length - 1);
          break;
        case "n":
        case "N":
          document.body.classList.toggle("show-notes");
          break;
        case "d":
        case "D":
          if (!e.ctrlKey && !e.metaKey && btnDel) btnDel.click();
          break;
        case "z":
        case "Z":
          if (!e.ctrlKey && !e.metaKey && btnUndo) btnUndo.click();
          break;
        case "f":
        case "F":
          if (!e.ctrlKey && !e.metaKey && btnPresent) btnPresent.click();
          break;
        default:
          handled = false;
      }
      if (handled) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );

  deck.addEventListener(
    "click",
    function (e) {
      if (e.target.closest("a, button, iframe, input, textarea, select")) return;
      go(curIdx() + 1);
      e.stopImmediatePropagation();
    },
    true
  );

  if (btnDel) {
    btnDel.addEventListener("click", function (e) {
      e.stopPropagation();
      var v = visible();
      if (v.length <= 1) return;
      var idx = curIdx();
      var slide = v[idx];
      slide.classList.add("slide--deleted");
      slide.classList.remove("is-on");
      deletedStack.push({ el: slide, visIdx: idx });
      go(Math.min(idx, visible().length - 1));
      updateUI();
    });
  }

  if (btnUndo) {
    btnUndo.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!deletedStack.length) return;
      var last = deletedStack.pop();
      last.el.classList.remove("slide--deleted");
      go(last.visIdx);
      updateUI();
    });
  }

  if (btnPresent) {
    btnPresent.addEventListener("click", function () {
      document.body.classList.toggle("ppt-present-mode");
      var on = document.body.classList.contains("ppt-present-mode");
      btnPresent.textContent = on ? "退出" : "演示";
      btnPresent.classList.toggle("ppt-seg__btn--on", on);
    });
  }

  if (btnPrompter) {
    btnPrompter.addEventListener("click", function () {
      var u = new URL(window.location.href);
      u.searchParams.set("prompter", "1");
      window.open(u.toString(), "yiliu-brief-prompter", "noopener,noreferrer,width=960,height=1080");
    });
  }

  if (btnCollapse) {
    btnCollapse.addEventListener("click", function () {
      document.body.classList.toggle("ppt-sidebar-collapsed");
    });
  }

  if (btnShowSidebar) {
    btnShowSidebar.addEventListener("click", function () {
      document.body.classList.remove("ppt-sidebar-collapsed");
    });
  }

  if (btnViewList) {
    btnViewList.addEventListener("click", function () {
      setSidebarViewMode("list");
    });
  }
  if (btnViewGrid) {
    btnViewGrid.addEventListener("click", function () {
      setSidebarViewMode("grid");
    });
  }

  if (btnExport) {
    btnExport.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!deletedStack.length) return;
      btnExport.disabled = true;
      btnExport.textContent = "⏳ 正在打包…";

      try {
        var cssB64El = document.getElementById("deck-css-b64");
        var jsB64El = document.getElementById("deck-js-b64");
        var cssText = cssB64El ? decodeURIComponent(escape(atob(cssB64El.textContent.trim()))) : "";
        var jsText = jsB64El ? decodeURIComponent(escape(atob(jsB64El.textContent.trim()))) : "";

        var parser = new DOMParser();
        var doc = parser.parseFromString(
          "<!DOCTYPE html>\n<html lang=\"zh-CN\">" + document.head.outerHTML + document.body.outerHTML + "</html>",
          "text/html"
        );

        var link = doc.querySelector('link[rel="stylesheet"][href*="deck.css"]');
        if (link && cssText) {
          var styleEl = doc.createElement("style");
          styleEl.textContent = "\n/* deck.css inlined */\n" + cssText + "\n";
          link.parentNode.replaceChild(styleEl, link);
        }

        var scriptDeck = doc.querySelector('script[src*="deck.js"]');
        if (scriptDeck && jsText) {
          var inlineScript = doc.createElement("script");
          inlineScript.textContent = "\n// deck.js inlined\n" + jsText + "\n";
          scriptDeck.parentNode.replaceChild(inlineScript, scriptDeck);
        }

        var baseUrl = window.location.href.replace(/[^/]*$/, "");
        doc.querySelectorAll("iframe[src]").forEach(function (ifr) {
          var s = ifr.getAttribute("src");
          if (s && !/^(https?:|data:|blob:)/.test(s)) {
            try {
              ifr.setAttribute("src", new URL(s, baseUrl).href);
            } catch (err) {}
          }
        });

        doc.querySelectorAll(".slide--deleted").forEach(function (el) {
          var prev = el.previousSibling;
          while (prev && prev.nodeType === 3 && !prev.textContent.trim()) prev = prev.previousSibling;
          if (prev && prev.nodeType === 8) prev.parentNode.removeChild(prev);
          el.parentNode.removeChild(el);
        });

        var ssDataEl = doc.querySelector("#iframe-screenshots-data");
        var ssData = {};
        if (ssDataEl) {
          try {
            ssData = JSON.parse(ssDataEl.textContent);
          } catch (err) {}
        }
        doc.querySelectorAll("iframe[data-screenshot-key]").forEach(function (ifr) {
          var key = ifr.getAttribute("data-screenshot-key");
          if (ssData[key]) {
            var img = doc.createElement("img");
            img.src = "data:image/jpeg;base64," + ssData[key];
            img.alt = ifr.getAttribute("title") || "prototype screenshot";
            img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;";
            ifr.parentNode.replaceChild(img, ifr);
          }
        });

        var eb = doc.querySelector("#deck-editor-bar");
        if (eb) eb.parentNode.removeChild(eb);
        var cb = doc.querySelector("#deck-css-b64");
        if (cb) cb.parentNode.removeChild(cb);
        var jb = doc.querySelector("#deck-js-b64");
        if (jb) jb.parentNode.removeChild(jb);
        var sd = doc.querySelector("#iframe-screenshots-data");
        if (sd) sd.parentNode.removeChild(sd);

        /* 去掉 PPT 编辑器壳与提词器面板，恢复为纯 deck 结构 */
        var editorLayout = doc.getElementById("ppt-editor-layout");
        if (editorLayout && editorLayout.parentNode) {
          var stage = doc.getElementById("ppt-stage");
          if (stage) {
            while (stage.firstChild) {
              editorLayout.parentNode.insertBefore(stage.firstChild, editorLayout);
            }
          }
          editorLayout.parentNode.removeChild(editorLayout);
        }
        var promPanel = doc.getElementById("ppt-prompter-panel");
        if (promPanel && promPanel.parentNode) promPanel.parentNode.removeChild(promPanel);
        var prompterEarly = doc.querySelector("script.ppt-prompter-snippet");
        if (prompterEarly && prompterEarly.parentNode) prompterEarly.parentNode.removeChild(prompterEarly);

        doc.querySelectorAll('script[src*="brief-v2-ppt-editor"]').forEach(function (s) {
          s.parentNode.removeChild(s);
        });
        doc.querySelectorAll("script").forEach(function (s) {
          if (s.textContent.indexOf("slide--deleted") !== -1) s.parentNode.removeChild(s);
        });
        doc.querySelectorAll("style").forEach(function (s) {
          if (s.textContent.indexOf("deck-editor-bar") !== -1 || s.textContent.indexOf("ppt-editor-layout") !== -1)
            s.parentNode.removeChild(s);
        });

        var htmlEl = doc.documentElement;
        htmlEl.classList.remove("ppt-prompter-root");

        var total = doc.querySelectorAll(".slide").length;
        var mi = doc.querySelector("#deck-idx");
        if (mi) mi.textContent = "1 / " + total;
        var ti = doc.querySelector("title");
        if (ti) ti.textContent = ti.textContent.replace(/\d+页/, total + "页");

        var html = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
        var blob = new Blob([html], { type: "text/html;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        var ts = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
        a.href = url;
        a.download = "brief-v2-trimmed-" + ts + ".html";
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 200);
      } catch (err) {
        console.error("导出失败:", err);
        alert("导出失败: " + err.message);
      }
      btnExport.disabled = false;
      btnExport.textContent = "📥 导出新版本";
    });
  }

  ensureSlideIds();
  rebuildSidebar();
  go(curIdx());
  updateUI();
})();
