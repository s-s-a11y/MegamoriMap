interface HeaderProps {
  // Home画面自身では渡さない。渡されなければ「TOPに戻る」ボタンは表示しない。
  onGoHome?: () => void;
}

// アプリ全体で共通の、画面上部に固定表示されるヘッダー。
// タイトルは常に固定文言(「メガ盛りマップ」)で、ページごとに変わらない。
// App.tsxの最上位で1回だけ描画される想定(各ページが個別に描画しない)。
export function Header({ onGoHome }: HeaderProps) {
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
    </header>
  );
}
