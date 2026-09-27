function normalize(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

// 空白や全角半角の違いだけの「会社名＋部署」を同じ顧客とみなすためのキー
export function buildMatchKey(companyName: string, department: string): string {
  return `${normalize(companyName)}\u0000${normalize(department)}`;
}
