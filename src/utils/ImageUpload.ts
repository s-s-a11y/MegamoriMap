// 店舗登録・メニュー登録など、画像を伴う登録処理全般で使い回すユーティリティ。
// このファイルだけは複数のページから読み込まれる前提の共有モジュール。

const MAX_IMAGE_DIMENSION = 1600; // アップロード前にリサイズする際の長辺の上限(px)
const IMAGE_JPEG_QUALITY = 0.8;

interface IssueUploadUrlResponse {
  upload_url: string;
  image_url: string;
}

// 画像ファイルを長辺MAX_IMAGE_DIMENSION以内に収まるようリサイズし、
// JPEGのBlobに変換する。
async function resizeImageToJpegBlob(file: File): Promise<Blob> {
  const imageBitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(imageBitmap.width, imageBitmap.height),
  );

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(imageBitmap.width * scale);
  canvas.height = Math.round(imageBitmap.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("画像の処理に失敗しました");
  }
  ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("画像の変換に失敗しました")),
      "image/jpeg",
      IMAGE_JPEG_QUALITY,
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
  const blob = await resizeImageToJpegBlob(file);

  const issueUrlApiUrl =
    "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/megamorimap/ImageUploadUrl";

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
