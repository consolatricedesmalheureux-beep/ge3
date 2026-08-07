/* ═══════════════════════════════════════════════════════════════════════════
   GE 3.0 — Moteur de synchronisation (§10.2 du cahier des charges).

   Remplace la réplication naïve du socle, qui écrasait en dernier-arrivé-
   gagne : deux personnes modifiant la même fiche produisaient une perte
   silencieuse.

   RÈGLE DE RÉSOLUTION DES CONFLITS — exigée « définie et documentée » :

     Chaque donnée porte un numéro de version. Le client annonce la version
     sur laquelle il s'est fondé. Si la version en base a changé depuis,
     l'écriture est refusée, la valeur écartée est conservée côté serveur,
     et l'utilisateur est informé. Il choisit alors laquelle fait foi.

     Aucune écriture n'écrase donc une autre à l'insu de son auteur.

   Le reste des exigences du §10.2 :
   — synchronisation incrémentale : seules les données modifiées circulent,
     dans les deux sens (la bande passante est facturée à l'usage) ;
   — file d'attente locale, rejouée à la reconnexion, reprise sans perte ni
     duplication après interruption ;
   — état de synchronisation affiché en permanence.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const CLE_VERSIONS = 'ge3_sync_versions';   // { cle: version connue }
  const CLE_FILE = 'ge3_sync_attente';        // { cle: {valeur, at} }
  const CLE_DERNIER = 'ge3_sync_dernier';     // horodatage du dernier tirage
  const CLE_APPAREIL = 'ge3_device_id';

  const brut = {
    set: Object.getPrototypeOf(localStorage).setItem.bind(localStorage),
    get: Object.getPrototypeOf(localStorage).getItem.bind(localStorage),
  };

  const lireJSON = (cle, defaut) => {
    try {
      return JSON.parse(brut.get(cle) || '') || defaut;
    } catch {
      return defaut;
    }
  };
  const ecrireJSON = (cle, v) => {
    try {
      brut.set(cle, JSON.stringify(v));
    } catch {
      /* quota saturé : la prochaine écriture réessaiera */
    }
  };

  const appareil = () => {
    let id = brut.get(CLE_APPAREIL);
    if (!id) {
      id = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      brut.set(CLE_APPAREIL, id);
    }
    return id;
  };

  const versions = () => lireJSON(CLE_VERSIONS, {});
  const noterVersion = (cle, v) => {
    const m = versions();
    m[cle] = v;
    ecrireJSON(CLE_VERSIONS, m);
  };

  const file = () => lireJSON(CLE_FILE, {});
  const empiler = (cle, valeur) => {
    const f = file();
    f[cle] = { valeur, at: Date.now() };
    ecrireJSON(CLE_FILE, f);
  };
  const depiler = (cle) => {
    const f = file();
    delete f[cle];
    ecrireJSON(CLE_FILE, f);
  };

  const etat = (txt, titre) => {
    const e = document.getElementById('ge3-etat-sync');
    if (!e) return;
    e.textContent = txt;
    if (titre) e.title = titre;
  };

  /* ═══════════════════════ Conflits ═══════════════════════ */

  const conflits = [];

  function signaler(cle, versionServeur, valeurServeur, valeurLocale) {
    conflits.push({ cle, versionServeur, valeurServeur, valeurLocale });
    etat('⚠️ ' + conflits.length + ' conflit(s)', 'Cliquez pour arbitrer');
    const e = document.getElementById('ge3-etat-sync');
    if (e && !e.dataset.lie) {
      e.dataset.lie = '1';
      e.style.cursor = 'pointer';
      e.addEventListener('click', arbitrer);
    }
  }

  /* L'arbitrage revient à l'utilisateur : lui seul sait laquelle des deux
     saisies est la bonne. Le système ne choisit pas à sa place. */
  async function arbitrer() {
    if (!conflits.length) return;
    const c = conflits[0];

    const resume = (v) => {
      const t = typeof v === 'string' ? v : JSON.stringify(v);
      return t.length > 220 ? t.slice(0, 220) + '…' : t;
    };

    const garderLocal = confirm(
      "⚠️ MODIFICATION CONCURRENTE\n\n" +
        "La donnée « " + c.cle + " » a été modifiée ailleurs pendant que vous travailliez.\n" +
        "Aucune des deux versions n'a été perdue.\n\n" +
        "— VERSION DU SERVEUR :\n" + resume(c.valeurServeur) + "\n\n" +
        "— VOTRE VERSION :\n" + resume(c.valeurLocale) + "\n\n" +
        "OK  = garder VOTRE version (elle remplacera celle du serveur)\n" +
        "Annuler = garder la version du SERVEUR"
    );

    const { data } = await GE3.sb
      .from('conflits')
      .select('id')
      .eq('cle', c.cle)
      .eq('resolu', false)
      .order('at', { ascending: false })
      .limit(1);

    if (data && data.length) {
      await GE3.sb.rpc('resoudre_conflit', { p_id: data[0].id, p_garder_local: garderLocal });
    }

    if (!garderLocal) {
      /* On adopte la version du serveur : elle est réécrite en local pour
         que l'écran cesse d'afficher une donnée qui n'a plus cours. */
      const v = c.valeurServeur;
      brut.set(c.cle, typeof v === 'string' ? v : JSON.stringify(v));
    }
    noterVersion(c.cle, c.versionServeur + (garderLocal ? 1 : 0));
    depiler(c.cle);

    conflits.shift();
    if (conflits.length) {
      etat('⚠️ ' + conflits.length + ' conflit(s)', 'Cliquez pour arbitrer');
      arbitrer();
    } else {
      etat('☁️ synchronisé', '');
      if (!garderLocal) location.reload();
    }
  }

  /* ═══════════════════════ Poussée ═══════════════════════ */

  async function pousser(cle, valeurBrute) {
    if (!GE3.session) {
      empiler(cle, valeurBrute);
      return;
    }
    let valeur;
    try {
      valeur = JSON.parse(valeurBrute);
    } catch {
      valeur = valeurBrute;
    }

    const { data, error } = await GE3.sb.rpc('pousser_module_data', {
      p_cle: cle,
      p_valeur: valeur,
      p_version_base: versions()[cle] ?? null,
      p_device: appareil(),
    });

    if (error) {
      /* Réseau ou serveur indisponible : la donnée reste en attente. Elle
         n'est jamais abandonnée, la reprise se fait à la reconnexion. */
      empiler(cle, valeurBrute);
      etat('⏳ en attente', 'Modifications non transmises : ' + Object.keys(file()).length);
      return;
    }

    if (data.etat === 'conflit') {
      signaler(cle, data.version, data.valeur_serveur, valeur);
      return;
    }

    noterVersion(cle, data.version);
    depiler(cle);
    if (!conflits.length) etat('☁️ synchronisé', '');
  }

  async function viderFile() {
    const f = file();
    const cles = Object.keys(f);
    if (!cles.length || !GE3.session) return;
    etat('⏳ envoi de ' + cles.length + ' modification(s)…', '');
    /* Séquentiel : chaque clé peut entrer en conflit indépendamment, et un
       envoi groupé empêcherait de les distinguer. */
    for (const cle of cles) {
      await pousser(cle, f[cle].valeur);
    }
  }

  /* ═══════════════════════ Tirage ═══════════════════════ */

  async function tirer() {
    if (!GE3.session) return 0;
    const depuis = brut.get(CLE_DERNIER) || null;

    const { data, error } = await GE3.sb.rpc('tirer_module_data', { p_depuis: depuis });
    if (error || !data) return 0;

    data.forEach((l) => {
      const v = typeof l.valeur === 'string' ? l.valeur : JSON.stringify(l.valeur);
      brut.set(l.cle, v);
      noterVersion(l.cle, l.version);
    });

    brut.set(CLE_DERNIER, new Date().toISOString());
    return data.length;
  }

  /* ═══════════════════════ Installation ═══════════════════════ */

  function installer() {
    if (!window.GE3 || !GE3.sb) {
      setTimeout(installer, 200);
      return;
    }

    /* Le socle avait déjà enveloppé setItem ; on le réenveloppe pour router
       les écritures vers le moteur versionné. L'écriture locale reste
       première : sans réseau, l'application continue de fonctionner. */
    const precedent = localStorage.setItem.bind(localStorage);
    const natif = Object.getPrototypeOf(localStorage).setItem.bind(localStorage);

    localStorage.setItem = function (cle, valeur) {
      natif(cle, valeur);
      if (!GE3.estSynchronisable || !GE3.estSynchronisable(cle)) return;
      if (GE3.session) {
        pousser(cle, valeur);
      } else {
        empiler(cle, valeur);
      }
    };
    void precedent;

    GE3.sync = { pousser, tirer, viderFile, conflits, versions };

    window.addEventListener('online', async () => {
      etat('⏳ reconnexion…', '');
      await viderFile();
      const n = await tirer();
      if (!conflits.length) etat(n ? '☁️ ' + n + ' mise(s) à jour' : '☁️ synchronisé', '');
    });
    window.addEventListener('offline', () =>
      etat('⚠️ hors ligne', 'Vos saisies sont conservées et seront transmises au retour du réseau')
    );

    /* Après ouverture de session : rejouer ce qui attend, puis rapatrier ce
       qui a changé ailleurs. Cet ordre évite de perdre une saisie hors
       ligne en la recouvrant par une version distante. */
    const auDemarrage = setInterval(async () => {
      if (!GE3.session) return;
      clearInterval(auDemarrage);
      await viderFile();
      const n = await tirer();
      if (!conflits.length) etat(n ? '☁️ ' + n + ' élément(s) à jour' : '☁️ synchronisé', '');
    }, 500);
  }

  installer();
})();
