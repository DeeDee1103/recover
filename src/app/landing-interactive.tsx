"use client";

import { useEffect } from "react";
import Script from "next/script";

const GFORM_ACTION = "https://docs.google.com/forms/d/e/1FAIpQLScdylPSXEDWrg-x4FOmNOhv0nzIi6gnpTDbOiKATsxfOVOOOQ/formResponse";
const GFORM_EMAIL_FIELD = "entry.1099297159";
const CHURN = 0.09;
const RECOVERY = 0.70;

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString("en-US");
}

export function LandingInteractive() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function countUp(el: HTMLElement, to: number, opts: { prefix?: string; suffixHTML?: string; dur?: number; from?: number } = {}) {
      if (reduceMotion) {
        const text = (opts.prefix || "") + Math.round(to).toLocaleString("en-US");
        if (opts.suffixHTML) el.innerHTML = text + opts.suffixHTML;
        else el.textContent = text;
        return;
      }
      const dur = opts.dur || 900;
      const start = performance.now();
      const from = opts.from || 0;
      function tick(now: number) {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        const val = from + (to - from) * eased;
        const text = (opts.prefix || "") + Math.round(val).toLocaleString("en-US");
        if (opts.suffixHTML) el.innerHTML = text + opts.suffixHTML;
        else el.textContent = text;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    // Hero annual loss
    const annualLossEl = document.getElementById("annual-loss");
    const exampleAnnual = 10000 * 12 * CHURN;
    if (annualLossEl) countUp(annualLossEl, exampleAnnual, { prefix: "$", dur: 1100 });

    // Live ticker
    const liveEl = document.getElementById("live-loss");
    const perSecond = exampleAnnual / (365 * 24 * 60 * 60);
    const startTs = performance.now();
    function liveTick(now: number) {
      if (liveEl) liveEl.textContent = "$" + (perSecond * (now - startTs) / 1000).toFixed(2);
      requestAnimationFrame(liveTick);
    }
    if (!reduceMotion && liveEl) requestAnimationFrame(liveTick);

    // Calculator
    const mrrInput = document.getElementById("mrr") as HTMLInputElement | null;
    const slider = document.getElementById("mrr-slider") as HTMLInputElement | null;
    const outLoss = document.getElementById("out-loss");
    const outGain = document.getElementById("out-gain");

    function render(mrr: number, animate: boolean) {
      const loss = mrr * 12 * CHURN;
      const gain = loss * RECOVERY;
      if (animate && outLoss && outGain) {
        countUp(outLoss, loss, { prefix: "$", suffixHTML: ' <span class="per">/ year</span>', dur: 600 });
        countUp(outGain, gain, { prefix: "$", suffixHTML: ' <span class="per">/ year</span>', dur: 600 });
      } else {
        if (outLoss) outLoss.innerHTML = fmt(loss) + ' <span class="per">/ year</span>';
        if (outGain) outGain.innerHTML = fmt(gain) + ' <span class="per">/ year</span>';
      }
    }

    function parseMRR(v: string) {
      const n = parseInt(v.replace(/[^0-9]/g, ""), 10);
      return isNaN(n) ? 0 : n;
    }

    mrrInput?.addEventListener("input", () => {
      const n = parseMRR(mrrInput.value);
      mrrInput.value = n ? n.toLocaleString("en-US") : "";
      if (n && slider) slider.value = String(Math.max(1000, Math.min(200000, n)));
      render(n, false);
    });

    slider?.addEventListener("input", () => {
      const n = parseInt(slider.value, 10);
      if (mrrInput) mrrInput.value = n.toLocaleString("en-US");
      render(n, false);
    });

    render(10000, true);

    // Analytics
    function track(name: string, props?: Record<string, string>) {
      try {
        if ((window as any).gtag) (window as any).gtag("event", name, props || {});
      } catch {}
    }

    // Form submission
    function wireForm(formId: string, successId: string) {
      const form = document.getElementById(formId) as HTMLFormElement | null;
      const success = document.getElementById(successId);
      if (!form || !success) return;

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = form.querySelector("input[type=email]") as HTMLInputElement;
        const email = (input.value || "").trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          input.focus();
          input.style.borderColor = "var(--loss)";
          return;
        }
        track("early_access", { source: formId });

        function showDone() {
          form!.style.display = "none";
          success!.style.display = "block";
        }

        const body = new URLSearchParams();
        body.append(GFORM_EMAIL_FIELD, email);
        fetch(GFORM_ACTION, { method: "POST", mode: "no-cors", body })
          .then(() => showDone())
          .catch(() => showDone());
      });
    }

    wireForm("hero-form", "hero-success");
    wireForm("final-form", "final-success");
  }, []);

  return (
    <Script
      src="https://www.googletagmanager.com/gtag/js?id=G-RM7DPW3B91"
      strategy="afterInteractive"
      onLoad={() => {
        (window as any).dataLayer = (window as any).dataLayer || [];
        function gtag(...args: any[]) { (window as any).dataLayer.push(args); }
        (window as any).gtag = gtag;
        gtag("js", new Date());
        gtag("config", "G-RM7DPW3B91");
      }}
    />
  );
}
