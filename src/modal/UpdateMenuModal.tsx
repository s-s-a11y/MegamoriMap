import { useEffect, useRef, useState } from "react";
import { useAuth } from "react-oidc-context";
import { uploadImage } from "../utils/ImageUpload"; // 実際の配置場所に合わせてパスを調整してください
import { ImagePickerWithRotation } from "../components/ImagePickerWithRotation"; // 実際の配置場所に合わせてパスを調整してください
import { buildAuthHeaders } from "../utils/authHeaders"; // 実際の配置場所に合わせてパスを調整してください

interface MenuForUpdate {
  menu_id: string;
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

const MENU_NAME_MAX_LENGTH = 30;

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
  // ★追加：書き込み系のAPI呼び出しに使うIDトークンを取得する
  const auth = useAuth();

  const [menuName, setMenuName] = useState(menu.menu_name);
  const [price, setPrice] = useState(String(menu.price));
  const [memo, setMemo] = useState(menu.memo);
  const [imageFile, setImageFile] = useState<File | null>(null);
  // ★追加：画像の回転角度(0/90/180/270)
  const [imageRotation, setImageRotation] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setMenuName(menu.menu_name);
    setPrice(String(menu.price));
    setMemo(menu.memo);
    setImageFile(null);
    setImageRotation(0);
    setStatus("idle");
    setErrorMessage(null);
  }, [isOpen, menu]);

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
        ? await uploadImage(
            imageFile,
            "menus",
            imageRotation,
            auth.user?.id_token,
          )
        : undefined;

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: buildAuthHeaders(auth.user?.id_token),
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
            disabled={
              !isFormValid || status === "loading" || !auth.isAuthenticated
            }
          >
            {status === "loading" ? "更新中..." : "更新する"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
