// 店舗URL(store_url)など、利用者が入力したURLを扱うためのユーティリティ。

/**
 * http:// または https:// で始まるURLかどうかを判定する。
 * リンクとして表示するURLは、javascript: などの危険なスキームを避けるため、
 * これを満たすものだけに限定する(UpdateStore.py 側の入力チェックと同じ基準)。
 */
export function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}
