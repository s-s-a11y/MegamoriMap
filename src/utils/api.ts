// API Gateway(MegamoriMapAPI)の呼び出し全般で使い回す、共通の定数・ユーティリティ。
// 以前は各コンポーネントにURLとreadErrorMessageが個別に書かれていたため、ここに集約した。

// API Gatewayのステージ(MegamoriMap)までのURL。各APIはこの後ろにパスを付けて呼ぶ。
export const API_BASE_URL =
  "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap";

// ------------------------------------------------------------
// エラーメッセージの読み取り
// ------------------------------------------------------------
// Lambdaはエラー時に {"message": "..."} 形式のJSONか、素の文字列を返すため、
// どちらの場合でも画面に出せるメッセージを取り出す。
export async function readErrorMessage(res: Response): Promise<string> {
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
