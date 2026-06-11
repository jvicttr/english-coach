export type TrailLevel = "A1" | "A2" | "B1" | "B2" | "C1";

export type TrailStep = {
  id: string;
  level: TrailLevel;
  order: number;
  emoji: string;
  title: string;
  desc: string;
  context: string; // passed to chat API as stepContext
};

export const LEVEL_INFO: Record<TrailLevel, { label: string; sublabel: string; color: string; userLevel: string[] }> = {
  A1: { label: "A1", sublabel: "Básico",            color: "#4ade80", userLevel: ["beginner"] },
  A2: { label: "A2", sublabel: "Elementar",         color: "#60a5fa", userLevel: ["beginner"] },
  B1: { label: "B1", sublabel: "Intermediário",     color: "#f59e0b", userLevel: ["intermediate"] },
  B2: { label: "B2", sublabel: "Intermediário Alto", color: "#f97316", userLevel: ["intermediate", "advanced"] },
  C1: { label: "C1", sublabel: "Avançado",          color: "#a78bfa", userLevel: ["advanced"] },
};

export const TRAIL_STEPS: TrailStep[] = [
  // ── A1 ────────────────────────────────────────────────────────────────────
  { id: "a1_1", level: "A1", order: 1, emoji: "👋", title: "Apresentações",   desc: "Diga seu nome, sua cidade e sua idade.",           context: "Practice basic introductions: name, nationality, age. Use: My name is, I'm from, I'm X years old, Nice to meet you." },
  { id: "a1_2", level: "A1", order: 2, emoji: "☀️", title: "Rotina Diária",   desc: "Fale sobre o que você faz todo dia.",              context: "Talk about your daily routine. Use: I wake up at, I go to work/school, Every day I, In the morning/evening." },
  { id: "a1_3", level: "A1", order: 3, emoji: "👨‍👩‍👧", title: "Família",         desc: "Descreva sua família.",                           context: "Describe your family. Use: I have a sister/brother, My mother/father is, I live with, My family has X people." },
  { id: "a1_4", level: "A1", order: 4, emoji: "🍕", title: "Comida",          desc: "Fale sobre o que você gosta de comer.",           context: "Talk about food preferences. Use: I love/hate, My favorite food is, I usually eat, I don't like, For breakfast I eat." },
  { id: "a1_5", level: "A1", order: 5, emoji: "⛅", title: "Clima",           desc: "Descreva o tempo e as estações do ano.",          context: "Talk about the weather and seasons. Use: It's hot/cold/raining/sunny, I love summer/winter, Today the weather is." },
  { id: "a1_6", level: "A1", order: 6, emoji: "🎮", title: "Hobbies",         desc: "Fale sobre o que você faz no tempo livre.",       context: "Talk about hobbies and free time. Use: I like/love/enjoy, In my free time I, I play/watch/read, My hobby is." },
  { id: "a1_7", level: "A1", order: 7, emoji: "🏪", title: "Compras",         desc: "Compre algo em uma loja em inglês.",              context: "Practice shopping conversations. Use: How much is this, I'd like to buy, It's too expensive, Do you have, I'll take it." },
  { id: "a1_8", level: "A1", order: 8, emoji: "🎨", title: "Cores e Objetos", desc: "Descreva coisas ao seu redor.",                   context: "Describe objects, colors, and things around you. Use: It's big/small/round, The color is, I can see, There is/are." },

  // ── A2 ────────────────────────────────────────────────────────────────────
  { id: "a2_1", level: "A2", order: 1, emoji: "💼", title: "Trabalho",        desc: "Fale sobre sua profissão.",                       context: "Talk about your job and workplace. Use: I work as, My job is to, I work at, My boss/colleague, At the office we." },
  { id: "a2_2", level: "A2", order: 2, emoji: "🏠", title: "Casa e Moradia",  desc: "Descreva onde você mora.",                        context: "Describe your home. Use: I live in, My apartment/house has, My favorite room is, My neighborhood is, I've been living here for." },
  { id: "a2_3", level: "A2", order: 3, emoji: "✈️", title: "Viagens",         desc: "Planeje uma viagem ou fale sobre uma passada.",   context: "Talk about travel and trips. Use: I want to visit, I'm going to, Have you ever been to, Last time I traveled, The best thing about." },
  { id: "a2_4", level: "A2", order: 4, emoji: "🍽️", title: "Restaurante",     desc: "Peça comida em um restaurante.",                  context: "Order food at a restaurant. Use: I'd like, Could I have, What do you recommend, The bill please, Is this dish spicy." },
  { id: "a2_5", level: "A2", order: 5, emoji: "📸", title: "Passado",         desc: "Conte o que você fez no passado.",                context: "Talk about past experiences. Use: Last weekend I, When I was young, I used to, A few years ago, I remember when." },
  { id: "a2_6", level: "A2", order: 6, emoji: "🔮", title: "Planos Futuros",  desc: "Fale sobre seus planos e sonhos.",                context: "Talk about future plans and dreams. Use: I'm going to, I want to, Someday I'll, In the future I hope to, I'm planning to." },
  { id: "a2_7", level: "A2", order: 7, emoji: "📱", title: "Tecnologia",      desc: "Fale sobre apps e redes sociais.",                context: "Talk about apps and social media. Use: I use, My favorite app is, I follow, I post about, Social media helps me, I spend too much time on." },
  { id: "a2_8", level: "A2", order: 8, emoji: "💪", title: "Saúde e Bem-estar", desc: "Fale sobre saúde, exercícios e hábitos.", context: "Talk about health and wellness. Use: I feel, I go to the gym, I should/shouldn't, I try to eat healthy, I sleep about X hours." },

  // ── B1 ────────────────────────────────────────────────────────────────────
  { id: "b1_1", level: "B1", order: 1, emoji: "📋", title: "Reuniões",        desc: "Participe de uma reunião de trabalho.",           context: "Practice business meeting language. Use: Let's discuss, I agree/disagree, Moving on, To summarize, Could we schedule, I'd like to add." },
  { id: "b1_2", level: "B1", order: 2, emoji: "🗣️", title: "Opiniões",        desc: "Expresse e defenda suas opiniões.",               context: "Express and defend opinions. Use: In my opinion, I believe that, On the other hand, I see your point but, To be honest, I think it depends." },
  { id: "b1_3", level: "B1", order: 3, emoji: "🔍", title: "Problemas",       desc: "Descreva e resolva um problema.",                 context: "Describe and solve problems. Use: The issue is, We could try, What if we, The root cause is, One solution would be, Have you considered." },
  { id: "b1_4", level: "B1", order: 4, emoji: "🔥", title: "Phrasal Verbs",   desc: "Use phrasal verbs naturalmente.",                 context: "Use common phrasal verbs naturally. Focus on: give up, figure out, come up with, deal with, bring up, look into, run into, carry out." },
  { id: "b1_5", level: "B1", order: 5, emoji: "🎯", title: "Entrevista",      desc: "Responda perguntas de entrevista de emprego.",    context: "Practice a job interview. Use: I have experience in, My strength is, I'm passionate about, A challenge I overcame, My goal is to, I'd bring to this role." },
  { id: "b1_6", level: "B1", order: 6, emoji: "📊", title: "Apresentações",   desc: "Faça uma apresentação curta.",                    context: "Give a short presentation. Use: Today I'd like to talk about, First/Second/Finally, As you can see, In conclusion, Any questions, The key takeaway is." },
  { id: "b1_7", level: "B1", order: 7, emoji: "📰", title: "Notícias",        desc: "Discuta um assunto do mundo.",                    context: "Discuss current events and news. Use: Have you heard about, I read that, It's interesting that, This could affect, I'm concerned about, What's your take." },
  { id: "b1_8", level: "B1", order: 8, emoji: "🌍", title: "Culturas",        desc: "Compare culturas e costumes diferentes.",         context: "Discuss cultural differences. Use: In Brazil we, I noticed that, It's common to, That's interesting because, Culture shapes, Where I'm from." },

  // ── B2 ────────────────────────────────────────────────────────────────────
  { id: "b2_1", level: "B2", order: 1, emoji: "🤝", title: "Negociação",      desc: "Negocie em inglês profissional.",                 context: "Practice negotiation. Use: I propose, We could compromise, That's a fair point, I'd be willing to, The bottom line is, Let's find middle ground." },
  { id: "b2_2", level: "B2", order: 2, emoji: "👑", title: "Liderança",       desc: "Fale sobre liderança e gestão.",                  context: "Discuss leadership and management. Use: The key is to, I'd encourage, From my perspective, What drives the team is, A good leader should, I believe in empowering." },
  { id: "b2_3", level: "B2", order: 3, emoji: "💡", title: "Idioms",          desc: "Use expressões idiomáticas naturalmente.",        context: "Use idiomatic expressions naturally. Focus on: hit the nail on the head, bite the bullet, think outside the box, the ball is in your court, cut to the chase." },
  { id: "b2_4", level: "B2", order: 4, emoji: "⚡", title: "Conflitos",       desc: "Lide com conflitos profissionalmente.",           context: "Handle professional conflicts. Use: I understand your concern, Let's find common ground, I respectfully disagree, What I'm hearing is, Can we step back and." },
  { id: "b2_5", level: "B2", order: 5, emoji: "🚀", title: "Pitch",           desc: "Apresente uma ideia ou produto.",                 context: "Give a business pitch. Use: The problem we're solving, Our solution is, The market opportunity, What sets us apart, Our next steps are, Imagine a world where." },
  { id: "b2_6", level: "B2", order: 6, emoji: "🌐", title: "Networking",      desc: "Faça networking profissional em inglês.",         context: "Practice professional networking. Use: What do you do, I've been working on, We should connect, I'd love to pick your brain, Have you been to these events before." },
  { id: "b2_7", level: "B2", order: 7, emoji: "🧠", title: "Argumentação",    desc: "Construa argumentos complexos.",                  context: "Build complex arguments. Use: Evidence suggests, Contrary to popular belief, This leads to, The implications are, One could argue, It would be remiss not to mention." },
  { id: "b2_8", level: "B2", order: 8, emoji: "😄", title: "Humor",           desc: "Entenda e use o humor em inglês.",                context: "Use and understand English humor. Use: That's ironic, Funny you should say, Speaking of which, You could say, That's an understatement, I couldn't help but notice." },

  // ── C1 ────────────────────────────────────────────────────────────────────
  { id: "c1_1", level: "C1", order: 1, emoji: "🎓", title: "Linguagem Formal", desc: "Use linguagem acadêmica e formal.",              context: "Use academic and formal language. Use: Furthermore, Nevertheless, It can be argued that, The evidence points to, This warrants further consideration." },
  { id: "c1_2", level: "C1", order: 2, emoji: "📖", title: "Storytelling",    desc: "Conte histórias de forma envolvente.",            context: "Tell engaging stories. Use: Picture this, What happened next was, The twist is, Against all odds, Little did I know, That's when everything changed." },
  { id: "c1_3", level: "C1", order: 3, emoji: "⚔️", title: "Debate",          desc: "Debata um tema complexo.",                        context: "Engage in complex debates. Use: I'd challenge that assumption, The counterargument would be, Building on that, If we follow that logic, That conflates two issues." },
  { id: "c1_4", level: "C1", order: 4, emoji: "🎭", title: "Metáforas",       desc: "Use metáforas e analogias com fluidez.",          context: "Use metaphors and analogies naturally. Use: It's like, Think of it as, By analogy, In the same way that, This mirrors, The parallel here is." },
  { id: "c1_5", level: "C1", order: 5, emoji: "⚡", title: "Improvisação",    desc: "Fale com fluidez sobre qualquer assunto.",        context: "Practice spontaneous speaking on any random topic. Focus on fluency, natural transitions, and keeping the conversation going without hesitation." },
  { id: "c1_6", level: "C1", order: 6, emoji: "🔬", title: "Nuances",         desc: "Domine os detalhes sutis do inglês.",             context: "Explore subtle language nuances: could vs would, slightly/somewhat/rather, imply vs infer, affect vs effect, who vs whom, and other native-level distinctions." },
  { id: "c1_7", level: "C1", order: 7, emoji: "🌟", title: "Liderança Avançada", desc: "Discuta cenários complexos de liderança.",    context: "Advanced leadership scenarios. Use: The underlying issue, What I'd advocate for, In retrospect, The systemic challenge is, This calls for a paradigm shift." },
  { id: "c1_8", level: "C1", order: 8, emoji: "🏆", title: "Maestria",        desc: "Conversa livre de nível nativo.",                 context: "Free advanced conversation demonstrating full fluency. Any topic. Focus on natural native-like expression, humor, cultural references, and effortless flow." },
];

export function getStartingLevel(userLevel: string): TrailLevel {
  if (userLevel === "advanced") return "B2";
  if (userLevel === "intermediate") return "B1";
  return "A1";
}

export function isStepUnlocked(stepId: string, completedIds: Set<string>): boolean {
  const step = TRAIL_STEPS.find((s) => s.id === stepId);
  if (!step) return false;
  if (step.order === 1) {
    // First step of a level — unlock if previous level is complete or it's the starting level
    const levelsOrder: TrailLevel[] = ["A1", "A2", "B1", "B2", "C1"];
    const levelIdx = levelsOrder.indexOf(step.level);
    if (levelIdx === 0) return true;
    const prevLevel = levelsOrder[levelIdx - 1];
    const prevLevelSteps = TRAIL_STEPS.filter((s) => s.level === prevLevel);
    return prevLevelSteps.every((s) => completedIds.has(s.id));
  }
  // All other steps: previous step in same level must be completed
  const prev = TRAIL_STEPS.find((s) => s.level === step.level && s.order === step.order - 1);
  return prev ? completedIds.has(prev.id) : false;
}
