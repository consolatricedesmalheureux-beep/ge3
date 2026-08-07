/* ═══════════════════════════════════════════════════════════════════════════
   GE 3.0 — Modules ⑬ Synthèse École et ⑭ Synthèse UP.

   Ces deux modules changent de nature (§4.3) :

     Effectifs et résultats chiffrés : saisis manuellement → CALCULÉS
     Points à renforcer, observations, analyses, conclusion : restent saisis

   Le directeur ne compile plus ses six classes, le responsable d'UP ne
   rapproche plus des documents hétérogènes : les chiffres remontent des
   saisies des enseignants. C'est le principe de saisie unique rendu visible.

   Les tableaux calculés remplacent la partie chiffrée de l'écran ; la partie
   rédigée est conservée et enregistrée dans la table syntheses.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
    );

  const nb = (v) => (v == null ? '—' : v);
  const pct = (v) => (v == null ? '—' : Number(v).toFixed(2) + ' %');

  const anneeCourante = () => {
    const d = new Date();
    const y = d.getFullYear();
    return d.getMonth() >= 8 ? y + '-' + (y + 1) : y - 1 + '-' + y;
  };

  /* ─────────────────────── Ossature commune ─────────────────────── */

  function bandeau(titre, sousTitre) {
    return `
      <h2 style="color:#1a4731; margin-bottom:2px;">${titre}</h2>
      <p style="color:#666; font-size:13px; margin-top:0;">${sousTitre}</p>
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin-bottom:14px;">
        <label>Année scolaire<br><input class="sy-annee" value="${anneeCourante()}" style="padding:8px;"></label>
        <label>Étape / évaluation<br><input class="sy-etape" placeholder="ex. 1ere" style="padding:8px;"></label>
        <button class="sy-calc" style="background:#1a4731;color:#fff;border:none;padding:10px 16px;border-radius:8px;font-weight:bold;cursor:pointer;">
          Actualiser
        </button>
        <span class="sy-msg" style="font-size:13px; font-weight:bold;"></span>
      </div>
      <div class="sy-tableau" style="overflow-x:auto; margin-bottom:18px;"></div>`;
  }

  function blocQualitatif() {
    return `
      <section style="border:1px solid #ddd; border-radius:10px; padding:16px;">
        <h3 style="margin-top:0;">Appréciation</h3>
        <p style="font-size:12px; color:#777; margin-top:0;">
          Les chiffres ci-dessus sont calculés à partir des saisies. Seule cette
          partie est rédigée.
        </p>
        <label>Points à renforcer<br>
          <textarea class="sy-points" rows="3" style="width:100%; padding:8px;"></textarea></label>
        <label>Observations<br>
          <textarea class="sy-obs" rows="3" style="width:100%; padding:8px;"></textarea></label>
        <label>Analyses<br>
          <textarea class="sy-ana" rows="4" style="width:100%; padding:8px;"></textarea></label>
        <label>Conclusion<br>
          <textarea class="sy-concl" rows="3" style="width:100%; padding:8px;"></textarea></label>
        <div style="margin-top:10px;">
          <button class="sy-enr" style="background:#1a4731;color:#fff;border:none;padding:10px 18px;border-radius:8px;font-weight:bold;cursor:pointer;">
            Enregistrer l'appréciation
          </button>
          <span class="sy-msg2" style="margin-left:10px; font-size:13px; font-weight:bold;"></span>
        </div>
      </section>`;
  }

  const tableau = (entetes, lignes, total) => `
    <table style="width:100%; border-collapse:collapse; font-size:13px;">
      <tr style="background:#e8f0eb; text-align:left;">
        ${entetes.map((h) => '<th style="padding:7px;">' + h + '</th>').join('')}
      </tr>
      ${lignes}
      ${total}
    </table>`;

  /* ─────────────────────── Module ⑬ École ─────────────────────── */

  function rendreEcole(hote, d) {
    if (d.erreur) {
      hote.innerHTML = '<p style="color:#c0392b;font-weight:bold;">' + esc(d.erreur) + '</p>';
      return;
    }
    if (!d.classes.length) {
      hote.innerHTML =
        '<p style="color:#a06000;font-weight:bold;">Aucune donnée saisie pour cette année et cette étape. ' +
        'Les chiffres apparaîtront dès que les enseignants auront enregistré leurs notes.</p>';
      return;
    }
    const l = d.classes
      .map(
        (c) =>
          '<tr style="border-top:1px solid #eee;">' +
          '<td style="padding:7px;font-weight:600;">' + esc(c.classe) + '</td>' +
          '<td style="padding:7px;">' + nb(c.effectif) + '</td>' +
          '<td style="padding:7px;">' + nb(c.garcons) + '</td>' +
          '<td style="padding:7px;">' + nb(c.filles) + '</td>' +
          '<td style="padding:7px;">' + nb(c.reussites) + '</td>' +
          '<td style="padding:7px;">' + nb(c.reussites_g) + '</td>' +
          '<td style="padding:7px;">' + nb(c.reussites_f) + '</td>' +
          '<td style="padding:7px;">' + nb(c.moyenne) + '</td>' +
          '<td style="padding:7px;font-weight:700;">' + pct(c.taux) + '</td></tr>'
      )
      .join('');
    const t = d.total;
    hote.innerHTML =
      '<p style="font-size:13px;color:#555;">École <strong>' + esc(d.ecole) + '</strong> — ' +
      esc(d.annee) + (d.etape ? ' — étape ' + esc(d.etape) : '') +
      ' — seuil de réussite <strong>' + nb(d.seuil) + '</strong> (paramètre national)</p>' +
      tableau(
        ['Classe', 'Effectif', 'Garçons', 'Filles', 'Réussites', 'dont G', 'dont F', 'Moyenne', 'Taux'],
        l,
        '<tr style="background:#1a4731;color:#fff;font-weight:700;">' +
          '<td style="padding:8px;">ÉCOLE</td>' +
          '<td style="padding:8px;">' + nb(t.effectif) + '</td>' +
          '<td style="padding:8px;">' + nb(t.garcons) + '</td>' +
          '<td style="padding:8px;">' + nb(t.filles) + '</td>' +
          '<td style="padding:8px;">' + nb(t.reussites) + '</td>' +
          '<td style="padding:8px;">' + nb(t.reussites_g) + '</td>' +
          '<td style="padding:8px;">' + nb(t.reussites_f) + '</td>' +
          '<td style="padding:8px;">—</td>' +
          '<td style="padding:8px;">' + pct(t.taux) + '</td></tr>'
      );
  }

  /* ─────────────────────── Module ⑭ UP ─────────────────────── */

  function rendreUP(hote, d) {
    if (d.erreur) {
      hote.innerHTML = '<p style="color:#c0392b;font-weight:bold;">' + esc(d.erreur) + '</p>';
      return;
    }
    if (!d.ecoles.length) {
      hote.innerHTML =
        "<p style=\"color:#a06000;font-weight:bold;\">Aucune donnée pour cette unité. Vérifiez que des écoles " +
        'lui sont rattachées et que leurs enseignants ont saisi leurs notes.</p>';
      return;
    }
    const l = d.ecoles
      .map(
        (e) =>
          '<tr style="border-top:1px solid #eee;">' +
          '<td style="padding:7px;font-weight:600;">' + esc(e.ecole) + '</td>' +
          '<td style="padding:7px;">' + nb(e.effectif) + '</td>' +
          '<td style="padding:7px;">' + nb(e.garcons) + '</td>' +
          '<td style="padding:7px;">' + nb(e.filles) + '</td>' +
          '<td style="padding:7px;">' + nb(e.reussites) + '</td>' +
          '<td style="padding:7px;font-weight:700;">' + pct(e.taux) + '</td></tr>'
      )
      .join('');
    const t = d.total;
    hote.innerHTML =
      '<p style="font-size:13px;color:#555;">Unité <strong>' + esc(d.up) + '</strong> — ' +
      esc(d.annee) + (d.etape ? ' — étape ' + esc(d.etape) : '') +
      ' — <strong>' + nb(t.nb_ecoles) + '</strong> école(s) — seuil <strong>' + nb(d.seuil) + '</strong></p>' +
      tableau(
        ['École', 'Effectif', 'Garçons', 'Filles', 'Réussites', 'Taux'],
        l,
        '<tr style="background:#1a4731;color:#fff;font-weight:700;">' +
          '<td style="padding:8px;">UNITÉ</td>' +
          '<td style="padding:8px;">' + nb(t.effectif) + '</td>' +
          '<td style="padding:8px;">' + nb(t.garcons) + '</td>' +
          '<td style="padding:8px;">' + nb(t.filles) + '</td>' +
          '<td style="padding:8px;">' + nb(t.reussites) + '</td>' +
          '<td style="padding:8px;">' + pct(t.taux) + '</td></tr>'
      );
  }

  /* ─────────────────────── Câblage ─────────────────────── */

  function installer(idOnglet, echelon, rpc, rendre, titre, sousTitre) {
    const panneau = document.getElementById('tab-' + idOnglet);
    if (!panneau || panneau.dataset.ge3Conso) return;
    panneau.dataset.ge3Conso = '1';

    /* L'ancienne saisie chiffrée est conservée mais repliée : elle n'a plus
       cours, et la supprimer ferait disparaître des repères familiers. */
    const ancien = document.createElement('details');
    ancien.style.cssText = 'margin-top:22px; font-size:13px; color:#666;';
    ancien.innerHTML = '<summary style="cursor:pointer;">Ancienne saisie manuelle (remplacée par le calcul automatique)</summary>';
    while (panneau.firstChild) ancien.appendChild(panneau.firstChild);

    panneau.innerHTML = bandeau(titre, sousTitre) + blocQualitatif();
    panneau.appendChild(ancien);

    const q = (c) => panneau.querySelector(c);
    const msg = (t, err) => {
      const m = q('.sy-msg');
      m.style.color = err ? '#c0392b' : '#1a7a3c';
      m.textContent = t;
    };

    async function actualiser() {
      msg('Calcul en cours…', false);
      const { data, error } = await GE3.sb.rpc(rpc, {
        p_annee: q('.sy-annee').value.trim(),
        p_etape: q('.sy-etape').value.trim() || null,
      });
      if (error) {
        msg('Calcul impossible : ' + error.message, true);
        return;
      }
      msg('', false);
      rendre(q('.sy-tableau'), data);

      const qa = data.qualitatif || {};
      q('.sy-points').value = qa.points_a_renforcer || '';
      q('.sy-obs').value = qa.observations || '';
      q('.sy-ana').value = qa.analyses || '';
      q('.sy-concl').value = qa.conclusion || '';
    }

    async function enregistrer() {
      const m2 = q('.sy-msg2');
      const cible =
        echelon === 'ecole' ? GE3.profil.ecole_id : GE3.profil.up_id;
      if (!cible) {
        m2.style.color = '#c0392b';
        m2.textContent = "Votre compte n'est rattaché à aucun périmètre.";
        return;
      }
      m2.style.color = '#666';
      m2.textContent = 'Enregistrement…';

      const { error } = await GE3.sb.from('syntheses').upsert(
        {
          echelon,
          cible_id: cible,
          annee: q('.sy-annee').value.trim(),
          etape: q('.sy-etape').value.trim() || '',
          points_a_renforcer: q('.sy-points').value,
          observations: q('.sy-obs').value,
          analyses: q('.sy-ana').value,
          conclusion: q('.sy-concl').value,
          auteur: GE3.session.user.id,
          maj_le: new Date().toISOString(),
        },
        { onConflict: 'echelon,cible_id,annee,etape' }
      );

      m2.style.color = error ? '#c0392b' : '#1a7a3c';
      m2.textContent = error ? '❌ ' + error.message : '✅ Appréciation enregistrée.';
    }

    q('.sy-calc').addEventListener('click', actualiser);
    q('.sy-enr').addEventListener('click', enregistrer);
    actualiser();
  }

  function attendre() {
    if (!(window.GE3 && GE3.profil && GE3.sb)) {
      setTimeout(attendre, 300);
      return;
    }
    installer(
      'syntheseEcole', 'ecole', 'synthese_ecole', rendreEcole,
      '🏫 Synthèse École',
      "Consolidation automatique de toutes les classes de l'école. Aucune ressaisie des chiffres."
    );
    installer(
      'syntheseUP', 'up', 'synthese_up', rendreUP,
      '🏘️ Synthèse Unité Pédagogique',
      'Consolidation automatique des écoles de l\'unité, à partir des saisies des enseignants.'
    );
  }

  attendre();
})();
