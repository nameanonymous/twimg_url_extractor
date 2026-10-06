# Twimg URL extractor

X（旧Twitter）の投稿URLを貼ると、その投稿についている画像と動画のリンクを出します。リンク先は `pbs.twimg.com` と `video.twimg.com` です。

ログインは要りません。公開投稿だけ取れます。非公開アカウントや、消えた投稿は取れません。

## 公開サイト

GitHub Pages: https://nameanonymous.github.io/twimg_url_extractor/

## 手元で開く

`index.html` をダブルクリックしても、ブラウザが外部への通信を止めるので抽出は動きません。次のどちらかで開きます。

```powershell
python -m http.server 8080
```

ブラウザで http://localhost:8080 を開きます。Python が無いときは、VS Code の Live Server など、ローカル用のサーバーで同じフォルダを配信します。

npm のインストールは不要です。

## 広告を出す

「抽出する」を押してURLの形が正しいとき、結果の前に約3秒、広告枠が出ます。今入っているのは仮の枠です。お金が発生する広告にするには、配信サービスのアカウントと審査が要ります。

差し替え方:

1. [Google AdSense](https://www.google.com/adsense/) などでサイトを登録し、広告コードをもらう。
2. `index.html` の `<div id="ad-slot">` の中身を、そのコードに差し替える。
3. 変更を GitHub に push する。

表示時間は `app.js` の `AD_DURATION_MS` です。`3000` が3秒です。

AdSense は、中身を覆い隠す強制的な全面広告を禁止していることが多いです。審査に出すときは、ボタンの下に普通のバナーを置く形の方が通りやすいです。

## 動き

1. URLから `/status/` のうしろの番号だけを取り出す。
2. `https://api.fxtwitter.com/status/番号` にブラウザから直接聞く。
3. 返ってきた画像と mp4 のURLだけを表示する。

このサイト用のサーバーは無く、投稿URLは fxtwitter にだけ送られます。
