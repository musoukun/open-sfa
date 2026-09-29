import { domToJpeg } from "modern-screenshot";

// この属性が付いた要素（要望フォームそのもの）はスクリーンショットに写さない
export const SCREENSHOT_IGNORE_ATTR = "data-screenshot-ignore";

const MAX_EDGE = 1600;

// 今見えている範囲を JPEG の data URL にする。長い辺が MAX_EDGE を超えるときだけ縮める
export async function captureViewport(): Promise<string> {
  const width = window.innerWidth;
  const height = window.innerHeight;
  return domToJpeg(document.body, {
    width,
    height,
    scale: Math.min(window.devicePixelRatio || 1, MAX_EDGE / Math.max(width, height)),
    quality: 0.85,
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    // スクロールした分だけ中身をずらし、画面に見えている所を写す
    style: { marginTop: `${-window.scrollY}px` },
    filter: (node) => !(node instanceof Element && node.hasAttribute(SCREENSHOT_IGNORE_ATTR)),
  });
}
