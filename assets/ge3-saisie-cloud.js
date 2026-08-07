/* ═══════════════════════════════════════════════════════════════════════════
   GE 3.0 — Module ① Saisie des notes : passage au stockage relationnel.

   La fiche de saisie n'est plus un bloc JSON : elle est éclatée dans les
   tables ecoles / evaluations / eleves / notes, via deux fonctions SQL
   (enregistrer_saisie, charger_saisie) qui font le travail en une
   transaction, sous le contrôle de la RLS.

   Le module lui-même n'est pas réécrit. Ses deux fonctions de sauvegarde
   sont remplacées ici, et la structure d'objet qu'il manipule est conservée
   telle quelle à la frontière : le reste du module (tableau, calculs,
   bulletins, exports PDF et Excel) continue de fonctionner à l'identique.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const attendreSocle = (suite) => {
    if (window.GE3 && window.GE3.sb && typeof window.saveLocalBrowser === 'function') return suite();
    setTimeout(() => attendreSocle(suite), 200);
  };

  /* Reconstruit l'objet de la fiche à partir de l'écran — même structure
     qu'auparavant, pour rester compatible avec le reste du module. */
  function lireFiche() {
    const val = (id) => {
      const e = document.getElementById(id);
      return e ? e.value : '';
    };
    const fiche = {
      ddemp: val('ddemp'),
      cs: val('cs'),
      epp: val('epp'),
      cours: val('cours'),
      etape: val('etape'),
      annee: val('annee'),
      admin: val('admin'),
      directeur: val('directeur'),
      seuil: val('seuil'),
      seuilMatNum: typeof seuilMatNumerateur !== 'undefined' ? seuilMatNumerateur : null,
      nbEleves: val('nb-eleves'),
      matieresOrdre:
        typeof _matieresOrdreSelection !== 'undefined' ? _matieresOrdreSelection.slice() : [],
      eleves: [],
    };
    document.querySelectorAll('#table-body tr').forEach((row) => {
      const cells = row.querySelectorAll('td');
      const nomInput = cells[1] && cells[1].querySelector('input');
      if (!nomInput) return;
      const notes = [];
      row.querySelectorAll('input[type=number]').forEach((inp) => notes.push(inp.value));
      fiche.eleves.push({
        nom: nomInput.value,
        sexe: cells[2] && cells[2].querySelector('select') ? cells[2].querySelector('select').value : '',
        notes,
      });
    });
    return fiche;
  }

  /* Réinjecte une fiche dans l'écran. Reprend fidèlement la logique de
     restauration d'origine, y compris l'ordre des matières et le délai
     nécessaire à la reconstruction du tableau. */
  function ecrireFiche(data) {
    const set = (id, v) => {
      const e = document.getElementById(id);
      if (e && v != null && v !== '') e.value = v;
    };
    set('epp', data.epp);
    set('cours', data.cours);
    set('etape', data.etape);
    set('annee', data.annee);
    set('admin', data.admin);
    set('directeur', data.directeur);
    set('seuil', data.seuil);
    set('nb-eleves', data.nbEleves);

    if (data.seuilMatNum != null) {
      try {
        seuilMatNumerateur = data.seuilMatNum;
      } catch {
        /* variable du module absente : sans conséquence */
      }
      const inp = document.getElementById('seuil-mat-num');
      if (inp) inp.value = data.seuilMatNum;
    }

    if (Array.isArray(data.matieresOrdre) && data.matieresOrdre.length) {
      try {
        _matieresOrdreSelection = [];
        document.querySelectorAll('.mat-chk').forEach((c) => {
          c.checked = false;
        });
        data.matieresOrdre.forEach((v) => {
          const chk = document.querySelector('.mat-chk[value="' + v + '"]');
          if (chk) {
            chk.checked = true;
            _matieresOrdreSelection.push(v);
          }
        });
        if (typeof majBadgeMatieres === 'function') majBadgeMatieres();
        if (typeof majAffichageMatieres === 'function') majAffichageMatieres();
      } catch {
        /* idem */
      }
    }

    if (typeof updateHeader === 'function') updateHeader();
    if (typeof buildTable === 'function') buildTable();

    setTimeout(() => {
      const rows = document.querySelectorAll('#table-body tr');
      (data.eleves || []).forEach((el, i) => {
        if (!rows[i]) return;
        const cells = rows[i].querySelectorAll('td');
        if (cells[1] && cells[1].querySelector('input')) cells[1].querySelector('input').value = el.nom || '';
        if (cells[2] && cells[2].querySelector('select')) cells[2].querySelector('select').value = el.sexe || '';
        const inputs = rows[i].querySelectorAll('input[type=number]');
        (el.notes || []).forEach((n, j) => {
          if (inputs[j]) inputs[j].value = n;
        });
      });
      if (typeof recalcAll === 'function') recalcAll();
    }, 200);
  }

  const etat = (txt) => {
    const e = document.getElementById('ge3-etat-sync');
    if (e) e.textContent = txt;
  };

  function installer() {
    /* ── Enregistrement ──────────────────────────────────────────────── */
    window.saveLocalBrowser = async function () {
      if (!GE3.session) {
        alert('⚠️ Vous devez être connecté pour enregistrer.');
        return;
      }
      const fiche = lireFiche();
      if (!fiche.cours || !fiche.annee) {
        alert("⚠️ Renseignez la classe et l'année scolaire avant d'enregistrer.");
        return;
      }

      etat('⏳ enregistrement…');
      const { data, error } = await GE3.sb.rpc('enregistrer_saisie', { p: fiche });

      if (error) {
        etat('⚠️ non enregistré');
        alert(
          "❌ Enregistrement impossible.\n\n" +
            (error.message || 'Vérifiez votre connexion Internet.') +
            "\n\nVos données restent affichées à l'écran : vous pouvez réessayer."
        );
        return;
      }

      etat('☁️ enregistré');
      alert(
        '💾 Enregistré sur le serveur.\n\n' +
          data.eleves +
          ' élève(s), ' +
          data.notes +
          ' note(s).\n\nVos données sont accessibles depuis n\'importe quel appareil.'
      );
    };

    /* ── Chargement ──────────────────────────────────────────────────── */
    window.loadLocalBrowser = async function () {
      if (!GE3.session) {
        alert('⚠️ Vous devez être connecté pour charger vos données.');
        return;
      }
      const classe = (document.getElementById('cours') || {}).value || '';
      const annee = (document.getElementById('annee') || {}).value || '';
      const etape = (document.getElementById('etape') || {}).value || '';
      const epp = (document.getElementById('epp') || {}).value || '';

      if (!classe || !annee) {
        alert("⚠️ Indiquez la classe et l'année scolaire, puis relancez le chargement.");
        return;
      }

      etat('⏳ chargement…');
      const { data, error } = await GE3.sb.rpc('charger_saisie', {
        p_classe: classe,
        p_annee: annee,
        p_etape: etape,
        p_epp: epp,
      });

      if (error) {
        etat('⚠️ erreur');
        alert('❌ Chargement impossible.\n\n' + (error.message || 'Vérifiez votre connexion.'));
        return;
      }
      if (!data) {
        etat('☁️ synchronisé');
        alert(
          "⚠️ Aucune fiche enregistrée pour :\n\n" +
            classe + ' — ' + annee + (etape ? ' — ' + etape : '') +
            "\n\nVérifiez la classe, l'année et l'étape."
        );
        return;
      }

      ecrireFiche(data);
      etat('☁️ synchronisé');
      alert('🔄 Fiche chargée depuis le serveur : ' + (data.eleves || []).length + ' élève(s).');
    };

    /* La fiche de saisie vit désormais dans les tables. La réplication en
       bloc JSON ferait doublon — et divergerait à la première modification. */
    window.GE3.clesRelationnelles = window.GE3.clesRelationnelles || new Set();
    window.GE3.clesRelationnelles.add('ge3_saisie_data');
  }

  attendreSocle(installer);
})();
