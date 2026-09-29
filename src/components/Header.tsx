import { useState } from "react";
import { useAuth } from "react-oidc-context";
import { UserNameForm } from "./UserNameForm";
import "../css_components/Header.css";

interface HeaderProps {
  // Home画面自身では渡さない。渡されなければ「TOPに戻る」ボタンは表示しない。
  onGoHome?: () => void;
  // ★追加(機能追加#1)：ログイン中の利用者のユーザー名(null=未ログイン・取得中、""=未設定)
  userName?: string | null;
  onSaveUserName?: (name: string) => Promise<void>;
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
export function Header({ onGoHome, userName = null, onSaveUserName }: HeaderProps) {
  const auth = useAuth();
  // ★追加(機能追加#1)：ユーザー名の変更フォームを開いているか
  const [isEditingName, setIsEditingName] = useState(false);

  // ★追加：ログイン失敗時のエラーメッセージを、閉じるまで画面に表示し続ける。
  // ★修正：auth.errorをeffectでstateにコピーするのをやめ、「閉じたエラー」だけを
  // 覚えておいて、表示するメッセージは描画時に算出する(lint: set-state-in-effect対応)。
  const [dismissedError, setDismissedError] = useState<Error | null>(null);
  const authErrorMessage =
    auth.error && auth.error !== dismissedError ? auth.error.message : null;

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
        <h1 className="app-header__title">池ごはんマップ</h1>

        <div className="app-header__auth">
          {/* ★追加(機能追加#1)：登録済みのユーザー名と、変更ボタン */}
          {auth.isAuthenticated && userName && !isEditingName && (
            <span className="app-header__user">
              {userName} さん
              <button type="button" onClick={() => setIsEditingName(true)}>
                変更
              </button>
            </span>
          )}
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

      {/* ★追加(機能追加#1)：ユーザー名の変更フォーム */}
      {isEditingName && userName && onSaveUserName && (
        <div className="app-header__name-edit">
          <UserNameForm
            initialValue={userName}
            submitLabel="変更する"
            onSave={onSaveUserName}
            onDone={() => setIsEditingName(false)}
            onCancel={() => setIsEditingName(false)}
          />
        </div>
      )}

      {/* ★追加：ログイン失敗時(ドメイン外アドレスなど)の案内バナー */}
      {authErrorMessage && (
        <div className="app-auth-error-banner" role="alert">
          <p>ログインできませんでした：{authErrorMessage}</p>
          <button type="button" onClick={() => setDismissedError(auth.error ?? null)}>
            閉じる
          </button>
        </div>
      )}
    </>
  );
}
