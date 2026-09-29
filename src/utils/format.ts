// 投稿日・投稿者など、画面表示用の整形処理(機能追加#1)。

/**
 * Lambdaが保存している日付(YYYYMMDD)を、画面表示用の「YYYY/MM/DD」に変換する。
 * 形式が違う場合は、そのまま返す。
 */
export function formatPostedDate(value: string): string {
  return /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6, 8)}`
    : value;
}

/**
 * ユーザー名が未設定・投稿者が記録されていない場合の表示名。
 */
export function displayUserName(name: string | undefined): string {
  return name && name.trim() ? name : "名無しさん";
}

/**
 * 会社からの徒歩時間を「徒歩11分（650m）」の形に整形する(機能追加#2)。
 * 1km以上は「1.2km」のように表示する。値が無ければnull(画面では非表示にする)。
 */
export function formatWalk(
  minutes: number | null | undefined,
  distanceM: number | null | undefined,
): string | null {
  if (minutes == null || distanceM == null) return null;
  const distance =
    distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)}km` : `${distanceM}m`;
  return `徒歩${minutes}分（${distance}）`;
}
