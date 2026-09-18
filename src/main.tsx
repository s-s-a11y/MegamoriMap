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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </StrictMode>,
);
