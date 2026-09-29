import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "react-oidc-context";

// Cognitoの、Googleを介したログインに必要な設定一式。
// ※scopeはCognitoのアプリクライアント側で許可されているものだけを指定すること
//   (今は email/openid/phone のみ許可されており、profileは未許可のため含めない)
// ※redirect_uriは、Cognito側に登録されたCallback URLと1文字も違わず一致させる
//   必要がある(末尾のスラッシュの有無も含む)
const cognitoAuthConfig = {
  authority:
    "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_ClP5cwKis",
  client_id: "3ff8jc8a229g96fbpv7lpe0qhm",
  redirect_uri: "https://main.dc2x1tgfccujd.amplifyapp.com",
  response_type: "code",
  scope: "openid email",
};

const root = createRoot(document.getElementById("root")!);

async function start() {
  // ★追加：画面確認用の「確認モード」(src/dev/preview.tsx)。
  // 開発用サーバー(npm run dev)で ?preview=シナリオ名 を付けたときだけ有効になり、
  // ログイン状態とAPIの応答を作り物に差し替える。import.meta.env.DEV は本番のビルドでは
  // false になるため、この分岐と確認モードのコードは本番には含まれない。
  if (import.meta.env.DEV) {
    const { getPreviewScenario, setupPreview, PREVIEW_PLACE_ID } = await import(
      "./dev/preview"
    );
    const scenario = getPreviewScenario();
    if (scenario) {
      const PreviewAuthProvider = setupPreview(scenario);
      root.render(
        <StrictMode>
          <PreviewAuthProvider>
            <App
              initialView={scenario.initialView}
              initialPlaceId={PREVIEW_PLACE_ID}
            />
          </PreviewAuthProvider>
        </StrictMode>,
      );
      return;
    }
  }

  root.render(
    <StrictMode>
      <AuthProvider {...cognitoAuthConfig}>
        <App />
      </AuthProvider>
    </StrictMode>,
  );
}

start();
