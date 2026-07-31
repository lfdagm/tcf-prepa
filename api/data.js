// Fonction serverless Vercel : lecture/écriture d'un document JSON par utilisateur.
// Le « document » est stocké dans Upstash Redis (Vercel KV) sous une clé dérivée
// du mot de passe de l'utilisateur (envoyé haché dans l'en-tête x-sync-key).
// Aucune dépendance npm : on utilise l'API REST d'Upstash via fetch.

module.exports = async (req, res) => {
  const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!URL || !TOKEN) {
    res.status(500).json({ error: "Stockage non configuré (variables KV manquantes)." });
    return;
  }

  const key = req.headers["x-sync-key"];
  if (!key || typeof key !== "string" || key.length < 8) {
    res.status(400).json({ error: "Clé de synchronisation absente ou trop courte." });
    return;
  }
  const redisKey = "tcfjournal:" + key;

  async function cmd(command) {
    const r = await fetch(URL, {
      method: "POST",
      headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    if (!r.ok) throw new Error("KV HTTP " + r.status);
    return r.json();
  }

  try {
    if (req.method === "GET") {
      const out = await cmd(["GET", redisKey]);
      res.status(200).json({ data: out.result ? JSON.parse(out.result) : null });
      return;
    }
    if (req.method === "PUT" || req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") body = JSON.parse(body || "{}");
      if (!body || typeof body.data !== "object") {
        res.status(400).json({ error: "Corps invalide (data manquant)." });
        return;
      }
      await cmd(["SET", redisKey, JSON.stringify(body.data)]);
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ error: "Méthode non autorisée." });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
