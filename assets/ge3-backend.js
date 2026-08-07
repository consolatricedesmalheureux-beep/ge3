/* ═══════════════════════════════════════════════════════════════════════════
   GE 3.0 — Socle backend : authentification et stockage cloud.

   Ce fichier ne modifie aucune fonction des 16 modules. Il s'insère en amont :

   1. Écran de connexion — comptes Supabase réels, six rôles hiérarchiques.
   2. Couche de stockage — les modules continuent d'appeler localStorage ;
      les clés « ge3 » sont interceptées et répliquées dans la table
      module_data, rattachées au compte connecté.

   Conséquence : les données suivent l'utilisateur d'un appareil à l'autre,
   sans qu'aucun module ait été réécrit. localStorage reste le cache local,
   ce qui préserve le fonctionnement hors ligne : les écritures faites sans
   réseau sont rejouées à la reconnexion.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const SUPABASE_URL = 'https://jicvpknbifhfsbqcstof.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_xfutV5Xdu_O8DM_tSSRW7g_eF5skvrv';

  /* Clés de modules à synchroniser. Préfixes volontairement larges : toute
     nouvelle clé d'un module existant est reprise sans modifier ce fichier. */
  const PREFIXES = ['ge3_', 'cep_', 'cant_', 'rm_', 'ta_', 'carteScolaireCEP_'];

  /* Clés purement techniques, propres à l'appareil : jamais envoyées. */
  const EXCLUES = new Set(['ge3_device_id', 'ge3_access_code']);

  const FILE_ATTENTE = 'ge3_sync_attente';

  const estSynchronisable = (cle) =>
    typeof cle === 'string' &&
    !EXCLUES.has(cle) &&
    PREFIXES.some((p) => cle.startsWith(p));

  const GE3 = {
    sb: null,
    session: null,
    profil: null,
    enLigne: false,
  };
  window.GE3 = GE3;

  /* ───────────────────────── Identifiant → e-mail ─────────────────────────
     Les utilisateurs saisissent « Admin », pas une adresse e-mail. La même
     convention que la version cloud est conservée. */
  const emailDe = (ident) =>
    String(ident).includes('@') ? String(ident).trim() : String(ident).trim().toLowerCase() + '@ge3.bj';

  /* ═══════════════════════ File d'attente hors ligne ═══════════════════════ */

  const lireFile = () => {
    try {
      return JSON.parse(localStorage.getItem(FILE_ATTENTE) || '{}');
    } catch {
      return {};
    }
  };

  const ecrireFile = (f) => {
    try {
      localStorage.setItem(FILE_ATTENTE, JSON.stringify(f));
    } catch {
      /* quota dépassé : la synchronisation reprendra sur les écritures suivantes */
    }
  };

  const empiler = (cle, valeur) => {
    const f = lireFile();
    f[cle] = { valeur, at: Date.now() };
    ecrireFile(f);
  };

  /* ═══════════════════════════ Écritures cloud ═══════════════════════════ */

  async function pousser(cle, valeurBrute) {
    if (!GE3.session) return false;
    let valeur;
    try {
      valeur = JSON.parse(valeurBrute);
    } catch {
      valeur = valeurBrute; // certaines clés stockent une chaîne nue
    }
    const { error } = await GE3.sb
      .from('module_data')
      .upsert({ user_id: GE3.session.user.id, cle, valeur }, { onConflict: 'user_id,cle' });
    if (error) {
      empiler(cle, valeurBrute);
      return false;
    }
    return true;
  }

  async function viderFile() {
    const f = lireFile();
    const cles = Object.keys(f);
    if (!cles.length || !GE3.session) return;
    const lignes = cles.map((cle) => {
      let valeur;
      try {
        valeur = JSON.parse(f[cle].valeur);
      } catch {
        valeur = f[cle].valeur;
      }
      return { user_id: GE3.session.user.id, cle, valeur };
    });
    const { error } = await GE3.sb.from('module_data').upsert(lignes, { onConflict: 'user_id,cle' });
    if (!error) ecrireFile({});
  }

  /* ═════════════════════ Interception de localStorage ═════════════════════
     setItem est enveloppé plutôt que remplacé : l'écriture locale a toujours
     lieu d'abord, la réplication cloud est opportuniste. Si le réseau tombe,
     l'application continue de fonctionner exactement comme avant. */

  function installerInterception() {
    const setItemOriginal = localStorage.setItem.bind(localStorage);
    const removeItemOriginal = localStorage.removeItem.bind(localStorage);

    localStorage.setItem = function (cle, valeur) {
      setItemOriginal(cle, valeur);
      if (estSynchronisable(cle)) {
        if (GE3.session) {
          pousser(cle, valeur).catch(() => empiler(cle, valeur));
        } else {
          empiler(cle, valeur);
        }
      }
    };

    localStorage.removeItem = function (cle) {
      removeItemOriginal(cle);
      if (estSynchronisable(cle) && GE3.session) {
        GE3.sb
          .from('module_data')
          .delete()
          .eq('user_id', GE3.session.user.id)
          .eq('cle', cle)
          .then(() => {}, () => {});
      }
    };
  }

  /* ═══════════════════ Restauration au démarrage ═══════════════════
     Les données du compte sont réécrites dans localStorage avant que les
     modules ne s'initialisent : ils lisent leur état habituel, sans savoir
     qu'il vient du serveur. */

  async function restaurer() {
    const { data, error } = await GE3.sb
      .from('module_data')
      .select('cle, valeur')
      .eq('user_id', GE3.session.user.id);
    if (error || !data) return 0;

    const setItemOriginal = Object.getPrototypeOf(localStorage).setItem.bind(localStorage);
    for (const ligne of data) {
      const brut = typeof ligne.valeur === 'string' ? ligne.valeur : JSON.stringify(ligne.valeur);
      setItemOriginal(ligne.cle, brut);
    }
    return data.length;
  }

  /* ═══════════════════════════ Écran de connexion ═══════════════════════════ */

  function ecranHTML() {
    return `
<div id="ge3-auth" style="position:fixed; inset:0; z-index:999999; display:flex; flex-direction:column;
     align-items:center; justify-content:center; padding:20px; overflow-y:auto;
     background:linear-gradient(135deg,#1a4731 0%,#0d2818 100%);">
  <div style="background:#fff; border-radius:16px; padding:36px 32px; max-width:380px; width:100%;
       box-shadow:0 20px 60px rgba(0,0,0,.4); text-align:center;">
    <div style="font-size:44px; margin-bottom:6px;">📘</div>
    <div style="font-size:20px; font-weight:bold; color:#1a4731; font-family:Lexend,sans-serif;">MAÎTRE MARIANO</div>
    <div style="font-size:12px; color:#888; margin-bottom:22px;">Gestionnaire d'Évaluation 3.0</div>

    <input id="ge3-auth-id" type="text" placeholder="Identifiant" autocomplete="username"
      style="width:100%; box-sizing:border-box; font-size:15px; padding:12px; margin-bottom:10px;
             border:2px solid #d8d8d8; border-radius:10px; font-family:Lexend,sans-serif;">
    <input id="ge3-auth-pw" type="password" placeholder="Mot de passe" autocomplete="current-password"
      style="width:100%; box-sizing:border-box; font-size:15px; padding:12px; margin-bottom:12px;
             border:2px solid #d8d8d8; border-radius:10px; font-family:Lexend,sans-serif;">

    <div id="ge3-auth-msg" style="font-size:12px; font-weight:bold; min-height:34px; margin-bottom:8px; color:#c0392b;"></div>

    <button id="ge3-auth-btn" style="width:100%; background:#1a4731; color:#fff; border:none; padding:13px;
            border-radius:10px; font-weight:bold; font-size:14px; cursor:pointer; letter-spacing:1px;">SE CONNECTER</button>

    <div style="margin-top:16px; font-size:11px; color:#999;">
      Mot de passe oublié ? Contactez votre directeur ou l'administrateur.
    </div>
  </div>
</div>`;
  }

  function barreHTML() {
    const p = GE3.profil || {};
    const libelles = {
      admin: 'Administrateur',
      ministere: 'Ministère',
      ddemp: 'DDEMP',
      cs: 'Circonscription',
      dir: 'Directeur',
      ens: 'Enseignant',
    };
    const qui = [p.prenom, p.nom].filter(Boolean).join(' ') || 'Compte';
    return `
<div id="ge3-barre" style="position:fixed; top:0; left:0; right:0; height:30px; background:#1a4731;
     color:#f5d98b; z-index:999998; display:flex; align-items:center; justify-content:space-between;
     padding:0 12px; font-family:Lexend,sans-serif; font-size:12px; font-weight:600;">
  <span>👤 ${qui} — ${libelles[p.role] || p.role || ''}</span>
  <span style="display:flex; align-items:center; gap:10px;">
    <span id="ge3-etat-sync" title="État de la synchronisation">☁️ synchronisé</span>
    <button id="ge3-deco" style="background:transparent; border:1px solid #f5d98b; color:#f5d98b;
            border-radius:6px; padding:2px 10px; font-size:11px; cursor:pointer; font-weight:600;">Déconnexion</button>
  </span>
</div>`;
  }

  const majEtat = (txt) => {
    const e = document.getElementById('ge3-etat-sync');
    if (e) e.textContent = txt;
  };

  function afficherApplication() {
    const auth = document.getElementById('ge3-auth');
    if (auth) auth.remove();
    if (!document.getElementById('ge3-barre')) {
      document.body.insertAdjacentHTML('afterbegin', barreHTML());
      document.body.style.paddingTop = '30px';
      document.getElementById('ge3-deco').addEventListener('click', deconnexion);
    }
    const app = document.getElementById('app-content');
    if (app) app.style.display = '';
  }

  async function deconnexion() {
    await GE3.sb.auth.signOut();
    /* Les données du compte sont retirées du cache local : sur un poste
       partagé, l'utilisateur suivant ne doit rien voir de la session précédente. */
    const removeOriginal = Object.getPrototypeOf(localStorage).removeItem.bind(localStorage);
    Object.keys(localStorage)
      .filter(estSynchronisable)
      .forEach(removeOriginal);
    location.reload();
  }

  async function chargerProfil() {
    const { data } = await GE3.sb
      .from('profiles')
      .select('role, nom, prenom, ecole_id, cs_id, ddemp_id, classe, actif')
      .eq('id', GE3.session.user.id)
      .maybeSingle();
    GE3.profil = data || null;
    return GE3.profil;
  }

  async function ouvrirSession(session) {
    GE3.session = session;
    const profil = await chargerProfil();

    if (!profil) {
      msg("Profil introuvable. L'administrateur doit rattacher ce compte.", true);
      await GE3.sb.auth.signOut();
      GE3.session = null;
      return;
    }
    if (profil.actif === false) {
      msg('Ce compte est désactivé. Contactez votre administrateur.', true);
      await GE3.sb.auth.signOut();
      GE3.session = null;
      return;
    }

    msg('Chargement de vos données…', false);
    const n = await restaurer();
    await viderFile();
    afficherApplication();
    majEtat(n ? '☁️ ' + n + ' élément(s) chargé(s)' : '☁️ synchronisé');
  }

  function msg(texte, erreur) {
    const m = document.getElementById('ge3-auth-msg');
    if (!m) return;
    m.style.color = erreur ? '#c0392b' : '#888';
    m.textContent = texte;
  }

  async function connexion() {
    const id = document.getElementById('ge3-auth-id').value.trim();
    const pw = document.getElementById('ge3-auth-pw').value;
    if (!id || !pw) {
      msg("Renseignez l'identifiant et le mot de passe.", true);
      return;
    }
    msg('Connexion…', false);

    const { data, error } = await GE3.sb.auth.signInWithPassword({
      email: emailDe(id),
      password: pw,
    });

    if (error) {
      /* Un identifiant refusé et une panne serveur ne se ressemblent pas :
         les distinguer évite de chercher un problème de mot de passe
         quand c'est le réseau ou la base qui est en cause. */
      const code = error.status || 0;
      if (code === 400 || code === 401) {
        msg('Identifiant ou mot de passe incorrect.', true);
      } else if (code >= 500) {
        msg('Le serveur ne répond pas correctement (erreur ' + code + '). Réessayez ou signalez-le.', true);
      } else {
        msg('Connexion impossible : ' + (error.message || 'vérifiez votre accès Internet.'), true);
      }
      return;
    }
    await ouvrirSession(data.session);
  }

  /* ═══════════════════════════════ Démarrage ═══════════════════════════════ */

  async function demarrer() {
    const app = document.getElementById('app-content');
    if (app) app.style.display = 'none';
    document.body.insertAdjacentHTML('beforeend', ecranHTML());

    document.getElementById('ge3-auth-btn').addEventListener('click', connexion);
    ['ge3-auth-id', 'ge3-auth-pw'].forEach((id) => {
      document.getElementById(id).addEventListener('keydown', (e) => {
        if (e.key === 'Enter') connexion();
      });
    });

    GE3.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    installerInterception();

    /* Session déjà ouverte sur cet appareil : on enchaîne sans redemander. */
    const { data } = await GE3.sb.auth.getSession();
    if (data && data.session) await ouvrirSession(data.session);

    window.addEventListener('online', () => {
      if (GE3.session) viderFile().then(() => majEtat('☁️ synchronisé'));
    });
    window.addEventListener('offline', () => majEtat('⚠️ hors ligne'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
})();
