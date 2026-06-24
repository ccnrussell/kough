const SYNC_TABLES = ["boards", "columns", "tasks", "tags", "task_tags"];

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Sync-Key",
  };
}

async function handleSync(request, env) {
  try {
    const syncKey = request.headers.get("X-Sync-Key");
    if (!syncKey || syncKey !== env.SYNC_KEY) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { last_sync, changes } = body;
    const serverTime = new Date().toISOString();

    for (const table of SYNC_TABLES) {
      const rows = changes[table] || [];
      for (const row of rows) {
        const columns = Object.keys(row);
        const placeholders = columns.map((_, i) => `?${i + 1}`).join(", ");

        let sql;
        if (table === "task_tags") {
          sql = `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
        } else {
          const updateClauses = columns
            .filter((c) => c !== "id")
            .map((c) => `${c} = excluded.${c}`)
            .join(", ");
          sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})
           ON CONFLICT(id) DO UPDATE SET ${updateClauses}
           WHERE excluded.updated_at >= ${table}.updated_at OR ${table}.updated_at IS NULL`;
        }

        await env.DB.prepare(sql)
          .bind(...columns.map((c) => row[c]))
          .run();
      }
    }

    const result = {};
    for (const table of SYNC_TABLES) {
      let query;
      if (table === "task_tags") {
        query = `SELECT * FROM ${table}`;
        const { results } = await env.DB.prepare(query).all();
        result[table] = results || [];
      } else {
        query = `SELECT * FROM ${table} WHERE updated_at > ?1 OR (updated_at IS NULL AND deleted_at > ?1)`;
        const { results } = await env.DB.prepare(query).bind(last_sync).all();
        result[table] = results || [];
      }
    }

    return new Response(JSON.stringify({ server_time: serverTime, changes: result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || String(e), stack: e.stack }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (url.pathname === "/sync" && request.method === "POST") {
      const response = await handleSync(request, env);
      const newHeaders = new Headers(response.headers);
      for (const [k, v] of Object.entries(headers)) {
        newHeaders.set(k, v);
      }
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    }

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404, headers });
  },
};
