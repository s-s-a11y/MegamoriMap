import { useEffect, useState } from "react";

// ShowStoreDetail Lambdaが返す、1店舗分の詳細情報
// (ShowStoreDetail.pyのformat_store()の出力に合わせている)
interface StoreDetail {
  place_id: string;
  title: string;
  avg_price: number;
  address_label: string;
  store_url: string;
  store_category_name: string;
  longitude: number;
  latitude: number;
}

type Status = "loading" | "success" | "error" | "not-found";

// App.tsx から画面切り替え関数を受け取るためのprops
// ※この画面は「どのplace_idを表示するか」を自分では持てないため、
//   placeIdもpropsで受け取る形にしている。
//   実際に組み込む際は、ViewNameに"store-detail"を追加し、
//   選んだ店舗のplace_idをApp.tsx側のStateで保持したうえで、
//   このコンポーネントにpropsとして渡す必要がある(現時点では未対応)。
interface StoreDetailPageProps {
  placeId: string;
  onNavigate: (view: "map" | "regist-store" | "regist-menu") => void;
}

// ------------------------------------------------------------
// エラーメッセージの読み取り
// ShowStoreDetail.py は 400のときはJSON({"message": "..."})、
// 401/500のときはプレーン文字列を返すので、両方に対応できるようにする
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

export function StoreDetailPage({ placeId, onNavigate }: StoreDetailPageProps) {
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setStatus("loading");
    setErrorMessage(null);

    const apiUrl =
      "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/megamorimap/ShowStoreDetail";

    fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ place_id: placeId }),
    })
      .then(async (res) => {
        if (cancelled) return;

        // 404: 該当する店舗が存在しない
        if (res.status === 404) {
          setStatus("not-found");
          return;
        }

        if (!res.ok) {
          throw new Error(await readErrorMessage(res));
        }

        const data = (await res.json()) as StoreDetail;
        setStore(data);
        setStatus("success");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(
          err instanceof Error ? err.message : "店舗情報の取得に失敗しました",
        );
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [placeId]);

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "24px 16px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => onNavigate("map")}>← 地図に戻る</button>
      </div>

      <h1>店舗詳細</h1>

      {status === "loading" && <p>読み込み中...</p>}

      {status === "not-found" && <p>指定された店舗が見つかりませんでした。</p>}

      {status === "error" && <p style={{ color: "red" }}>{errorMessage}</p>}

      {status === "success" && store && (
        <dl>
          <dt style={{ fontWeight: "bold" }}>店舗名</dt>
          <dd>{store.title}</dd>

          <dt style={{ fontWeight: "bold", marginTop: 12 }}>カテゴリー</dt>
          <dd>{store.store_category_name || "未設定"}</dd>

          <dt style={{ fontWeight: "bold", marginTop: 12 }}>住所</dt>
          <dd>{store.address_label}</dd>

          <dt style={{ fontWeight: "bold", marginTop: 12 }}>平均価格</dt>
          <dd>
            {store.avg_price > 0 ? `¥${store.avg_price.toLocaleString()}` : "-"}
          </dd>

          {store.store_url && (
            <>
              <dt style={{ fontWeight: "bold", marginTop: 12 }}>店舗ページ</dt>
              <dd>
                <a href={store.store_url} target="_blank" rel="noreferrer">
                  {store.store_url}
                </a>
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
