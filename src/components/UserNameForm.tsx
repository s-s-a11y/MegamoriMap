import { useState } from "react";

// 機能追加#1：ユーザー名の登録・変更フォーム。
// Home画面の未設定時の案内と、ヘッダーの「変更」の両方で使い回す。

const USER_NAME_MAX_LENGTH = 20; // UpdateMyUser.py: MAX_USER_NAME_LENGTH = 20

interface UserNameFormProps {
  initialValue?: string;
  submitLabel: string;
  onSave: (name: string) => Promise<void>;
  onDone?: () => void;
  onCancel?: () => void;
}

export function UserNameForm({
  initialValue = "",
  submitLabel,
  onSave,
  onDone,
  onCancel,
}: UserNameFormProps) {
  const [name, setName] = useState(initialValue);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmed = name.trim();
  const isValid = trimmed !== "" && trimmed.length <= USER_NAME_MAX_LENGTH;

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid) return;

    setStatus("loading");
    setErrorMessage(null);
    try {
      await onSave(trimmed);
      setStatus("idle");
      onDone?.();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "ユーザー名の登録に失敗しました",
      );
      setStatus("error");
    }
  };

  return (
    <form className="user-name-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={name}
        maxLength={USER_NAME_MAX_LENGTH}
        onChange={(e) => setName(e.target.value)}
        placeholder={`ユーザー名（${USER_NAME_MAX_LENGTH}文字以内）`}
        aria-label="ユーザー名"
      />
      <button type="submit" disabled={!isValid || status === "loading"}>
        {status === "loading" ? "登録中..." : submitLabel}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel}>
          キャンセル
        </button>
      )}
      {status === "error" && <p role="alert">{errorMessage}</p>}
    </form>
  );
}
