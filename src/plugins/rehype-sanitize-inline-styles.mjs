// mermaid が生成する SVG の壊れた style 属性を無害化する rehype プラグイン。
//
// mermaid 11.14.0 の erDiagram は一部の要素に style="undefined;;;undefined" を吐く
// (cssStyles が未定義のまま join される上流バグ)。inline-svg 戦略ではこの SVG が
// そのまま hast に入り、MDX 変換(hast-util-to-estree)の inline-style-parser が
// 「property missing ':'」で**ビルドごと落とす**。erDiagram を1つ書いただけで
// サイト全体がビルド不能になるため、rehypeMermaid の直後で style を検査する。
//
// やること: style 属性を宣言単位に分解し、「:」を持たない宣言を捨てる。
// 全宣言が壊れていたら style 属性ごと消す。正しい宣言には触れない。
export default function rehypeSanitizeInlineStyles() {
  return (tree) => visit(tree);
}

function visit(node) {
  if (node.type === 'element' && node.properties && typeof node.properties.style === 'string') {
    const kept = node.properties.style
      .split(';')
      .map((d) => d.trim())
      .filter((d) => d.includes(':'));
    if (kept.length > 0) {
      node.properties.style = kept.join('; ');
    } else {
      delete node.properties.style;
    }
  }
  if (node.children) {
    for (const child of node.children) visit(child);
  }
}
