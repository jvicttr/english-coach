"use client";

import { useState, useEffect } from "react";

const WPP = "https://wa.me/5561995691219?text=Ol%C3%A1%2C+quero+aprender+ingl%C3%AAs.+Quais+s%C3%A3o+os+planos+dispon%C3%ADveis%3F";

const WHY_CARDS = [
  { icon: "fa-user-graduate", title: "100% personalizado", desc: "Cada aula é planejada de acordo com o seu nível, objetivos e ritmo. Sem pacotes prontos que não servem para ninguém." },
  { icon: "fa-comments", title: "Foco em conversação", desc: "Você pratica falar desde a primeira aula. A fluência vem de praticar, não de decorar regras gramaticais." },
  { icon: "fa-calendar-alt", title: "Horários flexíveis", desc: "Você escolhe os melhores horários para encaixar no seu dia a dia. Fácil de agendar, fácil de remarcar." },
  { icon: "fa-globe-americas", title: "Inglês para a vida real", desc: "Vocabulário e situações do cotidiano: reuniões, viagens, entrevistas, séries, músicas — o que você realmente vai usar." },
  { icon: "fa-chart-line", title: "Progresso visível", desc: "Você vai notar a evolução da primeira à décima aula. Feedbacks constantes e acompanhamento personalizado." },
  { icon: "fa-heart", title: "Ambiente sem julgamentos", desc: "Erre à vontade — o erro faz parte do aprendizado. As aulas são um espaço seguro e descontraído para crescer." },
];

const FOR_WHOM = [
  { emoji: "✈️", title: "Quem vai viajar", desc: "Aprenda a se virar em qualquer situação no exterior com confiança." },
  { emoji: "💼", title: "Profissionais", desc: "Reuniões, e-mails, apresentações — inglês para alavancar sua carreira." },
  { emoji: "🎓", title: "Estudantes", desc: "Prepare-se para vestibulares, intercâmbios e certificações internacionais." },
  { emoji: "🌍", title: "Quem quer emigrar", desc: "Inglês sólido para uma nova vida no exterior com segurança linguística." },
  { emoji: "🎯", title: "Iniciantes do zero", desc: "Nunca estudou inglês? Perfeito. Começo do básico com paciência e método." },
  { emoji: "🚀", title: "Quem quer fluência", desc: "Já tem uma base mas trava na hora de falar? Vamos destravar juntos." },
];

const TESTIMONIALS = [
  { initial: "T", name: "Thaís Vicente", role: "São Paulo, SP", quote: "As aulas com o JV sempre foram muito efetivas. Ele realmente se preocupa com o progresso de cada aluno e adapta o conteúdo para o que você precisa. Recomendo de olhos fechados!" },
  { initial: "R", name: "Rafael Mendes", role: "Brasília, DF", quote: "Comecei do zero e em poucos meses já estava me virando em inglês nas viagens. O JV tem um jeito único de ensinar — as aulas passam voando e você aprende sem perceber." },
  { initial: "C", name: "Camila Rocha", role: "Rio de Janeiro, RJ", quote: "Precisava do inglês para uma promoção no trabalho. Com o JV aprendi o vocabulário certo para reuniões e apresentações. Consegui a promoção em 4 meses de aula!" },
];

const FAQS = [
  { q: "Preciso ter algum nível de inglês para começar?", a: "Não! Aceito alunos completamente iniciantes. As aulas são adaptadas ao seu nível atual, seja do zero ou intermediário/avançado." },
  { q: "Qual plataforma é usada para as aulas?", a: "As aulas acontecem pelo Microsoft Teams. Basta ter um computador, tablet ou celular com câmera e microfone. Simples assim!" },
  { q: "Posso remarcar uma aula se precisar?", a: "Sim! Entendo que a vida acontece. Você pode remarcar a aula sem nenhum custo adicional." },
  { q: "As aulas são gravadas?", a: "Sim! Todas as aulas são gravadas e enviadas para você revisar quantas vezes quiser. Ótimo para fixar o conteúdo depois." },
  { q: "Como funciona a aula experimental gratuita?", a: "É uma aula completa de 30 minutos, 100% grátis e sem compromisso. Você me conhece, avaliamos seu nível e vejo como posso te ajudar." },
  { q: "Em quanto tempo verei resultados?", a: "Depende do seu objetivo, mas a maioria dos alunos relata progresso perceptível já nas primeiras semanas. Consistência é a chave — quem estuda regularmente evolui muito rápido." },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visible"); observer.unobserve(e.target); } }),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".anim").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll("section[id]");
      const navLinks = document.querySelectorAll(".nav-links a");
      let current = "";
      sections.forEach((s) => { if (window.scrollY >= (s as HTMLElement).offsetTop - 100) current = s.id; });
      navLinks.forEach((a) => { (a as HTMLAnchorElement).style.color = a.getAttribute("href") === "#" + current ? "var(--yellow)" : ""; });
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest("nav")) setMenuOpen(false);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className="landing">
      {/* NAV */}
      <nav className={menuOpen ? "nav-open" : ""}>
        <a className="nav-logo" href="#inicio">
          <div style={{ width: 155, height: 44, overflow: "hidden", position: "relative" }}>
            <img src="/logo-amarelo.png" alt="Fale Inglês JV" style={{ position: "absolute", width: 158, top: "50%", left: 2, transform: "translateY(-50%)" }} />
          </div>
        </a>
        <div className="mobile-menu">
          <ul className="nav-links">
            <li><a href="#por-que" onClick={() => setMenuOpen(false)}>Por que JV?</a></li>
            <li><a href="#como-funciona" onClick={() => setMenuOpen(false)}>Como funciona</a></li>
            <li><a href="#depoimentos" onClick={() => setMenuOpen(false)}>Depoimentos</a></li>
            <li><a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a></li>
          </ul>
          <a className="nav-cta nav-cta-style" href={WPP} target="_blank" rel="noopener noreferrer">
            <i className="fab fa-whatsapp" /> Fale comigo
          </a>
        </div>
        <button className="hamburger" onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}>
          <i className={menuOpen ? "fas fa-times" : "fas fa-bars"} />
        </button>
      </nav>

      {/* HERO */}
      <section className="hero" id="inicio">
        <div className="hero-content">
          <h1>Fale inglês de verdade,<br /><em>do jeito que você precisa</em></h1>
          <p>Aulas 100% online, personalizadas para o seu objetivo — seja para viajar, trabalhar, se comunicar ou conquistar a fluência que você sempre quis.</p>
          <div className="hero-btns">
            <a className="btn-primary" href={WPP} target="_blank" rel="noopener noreferrer">
              <i className="fab fa-whatsapp" /> Aula experimental grátis
            </a>
            <a className="btn-secondary" href="#como-funciona">Como funciona</a>
          </div>
          <div className="hero-stats">
            <div className="stat"><div className="stat-num">5+</div><div className="stat-label">Anos de experiência</div></div>
            <div className="stat"><div className="stat-num">100%</div><div className="stat-label">Online e flexível</div></div>
            <div className="stat"><div className="stat-num">★ 5.0</div><div className="stat-label">Avaliação dos alunos</div></div>
          </div>
        </div>
        <div className="hero-image anim scale-up">
          <div className="float-badge top-right"><i className="fas fa-check-circle" /> Aula experimental grátis</div>
          <div className="hero-card">
            <div className="hero-avatar"><img src="/foto-jv.avif" alt="João Victor" /></div>
            <h3>João Victor</h3>
            <p>Professor de inglês há mais de 5 anos. Alunos em todo o Brasil e no exterior.</p>
            <div className="hero-card-tags">
              {["Fluência", "Negócios", "Viagem", "Conversação", "Iniciantes"].map((t) => (
                <span key={t} className="tag">{t}</span>
              ))}
            </div>
          </div>
          <div className="float-badge bottom-left"><i className="fas fa-map-marker-alt" /> Todo o Brasil e exterior</div>
        </div>
      </section>

      {/* POR QUE JV */}
      <section className="why" id="por-que">
        <div className="section-label anim">Por que escolher o JV?</div>
        <h2 className="anim anim-delay-1">Inglês que <em>realmente funciona</em></h2>
        <p className="subtitle anim anim-delay-2">Esqueça métodos engessados e livros que não te preparam para a vida real. Aqui as aulas são feitas para você.</p>
        <div className="why-grid">
          {WHY_CARDS.map((card, i) => (
            <div key={i} className={`why-card anim anim-delay-${(i % 3) + 1}`}>
              <div className="why-icon"><i className={`fas ${card.icon}`} /></div>
              <h3>{card.title}</h3>
              <p>{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="how" id="como-funciona">
        <div className="section-label anim">Como funciona</div>
        <h2 className="anim anim-delay-1">Simples, rápido e <em>sem burocracia</em></h2>
        <p className="subtitle anim anim-delay-2">Em menos de 24 horas você já pode estar tendo sua primeira aula.</p>
        <div className="steps">
          {[
            { n: 1, title: "Entre em contato", desc: "Mande uma mensagem no WhatsApp e me conte sobre seus objetivos e nível atual." },
            { n: 2, title: "Aula experimental grátis", desc: "Faço uma aula gratuita para avaliar seu nível e você me conhecer sem compromisso." },
            { n: 3, title: "Plano personalizado", desc: "Monto um plano de aulas sob medida para o seu ritmo, objetivo e disponibilidade." },
            { n: 4, title: "Comece a evoluir", desc: "Aulas pelo Microsoft Teams, materiais exclusivos e suporte contínuo via WhatsApp." },
          ].map((step, i) => (
            <div key={i} className={`step anim anim-delay-${i + 1}`}>
              <div className="step-num">{step.n}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PARA QUEM */}
      <section className="forwhom">
        <div className="section-label anim">Para quem é?</div>
        <h2 className="anim anim-delay-1">Para quem quer <em>resultados de verdade</em></h2>
        <p className="subtitle anim anim-delay-2">Independente do seu nível ou objetivo, você tem um lugar aqui.</p>
        <div className="forwhom-grid">
          {FOR_WHOM.map((card, i) => (
            <div key={i} className={`forwhom-card anim anim-delay-${(i % 3) + 1}`}>
              <div className="forwhom-icon">{card.emoji}</div>
              <div><h3>{card.title}</h3><p>{card.desc}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section className="testimonials" id="depoimentos">
        <div className="section-label anim">Depoimentos</div>
        <h2 className="anim anim-delay-1">O que os alunos <em>dizem</em></h2>
        <p className="subtitle anim anim-delay-2">Resultados reais de pessoas reais que passaram pelas aulas do JV.</p>
        <div className="t-grid">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className={`t-card anim anim-delay-${i + 1}`}>
              <div className="stars">★★★★★</div>
              <blockquote>&ldquo;{t.quote}&rdquo;</blockquote>
              <div className="t-author">
                <div className="t-avatar">{t.initial}</div>
                <div><div className="t-name">{t.name}</div><div className="t-role">{t.role}</div></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA CONTATO */}
      <div className="contact-cta anim scale-up">
        <h2>Pronto para dar o <em>primeiro passo</em>?</h2>
        <p>Mande uma mensagem e descubra qual plano é ideal para o seu objetivo e rotina. Respondo rápido!</p>
        <a className="btn-wpp-big" href={WPP} target="_blank" rel="noopener noreferrer">
          <i className="fab fa-whatsapp" /> Ver planos disponíveis
        </a>
      </div>

      {/* BITCOIN */}
      <div className="bitcoin-banner">
        <div className="icon"><i className="fab fa-bitcoin" /></div>
        <div>
          <h3>Pague em Bitcoin e ganhe 10% de desconto!</h3>
          <p>Aceito pagamento em criptomoedas. Entre em contato para saber como funciona.</p>
        </div>
        <a className="btn-yellow" href={WPP} target="_blank" rel="noopener noreferrer">
          <i className="fab fa-bitcoin" /> Saber mais
        </a>
      </div>

      {/* FAQ */}
      <section className="faq" id="faq">
        <div style={{ textAlign: "center" }}>
          <div className="section-label anim">Dúvidas frequentes</div>
          <h2 className="anim anim-delay-1">Perguntas <em>frequentes</em></h2>
        </div>
        <div className="faq-list">
          {FAQS.map((item, i) => (
            <div key={i} className={`faq-item anim anim-delay-${Math.min(i + 1, 5)} ${openFaq === i ? "open" : ""}`}>
              <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                {item.q} <i className="fas fa-chevron-down" />
              </button>
              <div className="faq-a">{item.a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="cta-section">
        <h2 className="anim">Pronto para começar sua jornada rumo à <em>fluência</em>?</h2>
        <p className="anim anim-delay-1">Dê o primeiro passo hoje. A aula experimental é gratuita e sem compromisso.</p>
        <a className="cta-wpp anim anim-delay-2" href={WPP} target="_blank" rel="noopener noreferrer">
          <i className="fab fa-whatsapp" /> Agendar aula gratuita agora
        </a>
      </section>

      {/* FOOTER */}
      <footer>
        <div>
          <div className="footer-logo" style={{ marginBottom: ".75rem" }}>
            <div style={{ width: 155, height: 44, overflow: "hidden", position: "relative" }}>
              <img src="/logo-amarelo.png" alt="Fale Inglês JV" style={{ position: "absolute", width: 158, top: "50%", left: 2, transform: "translateY(-50%)", opacity: 0.9 }} />
            </div>
          </div>
          <div className="footer-info">
            📱 (61) 99569-1219 · ✉️ contato@faleinglesjv.com.br<br />
            CNPJ: 46.794.713/0001-75 · © 2026 Fale Inglês JV. Todos os direitos reservados.
          </div>
        </div>
        <div className="footer-social">
          <a href="https://instagram.com/faleinglesjv" target="_blank" rel="noopener noreferrer" title="Instagram"><i className="fab fa-instagram" /></a>
          <a href="https://www.linkedin.com/in/jo%C3%A3o-victor-mota-araujo/" target="_blank" rel="noopener noreferrer" title="LinkedIn"><i className="fab fa-linkedin-in" /></a>
          <a href="https://www.youtube.com/@faleinglesjv" target="_blank" rel="noopener noreferrer" title="YouTube"><i className="fab fa-youtube" /></a>
          <a href={WPP} target="_blank" rel="noopener noreferrer" title="WhatsApp"><i className="fab fa-whatsapp" /></a>
        </div>
      </footer>

      {/* WPP FLUTUANTE */}
      <a className="wpp-float" href={WPP} target="_blank" rel="noopener noreferrer" title="Fale comigo no WhatsApp">
        <i className="fab fa-whatsapp" />
      </a>
    </div>
  );
}
