/**
 * Cloudflare Workers の入口。
 *
 * サイト本体は Astro が作った dist/ の静的ファイルで、Cloudflare がそのまま配信する（wrangler.jsonc の assets）。
 * このスクリプトが動くのは、wrangler.jsonc の run_worker_first に書いた次の URL だけ。
 *
 *   /pamphlet/:id  Google Drive のパンフレット PDF を中継する
 *   /bib/*         旧サイトのパンフレット（BiB/i）のリンクを、その回のビューアーへ転送する
 */
const CACHE_SECONDS = 60 * 60 * 24 * 7;

/** ビルド時に microCMS から作った「書展 ID → Drive のファイル ID」の対応表 */
async function pamphletMap(request, env) {
  const res = await env.ASSETS.fetch(new URL('/pamphlets.json', request.url));
  return res.ok ? res.json() : {};
}

/**
 * /pamphlet/:id
 * Drive は他サイトからの直接読み込みを許可していないので、サイトと同じドメインから返す。
 * 中継するのは対応表に載っているファイルだけ。取得した PDF は Cloudflare のキャッシュに保存する
 * （キャッシュは ?f=<ファイルID> ごとなので、Drive のファイルを差し替えればすぐ反映される）。
 */
async function servePamphlet(request, env, ctx, id) {
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString());
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const fileId = (await pamphletMap(request, env))[id];
  if (!fileId) return new Response('Not found', { status: 404 });

  const upstream = await fetch(
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`,
  );
  // Drive は PDF を application/octet-stream で返す。
  // 共有設定が「リンクを知っている全員」になっていないと HTML のログイン画面が返ってくる
  const type = upstream.headers.get('Content-Type') ?? '';
  if (!upstream.ok || type.includes('text/html')) {
    return new Response('Pamphlet is not available', { status: 502 });
  }

  const response = new Response(upstream.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
    },
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

/**
 * /bib/i/?book=123、/bib/i/?book=134.epub など
 * URL の ? 以降は public/_redirects では見られないので、ここで転送する。
 * 回数が分からない・その回のパンフレットがないときは作品紹介へ。
 */
async function redirectOldPamphlet(request, env) {
  const url = new URL(request.url);
  const number = Number.parseInt(url.searchParams.get('book') ?? '', 10);

  let destination = '/activities';
  if (Number.isFinite(number)) {
    const id = `shoten-${number}`;
    if ((await pamphletMap(request, env))[id]) destination = `/exhibitions/${id}/pamphlet`;
  }
  return Response.redirect(new URL(destination, url).toString(), 301);
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);

    if (request.method === 'GET') {
      const pamphlet = pathname.match(/^\/pamphlet\/([\w-]+)\/?$/);
      if (pamphlet) return servePamphlet(request, env, ctx, pamphlet[1]);
      if (pathname === '/bib' || pathname.startsWith('/bib/')) return redirectOldPamphlet(request, env);
    }

    // それ以外は静的ファイル（run_worker_first の設定上、通常ここには来ない）
    return env.ASSETS.fetch(request);
  },
};
