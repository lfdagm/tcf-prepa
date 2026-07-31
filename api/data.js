// Fonction serverless Vercel : lecture/écriture d'un document JSON par utilisateur.
// Stocké dans Redis (Upstash via Vercel) sous une clé dérivée du mot de passe
// (haché SHA-256, envoyé dans l'en-tête x-sync-key). Connexion via REDIS_URL.

const Redis = require("ioredis");

let client;
function getClient() {
  if (client) return client;
  const url = process.env.REDIS_URL || process.env.KV_URL || process.env.UPSTASH_REDIS_URL;
  if (!url) return null;
  client = new Redis(url, { maxRetriesPerRequest: 5, lazyConnect: false });
  client.on("error", () => {});   // évite les crashs sur erreurs transitoires
  return client;
}

module.exports = async (req, res) => {
  const redis = getClient();
  if (!redis) { res.status(500).json({ error: "Stockage non configuré (REDIS_URL manquant)." }); return; }

  const key = req.headers["x-sync-key"];
  if (!key || typeof key !== "string" || key.length < 8) {
    res.status(400).json({ error: "Clé de synchronisation absente ou trop courte." });
    return;
  }
  const redisKey = "tcfjournal:" + key;

  try {
    if (req.method === "GET") {
      const val = await redis.get(redisKey);
      res.status(200).json({ data: val ? JSON.parse(val) : null });
      return;
    }
    if (req.method === "PUT" || req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") body = JSON.parse(body || "{}");
      if (!body || typeof body.data !== "object") {
        res.status(400).json({ error: "Corps invalide (data manquant)." });
        return;
      }
      await redis.set(redisKey, JSON.stringify(body.data));
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ error: "Méthode non autorisée." });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
