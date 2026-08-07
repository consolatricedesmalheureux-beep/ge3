/* ═══════════════════════════════════════════════════════════════════════════
   GE 3.0 — Module ⑰ Administration (§6 du cahier des charges).

   Module supplémentaire, non prévu dans la version 3.0 : enregistrement des
   établissements et gestion des comptes.

   Le §6.2 fixe la règle : « la création des comptes d'un établissement
   relève de l'échelon immédiatement supérieur ». Cette règle est appliquée
   par la fonction serveur admin-comptes, seul endroit où la clé de service
   est employée. L'interface ci-dessous ne fait que proposer les actions
   permises ; elle ne décide rien.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* Qui administre quoi. Doit rester le miroir de PEUT_CREER, côté serveur. */
  const PEUT_CREER = {
    admin: ['ministere', 'ddemp', 'cs', 'up', 'dir', 'ens'],
    ministere: ['ddemp'],
    ddemp: ['cs'],
    cs: ['up', 'dir'],
    up: [],
    dir: ['ens'],
    ens: [],
  };

  const NOMS = {
    ministere: 'Ministère (MEMP)',
    ddemp: 'DDEMP',
    cs: 'Circonscription scolaire',
    up: "Responsable d'unité pédagogique",
    dir: "Directeur d'école",
    ens: 'Enseignant',
  };

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
    );

  let ecoles = [];

  /* ─────────────────────────── Interface ─────────────────────────── */

  function carteAccueil() {
    const grille = document.querySelector('.home-grid');
    if (!grille || document.getElementById('ge3-carte-admin')) return;
    const c = document.createElement('div');
    c.id = 'ge3-carte-admin';
    c.className = 'home-card';
    c.style.cssText =
      '--accent-from:#5a3d8a; --accent-to:#8b6bc4; --accent-text:#ffffff;' +
      '--accent-shadow:rgba(90,61,138,0.45);';
    c.setAttribute('onclick', "showTab('administration', this)");
    c.innerHTML =
      '<span class="hc-num">Module ⑰</span>' +
      '<div class="hc-icon-chip">🛠️</div>' +
      '<span class="hc-badge-title">Administration</span>' +
      '<span class="hc-desc">Établissements, comptes et paramètres</span>' +
      '<span class="hc-arrow">➜</span>';
    grille.appendChild(c);
  }

  function panneau() {
    if (document.getElementById('tab-administration')) return;
    const app = document.getElementById('app-content');
    if (!app) return;

    const role = GE3.profil.role;
    const creables = PEUT_CREER[role] || [];

    const div = document.createElement('div');
    div.className = 'tab-content';
    div.id = 'tab-administration';
    div.innerHTML = `
      <h2 style="color:#5a3d8a;">🛠️ Administration</h2>

      <section style="border:1px solid #ddd; border-radius:10px; padding:16px; margin-bottom:18px;">
        <h3 style="margin-top:0;">Créer un compte</h3>
        <p style="font-size:13px; color:#666; margin-top:0;">
          Chaque échelon crée les comptes du niveau qu'il encadre directement.
          ${creables.length
            ? 'Vous pouvez créer : <strong>' + creables.map((r) => esc(NOMS[r])).join(', ') + '</strong>.'
            : "<strong>Votre profil ne crée aucun compte.</strong>"}
        </p>
        ${
          creables.length
            ? `
        <div style="display:grid; gap:10px; grid-template-columns:repeat(auto-fit,minmax(190px,1fr));">
          <label>Profil<select id="adm-role" style="width:100%;padding:8px;">
            ${creables.map((r) => '<option value="' + r + '">' + esc(NOMS[r]) + '</option>').join('')}
          </select></label>
          <label>Identifiant<input id="adm-ident" placeholder="ex. kofficlasse" style="width:100%;padding:8px;"></label>
          <label>Mot de passe<input id="adm-mdp" type="text" placeholder="8 caractères minimum" style="width:100%;padding:8px;"></label>
          <label>Nom<input id="adm-nom" style="width:100%;padding:8px;"></label>
          <label>Prénom<input id="adm-prenom" style="width:100%;padding:8px;"></label>
          <label>Classe (enseignant)<input id="adm-classe" placeholder="ex. CM2" style="width:100%;padding:8px;"></label>
          <label id="adm-ecole-bloc" style="display:none;">École<select id="adm-ecole" style="width:100%;padding:8px;"></select></label>
        </div>
        <div id="adm-msg" style="min-height:22px; font-size:13px; font-weight:bold; margin:10px 0;"></div>
        <button id="adm-creer" style="background:#5a3d8a;color:#fff;border:none;padding:10px 18px;border-radius:8px;font-weight:bold;cursor:pointer;">
          Créer le compte
        </button>`
            : ''
        }
      </section>

      <section style="border:1px solid #ddd; border-radius:10px; padding:16px;">
        <h3 style="margin-top:0;">Comptes existants</h3>
        <div id="adm-liste" style="overflow-x:auto;">Chargement…</div>
      </section>
    `;
    app.appendChild(div);

    if (creables.length) {
      document.getElementById('adm-creer').addEventListener('click', creer);
      document.getElementById('adm-role').addEventListener('change', majEcole);
      majEcole();
    }
    chargerListe();
  }

  /* Une circonscription doit désigner l'école du directeur qu'elle crée ;
     un directeur, lui, n'a pas ce choix : c'est la sienne. */
  async function majEcole() {
    const bloc = document.getElementById('adm-ecole-bloc');
    const sel = document.getElementById('adm-ecole');
    if (!bloc || !sel) return;
    const role = document.getElementById('adm-role').value;
    const besoin = GE3.profil.role !== 'dir' && (role === 'dir' || role === 'ens');
    bloc.style.display = besoin ? '' : 'none';
    if (!besoin || sel.options.length) return;

    if (!ecoles.length) {
      const { data } = await GE3.sb.from('ecoles').select('id, nom').order('nom');
      ecoles = data || [];
    }
    sel.innerHTML = ecoles.map((e) => '<option value="' + e.id + '">' + esc(e.nom) + '</option>').join('');
  }

  const msg = (t, err) => {
    const m = document.getElementById('adm-msg');
    if (!m) return;
    m.style.color = err ? '#c0392b' : '#1a7a3c';
    m.textContent = t;
  };

  async function appeler(charge) {
    const { data, error } = await GE3.sb.functions.invoke('admin-comptes', { body: charge });
    if (error) {
      /* Le corps de la réponse porte le motif exact du refus ; sans lui on
         n'afficherait qu'un « Edge Function returned a non-2xx status ». */
      let detail = error.message;
      try {
        if (error.context && typeof error.context.json === 'function') {
          const c = await error.context.json();
          if (c && c.error) detail = c.error;
        }
      } catch {
        /* réponse illisible : on garde le message générique */
      }
      return { erreur: detail };
    }
    if (data && data.error) return { erreur: data.error };
    return { data };
  }

  async function creer() {
    const v = (id) => (document.getElementById(id) || {}).value || '';
    const ecoleSel = document.getElementById('adm-ecole');
    const besoinEcole = document.getElementById('adm-ecole-bloc').style.display !== 'none';

    if (!v('adm-ident') || v('adm-mdp').length < 8) {
      msg("Renseignez l'identifiant et un mot de passe d'au moins 8 caractères.", true);
      return;
    }

    msg('Création en cours…', false);
    const r = await appeler({
      action: 'creer',
      role: v('adm-role'),
      identifiant: v('adm-ident'),
      motDePasse: v('adm-mdp'),
      nom: v('adm-nom'),
      prenom: v('adm-prenom'),
      classe: v('adm-classe'),
      ecole_id: besoinEcole && ecoleSel ? ecoleSel.value : null,
    });

    if (r.erreur) {
      msg('❌ ' + r.erreur, true);
      return;
    }
    msg('✅ Compte créé : ' + r.data.identifiant, false);
    ['adm-ident', 'adm-mdp', 'adm-nom', 'adm-prenom', 'adm-classe'].forEach((id) => {
      const e = document.getElementById(id);
      if (e) e.value = '';
    });
    chargerListe();
  }

  async function chargerListe() {
    const hote = document.getElementById('adm-liste');
    if (!hote) return;

    const { data, error } = await GE3.sb
      .from('profiles')
      .select('id, role, nom, prenom, classe, actif')
      .order('role');

    if (error) {
      hote.textContent = 'Liste indisponible : ' + error.message;
      return;
    }
    if (!data || !data.length) {
      hote.textContent = 'Aucun compte dans votre périmètre.';
      return;
    }

    const peut = PEUT_CREER[GE3.profil.role] || [];
    hote.innerHTML =
      '<table style="width:100%; border-collapse:collapse; font-size:13px;">' +
      '<tr style="background:#f0eef7; text-align:left;">' +
      '<th style="padding:6px;">Profil</th><th style="padding:6px;">Nom</th>' +
      '<th style="padding:6px;">Classe</th><th style="padding:6px;">État</th>' +
      '<th style="padding:6px;">Actions</th></tr>' +
      data
        .map((p) => {
          const gerable = peut.includes(p.role);
          return (
            '<tr style="border-top:1px solid #eee;">' +
            '<td style="padding:6px;">' + esc(NOMS[p.role] || p.role) + '</td>' +
            '<td style="padding:6px;">' + esc([p.prenom, p.nom].filter(Boolean).join(' ') || '—') + '</td>' +
            '<td style="padding:6px;">' + esc(p.classe || '—') + '</td>' +
            '<td style="padding:6px;">' + (p.actif === false ? '⛔ suspendu' : '✅ actif') + '</td>' +
            '<td style="padding:6px;">' +
            (gerable
              ? '<button data-act="mdp" data-id="' + p.id + '" style="margin-right:6px;cursor:pointer;">Mot de passe</button>' +
                '<button data-act="statut" data-id="' + p.id + '" data-actif="' + (p.actif === false) + '" style="cursor:pointer;">' +
                (p.actif === false ? 'Réactiver' : 'Suspendre') + '</button>'
              : '<span style="color:#999;">—</span>') +
            '</td></tr>'
          );
        })
        .join('') +
      '</table>';

    hote.querySelectorAll('button[data-act]').forEach((b) =>
      b.addEventListener('click', () => actionLigne(b.dataset.act, b.dataset.id, b.dataset.actif === 'true'))
    );
  }

  async function actionLigne(act, id, activer) {
    if (act === 'mdp') {
      const mdp = prompt('Nouveau mot de passe (8 caractères minimum) :');
      if (!mdp) return;
      if (mdp.length < 8) {
        alert('Mot de passe trop court.');
        return;
      }
      const r = await appeler({ action: 'reinitialiser', id, motDePasse: mdp });
      alert(r.erreur ? '❌ ' + r.erreur : '✅ Mot de passe réinitialisé.');
      return;
    }
    if (act === 'statut') {
      const r = await appeler({ action: 'statut', id, actif: activer });
      if (r.erreur) {
        alert('❌ ' + r.erreur);
        return;
      }
      chargerListe();
    }
  }

  /* Le module n'apparaît que pour les profils qui administrent quelque
     chose, conformément au principe du §4.4. */
  function attendre() {
    if (window.GE3 && GE3.profil && GE3.profil.role && GE3.sb) {
      const role = GE3.profil.role;
      if ((PEUT_CREER[role] || []).length === 0) return;
      carteAccueil();
      panneau();
      return;
    }
    setTimeout(attendre, 300);
  }

  attendre();
})();
