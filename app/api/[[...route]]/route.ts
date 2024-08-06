import { Redis } from "@upstash/redis/cloudflare";
import { Hono } from "hono";
import { env } from "hono/adapter";
import { cors } from "hono/cors";
import { handle } from "hono/vercel";

export const runtime = "edge";

const app = new Hono().basePath("/api");

type EnvConfig = {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
};

app.use("/*", cors());
app.get("/search", async (c) => {
  try {
    const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } =
      env<EnvConfig>(c);

    const start = performance.now();

    const redis = new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
    });

    const query = c.req.query("q")?.toUpperCase();

    if (!query) {
      return c.json(
        { message: "No query provided" },
        {
          status: 400,
        }
      );
    }

    const res = [];

    const rank = await redis.zrank("2terms", query);

    if (rank !== null && rank !== undefined) {
      const temp = await redis.zrange<string[]>("2terms", rank, rank + 100);

      for (const t of temp) {
        if (!t.startsWith(query)) break;

        if (t.endsWith("*")) {
          res.push(t.substring(0, t.length - 1));
        }
      }
    }

    const end = performance.now();

    return c.json({
      results: res,
      duration: end - start,
    });
  } catch (error) {
    console.error(error);
    return c.json({ message: "Something went wrong" }, { status: 500 });
  }
});

export const GET = handle(app);
export default app as never;
