/* ═══════════════════════════════════════════════════════════════════════════
   GE 3.0 — Matrice des droits d'accès.

   Transcription de la section 5.1 du cahier des charges. Chaque profil ne
   voit que les modules relevant de ses attributions.

   Le cahier des charges est explicite sur la manière (§4.4) : les fonctions
   inaccessibles « sont absentes de la navigation, et non simplement
   désactivées ». Les entrées correspondantes sont donc retirées du document,
   pas masquées visuellement.

   ⚠ Ce filtrage est un confort d'interface, pas une sécurité. Le contrôle
   réel des droits est assuré côté serveur par la RLS PostgreSQL, comme
   l'exige le §10.4 : « contrôle des droits appliqué côté serveur,
   indépendamment de ce qu'affiche l'application cliente ».

   ⚠ La numérotation du cahier des charges et celle de l'application
   divergent sur deux modules : le cahier des charges appelle 9 le cahier de
   notes EducMaster et 10 la carte CEP, quand l'application les numérote
   respectivement ⑩ et ⑨. Le rattachement ci-dessous se fait donc par
   identifiant d'onglet, jamais par numéro.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* S = saisie · V = validation · L = lecture · C = consolidé · null = aucun accès */
  const MATRICE = {
    //  onglet             CDC                     ens    dir    cs     ddemp  memp
    saisie:            { n: 1,  ens: 'S', dir: 'V', cs: 'C', ddemp: 'C', ministere: 'C' },
    stats:             { n: 2,  ens: 'L', dir: 'L', cs: 'C', ddemp: 'C', ministere: 'C' },
    analyse:           { n: 3,  ens: 'L', dir: 'V', cs: 'C', ddemp: 'C', ministere: 'C' },
    passage:           { n: 4,  ens: 'S', dir: 'V', cs: 'C', ddemp: 'C', ministere: 'C' },
    cep:               { n: 5,  ens: null, dir: 'S', cs: 'L', ddemp: 'C', ministere: 'C' },
    pdfCsv:            { n: 6,  ens: null, dir: 'S', cs: 'L', ddemp: null, ministere: null },
    releveNotesCep:    { n: 7,  ens: null, dir: 'S', cs: 'C', ddemp: 'C', ministere: null },
    relevesMensuels:   { n: 8,  ens: 'S', dir: 'V', cs: 'C', ddemp: 'C', ministere: 'C' },
    cahierNotes:       { n: 9,  ens: 'S', dir: 'L', cs: 'C', ddemp: 'C', ministere: 'C' },
    carteCep:          { n: 10, ens: 'S', dir: 'V', cs: 'C', ddemp: null, ministere: null },
    cantine:           { n: 11, ens: 'S', dir: 'V', cs: 'C', ddemp: 'C', ministere: 'C' },
    tableauAffiche:    { n: 12, ens: 'S', dir: 'V', cs: 'C', ddemp: 'C', ministere: 'C' },
    syntheseEcole:     { n: 13, ens: null, dir: 'S', cs: 'L', ddemp: 'C', ministere: 'C' },
    syntheseUP:        { n: 14, ens: null, dir: 'L', cs: 'S', ddemp: 'L', ministere: 'C' },
    enrolement:        { n: 15, ens: 'S', dir: 'V', cs: 'C', ddemp: 'C', ministere: 'C' },
    ficheCep:          { n: 16, ens: 'S', dir: 'V', cs: 'L', ddemp: 'C', ministere: null },
  };

  const LIBELLES = {
    S: 'Saisie',
    V: 'Validation',
    L: 'Lecture',
    C: 'Consolidé',
  };

  /* L'administrateur technique n'est pas un profil du cahier des charges :
     il administre la plateforme et conserve l'accès à tout. */
  const accesDe = (role, onglet) => {
    if (role === 'admin') return 'S';
    const ligne = MATRICE[onglet];
    if (!ligne) return 'S'; // onglet hors matrice : laissé visible
    return ligne[role] !== undefined ? ligne[role] : null;
  };

  function appliquer(role) {
    if (!role) return;

    const retires = [];
    Object.keys(MATRICE).forEach((onglet) => {
      if (accesDe(role, onglet) !== null) return;

      /* Carte d'accueil, bouton d'onglet et panneau du module. */
      document
        .querySelectorAll('[onclick*="showTab(\'' + onglet + '\'"]')
        .forEach((el) => el.remove());
      const panneau = document.getElementById('tab-' + onglet);
      if (panneau) panneau.remove();

      retires.push(MATRICE[onglet].n);
    });

    marquerNiveaux(role);
    return retires;
  }

  /* Le niveau d'accès est indiqué sur chaque carte restante : un directeur
     doit savoir qu'il valide là où l'enseignant saisit, et un échelon
     supérieur qu'il ne consulte que des agrégats. */
  function marquerNiveaux(role) {
    if (role === 'admin') return;
    Object.keys(MATRICE).forEach((onglet) => {
      const acces = accesDe(role, onglet);
      if (!acces || acces === 'S') return;
      document
        .querySelectorAll('.home-card[onclick*="showTab(\'' + onglet + '\'"]')
        .forEach((carte) => {
          if (carte.querySelector('.ge3-niveau')) return;
          const b = document.createElement('span');
          b.className = 'ge3-niveau';
          b.textContent = LIBELLES[acces];
          b.style.cssText =
            'position:absolute; top:8px; right:10px; font-size:10px; font-weight:700;' +
            'letter-spacing:.5px; text-transform:uppercase; padding:2px 7px; border-radius:99px;' +
            'background:rgba(0,0,0,.28); color:#fff;';
          if (getComputedStyle(carte).position === 'static') carte.style.position = 'relative';
          carte.appendChild(b);
        });
    });
  }

  /* Le socle signale l'ouverture de session ; la matrice s'applique alors,
     une fois le rôle connu. */
  function attendreProfil() {
    if (window.GE3 && window.GE3.profil && window.GE3.profil.role) {
      const retires = appliquer(window.GE3.profil.role);
      if (retires && retires.length) {
        console.info(
          '[GE3] Profil « ' + window.GE3.profil.role + ' » — modules non accessibles retirés : ' +
            retires.sort((a, b) => a - b).join(', ')
        );
      }
      return;
    }
    setTimeout(attendreProfil, 300);
  }

  window.GE3_MATRICE = MATRICE;
  attendreProfil();
})();
