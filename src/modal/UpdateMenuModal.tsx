import { useEffect, useRef, useState } from "react";
import { uploadImage } from "../utils/ImageUpload"; // 実際の配置場所に合わせてパスを調整してください

// このモーダルが必要とするメニュー情報だけを定義(呼び出し元の型に依存しない)
interface MenuForUpdate {
  menu_id: number;
  menu_name: string;
  price: number;
  memo: string;
}

interface UpdateMenuModalProps {
  menu: MenuForUpdate;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

type Status = "idle" | "loading" | "error";

const MENU_NAME_MAX_LENGTH = 30; // RegistMenu.py: MAX_MENU_NAME_LENGTH = 30

// ------------------------------------------------------------
// エラーメッセージの読み取り
// UpdateMenu.py は 400/404 のときはJSON({"message": "..."})、
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

export function UpdateMenuModal({
  menu,
  isOpen,
  onClose,
  onUpdated,
}: UpdateMenuModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const [menuName, setMenuName] = useState(menu.menu_name);
  const [price, setPrice] = useState(String(menu.price));
  const [memo, setMemo] = useState(menu.memo);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // モーダルを開くたびに、その時点のメニュー情報でフォームを初期化し直す
  useEffect(() => {
    if (!isOpen) return;
    setMenuName(menu.menu_name);
    setPrice(String(menu.price));
    setMemo(menu.memo);
    setImageFile(null);
    setStatus("idle");
    setErrorMessage(null);
  }, [isOpen, menu]);

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

  const isFormValid =
    menuName.trim() !== "" &&
    menuName.length <= MENU_NAME_MAX_LENGTH &&
    price !== "" &&
    !Number.isNaN(Number(price)) &&
    Number(price) >= 0;

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isFormValid) return;

    setStatus("loading");
    setErrorMessage(null);

    try {
      const apiUrl =
        "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/menus/update";

      // 画像を選び直した場合のみアップロードし、image_urlを送る
      const image_url = imageFile
        ? await uploadImage(imageFile, "menus")
        : undefined;

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menu_id: menu.menu_id,
          menu_name: menuName,
          price: Number(price),
          memo,
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
      <h2>メニューを更新</h2>

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
          メモ
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
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
          <button type="submit" disabled={!isFormValid || status === "loading"}>
            {status === "loading" ? "更新中..." : "更新する"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
