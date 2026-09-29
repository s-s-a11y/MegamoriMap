import { useEffect, useRef, useState } from "react";
import { useAuth } from "react-oidc-context";
import { uploadImage } from "../utils/ImageUpload"; // 実際の配置場所に合わせてパスを調整してください
import { ImagePickerWithRotation } from "../components/ImagePickerWithRotation"; // 実際の配置場所に合わせてパスを調整してください
import { buildAuthHeaders } from "../utils/authHeaders"; // 実際の配置場所に合わせてパスを調整してください
import { API_BASE_URL, readErrorMessage } from "../utils/api";
import { isHttpUrl } from "../utils/url";

interface StoreForUpdate {
  place_id: string;
  title: string;
  store_category_name: string;
  store_url: string;
  // ★追加：昼/晩(居酒屋対応)
  meal_time: "lunch" | "dinner";
}

interface UpdateStoreModalProps {
  store: StoreForUpdate;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

type Status = "idle" | "loading" | "error";

export function UpdateStoreModal({
  store,
  isOpen,
  onClose,
  onUpdated,
}: UpdateStoreModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  // ★追加：書き込み系のAPI呼び出しに使うIDトークンを取得する
  const auth = useAuth();

  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState(store.store_category_name);
  const [storeUrl, setStoreUrl] = useState(store.store_url);
  // ★追加：昼/晩(居酒屋対応)
  const [mealTime, setMealTime] = useState<"lunch" | "dinner">(store.meal_time);
  const [imageFile, setImageFile] = useState<File | null>(null);
  // ★追加：画像の回転角度(0/90/180/270)
  const [imageRotation, setImageRotation] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ★修正：開くたびのフォーム初期化はeffectで行わない。呼び出し側
  // (ShowStoreDetail.tsx)が開いている間だけ描画するため、開くたびに
  // 上のuseStateの初期値(storeの現在値)で作り直される(lint: set-state-in-effect対応)。

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    fetch(
      `${API_BASE_URL}/categories/stores`,
    )
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }, [isOpen]);

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    // ★追加：店舗URLはhttp(s)のURLか空欄のみ受け付ける(UpdateStore.pyと同じ基準、C17)
    const trimmedStoreUrl = storeUrl.trim();
    if (trimmedStoreUrl && !isHttpUrl(trimmedStoreUrl)) {
      setErrorMessage(
        "店舗URLは http:// または https:// で始まるURLを入力してください",
      );
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const apiUrl =
        `${API_BASE_URL}/stores/update`;

      // 画像を選び直した場合のみアップロードし、image_urlを送る
      const image_url = imageFile
        ? await uploadImage(
            imageFile,
            "stores",
            imageRotation,
            auth.user?.id_token,
          )
        : undefined;

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: buildAuthHeaders(auth.user?.id_token),
        body: JSON.stringify({
          place_id: store.place_id,
          store_category_name: category,
          store_url: trimmedStoreUrl,
          meal_time: mealTime,
          image_url,
        }),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }

      onUpdated();
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "更新に失敗しました",
      );
      setStatus("error");
    }
  };

  return (
    <dialog ref={dialogRef} onClose={onClose}>
      <h2>店舗情報を更新</h2>
      <p>{store.title}</p>

      <form onSubmit={handleSubmit}>
        <label>
          カテゴリー
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label>
          店舗URL（任意）
          <input
            type="text"
            value={storeUrl}
            onChange={(e) => setStoreUrl(e.target.value)}
          />
        </label>

        {/* ★追加：昼/晩(居酒屋対応) */}
        <fieldset>
          <legend>昼の店？晩の店？</legend>
          <label>
            <input
              type="radio"
              name="update-meal-time"
              value="lunch"
              checked={mealTime === "lunch"}
              onChange={() => setMealTime("lunch")}
            />{" "}
            昼
          </label>
          <label>
            <input
              type="radio"
              name="update-meal-time"
              value="dinner"
              checked={mealTime === "dinner"}
              onChange={() => setMealTime("dinner")}
            />{" "}
            晩
          </label>
        </fieldset>

        {/* ★変更：プレビュー＋回転ボタン付きの共有コンポーネントに置き換え */}
        <ImagePickerWithRotation
          label="写真を差し替える（任意）"
          file={imageFile}
          rotation={imageRotation}
          onFileChange={setImageFile}
          onRotationChange={setImageRotation}
        />

        {status === "error" && <p role="alert">{errorMessage}</p>}

        <div>
          <button type="button" onClick={onClose}>
            キャンセル
          </button>
          <button
            type="submit"
            disabled={status === "loading" || !auth.isAuthenticated}
          >
            {status === "loading" ? "更新中..." : "更新する"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
