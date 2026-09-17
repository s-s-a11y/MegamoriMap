// 書き込み系のAPI呼び出し全般で使い回す、認証ヘッダー組み立て用の小さなユーティリティ。
//
// 注意：Authorizationヘッダーには"Bearer "という接頭辞を付けない。
// 今回使っているAPI Gateway(REST API)のCognitoオーソライザーは、
// 素のIDトークンだけを期待する仕様のため。
export function buildAuthHeaders(idToken?: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(idToken ? { Authorization: idToken } : {}),
  };
}
