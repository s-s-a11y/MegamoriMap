import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";

interface HeaderProps {
  // Home画面自身では渡さない。渡されなければ「TOPに戻る」ボタンは表示しない。
  onGoHome?: () => void;
}

// Cognitoは標準的なOIDCの「ログアウトエンドポイント」を持たないため、
// ログアウトは①ブラウザ側が持っているトークンを破棄、②Cognito自身の
// ホストされたセッションもログアウトさせる、という2段階を自分で行う。
//
// ※logout_uriも、Cognito側に登録されたLogout URLと1文字も違わず一致させる
//   必要がある(末尾のスラッシュの有無も含む。main.tsxのredirect_uriと同じ注意点)
const COGNITO_DOMAIN =
  "https://ap-northeast-1clp5cwkis.auth.ap-northeast-1.amazoncognito.com";
const COGNITO_CLIENT_ID = "3ff8jc8a229g96fbpv7lpe0qhm";
const LOGOUT_REDIRECT_URI = "https://main.dc2x1tgfccujd.amplifyapp.com";

// アプリ全体で共通の、画面上部に固定表示されるヘッダー。
// タイトルは常に固定文言(「メガ盛りマップ」)で、ページごとに変わらない。
// App.tsxの最上位で1回だけ描画される想定(各ページが個別に描画しない)。
export function Header({ onGoHome }: HeaderProps) {
  const auth = useAuth();

  // ★追加：ログイン失敗時のエラーメッセージを、閉じるまで画面に表示し続けるための状態。
  // auth.error自体はライブラリ側の内部状態なので、こちらでコピーして持っておく。
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (auth.error) {
      setAuthErrorMessage(auth.error.message);
    }
  }, [auth.error]);

  // Cognitoは標準的なOIDCの「ログアウトエンドポイント」を持たないため、
  // ログアウトは①ブラウザ側が持っているトークンを破棄、②Cognito自身の
  // ホストされたセッションもログアウトさせる、という2段階を自分で行う。
  const handleSignOut = () => {
    auth.removeUser();
    window.location.href =
      `${COGNITO_DOMAIN}/logout` +
      `?client_id=${COGNITO_CLIENT_ID}` +
      `&logout_uri=${encodeURIComponent(LOGOUT_REDIRECT_URI)}`;
  };

  return (
    <>
      <header className="app-header">
        {onGoHome && (
          <button
            type="button"
            className="app-header__home-button"
            onClick={onGoHome}
          >
            TOPに戻る
          </button>
        )}
        <h1 className="app-header__title">メガ盛りマップ</h1>

        <div className="app-header__auth">
          {auth.isAuthenticated ? (
            <button type="button" onClick={handleSignOut}>
              ログアウト
            </button>
          ) : (
            <button type="button" onClick={() => auth.signinRedirect()}>
              ログイン
            </button>
          )}
        </div>
      </header>

      {/* ★追加：ログイン失敗時(ドメイン外アドレスなど)の案内バナー */}
      {authErrorMessage && (
        <div className="app-auth-error-banner" role="alert">
          <p>ログインできませんでした：{authErrorMessage}</p>
          <button type="button" onClick={() => setAuthErrorMessage(null)}>
            閉じる
          </button>
        </div>
      )}
    </>
  );
}
