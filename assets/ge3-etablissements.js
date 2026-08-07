/* ═══════════════════════════════════════════════════════════════════════════
   GE 3.0 — Enregistrement des établissements (§6.1) et tableaux de bord
   des échelons supérieurs (phase 6 du §12).

   §6.1 : un établissement se déclare avec son identification, son
   rattachement, le nombre de classes qu'il peut ouvrir, les niveaux
   effectivement ouverts, l'année d'activité et le statut de son compte.

   §6.2 : « chaque échelon administre le niveau qu'il encadre directement ».
   La circonscription enregistre les écoles de son ressort, la DDEMP ses
   circonscriptions. La règle est portée par la RLS ; l'interface se contente
   de ne pas proposer ce qui sera refusé.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const NIVEAUX = ['Ma1', 'Ma2', 'Ma3', 'CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
    );
  const pct = (v) => (v == null ? '—' : Number(v).toFixed(2) + ' %');
  const nb = (v) => (v == null ? '—' : v);

  const anneeCourante = () => {
    const d = new Date();
    const y = d.getFullYear();
    return d.getMonth() >= 8 ? y + '-' + (y + 1) : y - 1 + '-' + y;
  };

  /* ═══════════════ Établissements — section du module ⑰ ═══════════════ */

  function sectionEtablissements() {
    const panneau = document.getElementById('tab-administration');
    if (!panneau || document.getElementById('adm-etab')) return;

    const role = GE3.profil.role;
    const peutEcoles = role === 'admin' || role === 'cs';
    const peutUP = role === 'admin' || role === 'cs';
    if (!peutEcoles && !peutUP) return;

    const s = document.createElement('section');
    s.id = 'adm-etab';
    s.style.cssText = 'border:1px solid #ddd; border-radius:10px; padding:16px; margin-bottom:18px;';
    s.innerHTML = `
      <h3 style="margin-top:0;">Établissements et unités pédagogiques</h3>
      <p style="font-size:13px;color:#666;margin-top:0;">
        Chaque échelon administre le niveau qu'il encadre directement.
      </p>

      ${peutUP ? `
      <div style="margin-bottom:14px;">
        <strong style="font-size:13px;">Nouvelle unité pédagogique</strong>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
          <input id="up-nom" placeholder="Nom de l'unité" style="padding:8px;flex:1;min-width:180px;">
          <button id="up-creer" style="background:#5a3d8a;color:#fff;border:none;padding:9px 16px;border-radius:8px;font-weight:bold;cursor:pointer;">Enregistrer</button>
        </div>
      </div>` : ''}

      ${peutEcoles ? `
      <div>
        <strong style="font-size:13px;">Nouvel établissement</strong>
        <div style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-top:6px;">
          <label>Dénomination<input id="ec-nom" style="width:100%;padding:8px;"></label>
          <label>Statut<select id="ec-statut" style="width:100%;padding:8px;">
            <option value="public">Public</option><option value="prive">Privé</option></select></label>
          <label>Commune<input id="ec-commune" style="width:100%;padding:8px;"></label>
          <label>Zone<input id="ec-zone" style="width:100%;padding:8px;"></label>
          <label>Unité pédagogique<select id="ec-up" style="width:100%;padding:8px;"></select></label>
          <label>Classes autorisées<input id="ec-nbcl" type="number" min="1" max="30" style="width:100%;padding:8px;"></label>
          <label>Année scolaire<input id="ec-annee" value="${anneeCourante()}" style="width:100%;padding:8px;"></label>
          <label>Statut du compte<select id="ec-compte" style="width:100%;padding:8px;">
            <option value="actif">Actif</option><option value="suspendu">Suspendu</option><option value="clos">Clos</option></select></label>
        </div>
        <div style="margin-top:8px;font-size:13px;">
          <strong>Niveaux ouverts</strong><br>
          ${NIVEAUX.map((n) =>
            '<label style="margin-right:10px;"><input type="checkbox" class="ec-niv" value="' + n + '"> ' + n + '</label>'
          ).join('')}
        </div>
        <div id="etab-msg" style="min-height:22px;font-size:13px;font-weight:bold;margin:8px 0;"></div>
        <button id="ec-creer" style="background:#5a3d8a;color:#fff;border:none;padding:10px 18px;border-radius:8px;font-weight:bold;cursor:pointer;">
          Enregistrer l'établissement
        </button>
      </div>` : ''}

      <div id="etab-liste" style="margin-top:16px;overflow-x:auto;">Chargement…</div>
    `;
    panneau.insertBefore(s, panneau.querySelector('section') || null);

    if (peutUP) document.getElementById('up-creer').addEventListener('click', creerUP);
    if (peutEcoles) document.getElementById('ec-creer').addEventListener('click', creerEcole);
    chargerUP();
    listerEcoles();
  }

  const msgEtab = (t, err) => {
    const m = document.getElementById('etab-msg');
    if (!m) return;
    m.style.color = err ? '#c0392b' : '#1a7a3c';
    m.textContent = t;
  };

  async function chargerUP() {
    const sel = document.getElementById('ec-up');
    if (!sel) return;
    const { data } = await GE3.sb.from('ups').select('id, nom').order('nom');
    sel.innerHTML =
      '<option value="">— aucune —</option>' +
      (data || []).map((u) => '<option value="' + u.id + '">' + esc(u.nom) + '</option>').join('');
  }

  async function creerUP() {
    const nom = (document.getElementById('up-nom').value || '').trim();
    if (!nom) return;
    const ligne = { nom };
    /* La circonscription ne peut créer que dans son ressort ; la RLS le
       vérifie, on renseigne donc le rattachement attendu. */
    if (GE3.profil.role === 'cs') ligne.cs_id = GE3.profil.cs_id;
    const { error } = await GE3.sb.from('ups').insert(ligne);
    if (error) {
      alert('❌ ' + error.message);
      return;
    }
    document.getElementById('up-nom').value = '';
    chargerUP();
    alert('✅ Unité pédagogique enregistrée.');
  }

  async function creerEcole() {
    const v = (id) => (document.getElementById(id) || {}).value || '';
    const nom = v('ec-nom').trim();
    if (!nom) {
      msgEtab("La dénomination de l'établissement est obligatoire.", true);
      return;
    }
    const niveaux = [...document.querySelectorAll('.ec-niv:checked')].map((c) => c.value);
    const nbcl = parseInt(v('ec-nbcl'), 10);

    /* Cohérence élémentaire : on ne déclare pas plus de niveaux ouverts que
       de classes autorisées, sinon l'école ne pourra pas les ouvrir. */
    if (nbcl && niveaux.length > nbcl) {
      msgEtab(
        niveaux.length + ' niveaux ouverts pour seulement ' + nbcl + ' classe(s) autorisée(s).',
        true
      );
      return;
    }

    const ligne = {
      nom,
      statut: v('ec-statut'),
      commune: v('ec-commune') || null,
      zone: v('ec-zone') || null,
      up_id: v('ec-up') || null,
      nb_classes_autorisees: isNaN(nbcl) ? null : nbcl,
      niveaux_ouverts: niveaux.length ? niveaux : null,
      annee: v('ec-annee') || null,
      statut_compte: v('ec-compte'),
    };
    if (GE3.profil.role === 'cs') {
      ligne.cs_id = GE3.profil.cs_id;
      ligne.ddemp_id = GE3.profil.ddemp_id || null;
    }

    msgEtab('Enregistrement…', false);
    const { error } = await GE3.sb.from('ecoles').insert(ligne);
    if (error) {
      msgEtab('❌ ' + error.message, true);
      return;
    }
    msgEtab('✅ Établissement enregistré.', false);
    ['ec-nom', 'ec-commune', 'ec-zone', 'ec-nbcl'].forEach((id) => {
      const e = document.getElementById(id);
      if (e) e.value = '';
    });
    document.querySelectorAll('.ec-niv:checked').forEach((c) => (c.checked = false));
    listerEcoles();
  }

  async function listerEcoles() {
    const hote = document.getElementById('etab-liste');
    if (!hote) return;
    const { data, error } = await GE3.sb
      .from('ecoles')
      .select('id, nom, statut, commune, nb_classes_autorisees, niveaux_ouverts, statut_compte, annee')
      .order('nom');
    if (error) {
      hote.textContent = 'Liste indisponible : ' + error.message;
      return;
    }
    if (!data || !data.length) {
      hote.textContent = 'Aucun établissement enregistré.';
      return;
    }
    hote.innerHTML =
      '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
      '<tr style="background:#f0eef7;text-align:left;">' +
      ['École', 'Statut', 'Commune', 'Classes', 'Niveaux', 'Compte', 'Année']
        .map((h) => '<th style="padding:6px;">' + h + '</th>').join('') +
      '</tr>' +
      data.map((e) =>
        '<tr style="border-top:1px solid #eee;">' +
        '<td style="padding:6px;font-weight:600;">' + esc(e.nom) + '</td>' +
        '<td style="padding:6px;">' + esc(e.statut || '—') + '</td>' +
        '<td style="padding:6px;">' + esc(e.commune || '—') + '</td>' +
        '<td style="padding:6px;">' + nb(e.nb_classes_autorisees) + '</td>' +
        '<td style="padding:6px;">' + esc((e.niveaux_ouverts || []).join(' ') || '—') + '</td>' +
        '<td style="padding:6px;">' + esc(e.statut_compte || '—') + '</td>' +
        '<td style="padding:6px;">' + esc(e.annee || '—') + '</td></tr>'
      ).join('') +
      '</table>';
  }

  /* ═══════════════ Module ⑱ — Tableau de bord ═══════════════ */

  const AVEC_TABLEAU = ['admin', 'ministere', 'ddemp', 'cs'];

  function moduleTableau() {
    if (!AVEC_TABLEAU.includes(GE3.profil.role)) return;
    const grille = document.querySelector('.home-grid');
    const app = document.getElementById('app-content');
    if (!grille || !app || document.getElementById('tab-tableauBord')) return;

    const carte = document.createElement('div');
    carte.className = 'home-card';
    carte.style.cssText =
      '--accent-from:#1a5fb4; --accent-to:#5b9bdb; --accent-text:#ffffff; --accent-shadow:rgba(26,95,180,.45);';
    carte.setAttribute('onclick', "showTab('tableauBord', this)");
    carte.innerHTML =
      '<span class="hc-num">Module ⑱</span><div class="hc-icon-chip">📡</div>' +
      '<span class="hc-badge-title">Tableau de bord</span>' +
      '<span class="hc-desc">Vision consolidée de votre périmètre</span>' +
      '<span class="hc-arrow">➜</span>';
    grille.appendChild(carte);

    const p = document.createElement('div');
    p.className = 'tab-content';
    p.id = 'tab-tableauBord';
    p.innerHTML = `
      <h2 style="color:#1a5fb4;">📡 Tableau de bord</h2>
      <p style="font-size:13px;color:#666;margin-top:0;">
        Chiffres consolidés à partir des saisies des enseignants. Aucune donnée
        nominative ne remonte à ce niveau.
      </p>
      <div style="display:flex;gap:10px;align-items:flex-end;margin-bottom:14px;">
        <label>Année scolaire<br><input id="tb-annee" value="${anneeCourante()}" style="padding:8px;"></label>
        <button id="tb-calc" style="background:#1a5fb4;color:#fff;border:none;padding:10px 16px;border-radius:8px;font-weight:bold;cursor:pointer;">Actualiser</button>
        <span id="tb-msg" style="font-size:13px;font-weight:bold;"></span>
      </div>
      <div id="tb-contenu"></div>`;
    app.appendChild(p);

    document.getElementById('tb-calc').addEventListener('click', actualiserTableau);
    actualiserTableau();
  }

  function bloc(titre, colonnes, lignes, cles) {
    if (!lignes || !lignes.length) return '';
    return (
      '<h3 style="margin-bottom:6px;">' + titre + '</h3>' +
      '<div style="overflow-x:auto;margin-bottom:18px;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
      '<tr style="background:#e6eef8;text-align:left;">' +
      colonnes.map((c) => '<th style="padding:7px;">' + c + '</th>').join('') + '</tr>' +
      lignes.map((l) =>
        '<tr style="border-top:1px solid #eee;">' +
        cles.map((k) =>
          '<td style="padding:7px;">' + (k === 'taux' ? pct(l[k]) : esc(nb(l[k]))) + '</td>'
        ).join('') + '</tr>'
      ).join('') +
      '</table></div>'
    );
  }

  async function actualiserTableau() {
    const m = document.getElementById('tb-msg');
    const hote = document.getElementById('tb-contenu');
    m.style.color = '#666';
    m.textContent = 'Calcul…';

    const { data, error } = await GE3.sb.rpc('tableau_de_bord', {
      p_annee: document.getElementById('tb-annee').value.trim(),
    });
    if (error) {
      m.style.color = '#c0392b';
      m.textContent = 'Calcul impossible : ' + error.message;
      return;
    }
    if (data.erreur) {
      m.style.color = '#c0392b';
      m.textContent = data.erreur;
      hote.innerHTML = '';
      return;
    }
    m.textContent = '';

    const html =
      bloc('Vision nationale', ['Évaluation', 'N°', 'Écoles', 'Effectif', 'Garçons', 'Filles', 'Réussites', 'Taux'],
        data.national, ['type', 'numero', 'nb_ecoles', 'effectif', 'garcons', 'filles', 'reussites', 'taux']) +
      bloc('Par département (DDEMP)', ['DDEMP', 'Écoles', 'Effectif', 'Réussites', 'Taux'],
        data.ddemps, ['ddemp', 'nb_ecoles', 'effectif', 'reussites', 'taux']) +
      bloc('Par circonscription', ['Circonscription', 'Écoles', 'Effectif', 'Réussites', 'Taux'],
        data.circonscriptions, ['cs', 'nb_ecoles', 'effectif', 'reussites', 'taux']) +
      bloc('Par école', ['École', 'Effectif', 'Garçons', 'Filles', 'Réussites', 'Taux'],
        data.ecoles, ['ecole', 'effectif', 'garcons', 'filles', 'reussites', 'taux']);

    hote.innerHTML =
      html ||
      '<p style="color:#a06000;font-weight:bold;">Aucune donnée pour cette année. ' +
        'Les chiffres apparaîtront dès que des notes auront été saisies.</p>';
  }

  /* ═══════════════ Démarrage ═══════════════ */

  function attendre() {
    if (!(window.GE3 && GE3.profil && GE3.sb)) {
      setTimeout(attendre, 300);
      return;
    }
    sectionEtablissements();
    moduleTableau();
  }
  attendre();
})();
