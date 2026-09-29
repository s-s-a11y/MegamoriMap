import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { API_BASE_URL, readErrorMessage } from "./api";
import { buildAuthHeaders } from "./authHeaders";

// 機能追加#1：ログイン中の利用者自身のユーザー名を取得・登録するためのフック。
// App.tsxで1回だけ呼び、Header(表示・変更)とHome(未設定時の登録案内)に渡す想定。
//
// userName の値の意味：
//   null … 未ログイン、または取得中・取得失敗(案内は出さない)
//   ""   … ログイン済みだが、ユーザー名が未設定
//   それ以外 … 登録済みのユーザー名
export function useMyUser() {
  const auth = useAuth();
  const idToken = auth.user?.id_token;
  const [loaded, setLoaded] = useState<{ token: string; userName: string } | null>(
    null,
  );

  useEffect(() => {
    if (!auth.isAuthenticated || !idToken) return;
    let cancelled = false;

    fetch(`${API_BASE_URL}/users/me`, {
      method: "POST",
      headers: buildAuthHeaders(idToken),
      body: "{}",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await readErrorMessage(res));
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setLoaded({ token: idToken, userName: data.user_name ?? "" });
      })
      .catch((err) => {
        // 取得に失敗しても画面は使えるようにする(案内を出さないだけ)
        console.warn("ユーザー名の取得に失敗しました", err);
      });

    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated, idToken]);

  // ログアウト後や、別のトークンで取得した結果は使わない
  const userName =
    auth.isAuthenticated && loaded && loaded.token === idToken
      ? loaded.userName
      : null;

  // ユーザー名を登録・変更する。失敗した場合はエラーメッセージ付きの例外を投げる
  const saveUserName = async (name: string) => {
    const res = await fetch(`${API_BASE_URL}/users/me/update`, {
      method: "POST",
      headers: buildAuthHeaders(idToken),
      body: JSON.stringify({ user_name: name }),
    });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res));
    }
    const data = await res.json();
    if (idToken) setLoaded({ token: idToken, userName: data.user_name });
  };

  return { userName, saveUserName };
}
