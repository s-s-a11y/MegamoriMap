import { useEffect, useRef, useState } from "react";
import { useAuth } from "react-oidc-context";
import { uploadImage } from "../utils/ImageUpload"; // 実際の配置場所に合わせてパスを調整してください
import { ImagePickerWithRotation } from "../components/ImagePickerWithRotation"; // 実際の配置場所に合わせてパスを調整してください
import { buildAuthHeaders } from "../utils/authHeaders"; // 実際の配置場所に合わせてパスを調整してください

interface StoreForUpdate {
  place_id: string;
  title: string;
  store_category_name: string;
  store_url: string;
}

interface UpdateStoreModalProps {
  store: StoreForUpdate;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

type Status = "idle" | "loading" | "error";

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
  const [imageFile, setImageFile] = useState<File | null>(null);
  // ★追加：画像の回転角度(0/90/180/270)
  const [imageRotation, setImageRotation] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCategory(store.store_category_name);
    setStoreUrl(store.store_url);
    setImageFile(null);
    setImageRotation(0);
    setStatus("idle");
    setErrorMessage(null);
  }, [isOpen, store]);

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
      "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/categories/stores",
    )
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }, [isOpen]);

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    setStatus("loading");
    setErrorMessage(null);

    try {
      const apiUrl =
        "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/stores/update";

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
          store_url: storeUrl,
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
