// 投稿URLから status の番号だけを取り、api.fxtwitter.com に聞きます。
// Xのページ自体はログイン壁があるので、見に行きません。
// 画像と動画の実ファイルは pbs.twimg.com / video.twimg.com にあり、
// ブラウザから直接リンクを読めます。

const AD_DURATION_MS = 3000;

function statusIdFromUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const match = url.pathname.match(/\/status(?:es)?\/(\d+)/);
  return match ? match[1] : null;
}

export function parseStatusId(raw) {
  const text = String(raw ?? "").trim();
  if (/^\d{8,25}$/.test(text)) return text;

  const direct = statusIdFromUrl(text);
  if (direct) return direct;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) return statusIdFromUrl(`https://${text}`);
  return null;
}

function isTwimg(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)twimg\.com$/.test(url.hostname);
  } catch {
    return false;
  }
}

function upgradeImage(value) {
  if (!isTwimg(value)) return value;
  const url = new URL(value);
  if (url.hostname === "pbs.twimg.com" && url.searchParams.has("name")) {
    url.searchParams.set("name", "orig");
  }
  return url.toString();
}

function isMp4(variant) {
  const type = variant.content_type || "";
  const container = variant.container || "";
  const url = variant.url || "";
  return type.includes("mp4") || container === "mp4" || /\.mp4(\?|$)/.test(url);
}

function resolutionLabel(value) {
  const match = String(value).match(/\/(\d{2,5})x(\d{2,5})\//);
  return match ? `${match[1]}×${match[2]}` : null;
}

export function collectTwimg(tweet) {
  const media = tweet?.media?.all;
  if (!Array.isArray(media)) return [];

  const items = [];
  const seen = new Set();
  const push = (value, kind) => {
    if (!value || !isTwimg(value) || seen.has(value)) return;
    seen.add(value);
    items.push({ url: value, kind });
  };

  for (const item of media) {
    const variants = Array.isArray(item.variants) ? item.variants : [];
    const mp4s = variants
      .filter(isMp4)
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const videoLike = item.type === "video" || item.type === "gif" || mp4s.length > 0;

    if (videoLike) {
      const prefix = item.type === "gif" ? "GIF" : "動画";
      if (mp4s.length === 0 && item.url) {
        const size = resolutionLabel(item.url);
        push(item.url, size ? `${prefix} ${size}` : prefix);
      }
      for (const variant of mp4s) {
        const size = resolutionLabel(variant.url);
        push(variant.url, size ? `${prefix} ${size}` : prefix);
      }
      push(item.thumbnail_url, "サムネイル");
      continue;
    }

    if (item.url) push(upgradeImage(item.url), "画像");
  }

  return items;
}

function showAd(durationMs) {
  const overlay = document.querySelector("#ad-overlay");
  const timer = document.querySelector("#ad-timer");
  overlay.hidden = false;
  document.body.classList.add("ad-open");
  const started = Date.now();

  const paint = () => {
    const left = Math.max(0, durationMs - (Date.now() - started));
    timer.textContent = `あと ${Math.ceil(left / 1000)} 秒`;
  };
  paint();

  return new Promise((resolve) => {
    const tick = () => {
      const left = durationMs - (Date.now() - started);
      if (left <= 0) {
        overlay.hidden = true;
        document.body.classList.remove("ad-open");
        resolve();
        return;
      }
      paint();
      window.setTimeout(tick, 200);
    };
    tick();
  });
}

async function fetchTweet(id) {
  let response;
  try {
    response = await fetch(`https://api.fxtwitter.com/status/${id}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error("取得がタイムアウトしました。もう一度押してください。");
    }
    throw new Error("通信できませんでした。接続を確認してください。");
  }

  if (!response.ok) {
    throw new Error("取得に失敗しました。時間をおいてもう一度押してください。");
  }

  const data = await response.json();
  if (!data?.tweet) {
    throw new Error("この投稿は取得できません。非公開か、削除済みの可能性があります。");
  }
  return data.tweet;
}

async function copyUrl(url, button) {
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const area = document.createElement("textarea");
    area.value = url;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  const previous = button.textContent;
  button.textContent = "コピーしました";
  window.setTimeout(() => {
    button.textContent = previous;
  }, 1500);
}

function renderResults(items) {
  const list = document.querySelector("#results");
  const message = document.querySelector("#message");
  list.replaceChildren();
  message.classList.remove("error");

  if (items.length === 0) {
    message.textContent = "この投稿には画像も動画も付いていません。";
    return;
  }

  message.textContent = `${items.length}件のリンク`;
  for (const item of items) {
    const li = document.createElement("li");
    const kind = document.createElement("p");
    kind.className = "kind";
    kind.textContent = item.kind;

    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = item.url;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "コピー";
    button.addEventListener("click", () => {
      copyUrl(item.url, button);
    });

    li.append(kind, link, button);
    list.append(li);
  }
}

function showError(text) {
  const message = document.querySelector("#message");
  const list = document.querySelector("#results");
  list.replaceChildren();
  message.classList.add("error");
  message.textContent = text;
}

function init() {
  const form = document.querySelector("#extract-form");
  const input = document.querySelector("#post-url");
  const button = document.querySelector("#extract-button");
  let busy = false;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;

    const id = parseStatusId(input.value);
    if (!id) {
      showError("投稿URLの形が違います。x.com の status のURLを貼ってください。");
      return;
    }

    busy = true;
    button.disabled = true;
    document.querySelector("#message").textContent = "";
    document.querySelector("#message").classList.remove("error");
    document.querySelector("#results").replaceChildren();

    const adDone = showAd(AD_DURATION_MS);
    const tweetDone = fetchTweet(id);

    try {
      const [tweet] = await Promise.all([tweetDone, adDone]);
      renderResults(collectTwimg(tweet));
    } catch (error) {
      await adDone;
      showError(error.message || "取得に失敗しました。");
    } finally {
      busy = false;
      button.disabled = false;
    }
  });
}

if (typeof document !== "undefined") init();
