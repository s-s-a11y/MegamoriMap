import { useAuth } from "react-oidc-context";

interface HeaderProps {
  // Home画面自身では渡さない。渡されなければ「TOPに戻る」ボタンは表示しない。
  onGoHome?: () => void;
}

// Cognitoのホストされたログイン画面から、ログアウト後に戻ってくる先。
// main.tsxのredirect_uriと必ず同じ値にしておくこと。
const COGNITO_DOMAIN =
  "https://ap-northeast-1clp5cwkis.auth.ap-northeast-1.amazoncognito.com";
const COGNITO_CLIENT_ID = "3ff8jc8a229g96fbpv7lpe0qhm";
const LOGOUT_REDIRECT_URI = "https://main.dc2x1tgfccujd.amplifyapp.com/";

// アプリ全体で共通の、画面上部に固定表示されるヘッダー。
// タイトルは常に固定文言(「メガ盛りマップ」)で、ページごとに変わらない。
// App.tsxの最上位で1回だけ描画される想定(各ページが個別に描画しない)。
export function Header({ onGoHome }: HeaderProps) {
  const auth = useAuth();

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
  );
}
