import { useEffect, useRef, useState } from "react";
import { useAuth } from "react-oidc-context";
import { UserNameForm } from "./UserNameForm";
import "../css_components/Header.css";

interface HeaderProps {
  // Home画面自身では渡さない。渡されなければ「TOPに戻る」ボタンは表示しない。
  onGoHome?: () => void;
  // ★追加(機能追加#1)：ログイン中の利用者のユーザー名(null=未ログイン・取得中、""=未設定)
  userName?: string | null;
  onSaveUserName?: (name: string) => Promise<void>;
  // ★追加(機能追加#4)：「≡」メニューから行ってみたい店リストを開く
  onOpenWishlist?: () => void;
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
export function Header({
  onGoHome,
  userName = null,
  onSaveUserName,
  onOpenWishlist,
}: HeaderProps) {
  const auth = useAuth();
  // ★追加(機能追加#1)：ユーザー名の変更フォームを開いているか
  const [isEditingName, setIsEditingName] = useState(false);
  // ★追加(C31)：ユーザー名変更・ログアウトをまとめた「≡」メニューを開いているか
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // メニューの外側をクリック・タップしたとき、またはEscキーで閉じる
  useEffect(() => {
    if (!isMenuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setIsMenuOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

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

        {/* ★修正(C31)：幅の狭い画面でタイトルと重ならないよう、ユーザー名・
            ユーザー名変更・ログアウトを「≡」メニューにまとめる */}
        <div className="app-header__auth" ref={menuRef}>
          {auth.isAuthenticated ? (
            <>
              <button
                type="button"
                className="app-header__menu-button"
                aria-label="メニュー"
                aria-expanded={isMenuOpen}
                aria-controls="app-header-menu"
                onClick={() => setIsMenuOpen((open) => !open)}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path
                    d="M3 6h18M3 12h18M3 18h18"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              {isMenuOpen && (
                <div id="app-header-menu" className="app-header__menu">
                  {/* ユーザー名が未設定のときは、Home画面の案内から設定してもらう */}
                  {userName && (
                    <p className="app-header__menu-user">{userName} さん</p>
                  )}
                  {onOpenWishlist && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenWishlist();
                      }}
                    >
                      行ってみたい店
                    </button>
                  )}
                  {userName && onSaveUserName && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setIsEditingName(true);
                      }}
                    >
                      ユーザー名変更
                    </button>
                  )}
                  <button type="button" onClick={handleSignOut}>
                    ログアウト
                  </button>
                </div>
              )}
            </>
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
          <button
            type="button"
            onClick={() => setDismissedError(auth.error ?? null)}
          >
            閉じる
          </button>
        </div>
      )}
    </>
  );
}
