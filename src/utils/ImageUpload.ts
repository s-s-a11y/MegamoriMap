// 店舗登録・メニュー登録など、画像を伴う登録処理全般で使い回すユーティリティ。
// このファイルだけは複数のページから読み込まれる前提の共有モジュール。

const MAX_IMAGE_DIMENSION = 1600; // アップロード前にリサイズする際の長辺の上限(px)
const IMAGE_JPEG_QUALITY = 0.8;

interface IssueUploadUrlResponse {
  upload_url: string;
  image_url: string;
}

// createImageBitmapでEXIF方向補正を試みる。
//
// 古いバージョンのSafariでは、"from-image"という値自体を認識できず、
// エラーになることがある(WebKit側でこの名前が導入されたのは2023年頃で、
// それ以前は挙動自体は近いが名称が違った)。そのため、まず現行の正しい
// 書き方を試し、失敗したらオプション無し(各ブラウザの既定の挙動に任せる)で
// フォールバックする。
async function createOrientedImageBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(file);
  }
}

// 画像ファイルを長辺MAX_IMAGE_DIMENSION以内に収まるようリサイズし、
// ユーザーが指定した回転(0/90/180/270度)を焼き込んだ上で、JPEGのBlobに変換する。
async function resizeImageToJpegBlob(
  file: File,
  rotationDegrees: number = 0,
): Promise<Blob> {
  const imageBitmap = await createOrientedImageBitmap(file);
  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(imageBitmap.width, imageBitmap.height),
  );
  const scaledWidth = Math.round(imageBitmap.width * scale);
  const scaledHeight = Math.round(imageBitmap.height * scale);

  // 0〜359の範囲に正規化しておく(負の値や360以上が来ても壊れないように)
  const rotation = ((rotationDegrees % 360) + 360) % 360;
  // 90度・270度回転の場合は、キャンバス自体の縦横を入れ替える必要がある
  const swapDimensions = rotation === 90 || rotation === 270;

  const canvas = document.createElement("canvas");
  canvas.width = swapDimensions ? scaledHeight : scaledWidth;
  canvas.height = swapDimensions ? scaledWidth : scaledHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("画像の処理に失敗しました");
  }

  // キャンバスの中心を軸に回転させてから、中心が(0,0)になるように
  // 画像を描画する(結果として、回転後もキャンバスの中央に収まる)
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(
    imageBitmap,
    -scaledWidth / 2,
    -scaledHeight / 2,
    scaledWidth,
    scaledHeight,
  );

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
 * 画像ファイルをリサイズ・回転したうえで、署名付きURL経由でS3へ直接アップロードする。
 *
 * @param file 選択された画像ファイル
 * @param folder S3上でのフォルダ分けのためだけの値(例: "stores", "menus")。
 *               DB上の紐づけとは無関係で、単なる整理用。
 * @param rotationDegrees ユーザーがプレビュー画面で指定した追加の回転角度
 *                        (0/90/180/270)。指定が無ければ0(回転無し)。
 * @param idToken CognitoのIDトークン。/images/upload-url が認証必須になったため、
 *                呼び出し元(useAuth()を使えるコンポーネント側)から渡してもらう。
 *                ※Authorizationヘッダーには"Bearer "を付けない(API Gateway側の仕様)
 * @returns アップロード完了後、DBに保存すべき画像の公開URL
 */
export async function uploadImage(
  file: File,
  folder: string,
  rotationDegrees: number = 0,
  idToken?: string,
): Promise<string> {
  const blob = await resizeImageToJpegBlob(file, rotationDegrees);

  const issueUrlApiUrl =
    "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/images/upload-url";

  const issueRes = await fetch(issueUrlApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: idToken } : {}),
    },
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
