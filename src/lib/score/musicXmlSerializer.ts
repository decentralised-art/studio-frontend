import type { ScoreTree, ScoreXmlNode } from "./types";

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>';
const MUSICXML_4_DOCTYPE =
  '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">';

const escapeXmlText = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeXmlAttr = (value: string): string =>
  escapeXmlText(value).replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const serializeNode = (node: ScoreXmlNode, depth = 0): string => {
  const indent = "  ".repeat(depth);
  const attrs = Object.entries(node.attributes ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ` ${name}="${escapeXmlAttr(value)}"`)
    .join("");
  const children = node.children ?? [];
  const text = node.text ?? "";

  if (children.length === 0 && !text) return `${indent}<${node.name}${attrs}/>`;

  if (children.length === 0) {
    return `${indent}<${node.name}${attrs}>${escapeXmlText(text)}</${node.name}>`;
  }

  const childMarkup = children.map((child) => serializeNode(child, depth + 1)).join("\n");
  const textLine = text ? `${"  ".repeat(depth + 1)}${escapeXmlText(text)}\n` : "";
  return `${indent}<${node.name}${attrs}>\n${textLine}${childMarkup}\n${indent}</${node.name}>`;
};

export const serializeScoreTreeToMusicXml = (tree: ScoreTree): string =>
  `${XML_HEADER}\n${MUSICXML_4_DOCTYPE}\n${serializeNode(tree.root)}\n`;

export const downloadMusicXml = (musicXml: string, fileName: string) => {
  const sanitized =
    fileName
      .trim()
      .replace(/[^a-z0-9._-]+/gi, "_")
      .replace(/^_+|_+$/g, "") || "dcn-score";
  const blob = new Blob([musicXml], { type: "application/vnd.recordare.musicxml+xml" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitized}.musicxml`;
  anchor.click();
  URL.revokeObjectURL(url);
};
