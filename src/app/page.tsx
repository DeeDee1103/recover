import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { LandingInteractive } from "./landing-interactive";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: landingStyles }} />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Hanken+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      <div className="landing">
        {/* HERO */}
        <div className="hero">
          <nav className="nav">
            <div className="nav-inner">
              <div className="brand"><span className="dot"></span>Recover</div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <a className="ghost" href="#pricing">See pricing</a>
                {user ? (
                  <Link className="ghost" href="/dashboard" style={{ borderColor: "var(--gold)", color: "var(--gold)" }}>
                    Dashboard
                  </Link>
                ) : (
                  <Link className="ghost" href="/login" style={{ borderColor: "var(--gold)", color: "var(--gold)" }}>
                    Sign in
                  </Link>
                )}
              </div>
            </div>
          </nav>

          <div className="wrap">
            <div className="hero-grid">
              <div className="hero-copy">
                <span className="eyebrow">For membership sites &amp; subscription SaaS</span>
                <h1>Win back the revenue your failed cards are <em>quietly</em> costing you.</h1>
                <p className="lede">When a subscriber&apos;s card fails, most of that money just disappears. Recover plugs the leak — automatic retries and branded reminders that win the payment back without you lifting a finger.</p>

                <form className="form" id="hero-form" noValidate>
                  <input type="email" name="email" placeholder="you@company.com" aria-label="Email address" required />
                  <button className="btn" type="submit">Get early access</button>
                </form>
                <p className="microcopy">Read-only Stripe access. No spam — just first access and the founding price.</p>
                <p className="form-success" id="hero-success">You&apos;re on the list. I&apos;ll email you the moment it&apos;s live.</p>
              </div>

              <div className="ticker">
                <div className="lbl">A $10k/mo business loses, per year</div>
                <div className="big mono" id="annual-loss">$0</div>
                <div className="sub">to involuntary churn — payments that fail for expired cards, insufficient funds, or bank holds. Most of it is recoverable.</div>
                <div className="live">
                  <span className="pulse"></span> Slipping away since you opened this page
                  <span className="amt" id="live-loss">$0.00</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CALCULATOR */}
        <section className="calc">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">The leak calculator</span>
              <h2>How much are you leaking?</h2>
              <p>Drag in your monthly recurring revenue. The red number is what failed payments cost you a year; the gold one is what a good recovery flow wins back.</p>
            </div>

            <div className="calc-card">
              <div className="calc-input">
                <label htmlFor="mrr">Your monthly recurring revenue</label>
                <div className="mrr-field">
                  <span>$</span>
                  <input id="mrr" className="mono" type="text" inputMode="numeric" defaultValue="10,000" aria-label="Monthly recurring revenue in dollars" />
                </div>
                <input className="slider" id="mrr-slider" type="range" min={1000} max={200000} step={1000} defaultValue={10000} aria-label="Adjust monthly recurring revenue" />
                <p className="calc-note">Based on a widely-cited ~9% involuntary-churn rate and a 70% recovery target. Your real numbers will differ — finding them out is exactly what early access is for.</p>
              </div>
              <div className="calc-out">
                <div className="out-row">
                  <div className="k">Lost to failed payments</div>
                  <div className="v loss mono" id="out-loss">$0 <span className="per">/ year</span></div>
                </div>
                <div className="out-row">
                  <div className="k">Recover wins back up to</div>
                  <div className="v gain mono" id="out-gain">$0 <span className="per">/ year</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STEPS */}
        <section className="steps">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">How it works</span>
              <h2>Three steps. Then it runs itself.</h2>
              <p className="intro">No engineering project, no replatforming. Connect once and Recover works in the background.</p>
            </div>
            <div className="step-grid">
              <div className="step">
                <div className="num">01</div>
                <h3>Connect Stripe</h3>
                <p>Read-only access in two clicks. Recover never touches card data or moves your money — Stripe stays the system of record.</p>
              </div>
              <div className="step">
                <div className="num">02</div>
                <h3>Recover runs the sequence</h3>
                <p>The moment a payment fails, it kicks off smart retries plus branded email reminders with a one-tap link to update the card.</p>
              </div>
              <div className="step">
                <div className="num">03</div>
                <h3>Watch revenue come back</h3>
                <p>Your dashboard tracks every recovery and the exact dollars won back, so you can see Recover pay for itself.</p>
              </div>
            </div>
          </div>
        </section>

        {/* PROOF */}
        <section className="proof">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Why this is worth your inbox</span>
              <h2>Failed payments are the churn nobody chose.</h2>
            </div>
            <div className="stat-grid">
              <div className="stat">
                <div className="n serif">~9%</div>
                <div className="d">of subscription revenue fails to collect on the first try — and a chunk of it never gets chased.</div>
              </div>
              <div className="stat">
                <div className="n serif">85%+</div>
                <div className="d">of those failed payments are recoverable with a good retry-and-reminder sequence.</div>
              </div>
              <div className="stat">
                <div className="n serif">1 invoice</div>
                <div className="d">A single recovered $500 charge can cover a year of Recover. The rest is upside.</div>
              </div>
            </div>
            <p className="caveat">Figures above are industry estimates, not a promise about your account — they&apos;re the reason this is worth testing on your real Stripe data.</p>
          </div>
        </section>

        {/* PRICING */}
        <section className="pricing" id="pricing">
          <div className="wrap">
            <div className="section-head">
              <span className="eyebrow">Pricing</span>
              <h2>Priced to be the easiest yes you&apos;ll make.</h2>
              <p className="intro">Every plan pays for itself with one or two recovered payments. Founding customers lock these prices in for life.</p>
            </div>
            <div className="price-grid">
              <div className="tier">
                <div className="name">Starter</div>
                <div className="amt">$49<small>/mo</small></div>
                <ul>
                  <li>Up to $10k MRR monitored</li>
                  <li>Branded email reminder sequence</li>
                  <li>Recovery dashboard</li>
                  <li>Read-only Stripe connection</li>
                </ul>
                <a className="btn" href="#get">Get early access</a>
              </div>
              <div className="tier featured">
                <span className="badge">Most popular</span>
                <div className="name">Growth</div>
                <div className="amt">$99<small>/mo</small></div>
                <ul>
                  <li>Up to $50k MRR monitored</li>
                  <li>Smart retries + email reminders</li>
                  <li>Custom sequences &amp; cadence</li>
                  <li>Slack recovery alerts</li>
                </ul>
                <a className="btn" href="#get">Get early access</a>
              </div>
              <div className="tier">
                <div className="name">Scale</div>
                <div className="amt">$199<small>/mo</small></div>
                <ul>
                  <li>Unlimited MRR monitored</li>
                  <li>Performance-based pricing option</li>
                  <li>AI-personalized reminder copy</li>
                  <li>Priority support</li>
                </ul>
                <a className="btn" href="#get">Get early access</a>
              </div>
            </div>
            <p className="founding">No charge today — early access reserves your founding price for when we launch.</p>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="final" id="get">
          <div className="wrap">
            <h2>Stop letting good revenue slip away.</h2>
            <form className="form" id="final-form" noValidate>
              <input type="email" name="email" placeholder="you@company.com" aria-label="Email address" required />
              <button className="btn" type="submit">Get early access</button>
            </form>
            <p className="microcopy">Be first in line — and lock in the founding price.</p>
            <p className="form-success" id="final-success">You&apos;re on the list. I&apos;ll email you the moment it&apos;s live.</p>
          </div>
        </section>

        <footer>
          <div className="wrap foot-inner">
            <div className="brand"><span className="dot" style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: "var(--gold)", marginRight: 8 }}></span>Recover</div>
            <div>Built in public · launching soon · © 2026</div>
          </div>
        </footer>
      </div>

      <LandingInteractive />
    </>
  );
}

const landingStyles = `
  .landing {
    --ink:#112E2A;
    --ink-soft:#1C403A;
    --paper:#F4F3ED;
    --card:#FFFFFF;
    --gold:#C5862F;
    --gold-bright:#E0A042;
    --loss:#BF4632;
    --muted:#5B6A65;
    --line:rgba(17,46,42,0.12);
    --line-on-ink:rgba(244,243,237,0.16);
    --maxw:1140px;
  }
  .landing, .landing *{box-sizing:border-box;margin:0;padding:0}
  .landing{
    background:var(--paper);
    color:var(--ink);
    font-family:"Hanken Grotesk",system-ui,sans-serif;
    font-size:17px;
    line-height:1.55;
    -webkit-font-smoothing:antialiased;
  }
  .landing .wrap{max-width:var(--maxw);margin:0 auto;padding:0 28px}
  .landing .mono{font-family:"Space Mono",monospace}
  .landing .serif{font-family:"Fraunces",serif}
  .landing a{color:inherit}
  .landing ::selection{background:var(--gold);color:var(--ink)}
  .landing .eyebrow{
    font-family:"Space Mono",monospace;
    font-size:12px;letter-spacing:.18em;text-transform:uppercase;
    color:var(--gold);
  }
  .landing .nav{position:relative;z-index:3}
  .landing .nav-inner{display:flex;align-items:center;justify-content:space-between;padding:22px 28px;max-width:var(--maxw);margin:0 auto}
  .landing .brand{display:flex;align-items:center;gap:10px;font-weight:600;font-size:19px;letter-spacing:-.01em;color:var(--paper)}
  .landing .brand .dot{width:11px;height:11px;border-radius:50%;background:var(--gold);box-shadow:0 0 0 4px rgba(197,134,47,.22)}
  .landing .nav .ghost{font-size:14px;font-weight:600;color:var(--paper);text-decoration:none;border:1px solid var(--line-on-ink);padding:9px 16px;border-radius:999px;transition:background .2s,border-color .2s}
  .landing .nav .ghost:hover{background:rgba(244,243,237,.08);border-color:rgba(244,243,237,.4)}
  .landing .hero{background:var(--ink);color:var(--paper);position:relative;overflow:hidden;padding-bottom:78px}
  .landing .hero::after{content:"";position:absolute;inset:0;pointer-events:none;
    background:radial-gradient(120% 90% at 88% -10%,rgba(197,134,47,.18),transparent 55%);}
  .landing .hero-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:54px;align-items:center;padding-top:34px;position:relative;z-index:2}
  .landing h1{font-family:"Fraunces",serif;font-weight:400;font-size:clamp(38px,5.6vw,68px);line-height:1.03;letter-spacing:-.02em;margin:20px 0 0}
  .landing h1 em{font-style:italic;color:var(--gold-bright)}
  .landing .lede{font-size:clamp(17px,2vw,20px);color:rgba(244,243,237,.82);max-width:34ch;margin-top:22px;line-height:1.5}
  .landing .form{margin-top:30px;display:flex;gap:10px;max-width:440px;flex-wrap:wrap}
  .landing .form input[type=email]{
    flex:1;min-width:210px;background:rgba(244,243,237,.07);border:1px solid var(--line-on-ink);
    color:var(--paper);padding:15px 16px;border-radius:12px;font-size:15px;font-family:inherit;
  }
  .landing .form input[type=email]::placeholder{color:rgba(244,243,237,.5)}
  .landing .form input[type=email]:focus{outline:none;border-color:var(--gold);background:rgba(244,243,237,.1)}
  .landing .btn{
    background:var(--gold);color:var(--ink);border:none;font-family:inherit;font-weight:700;font-size:15px;
    padding:15px 22px;border-radius:12px;cursor:pointer;transition:transform .12s,background .2s;white-space:nowrap;
  }
  .landing .btn:hover{background:var(--gold-bright);transform:translateY(-1px)}
  .landing .btn:active{transform:translateY(0)}
  .landing .microcopy{font-size:13px;color:rgba(244,243,237,.6);margin-top:12px}
  .landing .form-success{margin-top:18px;font-size:15px;color:var(--gold-bright);font-weight:600;display:none}
  .landing .ticker{
    background:rgba(244,243,237,.04);border:1px solid var(--line-on-ink);border-radius:18px;padding:26px;
    backdrop-filter:blur(2px);
  }
  .landing .ticker .lbl{font-family:"Space Mono",monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(244,243,237,.6)}
  .landing .ticker .big{font-family:"Space Mono",monospace;font-weight:700;font-size:clamp(34px,5vw,46px);color:var(--loss);margin-top:10px;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  .landing .ticker .sub{font-size:13px;color:rgba(244,243,237,.55);margin-top:8px;line-height:1.5}
  .landing .ticker .live{display:flex;align-items:center;gap:8px;margin-top:20px;padding-top:18px;border-top:1px solid var(--line-on-ink);font-size:13px;color:rgba(244,243,237,.7)}
  .landing .ticker .live .pulse{width:8px;height:8px;border-radius:50%;background:var(--loss);animation:landing-pulse 1.6s ease-in-out infinite}
  .landing .ticker .live .amt{margin-left:auto;font-family:"Space Mono",monospace;color:var(--loss);font-weight:700;font-variant-numeric:tabular-nums}
  @keyframes landing-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.7)}}
  .landing section{padding:84px 0}
  .landing .calc{background:var(--paper);border-top:1px solid var(--line)}
  .landing .section-head{max-width:560px}
  .landing .section-head h2{font-family:"Fraunces",serif;font-weight:400;font-size:clamp(28px,4vw,42px);line-height:1.08;letter-spacing:-.02em;margin-top:12px}
  .landing .section-head p{color:var(--muted);margin-top:14px;font-size:16px}
  .landing .calc-card{margin-top:38px;background:var(--card);border:1px solid var(--line);border-radius:20px;padding:34px;display:grid;grid-template-columns:1fr 1fr;gap:34px;align-items:center;box-shadow:0 1px 0 rgba(17,46,42,.04),0 24px 48px -32px rgba(17,46,42,.4)}
  .landing .calc-input label{display:block;font-family:"Space Mono",monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
  .landing .mrr-field{display:flex;align-items:center;gap:6px;margin-top:14px;border-bottom:2px solid var(--ink);padding-bottom:8px}
  .landing .mrr-field span{font-family:"Fraunces",serif;font-size:34px;color:var(--ink)}
  .landing .mrr-field input{border:none;background:none;font-family:"Fraunces",serif;font-size:40px;color:var(--ink);width:100%;padding:0;letter-spacing:-.01em}
  .landing .mrr-field input:focus{outline:none}
  .landing .slider{width:100%;margin-top:22px;accent-color:var(--gold);height:4px}
  .landing .calc-note{font-size:13px;color:var(--muted);margin-top:18px;line-height:1.5}
  .landing .calc-out{border-left:1px solid var(--line);padding-left:34px}
  .landing .out-row + .out-row{margin-top:26px}
  .landing .out-row .k{font-family:"Space Mono",monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
  .landing .out-row .v{font-family:"Space Mono",monospace;font-weight:700;font-size:clamp(30px,4.4vw,42px);letter-spacing:-.02em;margin-top:6px;font-variant-numeric:tabular-nums}
  .landing .v.loss{color:var(--loss)}
  .landing .v.gain{color:var(--gold)}
  .landing .out-row .per{font-size:13px;color:var(--muted);font-weight:400;letter-spacing:0;text-transform:none;font-family:"Hanken Grotesk",sans-serif}
  .landing .steps{background:var(--ink);color:var(--paper)}
  .landing .steps .eyebrow{color:var(--gold-bright)}
  .landing .steps h2{color:var(--paper)}
  .landing .steps p.intro{color:rgba(244,243,237,.7)}
  .landing .step-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:46px}
  .landing .step{border:1px solid var(--line-on-ink);border-radius:16px;padding:28px;background:rgba(244,243,237,.03)}
  .landing .step .num{font-family:"Space Mono",monospace;font-size:13px;color:var(--gold-bright);letter-spacing:.1em}
  .landing .step h3{font-family:"Fraunces",serif;font-weight:500;font-size:22px;margin-top:16px;line-height:1.15}
  .landing .step p{color:rgba(244,243,237,.72);font-size:15px;margin-top:10px;line-height:1.55}
  .landing .proof{background:var(--paper)}
  .landing .stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:44px}
  .landing .stat{border-top:2px solid var(--gold);padding-top:20px}
  .landing .stat .n{font-family:"Fraunces",serif;font-size:clamp(38px,5vw,54px);line-height:1;letter-spacing:-.02em}
  .landing .stat .d{color:var(--muted);font-size:15px;margin-top:12px;max-width:30ch}
  .landing .proof .caveat{font-size:13px;color:var(--muted);margin-top:30px;max-width:60ch}
  .landing .pricing{background:var(--ink);color:var(--paper)}
  .landing .pricing .eyebrow{color:var(--gold-bright)}
  .landing .pricing h2{color:var(--paper)}
  .landing .pricing .intro{color:rgba(244,243,237,.7);max-width:48ch}
  .landing .price-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:46px}
  .landing .tier{border:1px solid var(--line-on-ink);border-radius:18px;padding:30px;background:rgba(244,243,237,.03);display:flex;flex-direction:column}
  .landing .tier.featured{border-color:var(--gold);background:rgba(197,134,47,.08)}
  .landing .tier .name{font-family:"Space Mono",monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-bright)}
  .landing .tier .amt{font-family:"Fraunces",serif;font-size:46px;margin-top:14px;letter-spacing:-.02em}
  .landing .tier .amt small{font-size:16px;color:rgba(244,243,237,.6);font-family:"Hanken Grotesk",sans-serif}
  .landing .tier ul{list-style:none;margin:20px 0 26px;display:flex;flex-direction:column;gap:11px}
  .landing .tier li{font-size:14.5px;color:rgba(244,243,237,.82);padding-left:24px;position:relative;line-height:1.45}
  .landing .tier li::before{content:"";position:absolute;left:0;top:7px;width:13px;height:8px;border-left:2px solid var(--gold);border-bottom:2px solid var(--gold);transform:rotate(-45deg)}
  .landing .tier .btn{margin-top:auto;width:100%;text-align:center}
  .landing .tier.featured .badge{font-family:"Space Mono",monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink);background:var(--gold);display:inline-block;padding:3px 10px;border-radius:999px;margin-bottom:14px}
  .landing .founding{text-align:center;font-size:14px;color:rgba(244,243,237,.65);margin-top:28px}
  .landing .final{background:var(--paper);text-align:center}
  .landing .final h2{font-family:"Fraunces",serif;font-weight:400;font-size:clamp(30px,4.6vw,50px);line-height:1.05;letter-spacing:-.02em;max-width:18ch;margin:0 auto}
  .landing .final .form{margin:30px auto 0;justify-content:center}
  .landing .final input[type=email]{background:var(--card);border:1px solid var(--line);color:var(--ink)}
  .landing .final input[type=email]::placeholder{color:var(--muted)}
  .landing .final input[type=email]:focus{border-color:var(--gold)}
  .landing .final .microcopy{color:var(--muted)}
  .landing .final .form-success{color:var(--gold)}
  .landing footer{background:var(--ink);color:rgba(244,243,237,.6);padding:30px 0;border-top:1px solid var(--line-on-ink)}
  .landing .foot-inner{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;font-size:13px}
  .landing .foot-inner .brand{color:var(--paper);font-size:16px}
  @media(max-width:860px){
    .landing .hero-grid{grid-template-columns:1fr;gap:36px}
    .landing .calc-card{grid-template-columns:1fr;gap:28px}
    .landing .calc-out{border-left:none;border-top:1px solid var(--line);padding-left:0;padding-top:28px}
    .landing .step-grid,.landing .stat-grid,.landing .price-grid{grid-template-columns:1fr}
    .landing section{padding:60px 0}
  }
  @media(prefers-reduced-motion:reduce){
    .landing *{animation:none!important;transition:none!important;scroll-behavior:auto!important}
  }
`;
