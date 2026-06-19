"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

const WPP = "https://wa.me/5561995691219?text=Ol%C3%A1%2C+quero+saber+mais+sobre+o+JV+IA%21";

const FEATURES = [
  {
    icon: "💬",
    title: "Conversação por tópicos",
    desc: "Escolha um tema — trabalho, viagem, filmes, rotina — e converse em inglês com um coach que realmente entende o contexto. Sem frases prontas, sem exercícios mecânicos.",
    badge: null,
  },
  {
    icon: "🔊",
    title: "Ouça o inglês correto",
    desc: "Cada resposta do JV IA pode ser ouvida em áudio com a pronúncia nativa. Tem botão para repetir devagar — ideal para treinar o ouvido sem pressa.",
    badge: null,
  },
  {
    icon: "✏️",
    title: "Correção natural e sem vergonha",
    desc: "Errou na escrita? O JV IA corrige de forma discreta, mostrando a frase certa com fonética em português. Você aprende sem se sentir constrangido.",
    badge: null,
  },
  {
    icon: "🎯",
    title: "Quiz ao final de cada conversa",
    desc: "Ao encerrar a conversa, você pode gerar um quiz de 5 questões baseadas exatamente no que foi praticado. Revise, acerte e veja seu progresso.",
    badge: null,
  },
  {
    icon: "🏆",
    title: "Histórico e sequência de dias",
    desc: "Acompanhe seus quizzes anteriores, sua pontuação e quantos dias seguidos você está praticando. A consistência é o que gera fluência.",
    badge: null,
  },
  {
    icon: "📄",
    title: "Revisão de aula com PDF",
    desc: "Envie o PDF da sua aula ao vivo e o JV IA cria um resumo, responde suas dúvidas sobre o conteúdo e gera um quiz específico daquela aula.",
    badge: "Exclusivo Combo",
  },
  {
    icon: "📱",
    title: "Funciona como app no celular",
    desc: "Instale o JV IA direto na tela inicial do seu celular como um aplicativo. Sem baixar da App Store — é só adicionar à tela inicial.",
    badge: null,
  },
  {
    icon: "🧠",
    title: "Adapta ao seu nível automaticamente",
    desc: "O JV IA detecta se você é iniciante, intermediário ou avançado pela sua forma de escrever e adapta o vocabulário e as respostas sem você precisar configurar nada.",
    badge: null,
  },
];

const TOPICS = [
  { icon: "🏠", label: "Rotina & Cotidiano" },
  { icon: "💼", label: "Trabalho & Carreira" },
  { icon: "✈️", label: "Viagem & Turismo" },
  { icon: "🎬", label: "Filmes & Séries" },
  { icon: "🔗", label: "Phrasal Verbs" },
  { icon: "🍕", label: "Comida & Restaurantes" },
  { icon: "💻", label: "Tecnologia" },
  { icon: "💬", label: "Chat Livre" },
];

const HOW_STEPS = [
  { n: "01", title: "Acesse o JV IA", desc: "Entre com sua conta de aluno em faleinglesjv.com/app — disponível 24h pelo celular ou computador." },
  { n: "02", title: "Escolha um tópico", desc: "Selecione o tema que quer praticar ou abra um chat livre para falar de qualquer coisa." },
  { n: "03", title: "Converse em inglês", desc: "Escreva ou use o microfone. O JV IA responde como um professor nativo — com contexto, naturalidade e correções discretas." },
  { n: "04", title: "Ouça e repita", desc: "Clique para ouvir a resposta em áudio. Use o botão 'Devagar' para treinar palavras difíceis." },
  { n: "05", title: "Faça o quiz", desc: "Ao final, gere um quiz com 5 questões sobre o que foi praticado. Veja seu resultado e salve no histórico." },
];

const MIX_DEMO_STEPS = [
  { role: "user",  text: ["I went to the ", { word: "supermercado", en: "supermarket" }, " yesterday. Esqueci to buy the ", { word: "leite", en: "milk" }, ". Was very ", { word: "chato", en: "annoying" }, "!"] },
  { role: "coach", text: ["Perfect! You mixed português naturally! ", { highlight: "supermercado" }, " = supermarket, ", { highlight: "leite" }, " = milk, ", { highlight: "chato" }, " = annoying. That's exactly how fluency builds! 🎉"] },
];

type MixPart = string | { word: string; en: string } | { highlight: string };

function MixDemo() {
  const [visible, setVisible] = useState<number[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    timers.push(setTimeout(() => setVisible([0]), 300));
    timers.push(setTimeout(() => setVisible([0, 1]), 1800));
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <div ref={ref} style={{ background:"#111", border:"1px solid rgba(245,200,0,.2)", borderRadius:20, padding:"1.2rem 1.2rem", maxWidth:500, width:"100%", boxShadow:"0 24px 80px rgba(0,0,0,.6)", fontFamily:"'Inter',sans-serif", display:"flex", flexDirection:"column", minHeight:"auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:".5rem", marginBottom:"1rem", fontSize:".75rem", color:"var(--gray)", fontWeight:600 }}>
        <span style={{ width:8, height:8, borderRadius:"50%", background:"#4ade80", display:"inline-block" }} />
        JV IA — detectando português automaticamente
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:"1rem", overflow:"visible", minHeight:200, alignItems:"center", textAlign:"center" }}>
        {MIX_DEMO_STEPS.map((msg, i) => (
          <div key={i} style={{
            opacity: visible.includes(i) ? 1 : 0,
            transform: visible.includes(i) ? "translateY(0)" : "translateY(12px)",
            transition: "opacity .5s cubic-bezier(0.34, 1.56, 0.64, 1), transform .5s cubic-bezier(0.34, 1.56, 0.64, 1)",
            display:"flex", justifyContent: "center", width: "100%",
          }}>
            <div style={{
              maxWidth:"90%", padding:".7rem 1rem",
              borderRadius: msg.role === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
              background: msg.role === "user" ? "var(--yellow)" : "#1a1a1a",
              color: msg.role === "user" ? "#000" : "#fff",
              border: msg.role === "ai" ? "1px solid #2a2a2a" : "none",
              fontSize:".82rem", lineHeight:1.55,
              textAlign: "left",
            }}>
              {(msg.text as MixPart[]).map((part, j) =>
                typeof part === "string" ? (
                  <span key={j}>{part}</span>
                ) : "en" in part ? (
                  <span key={j} title={`em inglês: ${part.en}`} style={{
                    background: msg.role === "user" ? "rgba(0,0,0,.15)" : "rgba(245,200,0,.22)",
                    color: msg.role === "user" ? "#000" : "var(--yellow)",
                    fontWeight:700, borderRadius:4, padding:"0 4px",
                    borderBottom: msg.role === "user" ? "2px solid rgba(0,0,0,.3)" : "2px solid var(--yellow)",
                    cursor:"help",
                  }}>{part.word}</span>
                ) : (
                  <span key={j} style={{ color:"var(--yellow)", fontWeight:700 }}>{part.highlight}</span>
                )
              )}
            </div>
          </div>
        ))}
      </div>
      <p style={{ textAlign:"center", marginTop:"1rem", fontSize:".7rem", color:"var(--gray2)" }}>
        Passe o mouse sobre as palavras destacadas para ver a tradução ↑
      </p>
    </div>
  );
}

// Chat mockup messages
const MOCK_MESSAGES = [
  { role: "ai", text: "Hey! So good to have you here 😊 So tell me — what have you been up to today? Anything interesting happen?", pt: "Que bom ter você aqui! Me conta — o que você andou fazendo hoje?" },
  { role: "user", text: "I go to the gym this morning and after I eat a big breakfast." },
  { role: "ai", text: "Nice! A gym session followed by a big breakfast sounds like the perfect start to the day 💪 What did you have for breakfast — anything special?", pt: "Que legal! Uma sessão na academia seguida de um café da manhã farto parece o começo perfeito do dia!", fix: { wrong: "I go", right: "I went", phonetic: "ai uent tu de dzhim dhis mórnin" } },
];

function ChatMockup() {
  const [visible, setVisible] = useState(0);
  const [showFix, setShowFix] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(1), 600);
    const t2 = setTimeout(() => setVisible(2), 1800);
    const t3 = setTimeout(() => setVisible(3), 3200);
    const t4 = setTimeout(() => setShowFix(true), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  return (
    <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: "20px", overflow: "hidden", maxWidth: 420, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,.6)" }}>
      {/* phone bar */}
      <div style={{ background: "#0a0a0a", padding: "12px 16px", borderBottom: "1px solid #1e1e1e", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f87171" }} />
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--yellow)" }} />
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80" }} />
        <span style={{ marginLeft: 8, fontSize: ".75rem", color: "var(--gray)", fontFamily: "'Inter',sans-serif" }}>JV IA — Rotina & Cotidiano</span>
      </div>
      {/* messages */}
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12, minHeight: 300, fontFamily: "'Inter',sans-serif" }}>
        {MOCK_MESSAGES.slice(0, visible).map((msg, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: 6 }}>
            <div style={{
              maxWidth: "85%", padding: ".65rem .9rem", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: msg.role === "user" ? "var(--yellow)" : "#1a1a1a",
              color: msg.role === "user" ? "#000" : "#fff",
              fontSize: ".82rem", lineHeight: 1.55,
              border: msg.role === "ai" ? "1px solid #2a2a2a" : "none",
              animation: "fadeUp .35s ease",
            }}>
              {msg.text}
            </div>
            {msg.role === "ai" && msg.pt && (
              <div style={{ fontSize: ".7rem", color: "var(--gray)", fontStyle: "italic", maxWidth: "85%", paddingLeft: 4 }}>
                🇧🇷 {msg.pt}
              </div>
            )}
            {msg.role === "ai" && (
              <div style={{ display: "flex", gap: 6, paddingLeft: 4 }}>
                <button style={{ background: "transparent", border: "1px solid #2a2a2a", borderRadius: "50px", padding: "2px 9px", fontSize: ".68rem", color: "var(--gray)", cursor: "pointer" }}>🔊 Ouvir</button>
                <button style={{ background: "transparent", border: "1px solid #2a2a2a", borderRadius: "50px", padding: "2px 9px", fontSize: ".68rem", color: "var(--gray)", cursor: "pointer" }}>🐢 Devagar</button>
              </div>
            )}
          </div>
        ))}
        {visible < MOCK_MESSAGES.length && visible > 0 && (
          <div style={{ display: "flex", gap: 5, paddingLeft: 4 }}>
            {[0,1,2].map(d => <span key={d} style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--yellow)", display: "inline-block", animation: `bounce .8s infinite`, animationDelay: `${d*150}ms` }} />)}
          </div>
        )}
        {/* Fix tag */}
        {showFix && visible >= 3 && (
          <div style={{ background: "rgba(245,200,0,.06)", border: "1px solid rgba(245,200,0,.2)", borderRadius: 12, padding: "10px 12px", fontSize: ".75rem", animation: "fadeUp .35s ease" }}>
            <p style={{ color: "var(--yellow)", fontWeight: 700, marginBottom: 4 }}>✏️ Correção discreta</p>
            <p style={{ color: "#ccc" }}>
              <span style={{ textDecoration: "line-through", color: "#f87171" }}>I go</span> → <span style={{ color: "#4ade80" }}>I went</span>
            </p>
            <p style={{ color: "var(--gray)", marginTop: 2, fontStyle: "italic" }}>ai uent tu de dzhim dhis mórnin</p>
          </div>
        )}
      </div>
      {/* input bar */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid #1e1e1e", display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, padding: "8px 12px", fontSize: ".8rem", color: "var(--gray)", fontFamily: "'Inter',sans-serif" }}>Digite aqui...</div>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--yellow)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" fill="#000"/><path d="M19 10a7 7 0 0 1-14 0" stroke="#000" strokeWidth="2" strokeLinecap="round"/></svg>
        </div>
      </div>
    </div>
  );
}

function CommunityMockup() {
  return (
    <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: "20px", overflow: "hidden", maxWidth: 420, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,.6)", fontFamily: "'Inter',sans-serif" }}>
      {/* header */}
      <div style={{ background: "#0a0a0a", padding: "12px 16px", borderBottom: "1px solid #1e1e1e", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f87171" }} />
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--yellow)" }} />
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80" }} />
        <span style={{ marginLeft: 8, fontSize: ".75rem", color: "var(--gray)", fontFamily: "'Inter',sans-serif" }}>Comunidade - Feed</span>
      </div>
      {/* posts */}
      <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 12, minHeight: 320 }}>
        {[
          { author: "Sarah M.", avatar: "S", content: "Just finished my first conversation with JV IA! 🎉 So much better than just reading grammar rules. The corrections really make sense now.", likes: 24, replies: 3, timestamp: "2h ago" },
          { author: "Pedro L.", avatar: "P", content: "Consegui fazer uma frase inteira sem pedir ajuda! 'I went to the beach yesterday and had the best time with my friends' 🌊", likes: 18, replies: 5, timestamp: "4h ago", highlighted: true },
          { author: "Emma K.", avatar: "E", content: "The emoji feature is fun! 😄 Made my post more expressive. English is not just about words, it's about expression!", likes: 31, replies: 7, timestamp: "6h ago" },
        ].map((post, i) => (
          <div key={i} style={{ borderBottom: i < 2 ? "1px solid #1a1a1a" : "none", paddingBottom: 12 }}>
            <div style={{ display: "flex", gap: ".65rem", marginBottom: ".5rem" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--yellow)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".8rem", fontWeight: 700, color: "#000", flexShrink: 0 }}>
                {post.avatar}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: ".5rem" }}>
                  <p style={{ fontSize: ".82rem", fontWeight: 700, color: "#fff", margin: 0 }}>{post.author}</p>
                  <p style={{ fontSize: ".7rem", color: "var(--gray)", margin: 0 }}>{post.timestamp}</p>
                </div>
                <p style={{ fontSize: ".8rem", color: "rgba(255,255,255,.75)", lineHeight: 1.5, margin: ".4rem 0 0", wordBreak: "break-word" }}>
                  {post.content}
                </p>
                <div style={{ display: "flex", gap: "1rem", marginTop: ".6rem", fontSize: ".7rem", color: "var(--gray)" }}>
                  <span>👍 {post.likes}</span>
                  <span>💬 {post.replies}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuizMockup() {
  const [chosen, setChosen] = useState<number | null>(null);
  const correct = 1;
  const options = ["I go to the gym yesterday", "I went to the gym yesterday", "I gone to the gym yesterday", "I was go to the gym yesterday"];

  return (
    <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: "20px", overflow: "hidden", maxWidth: 400, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,.6)", fontFamily: "'Inter',sans-serif" }}>
      <div style={{ background: "#0a0a0a", padding: "12px 16px", borderBottom: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase", color: "var(--yellow)", letterSpacing: ".08em" }}>Quiz</p>
          <p style={{ fontSize: ".8rem", fontWeight: 700, color: "#fff", marginTop: 2 }}>Rotina & Cotidiano</p>
        </div>
        <span style={{ fontSize: ".8rem", color: "var(--gray)" }}>2/5</span>
      </div>
      <div style={{ padding: "16px" }}>
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
          <p style={{ fontSize: ".83rem", color: "#fff", lineHeight: 1.5 }}>Qual é a forma correta do passado da frase abaixo?</p>
          <p style={{ fontSize: ".78rem", color: "var(--yellow)", marginTop: 6, fontStyle: "italic" }}>"____ to the gym yesterday."</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {options.map((opt, i) => {
            let bg = "#1a1a1a", border = "1px solid #2a2a2a", color = "#fff";
            if (chosen !== null) {
              if (i === correct) { bg = "rgba(74,222,128,.1)"; border = "1px solid #4ade80"; color = "#4ade80"; }
              else if (i === chosen && chosen !== correct) { bg = "rgba(248,113,113,.1)"; border = "1px solid #f87171"; color = "#f87171"; }
              else { color = "var(--gray)"; }
            }
            return (
              <button key={i} onClick={() => setChosen(i)} style={{ background: bg, border, color, borderRadius: 10, padding: "9px 12px", fontSize: ".8rem", textAlign: "left", cursor: chosen !== null ? "default" : "pointer", transition: "all .15s" }}>
                <span style={{ fontWeight: 700, opacity: .5, marginRight: 8 }}>{["A","B","C","D"][i]}</span>{opt}
              </button>
            );
          })}
        </div>
        {chosen !== null && (
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: chosen === correct ? "rgba(74,222,128,.08)" : "rgba(248,113,113,.08)", border: chosen === correct ? "1px solid rgba(74,222,128,.2)" : "1px solid rgba(248,113,113,.2)", animation: "fadeUp .3s ease" }}>
            <p style={{ fontWeight: 700, color: chosen === correct ? "#4ade80" : "#f87171", fontSize: ".8rem" }}>{chosen === correct ? "✓ Correto!" : "✗ Quase lá!"}</p>
            <p style={{ color: "var(--gray)", fontSize: ".76rem", marginTop: 4 }}>O passado de "go" é "went" — um verbo irregular muito usado no dia a dia.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function IALanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); });
    }, { threshold: 0.12 });
    document.querySelectorAll(".anim").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:1} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        .anim { opacity:0; transform:translateY(24px); transition: opacity .6s ease, transform .6s ease; }
        .anim.visible { opacity:1; transform:translateY(0); }
        .anim-delay-1 { transition-delay:.1s; }
        .anim-delay-2 { transition-delay:.2s; }
        .anim-delay-3 { transition-delay:.3s; }
        .anim-delay-4 { transition-delay:.4s; }
        .feature-card { background:#111; border:1px solid #1e1e1e; border-radius:18px; padding:1.75rem; transition:border-color .2s, transform .2s; }
        .feature-card:hover { border-color:rgba(245,200,0,.3); transform:translateY(-3px); }
        .topic-chip { background:#1a1a1a; border:1px solid #2a2a2a; border-radius:50px; padding:.45rem 1rem; font-size:.82rem; color:#ccc; display:flex; align-items:center; gap:.4rem; transition:all .2s; cursor:default; }
        .topic-chip:hover { border-color:rgba(245,200,0,.4); color:#fff; background:rgba(245,200,0,.05); }
        .step-line { position:absolute; top:50%; left:100%; width:2rem; height:1px; background:rgba(245,200,0,.2); }
        section { padding: 3.5rem 1.25rem; }
        .section-inner { max-width:1100px; margin:0 auto; }
        .section-label { display:inline-block; background:rgba(245,200,0,.12); color:var(--yellow); font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.1em; padding:.3rem .9rem; border-radius:50px; margin-bottom:1rem; }
        h2.big { font-size:clamp(1.8rem,4vw,2.8rem); font-weight:900; color:#fff; line-height:1.1; letter-spacing:-.5px; }
        h2.big em { font-style:normal; color:var(--yellow); }
        .subtitle { color:rgba(255,255,255,.55); line-height:1.7; margin-top:.75rem; font-size:1rem; max-width:580px; }
        .badge-pro { background:rgba(245,200,0,.12); color:var(--yellow); font-size:.68rem; font-weight:700; padding:2px 8px; border-radius:50px; white-space:nowrap; }
      `}</style>

      {/* ── NAV ─────────────────────────────────────────────────── */}
      <nav style={{ position:"fixed", top:0, width:"100%", zIndex:100, background: scrolled ? "rgba(10,10,10,.97)" : "rgba(10,10,10,.8)", backdropFilter:"blur(16px)", borderBottom:"1px solid rgba(245,200,0,.12)", padding:"0 1.25rem", height:62, display:"flex", alignItems:"center", justifyContent:"space-between", transition:"background .3s" }}>
        <a href="/" style={{ display:"flex", alignItems:"center", gap:".6rem", textDecoration:"none" }}>
          <Image src="/favicon.png" alt="JV IA" width={30} height={30} style={{ borderRadius:8 }} />
          <span style={{ fontWeight:800, fontSize:".95rem", color:"#fff" }}>JV <span style={{ color:"var(--yellow)" }}>IA</span></span>
        </a>
        <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
          <a href="/app" style={{ background:"var(--yellow)", color:"#000", padding:".45rem 1.1rem", borderRadius:"50px", textDecoration:"none", fontWeight:700, fontSize:".85rem" }}>Experimentar</a>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section style={{ minHeight:"90vh", paddingTop:90, paddingBottom:50, display:"flex", alignItems:"center", background:"var(--black)", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-60, right:-80, width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle,rgba(245,200,0,.08) 0%,transparent 70%)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", bottom:-40, left:-60, width:350, height:350, borderRadius:"50%", background:"radial-gradient(circle,rgba(245,200,0,.05) 0%,transparent 70%)", pointerEvents:"none" }} />

        <div className="section-inner" style={{ width:"100%", display:"grid", gridTemplateColumns:"1fr", gap:"2.5rem", alignItems:"center" }}>
          <div className="anim">
            <div className="section-label">Praticado por alunos da Fale Inglês JV</div>
            <h1 style={{ fontSize:"clamp(2.2rem,5vw,3.8rem)", fontWeight:900, color:"#fff", lineHeight:1.05, letterSpacing:"-.5px", marginBottom:"1.25rem" }}>
              Seu professor de inglês<br /><em style={{ fontStyle:"normal", color:"var(--yellow)" }}>disponível 24 horas</em>
            </h1>
            <p style={{ fontSize:"1.05rem", color:"rgba(255,255,255,.6)", lineHeight:1.75, maxWidth:500, marginBottom:"2rem" }}>
              O JV IA é um coach de inglês com inteligência artificial que conversa, corrige, explica e te desafia — exatamente como nas aulas ao vivo, mas disponível a qualquer hora do dia.
            </p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:".75rem", marginBottom:"2.5rem" }}>
              <a href="/app" style={{ background:"var(--yellow)", color:"#000", padding:".9rem 2rem", borderRadius:"50px", textDecoration:"none", fontWeight:800, fontSize:"1rem", display:"flex", alignItems:"center", gap:".5rem", boxShadow:"0 4px 24px rgba(245,200,0,.35)" }}>
                🤖 Experimentar grátis
              </a>
              <a href="#funcionalidades" style={{ background:"transparent", color:"#fff", padding:".9rem 2rem", borderRadius:"50px", textDecoration:"none", fontWeight:600, fontSize:"1rem", border:"2px solid rgba(255,255,255,.15)" }}>
                Ver funcionalidades
              </a>
            </div>
            <div style={{ display:"flex", gap:"2rem", flexWrap:"wrap" }}>
              {[["24h", "Disponível sempre"]].map(([n, l]) => (
                <div key={n}>
                  <div style={{ fontSize:"1.8rem", fontWeight:900, color:"var(--yellow)", lineHeight:1 }}>{n}</div>
                  <div style={{ fontSize:".7rem", color:"rgba(255,255,255,.4)", marginTop:".2rem", textTransform:"uppercase", letterSpacing:".5px" }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat mockup */}
          <div className="anim anim-delay-2" style={{ display:"flex", justifyContent:"center" }}>
            <ChatMockup />
          </div>
        </div>
      </section>

      {/* ── TÓPICOS ─────────────────────────────────────────────── */}
      <section style={{ background:"#0d0d0d", borderTop:"1px solid #1a1a1a", borderBottom:"1px solid #1a1a1a" }}>
        <div className="section-inner" style={{ textAlign:"center" }}>
          <p className="anim" style={{ fontSize:".8rem", color:"var(--gray)", textTransform:"uppercase", letterSpacing:".1em", marginBottom:"1.5rem" }}>Pratique inglês sobre o que realmente importa para você</p>
          <div className="anim anim-delay-1" style={{ display:"flex", flexWrap:"wrap", gap:".65rem", justifyContent:"center" }}>
            {TOPICS.map((t) => (
              <div key={t.label} className="topic-chip">
                <span>{t.icon}</span> {t.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FUNCIONALIDADES ─────────────────────────────────────── */}
      <section id="funcionalidades" style={{ background:"var(--black)" }}>
        <div className="section-inner">
          <div className="anim" style={{ marginBottom:"2.5rem" }}>
            <div className="section-label">Funcionalidades</div>
            <h2 className="big">Tudo que você precisa para <em>evoluir de verdade</em></h2>
            <p className="subtitle">Do chat inteligente ao quiz personalizado — cada detalhe foi pensado para transformar a prática em fluência.</p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"1rem" }}>
            {FEATURES.map((f, i) => (
              <div key={i} className={`feature-card anim anim-delay-${(i % 4) + 1}`}>
                <div style={{ fontSize:"1.8rem", marginBottom:".75rem" }}>{f.icon}</div>
                <div style={{ display:"flex", alignItems:"center", gap:".5rem", marginBottom:".5rem" }}>
                  <h3 style={{ fontSize:"1rem", fontWeight:700, color:"#fff" }}>{f.title}</h3>
                  {f.badge && <span className="badge-pro">{f.badge}</span>}
                </div>
                <p style={{ fontSize:".875rem", color:"rgba(255,255,255,.5)", lineHeight:1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MISTURE PORTUGUÊS E INGLÊS ──────────────────────────── */}
      <section style={{ background:"#0d0d0d", borderTop:"1px solid #1a1a1a" }}>
        <div className="section-inner" style={{ display:"grid", gridTemplateColumns:"1fr", gap:"2.5rem", alignItems:"center" }}>
          <div className="anim">
            <div className="section-label">Funcionalidade exclusiva</div>
            <h2 className="big">Misture português<br /><em>e inglês à vontade</em></h2>
            <p className="subtitle">Esqueceu uma palavra em inglês? Fale em português mesmo, no meio da frase. O JV IA entende, traduz na hora e te ensina o vocabulário certo — sem interromper o fluxo da conversa.</p>
            <ul style={{ marginTop:"1.5rem", display:"flex", flexDirection:"column", gap:".75rem" }}>
              {[
                "Fale como você pensa — misturando os dois idiomas",
                "O coach detecta automaticamente a palavra em português",
                "Tradução e contexto em tempo real, sem sair da conversa",
                "Vocabulário fixado porque apareceu no contexto certo",
              ].map((item, i) => (
                <li key={i} style={{ display:"flex", gap:".75rem", alignItems:"flex-start", fontSize:".9rem", color:"rgba(255,255,255,.65)" }}>
                  <span style={{ color:"var(--yellow)", fontWeight:700, flexShrink:0 }}>✓</span> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="anim anim-delay-2" style={{ display:"flex", justifyContent:"center" }}>
            <MixDemo />
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ───────────────────────────────────────── */}
      <section id="como-funciona" style={{ background:"#0d0d0d", borderTop:"1px solid #1a1a1a" }}>
        <div className="section-inner">
          <div className="anim" style={{ marginBottom:"2.5rem" }}>
            <div className="section-label">Como funciona</div>
            <h2 className="big">Em 5 passos você <em>já está praticando</em></h2>
            <p className="subtitle">Simples, rápido e sem configuração. Abriu, escolheu o tema, começou a conversar.</p>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"1.5rem" }}>
            {HOW_STEPS.map((step, i) => (
              <div key={i} className={`anim anim-delay-${(i % 3) + 1}`} style={{ display:"flex", gap:"1.25rem", alignItems:"flex-start" }}>
                <div style={{ flexShrink:0, width:52, height:52, borderRadius:14, background:"rgba(245,200,0,.1)", border:"1px solid rgba(245,200,0,.2)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:"1.1rem", color:"var(--yellow)" }}>
                  {step.n}
                </div>
                <div>
                  <h3 style={{ fontSize:"1rem", fontWeight:700, color:"#fff", marginBottom:".35rem" }}>{step.title}</h3>
                  <p style={{ fontSize:".875rem", color:"rgba(255,255,255,.5)", lineHeight:1.6 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUIZ DEMO ───────────────────────────────────────────── */}
      <section style={{ background:"var(--black)" }}>
        <div className="section-inner" style={{ display:"grid", gridTemplateColumns:"1fr", gap:"2.5rem", alignItems:"center" }}>
          <div className="anim">
            <div className="section-label">Quiz personalizado</div>
            <h2 className="big">Teste o que você aprendeu<br /><em>em cada conversa</em></h2>
            <p className="subtitle">Ao encerrar o chat, o JV IA gera automaticamente 5 questões baseadas exatamente no que foi praticado — vocabulário, estruturas gramaticais e expressões que apareceram na conversa.</p>
            <ul style={{ marginTop:"1.5rem", display:"flex", flexDirection:"column", gap:".75rem" }}>
              {["Questões baseadas na SUA conversa, não genéricas", "Explicação da resposta certa em português", "Resultado salvo no histórico para acompanhar a evolução", "Sequência de dias para manter a consistência"].map((item, i) => (
                <li key={i} style={{ display:"flex", gap:".75rem", alignItems:"flex-start", fontSize:".9rem", color:"rgba(255,255,255,.65)" }}>
                  <span style={{ color:"var(--yellow)", fontWeight:700, flexShrink:0 }}>✓</span> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="anim anim-delay-2" style={{ display:"flex", justifyContent:"center" }}>
            <QuizMockup />
          </div>
        </div>
      </section>

      {/* ── REVISÃO DE AULA ─────────────────────────────────────── */}
      <section style={{ background:"#0d0d0d", borderTop:"1px solid #1a1a1a" }}>
        <div className="section-inner" style={{ display:"grid", gridTemplateColumns:"1fr", gap:"2.5rem", alignItems:"center" }}>
          <div className="anim anim-delay-1" style={{ display:"flex", justifyContent:"center", order:2 }}>
            {/* PDF mockup */}
            <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:20, padding:"1.5rem", maxWidth:380, width:"100%", boxShadow:"0 24px 80px rgba(0,0,0,.6)", fontFamily:"'Inter',sans-serif" }}>
              <div style={{ background:"rgba(245,200,0,.06)", border:"2px dashed rgba(245,200,0,.25)", borderRadius:14, padding:"2rem", textAlign:"center", marginBottom:"1.25rem" }}>
                <div style={{ fontSize:"2rem", marginBottom:".5rem" }}>📎</div>
                <p style={{ fontWeight:700, color:"#fff", fontSize:".85rem" }}>aula-present-perfect.pdf</p>
                <p style={{ color:"var(--yellow)", fontSize:".75rem", marginTop:4 }}>✓ Processado com sucesso</p>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {[
                  { role:"ai", text:"Oi! Analisei sua aula de hoje 📚 Vamos revisar juntos? Aqui estão os tópicos:\n• Present Perfect vs Simple Past\n• Palavras-chave: already, yet, ever, never\n• Pronúncia: have /hæv/ vs of /əv/" },
                  { role:"user", text:"Qual a diferença entre 'I have eaten' e 'I ate'?" },
                  { role:"ai", text:"Ótima pergunta! 'I have eaten' conecta o passado ao presente — você comeu e isso ainda é relevante agora. 'I ate' é um fato isolado no passado. Quer ver mais exemplos?" },
                ].map((msg, i) => (
                  <div key={i} style={{ display:"flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth:"85%", background: msg.role === "user" ? "var(--yellow)" : "#1a1a1a", color: msg.role === "user" ? "#000" : "#fff", borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding:".6rem .85rem", fontSize:".78rem", lineHeight:1.55, border: msg.role === "ai" ? "1px solid #2a2a2a" : "none", whiteSpace:"pre-line" }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="anim" style={{ order:1 }}>
            <div className="section-label">Exclusivo Combo</div>
            <h2 className="big">Revisão da aula<br /><em>com o JV IA</em></h2>
            <p className="subtitle">Envie o PDF da sua aula ao vivo e o JV IA lê o material, explica o conteúdo e responde qualquer dúvida — como se o professor estivesse com você nas outras horas do dia.</p>
            <ul style={{ marginTop:"1.5rem", display:"flex", flexDirection:"column", gap:".75rem" }}>
              {["Resumo automático do que foi estudado", "Chat para tirar dúvidas sobre a aula", "Quiz específico sobre o conteúdo do PDF", "Disponível para assinantes do combo Aulas + JV IA"].map((item, i) => (
                <li key={i} style={{ display:"flex", gap:".75rem", alignItems:"flex-start", fontSize:".9rem", color:"rgba(255,255,255,.65)" }}>
                  <span style={{ color:"var(--yellow)", fontWeight:700, flexShrink:0 }}>✓</span> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── PARA QUEM É ─────────────────────────────────────────── */}
      <section style={{ background:"var(--black)" }}>
        <div className="section-inner">
          <div className="anim" style={{ marginBottom:"3rem", textAlign:"center" }}>
            <div className="section-label">Para quem é?</div>
            <h2 className="big">Para quem quer <em>resultado de verdade</em></h2>
            <p className="subtitle" style={{ margin:"auto" }}>Não importa o seu nível — o JV IA se adapta e te desafia no ritmo certo.</p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:"0.95rem" }}>
            {[
              { emoji:"📅", title:"Alunos das aulas ao vivo", desc:"Pratique nos dias entre as aulas e chegue ao próximo encontro mais preparado." },
              { emoji:"⏱️", title:"Quem tem pouco tempo", desc:"10 minutos de conversa por dia já fazem diferença. Sem hora marcada, sem compromisso." },
              { emoji:"🗣️", title:"Quem trava na hora de falar", desc:"Treinar por escrito todos os dias elimina o bloqueio de produzir frases em inglês." },
              { emoji:"📖", title:"Quem quer fixar o vocabulário", desc:"O quiz ao final de cada conversa reforça o que foi praticado e ajuda a memorizar." },
              { emoji:"🌍", title:"Quem viaja ou trabalha em inglês", desc:"Pratique exatamente os cenários que você vai encontrar na vida real." },
              { emoji:"🎓", title:"Qualquer nível", desc:"Básico, intermediário ou avançado — o JV IA se adapta automaticamente ao seu inglês." },
            ].map((card, i) => (
              <div key={i} className={`feature-card anim anim-delay-${(i % 3) + 1}`}>
                <div style={{ fontSize:"1.75rem", marginBottom:".65rem" }}>{card.emoji}</div>
                <h3 style={{ fontSize:".95rem", fontWeight:700, color:"#fff", marginBottom:".4rem" }}>{card.title}</h3>
                <p style={{ fontSize:".85rem", color:"rgba(255,255,255,.5)", lineHeight:1.6 }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMUNIDADE ──────────────────────────────────────────── */}
      <section style={{ background:"var(--black)" }}>
        <div className="section-inner" style={{ display:"grid", gridTemplateColumns:"1fr", gap:"2.5rem", alignItems:"center" }}>
          <div className="anim">
            <div className="section-label">Comunidade</div>
            <h2 className="big">Aprenda e pratique<br /><em>com outros alunos</em></h2>
            <p className="subtitle">Compartilhe seus posts em inglês, receba feedback real de outros alunos e professores, edite suas mensagens com emojis — tudo em um ambiente colaborativo e sem julgamentos.</p>
            <ul style={{ marginTop:"1.5rem", display:"flex", flexDirection:"column", gap:".75rem" }}>
              {["Compartilhe posts e converse em inglês com a comunidade", "Edite seus posts e use emojis para expressar melhor", "Receba feedback e aprenda com outros alunos no mesmo nível", "Acompanhe a evolução da comunidade com discussões reais"].map((item, i) => (
                <li key={i} style={{ display:"flex", gap:".75rem", alignItems:"flex-start", fontSize:".9rem", color:"rgba(255,255,255,.65)" }}>
                  <span style={{ color:"var(--yellow)", fontWeight:700, flexShrink:0 }}>✓</span> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="anim anim-delay-2" style={{ display:"flex", justifyContent:"center" }}>
            <CommunityMockup />
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ───────────────────────────────────────────── */}
      <section style={{ background:"#0d0d0d", borderTop:"1px solid #1a1a1a" }}>
        <div className="section-inner" style={{ textAlign:"center", maxWidth:640, margin:"0 auto" }}>
          <div className="anim">
            <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>🤖</div>
            <h2 className="big" style={{ marginBottom:"1rem" }}>Pronto para praticar?<br /><em>Comece agora, grátis</em></h2>
            <p style={{ color:"rgba(255,255,255,.55)", lineHeight:1.7, marginBottom:"2rem" }}>
              O JV IA está disponível para todos os alunos. Faça login com sua conta e comece a conversar em inglês agora mesmo — sem configuração, sem taxa extra para o plano básico.
            </p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:".75rem", justifyContent:"center" }}>
              <a href="/app" style={{ background:"var(--yellow)", color:"#000", padding:".9rem 2.25rem", borderRadius:"50px", textDecoration:"none", fontWeight:800, fontSize:"1rem", boxShadow:"0 4px 24px rgba(245,200,0,.35)" }}>
                🤖 Abrir o JV IA
              </a>
              <a href={WPP} target="_blank" rel="noopener noreferrer" style={{ background:"transparent", color:"#fff", padding:".9rem 2rem", borderRadius:"50px", textDecoration:"none", fontWeight:600, fontSize:"1rem", border:"2px solid rgba(255,255,255,.15)", display:"flex", alignItems:"center", gap:".5rem" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Falar com o JV
              </a>
            </div>
            <p style={{ color:"rgba(255,255,255,.3)", fontSize:".78rem", marginTop:"1.25rem" }}>Já é aluno? Acesse com sua conta em <a href="/entrar" style={{ color:"var(--yellow)", textDecoration:"none" }}>faleinglesjv.com/entrar</a></p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer style={{ background:"var(--black)", borderTop:"1px solid #1a1a1a", padding:"2rem 1.25rem", textAlign:"center" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:".6rem", marginBottom:".75rem" }}>
          <Image src="/favicon.png" alt="JV IA" width={24} height={24} style={{ borderRadius:6 }} />
          <span style={{ fontWeight:800, fontSize:".9rem", color:"#fff" }}>JV <span style={{ color:"var(--yellow)" }}>IA</span></span>
        </div>
        <p style={{ color:"rgba(255,255,255,.3)", fontSize:".78rem" }}>© {new Date().getFullYear()} Fale Inglês JV. Todos os direitos reservados.</p>
        <div style={{ display:"flex", gap:"1.25rem", justifyContent:"center", marginTop:".75rem" }}>
          <a href="/" style={{ color:"rgba(255,255,255,.35)", fontSize:".78rem", textDecoration:"none" }}>Site principal</a>
          <a href="/app" style={{ color:"rgba(255,255,255,.35)", fontSize:".78rem", textDecoration:"none" }}>Acessar JV IA</a>
          <a href="/planos" style={{ color:"rgba(255,255,255,.35)", fontSize:".78rem", textDecoration:"none" }}>Planos</a>
        </div>
      </footer>
    </div>
  );
}
