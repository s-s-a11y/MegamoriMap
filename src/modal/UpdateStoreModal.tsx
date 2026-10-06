import { useEffect, useRef, useState } from "react";
import { useAuth } from "react-oidc-context";
import { uploadImage } from "../utils/ImageUpload"; // 実際の配置場所に合わせてパスを調整してください
import { ImagePickerWithRotation } from "../components/ImagePickerWithRotation"; // 実際の配置場所に合わせてパスを調整してください
import { buildAuthHeaders } from "../utils/authHeaders"; // 実際の配置場所に合わせてパスを調整してください
import { API_BASE_URL, readErrorMessage } from "../utils/api";
import { isHttpUrl } from "../utils/url";
import { looksLikeAddress, type MealTime } from "../utils/mealTime"; // ★追加(C71)
import "../css_components/UpdateStoreModal.css"; // ★追加(C71)

interface StoreForUpdate {
  place_id: string;
  title: string;
  store_category_name: string;
  store_url: string;
  // ★追加：昼/晩(居酒屋対応)。★変更(C71)：「昼・晩どちらも」を追加
  meal_time: MealTime;
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
  // ★追加(C71)：店名も直せるようにする(住所が店名として登録されてしまった店の修正用)
  const [title, setTitle] = useState(store.title);
  const [category, setCategory] = useState(store.store_category_name);
  // ★追加(C71)：その場で新しいカテゴリーを作る
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [storeUrl, setStoreUrl] = useState(store.store_url);
  // ★追加：昼/晩(居酒屋対応)
  const [mealTime, setMealTime] = useState<MealTime>(store.meal_time);
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

  // ★追加(C71)：新しいカテゴリーを作り、そのまま選んだ状態にする(店舗登録画面と同じAPI)
  const handleCreateCategory = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) return;
    setIsCreatingCategory(true);
    setCategoryError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/categories/stores`, {
        method: "POST",
        headers: buildAuthHeaders(auth.user?.id_token),
        body: JSON.stringify({ store_category_name: trimmedName }),
      });
      // 409は「既にある」なので、そのまま選べばよい
      if (!res.ok && res.status !== 409) {
        throw new Error(await readErrorMessage(res));
      }
      setCategories((prev) =>
        prev.includes(trimmedName) ? prev : [...prev, trimmedName],
      );
      setCategory(trimmedName);
      setNewCategoryName("");
    } catch (err) {
      setCategoryError(
        err instanceof Error ? err.message : "カテゴリーの作成に失敗しました",
      );
    } finally {
      setIsCreatingCategory(false);
    }
  };

  // 今のカテゴリーが一覧に無い場合(削除された等)でも、選択肢に残す
  const categoryOptions = categories.includes(category)
    ? categories
    : [category, ...categories].filter(Boolean);

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
          title: title.trim(), // ★追加(C71)
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
        {/* ★追加(C71)：店名 */}
        <label>
          店名
          <input
            type="text"
            value={title}
            maxLength={50}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        {looksLikeAddress(title) && (
          <p role="status" className="update-store__name-warning">
            店名が住所になっています。お店の名前に直してください。
          </p>
        )}

        <label>
          カテゴリー
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categoryOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {/* ★追加(C71)：一覧に無いカテゴリーは、ここで作ってそのまま選べる */}
        <div className="update-store__new-category">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="新しいカテゴリー（例: つけ麺）"
            aria-label="新しいカテゴリー名"
          />
          <button
            type="button"
            onClick={handleCreateCategory}
            disabled={isCreatingCategory || !newCategoryName.trim() || !auth.isAuthenticated}
          >
            {isCreatingCategory ? "作成中..." : "作って選ぶ"}
          </button>
        </div>
        {categoryError && <p role="alert">{categoryError}</p>}

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
          {/* ★追加(C71)：昼・晩どちらも */}
          <label>
            <input
              type="radio"
              name="update-meal-time"
              value="both"
              checked={mealTime === "both"}
              onChange={() => setMealTime("both")}
            />{" "}
            昼・晩どちらも
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
            disabled={status === "loading" || !auth.isAuthenticated || !title.trim()}
          >
            {status === "loading" ? "更新中..." : "更新する"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
