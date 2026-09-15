import { useEffect, useRef, useState } from "react";
import { uploadImage } from "../utils/ImageUpload"; // 実際の配置場所に合わせてパスを調整してください

// このモーダルが必要とする店舗情報だけを定義(呼び出し元の型に依存しない)
// ※commentsはここでは扱わない(上書きではなく追記専用のAddStoreComment.py側の責務)
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
  // 更新成功時に、呼び出し元に「最新の情報を取り直してね」と伝えるためのコールバック
  onUpdated: () => void;
}

type Status = "idle" | "loading" | "error";

// ------------------------------------------------------------
// エラーメッセージの読み取り
// UpdateStore.py は 400/404 のときはJSON({"message": "..."})、
// 401のときはプレーン文字列を返すので、両方に対応できるようにする
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

export function UpdateStoreModal({
  store,
  isOpen,
  onClose,
  onUpdated,
}: UpdateStoreModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState(store.store_category_name);
  const [storeUrl, setStoreUrl] = useState(store.store_url);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // モーダルを開くたびに、その時点の店舗情報でフォームを初期化し直す
  useEffect(() => {
    if (!isOpen) return;
    setCategory(store.store_category_name);
    setStoreUrl(store.store_url);
    setImageFile(null);
    setStatus("idle");
    setErrorMessage(null);
  }, [isOpen, store]);

  // <dialog>要素の開閉を、親から渡されるisOpenと同期させる
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // カテゴリー選択肢の取得(モーダルを開くたびに最新を取り直す)
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
      // (選び直していなければキーごと送らず、既存の画像を維持する)
      const image_url = imageFile
        ? await uploadImage(imageFile, "stores")
        : undefined;

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

        <label>
          写真を差し替える（任意）
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {status === "error" && <p role="alert">{errorMessage}</p>}

        <div>
          <button type="button" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "更新中..." : "更新する"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
