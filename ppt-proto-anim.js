/**
 * brief-v2.html · 原型分步演示：随幻灯片 is-on 触发，离场重置以便重复播放
 * 顺序：用户 → 应答 → 工具链逐步完成 → 结果卡 → 操作条（依页面结构）
 */
(function () {
  "use strict";

  var STEP = ".ppt-proto__step";
  var defaultMs = 380;
  var prefersReduce =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function allSteps(root) {
    return [].slice.call(root.querySelectorAll(STEP));
  }

  function resetProto(root) {
    if (!root) return;
    root.classList.remove("ppt-proto--done", "ppt-proto--playing");
    allSteps(root).forEach(function (el) {
      el.classList.remove("ppt-proto__step--on");
    });
    var lab = root.querySelector(".mock-agent__tool-label [data-ppt-tool-head]");
    if (lab) lab.textContent = "进行中";
  }

  function finishToolLabel(root) {
    var lab = root.querySelector(".mock-agent__tool-label [data-ppt-tool-head]");
    if (lab) lab.textContent = "已完成";
  }

  function playProto(root) {
    if (!root || root.classList.contains("ppt-proto--playing")) return;
    var steps = allSteps(root);
    if (!steps.length) return;

    if (prefersReduce) {
      steps.forEach(function (s) {
        s.classList.add("ppt-proto__step--on");
      });
      finishToolLabel(root);
      root.classList.add("ppt-proto--done");
      return;
    }

    var ms = parseInt(root.getAttribute("data-ppt-step-ms"), 10);
    if (isNaN(ms) || ms < 80) ms = defaultMs;

    root.classList.add("ppt-proto--playing");
    var i = 0;

    function tick() {
      if (i >= steps.length) {
        finishToolLabel(root);
        root.classList.remove("ppt-proto--playing");
        root.classList.add("ppt-proto--done");
        return;
      }
      steps[i].classList.add("ppt-proto__step--on");
      i += 1;
      setTimeout(tick, ms);
    }

    tick();
  }

  function runSlide(slide) {
    if (!slide) return;
    [].slice.call(slide.querySelectorAll(".ppt-proto")).forEach(function (root) {
      resetProto(root);
      setTimeout(function () {
        playProto(root);
      }, 100);
    });
  }

  function resetSlide(slide) {
    if (!slide) return;
    [].slice.call(slide.querySelectorAll(".ppt-proto")).forEach(resetProto);
  }

  var deck = document.getElementById("deck");
  if (!deck) return;

  var lastOn = null;

  function sync() {
    var on = deck.querySelector(".slide.is-on");
    if (on === lastOn) return;
    if (lastOn) resetSlide(lastOn);
    lastOn = on;
    runSlide(on);
  }

  var mo = new MutationObserver(sync);
  mo.observe(deck, { subtree: true, attributes: true, attributeFilter: ["class"] });
  sync();
})();
