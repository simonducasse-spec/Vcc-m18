// Ligue interne M18F — calcul des points (partagé par index.html et saisie.html)
// Modifier le barème ici : il s'applique à toutes les séances, passées comprises.
const LIGUE = (() => {
  const BAREME = {
    serviceRang: [3, 2, 1], // points par joueuse selon le rang de son équipe au challenge service
    record: 1,              // record personnel de service battu
    wash: 2,                // par manche de wash drill gagnée
    remontada: 2,           // par set gagné au match à remontada
    remontadaBonus: 1,      // set gagné par l'équipe menée
    sdaMax: 2,              // bonus Voir → Décider → Agir, max par joueuse et par séance
    fairplay: -1,           // rituel non respecté
  };
  const EQUIPES = ['A', 'B', 'C'];

  async function charger() {
    const r = await fetch('ligue.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('ligue.json introuvable (' + r.status + ')');
    return normaliser(await r.json());
  }

  function normaliser(d) {
    d = d || {};
    d.saison = d.saison || '';
    d.joueuses = Array.isArray(d.joueuses) ? d.joueuses : [];
    d.seances = Array.isArray(d.seances) ? d.seances : [];
    d.seances.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return d;
  }

  function equipeDe(seance, nom) {
    for (const e of EQUIPES) if ((seance.equipes?.[e] || []).includes(nom)) return e;
    return null;
  }
  function presentes(seance) {
    return EQUIPES.flatMap(e => seance.equipes?.[e] || []);
  }

  // Meilleur score de service de chaque joueuse AVANT la séance d'index idx
  function recordsAvant(data, idx) {
    const rec = {};
    data.seances.slice(0, idx).forEach(s => {
      Object.entries(s.service || {}).forEach(([nom, v]) => {
        if (typeof v === 'number' && (rec[nom] === undefined || v > rec[nom])) rec[nom] = v;
      });
    });
    return rec;
  }

  function rangsService(seance) {
    const totaux = {};
    EQUIPES.forEach(e => {
      const membres = seance.equipes?.[e] || [];
      if (!membres.length) return;
      const notes = membres.map(n => seance.service?.[n]).filter(v => typeof v === 'number');
      if (notes.length) totaux[e] = notes.reduce((a, b) => a + b, 0);
    });
    const rangs = {};
    Object.keys(totaux).forEach(e => {
      rangs[e] = 1 + Object.values(totaux).filter(t => t > totaux[e]).length;
    });
    return { totaux, rangs };
  }

  // Détail des points de chaque joueuse présente à la séance idx
  function pointsSeance(data, idx) {
    const s = data.seances[idx];
    const rec = recordsAvant(data, idx);
    const { rangs } = rangsService(s);
    const res = {};
    presentes(s).forEach(nom => {
      const e = equipeDe(s, nom);
      const p = { equipe: e, service: 0, record: 0, wash: 0, remontada: 0, bonus: 0, total: 0, recordBattu: false };
      if (rangs[e]) p.service = BAREME.serviceRang[rangs[e] - 1] || 0;
      const sc = s.service?.[nom];
      if (typeof sc === 'number' && rec[nom] !== undefined && sc > rec[nom]) { p.record = BAREME.record; p.recordBattu = true; }
      p.wash = (s.wash || []).filter(g => g === e).length * BAREME.wash;
      (s.remontada || []).forEach(set => {
        if (set.gagnante && set.gagnante === e) {
          p.remontada += BAREME.remontada;
          if (set.menee === e) p.remontada += BAREME.remontadaBonus;
        }
      });
      p.bonus = Math.min(s.sda?.[nom] || 0, BAREME.sdaMax) + ((s.fairplay || []).includes(nom) ? BAREME.fairplay : 0);
      p.total = p.service + p.record + p.wash + p.remontada + p.bonus;
      res[nom] = p;
    });
    return res;
  }

  function classement(data) {
    const t = {};
    data.joueuses.forEach(j => { t[j.nom] = { nom: j.nom, points: 0, seances: 0, derniere: null, record: null }; });
    data.seances.forEach((s, i) => {
      const pts = pointsSeance(data, i);
      Object.entries(pts).forEach(([nom, p]) => {
        t[nom] = t[nom] || { nom, points: 0, seances: 0, derniere: null, record: null };
        t[nom].points += p.total;
        t[nom].seances += 1;
      });
      Object.entries(s.service || {}).forEach(([nom, v]) => {
        if (t[nom] && typeof v === 'number' && (t[nom].record === null || v > t[nom].record)) t[nom].record = v;
      });
    });
    const last = data.seances.length - 1;
    if (last >= 0) {
      const pts = pointsSeance(data, last);
      Object.entries(pts).forEach(([nom, p]) => { if (t[nom]) t[nom].derniere = p.total; });
    }
    const liste = Object.values(t).sort((a, b) => b.points - a.points || a.nom.localeCompare(b.nom, 'fr'));
    liste.forEach(x => { x.rang = 1 + liste.filter(y => y.points > x.points).length; });
    return liste;
  }

  function dateFr(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  return { BAREME, EQUIPES, charger, normaliser, equipeDe, presentes, recordsAvant, rangsService, pointsSeance, classement, dateFr };
})();
