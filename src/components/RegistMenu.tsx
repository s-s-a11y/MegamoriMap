import { useState } from "react";
import { uploadImage } from "../utils/ImageUpload"; // 実際の配置場所に合わせてパスを調整してください
import { ImagePickerWithRotation } from "./ImagePickerWithRotation"; // 実際の配置場所に合わせてパスを調整してください

type SubmitStatus = "idle" | "loading" | "error";

// ★変更：店舗詳細画面から必ずplace_id・店舗名を受け取る形式に変更したため、
// 店舗一覧の取得(ShowMegaMap)・店舗選択セレクトタブは不要になった。
interface RegisterMenuPageProps {
  placeId: string;
  storeName: string;
  onNavigate: (
    view: "map" | "regist-store" | "regist-menu" | "store-detail",
    placeId?: string,
    storeName?: string,
  ) => void;
}

const MENU_NAME_MAX_LENGTH = 30; // RegistMenu.py: MAX_MENU_NAME_LENGTH = 30

// ------------------------------------------------------------
// エラーメッセージの読み取り
// ------------------------------------------------------------
async function readErrorMessage(res: Response): Promise<string> {
  const rawText = await res.text();
  try {
    const parsed = JSON.parse(rawText);
    if (typeof parsed === "object" && parsed?.message) {
      return parsed.message;
    }
    return rawText;
  } catch {
    return rawText || `エラーが発生しました（ステータスコード: ${res.status}）`;
  }
}

export function RegisterMenuPage({
  placeId,
  storeName,
  onNavigate,
}: RegisterMenuPageProps) {
  // ---- 入力フォームの状態 ----
  const [menuName, setMenuName] = useState("");
  const [price, setPrice] = useState("");
  const [memo, setMemo] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  // ★追加：画像の回転角度(0/90/180/270)
  const [imageRotation, setImageRotation] = useState(0);

  // ---- 登録処理の状態 ----
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // place_idは既にpropsで確定しているため、
  // RegistMenu.py の check_input() が要求する残りの条件だけ確認する
  const isFormValid =
    menuName.trim() !== "" &&
    menuName.length <= MENU_NAME_MAX_LENGTH &&
    price !== "" &&
    !Number.isNaN(Number(price)) &&
    Number(price) >= 0;

  // 「メニューを登録する」ボタンが押されたときの処理
  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isFormValid) return;

    setSubmitStatus("loading");
    setSubmitError(null);

    try {
      const apiUrl =
        "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/menus";

      // 画像が選ばれていれば、共有ユーティリティでリサイズ・回転→S3へ直接アップロードする
      const image_url = imageFile
        ? await uploadImage(imageFile, "menus", imageRotation)
        : undefined;

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menu_name: menuName,
          place_id: placeId,
          memo: memo, // 任意項目。空文字のままでもRegistMenu.py側で問題ない
          price: Number(price),
          image_url,
        }),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }

      // ★変更：成功メッセージを出して留まるのではなく、
      // 該当店舗の詳細画面へ即座に遷移する
      onNavigate("store-detail", placeId);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "登録に失敗しました");
      setSubmitStatus("error");
    }
  };

  return (
    <div>
      {/* ★変更：h1・nav(戻る/店舗登録へ)を削除。
          タイトルは共通ヘッダー側、Homeへの導線もそちらに移したため。 */}
      <main>
        {/* ★追加：place_idは表示せず、店舗名だけを文脈として表示する */}
        <p>
          「<strong>{storeName}</strong>」にメニューを登録します。
        </p>

        <form onSubmit={handleSubmit}>
          <label>
            メニュー名（{MENU_NAME_MAX_LENGTH}文字以内）
            <input
              type="text"
              value={menuName}
              maxLength={MENU_NAME_MAX_LENGTH}
              onChange={(e) => setMenuName(e.target.value)}
              required
            />
          </label>

          <label>
            価格（円）
            <input
              type="number"
              value={price}
              min={0}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </label>

          <label>
            メモ（重量など特盛を示す情報。任意）
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
            />
          </label>

          {/* ★変更：プレビュー＋回転ボタン付きの共有コンポーネントに置き換え */}
          <ImagePickerWithRotation
            label="写真（任意）"
            file={imageFile}
            rotation={imageRotation}
            onFileChange={setImageFile}
            onRotationChange={setImageRotation}
          />

          <button
            type="submit"
            disabled={!isFormValid || submitStatus === "loading"}
          >
            {submitStatus === "loading" ? "登録中..." : "メニューを登録する"}
          </button>
        </form>

        {submitStatus === "error" && <p role="alert">{submitError}</p>}
      </main>
    </div>
  );
}
