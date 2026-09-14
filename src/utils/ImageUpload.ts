// 店舗登録・メニュー登録など、画像を伴う登録処理全般で使い回すユーティリティ。
// このファイルだけは複数のページから読み込まれる前提の共有モジュール。

const MAX_IMAGE_DIMENSION = 1600; // アップロード前にリサイズする際の長辺の上限(px)
const IMAGE_JPEG_QUALITY = 0.8;

interface IssueUploadUrlResponse {
  upload_url: string;
  image_url: string;
}

// 画像ファイルを長辺MAX_IMAGE_DIMENSION以内に収まるようリサイズし、JPEGのBlobに変換する。
async function resizeImageToJpegBlob(file: File): Promise<Blob> {
  // インプットタグから入ってくるファイルを、幅◯px、高さ◯px の画像として扱えるようにするブラウザ標準搭載機能
  const imageBitmap = await createImageBitmap(file);
  // リサイズを行う際に何倍に縮小すればいいかを計算する
  const scale = Math.min(
    1, // 既に規定サイズより小さい場合はそのまま１倍
    MAX_IMAGE_DIMENSION / Math.max(imageBitmap.width, imageBitmap.height),
  );
  // 画像描画用のHTML要素を縮小率に合わせたサイズで作成する。canvasを使用することによって、JavaScriptから画像を描画することができるようになる機能
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(imageBitmap.width * scale);
  canvas.height = Math.round(imageBitmap.height * scale);

  // 2D画像描画用のツールを獲得
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("画像の処理に失敗しました");
  }
  // 実際にcanvasに対してリサイズした画像を描画する
  ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
  // canvasの内容を実際にBlob型に変換する処理
  // Promiseは、await/asyncでの処理待ちができない場合に使用する少し古いコールバック待機宣言
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("画像の変換に失敗しました")),
      "image/jpeg", // データ形式
      IMAGE_JPEG_QUALITY, // 画質
    );
  });
}

/**
 * 画像ファイルをリサイズしたうえで、署名付きURL経由でS3へ直接アップロードする。
 *
 * @param file 選択された画像ファイル
 * @param folder S3上でのフォルダ分けのためだけの値(例: "stores", "menus")。
 *               DB上の紐づけとは無関係で、単なる整理用。
 * @returns アップロード完了後、DBに保存すべき画像の公開URL
 */
export async function uploadImage(file: File, folder: string): Promise<string> {
  // 画像をバイナリ形式に変換、Lambdaのレスポンス上限に収まるサイズにリサイズ
  const blob = await resizeImageToJpegBlob(file);

  const issueUrlApiUrl =
    "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/megamorimap/ImageUploadUrl";
  // Lambda関数ImageUploadUrlを呼び出して画像アップロード用URLを取得
  const issueRes = await fetch(issueUrlApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: "image/jpeg", folder }),
  });

  if (!issueRes.ok) {
    throw new Error("画像アップロード用URLの取得に失敗しました");
  }

  const { upload_url, image_url } =
    (await issueRes.json()) as IssueUploadUrlResponse;

  // IssueImageUploadUrl.py が署名に含めたCacheControlと、
  // ここで送るヘッダーが一致していないと署名検証エラー(403)になるので注意。
  // 画像データをアップロード用URLにPUT
  const uploadRes = await fetch(upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "max-age=31536000, immutable",
    },
    body: blob,
  });

  if (!uploadRes.ok) {
    throw new Error("画像のアップロードに失敗しました");
  }

  return image_url;
}
