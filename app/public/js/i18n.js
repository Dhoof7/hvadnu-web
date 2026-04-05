const TRANSLATIONS = {
  da: {
    'nav.logo': 'Hvadnu',
    'nav.howItWorks': 'Sådan virker det',
    'nav.about': 'Om os',
    'nav.back': '← Tilbage til planer',
    'nav.tryAgain': '← Prøv igen',
    'nav.exit': '✕ Afslut',
    'hero.eyebrow': 'DIN PERSONLIGE PLANMAGER',
    'hero.h1': 'Ingen planer i den nye by?<br><em>VI har dem.</em>',
    'hero.sub': 'Beskriv din situation og få 3 personlige planer — med steder, aktiviteter og booking-links.',
    'hero.placeholder': 'Fx vi er 5 drenge i København, vil spise først og så ud i byen bagefter...',
    'hero.cta': 'Find mine planer →',
    'hero.quizLink': 'Foretrækker du spørgsmål? <a href="/quiz">Tag quizzen →</a>',
    'hero.loc.title': 'Anbefalede steder nær dig',
    'hero.loc.sub': 'Tillad lokation og se de bedste steder i din by',
    'hero.loc.btn': 'Tillad lokation →',
    'hero.feat1.title': 'Planer på sekunder', 'hero.feat1.sub': 'AI finder de bedste steder til dig',
    'hero.feat2.title': 'Lokale anbefalinger', 'hero.feat2.sub': 'Kendte og skjulte perler i din by',
    'hero.feat3.title': 'Personlig tilpasning', 'hero.feat3.sub': '3 unikke planer der passer til jer',
    'hiw.eyebrow': 'SÅDAN VIRKER DET',
    'hiw.title': 'Tre trin til en god dag',
    'hiw.step1.title': 'Beskriv din situation',
    'hiw.step1.text': 'Fortæl os hvem du er med, hvad I har lyst til, og hvad by I er i. Eller tag quizzen.',
    'hiw.step2.title': 'Få 3 personlige planer',
    'hiw.step2.text': 'Vores AI bygger komplette aktivitetsplaner — ikke bare en liste, men en rigtig rækkefølge der hænger sammen.',
    'hiw.step3.title': 'Nyd jeres dag',
    'hiw.step3.text': 'Vælg den plan der passer jer, se trin-for-trin guiden og gå af sted.',
    'hiw.cta': 'Kom i gang →',
    'examples.eyebrow': 'EKSEMPEL PLANER',
    'examples.title': 'De slags planer vi laver',
    'examples.tag1': 'Par · Hyggeligt · 2–3 timer',
    'examples.tag2': 'Venner · Sjovt · Hel dag',
    'examples.tag3': 'Familie · Aktivt · Hel dag',
    'cta.eyebrow': 'KLAR?',
    'cta.title': 'Hvad skal I lave <em>i dag?</em>',
    'cta.sub': 'Tager under et minut. Du har 3 planer på sekunder.',
    'cta.btn': 'Find min plan →',
    'footer.note': '© 2026 hvadnu · Lad appen beslutte. Du nyder.',
    'quiz.city.eyebrow': 'KOM I GANG',
    'quiz.city.question': 'Hvilken by er I i?',
    'quiz.city.hint': 'Valgfrit — hjælper os med at tilpasse planen til dit område.',
    'quiz.city.cta': 'Fortsæt →',
    'quiz.city.skip': 'Spring dette trin over',
    'quiz.who.eyebrow': 'GODT AT VIDE',
    'quiz.who.question': 'Hvem er du med i dag?',
    'quiz.couple.label': 'Date', 'quiz.couple.sub': 'Bare jer to',
    'quiz.friends.label': 'Venner', 'quiz.friends.sub': 'Gruppe hygge',
    'quiz.family.label': 'Familie', 'quiz.family.sub': 'Børn kan være med',
    'quiz.budget.eyebrow': 'DIT BUDGET',
    'quiz.budget.question': 'Hvad er dit budget?',
    'quiz.low.label': 'Lavt', 'quiz.low.sub': 'Under 100kr per person',
    'quiz.medium.label': 'Middel', 'quiz.medium.sub': '100–300kr per person',
    'quiz.high.label': 'Forkæl os', 'quiz.high.sub': '300kr+ per person',
    'quiz.time.eyebrow': 'DIN TIDSPLAN',
    'quiz.time.question': 'Hvor meget tid har I?',
    'quiz.1h.label': 'Kort udflugt', 'quiz.1h.sub': 'Cirka 1 time',
    'quiz.2-3h.label': 'Et par timer', 'quiz.2-3h.sub': '2 til 3 timer',
    'quiz.fullday.label': 'Hel dag', 'quiz.fullday.sub': '6+ timer, gør det til noget',
    'quiz.setting.eyebrow': 'STEMNINGEN',
    'quiz.setting.question': 'Indendørs eller udendørs?',
    'quiz.indoor.label': 'Indendørs', 'quiz.indoor.sub': 'Caféer, gallerier, steder',
    'quiz.outdoor.label': 'Udendørs', 'quiz.outdoor.sub': 'Parker, markeder, gader',
    'quiz.mix.label': 'Bland det', 'quiz.mix.sub': 'Begge er fint',
    'quiz.mood.eyebrow': 'SIDSTE SPØRGSMÅL',
    'quiz.mood.question': 'Hvad er stemningen?',
    'quiz.cozy.label': 'Hyggeligt',
    'quiz.active.label': 'Aktivt',
    'quiz.relaxed.label': 'Afslappet',
    'quiz.romantic.label': 'Romantisk',
    'quiz.fun.label': 'Sjovt',
    'results.eyebrow': 'DINE PLANER',
    'results.title': 'Her er dine <em>3 planer</em>',
    'results.notFeeling': 'Ikke tilfreds med nogen af dem?',
    'results.newPlans': 'Generer nye planer →',
    'results.viewPlan': 'Se plan →',
    'results.loading': 'Finder dine perfekte planer',
    'results.hint1': 'Matcher din stemning med de bedste aktiviteter...',
    'results.hint2': 'Bygger dit trin-for-trin program...',
    'results.hint3': 'Finder den perfekte kombination af stop...',
    'results.hint4': 'Næsten klar — lægger de sidste detaljer...',
    'results.enriching': 'Finder rigtige steder nær dig...',
    'results.error': 'Noget gik galt',
    'results.tryAgain': 'Prøv igen →',
    'plan.backBtn': '← Se alle 3 planer',
    'plan.whyTitle': 'Hvorfor passer det til dig',
    'plan.stepsTitle': 'Din plan, trin for trin',
    'plan.spotsTitle': 'Find stederne',
    'plan.mapsNote': 'Klik på et sted nedenfor for at søge på Google Maps.',
    'plan.diffPlans': 'Find andre planer',
    'plan.printBtn': 'Print plan',
    'plan.mapsLink': 'Find på Google Maps',
    'plan.bookTable': 'Book et bord →',
    'plan.stat.price': 'Pris',
    'plan.stat.time': 'Tid',
    'plan.stat.cost': 'Omkostning',
    'plan.stat.stops': 'stop planlagt i',
  }
};

function getCurrentLang() { return 'da'; }

function applyLang() {
  document.documentElement.lang = 'da';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const val = TRANSLATIONS.da[key];
    if (val === undefined) return;
    if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text')) {
      el.placeholder = val;
    } else {
      el.innerHTML = val;
    }
  });
}

function t(key) {
  return TRANSLATIONS.da[key] || key;
}

document.addEventListener('DOMContentLoaded', () => applyLang('da'));
