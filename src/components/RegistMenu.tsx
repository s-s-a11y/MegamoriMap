import { useEffect, useState } from "react";

// ------------------------------------------------------------
// 型定義（このファイル専用。他のファイルには依存しない）
// ------------------------------------------------------------

// メガ盛りマップ表示API（ShowMegaMap）が返す、登録済み店舗の情報
// = 店舗選択プルダウンに使う
interface Store {
  place_id: string;
  title: string;
  address_label: string;
}

type LoadStatus = "loading" | "success" | "error";
type SubmitStatus = "idle" | "loading" | "success" | "error";

// ★追加：App.tsx から画面切り替え関数を受け取るためのprops
interface RegisterMenuPageProps {
  onNavigate: (view: "map" | "regist-store" | "regist-menu") => void;
}

const MENU_NAME_MAX_LENGTH = 30; // RegistMenu.py: MAX_MENU_NAME_LENGTH = 30

// 池袋駅付近。ShowMegaMap は longitude/latitude が必須入力だが、
// 実装上は絞り込みに使われていないため、固定値を送っている。
const DEFAULT_ORIGIN = { longitude: 139.7109, latitude: 35.7295 };

// ------------------------------------------------------------
// エラーメッセージの読み取り
// RegistMenu.py は 400（バリデーションエラー）と
// 500の一部（menu_id採番の競合）はJSON({"message": "..."})、
// それ以外の500はプレーン文字列を返すので、両方に対応できるようにする
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

export function RegisterMenuPage({ onNavigate }: RegisterMenuPageProps) {
  // ---- 店舗一覧（プルダウン用）まわりの状態 ----
  const [stores, setStores] = useState<Store[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---- 入力フォームの状態 ----
  const [placeId, setPlaceId] = useState("");
  const [menuName, setMenuName] = useState("");
  const [price, setPrice] = useState("");
  const [memo, setMemo] = useState("");

  // ---- 登録処理の状態 ----
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 画面表示時に一度だけ、登録済み店舗一覧を取得してプルダウンに使う
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const apiUrl =
          "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/megamorimap/ShowMegaMap";

        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(DEFAULT_ORIGIN),
        });

        if (!res.ok) {
          throw new Error(await readErrorMessage(res));
        }

        const data = await res.json();
        if (!cancelled) {
          setStores(data.stores ?? []);
          setLoadStatus("success");
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "店舗一覧の取得に失敗しました",
          );
          setLoadStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // RegistMenu.py の check_input() が要求する条件と同じ内容を、送信前にここでも確認する
  const isFormValid =
    placeId !== "" &&
    menuName.trim() !== "" &&
    menuName.length <= MENU_NAME_MAX_LENGTH &&
    price !== "" &&
    !Number.isNaN(Number(price)) &&
    Number(price) >= 0;

  // 「メニューを登録する」ボタンが押されたときの処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setSubmitStatus("loading");
    setSubmitError(null);

    try {
      const apiUrl =
        "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/megamorimap/RegistMenu";

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menu_name: menuName,
          place_id: placeId,
          memo: memo, // 任意項目。空文字のままでもRegistMenu.py側で問題ない
          price: Number(price),
        }),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }

      setSubmitStatus("success");
      // 続けて別のメニューを登録しやすいよう、店舗選択以外はリセットする
      setMenuName("");
      setPrice("");
      setMemo("");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "登録に失敗しました");
      setSubmitStatus("error");
    }
  };

  // ★追加：どの状態でも表示する、他の画面への移動ボタン
  const navButtons = (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      <button onClick={() => onNavigate("map")}>← 地図に戻る</button>
      <button onClick={() => onNavigate("regist-store")}>店舗登録へ</button>
    </div>
  );

  if (loadStatus === "loading") {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
        {navButtons}
        <p>店舗一覧を読み込み中...</p>
      </div>
    );
  }

  if (loadStatus === "error") {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>
        {navButtons}
        <p style={{ color: "red" }}>{loadError}</p>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "24px 16px",
        fontFamily: "sans-serif",
      }}
    >
      {navButtons}

      <h1>メニュー登録</h1>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          店舗
          <select
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            required
          >
            <option value="" disabled>
              店舗を選択してください
            </option>
            {stores.map((store) => (
              <option key={store.place_id} value={store.place_id}>
                {store.title}（{store.address_label}）
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          メニュー名（{MENU_NAME_MAX_LENGTH}文字以内）
          <input
            type="text"
            value={menuName}
            maxLength={MENU_NAME_MAX_LENGTH}
            onChange={(e) => setMenuName(e.target.value)}
            required
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          価格（円）
          <input
            type="number"
            value={price}
            min={0}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          メモ（重量など特盛を示す情報。任意）
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
          />
        </label>

        <button
          type="submit"
          disabled={!isFormValid || submitStatus === "loading"}
        >
          {submitStatus === "loading" ? "登録中..." : "メニューを登録する"}
        </button>
      </form>

      {submitStatus === "success" && (
        <p style={{ color: "green" }}>メニューを登録しました。</p>
      )}
      {submitStatus === "error" && (
        <p style={{ color: "red" }}>{submitError}</p>
      )}
    </div>
  );
}
