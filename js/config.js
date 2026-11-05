/*
 * Configuration de Mayerbook.
 *
 * Laisse vide pour utiliser le MODE DÉMO (données dans ce navigateur uniquement).
 * Pour la vraie version en ligne, colle ici les informations de ton projet Supabase
 * (Supabase > Project Settings > API) — voir INSTALLATION.md.
 * La clé « anon / publishable » est faite pour être publique : ne mets JAMAIS la clé service_role ici.
 */
window.MAYERBOOK_CONFIG = {
  supabaseUrl: 'https://essmphsqbicerwagvdlm.supabase.co',
  supabaseAnonKey: 'sb_publishable_J330if75_M893VudeTWgXA_PcgHjn16',

  // Nom de la fonction « eleves » tel qu'il apparaît à la FIN de son URL dans
  // Supabase > Edge Functions (ex : .../functions/v1/clever-api → 'clever-api').
  fonctionEleves: 'clever-api'
};
