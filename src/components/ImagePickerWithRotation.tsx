import { useEffect, useState } from "react";
import "../css_components/ImagePicker.css";

interface ImagePickerWithRotationProps {
  label: string;
  file: File | null;
  rotation: number; // 0 | 90 | 180 | 270
  onFileChange: (file: File | null) => void;
  onRotationChange: (rotation: number) => void;
}

// 画像選択＋プレビュー＋90度単位の回転を行う、複数画面(店舗登録・メニュー登録・
// それぞれの更新モーダル)で使い回す共有コンポーネント。
//
// ここではCSSのtransformでプレビュー表示だけを回転させている(軽量なため)。
// 実際にピクセルデータへ回転を焼き込む処理は、アップロード時にImageUpload.ts
// (uploadImageのrotationDegrees引数)側で行う。
export function ImagePickerWithRotation({
  label,
  file,
  rotation,
  onFileChange,
  onRotationChange,
}: ImagePickerWithRotationProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // fileが変わるたびにプレビュー用URLを作り直す。
  // 使わなくなったURLはメモリリーク防止のため必ず解放する。
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileChange(e.target.files?.[0] ?? null);
    // 新しく選び直した画像には、前回の回転を引き継がない
    onRotationChange(0);
  };

  const rotateLeft = () => {
    onRotationChange((rotation + 270) % 360);
  };

  const rotateRight = () => {
    onRotationChange((rotation + 90) % 360);
  };

  return (
    <div className="image-picker">
      <label>
        {label}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
        />
      </label>

      {previewUrl && (
        <div className="image-picker__preview-area">
          <div className="image-picker__preview-box">
            <img
              src={previewUrl}
              alt="選択した画像のプレビュー"
              className="image-picker__preview-image"
              style={{ transform: `rotate(${rotation}deg)` }}
            />
          </div>
          <div className="image-picker__rotate-buttons">
            <button type="button" onClick={rotateLeft}>
              ↺ 左に90度回転
            </button>
            <button type="button" onClick={rotateRight}>
              ↻ 右に90度回転
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
