package com.talaatharb.doceditor.document;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import tools.jackson.databind.JsonNode;

/** Renders stored ProseMirror JSON as HTML, plain text or a basic text-only PDF. */
final class DocumentExporter {
    private DocumentExporter() {}

    record Block(String text, float size, boolean bold, int indent, boolean pageBreak) {}

    // ---- HTML ----

    static String toHtml(JsonNode doc, DocumentDtos.Meta meta) {
        StringBuilder out = new StringBuilder();
        out.append("<!doctype html><html><head><meta charset=\"utf-8\"><title>")
                .append(escape(meta.title())).append("</title></head><body>");
        children(doc).forEach(node -> block(node, out));
        return out.append("</body></html>").toString();
    }

    private static void block(JsonNode node, StringBuilder out) {
        String type = node.path("type").asString("");
        switch (type) {
            case "paragraph" -> wrap(out, "p", node);
            case "heading" -> {
                int level = Math.max(1, Math.min(6, node.path("attrs").path("level").asInt(1)));
                wrap(out, "h" + level, node);
            }
            case "bulletList" -> wrap(out, "ul", node);
            case "orderedList" -> wrap(out, "ol", node);
            case "taskList" -> wrap(out, "ul", node);
            case "listItem", "taskItem" -> wrap(out, "li", node);
            case "blockquote" -> wrap(out, "blockquote", node);
            case "codeBlock" -> wrap(out, "pre", node);
            case "table" -> wrap(out, "table", node);
            case "tableRow" -> wrap(out, "tr", node);
            case "tableCell" -> wrap(out, "td", node);
            case "tableHeader" -> wrap(out, "th", node);
            case "horizontalRule" -> out.append("<hr>");
            case "pageBreak" -> out.append("<div style=\"break-after:page\"></div>");
            case "image" -> image(node, out);
            default -> inline(node, out);
        }
    }

    private static void wrap(StringBuilder out, String tag, JsonNode node) {
        out.append('<').append(tag).append('>');
        children(node).forEach(child -> block(child, out));
        out.append("</").append(tag).append('>');
    }

    private static void image(JsonNode node, StringBuilder out) {
        String src = node.path("attrs").path("src").asString("");
        if (!(src.startsWith("data:image/") || src.startsWith("https://") || src.startsWith("http://"))) return;
        out.append("<img src=\"").append(escape(src)).append("\" alt=\"")
                .append(escape(node.path("attrs").path("alt").asString(""))).append("\">");
    }

    private static void inline(JsonNode node, StringBuilder out) {
        String type = node.path("type").asString("");
        if (type.equals("hardBreak")) {
            out.append("<br>");
            return;
        }
        if (type.equals("image")) {
            image(node, out);
            return;
        }
        String text = type.equals("mergeField")
                ? "{{" + node.path("attrs").path("key").asString("") + "}}"
                : node.path("text").asString("");
        List<String> closing = new ArrayList<>();
        for (JsonNode mark : children(node, "marks")) {
            String tag = switch (mark.path("type").asString("")) {
                case "bold" -> "<strong>";
                case "italic" -> "<em>";
                case "underline" -> "<u>";
                case "strike" -> "<s>";
                case "code" -> "<code>";
                case "subscript" -> "<sub>";
                case "superscript" -> "<sup>";
                case "link" -> safeLink(mark.path("attrs").path("href").asString(""));
                default -> null;
            };
            if (tag != null) {
                out.append(tag);
                closing.add(0, "</" + tag.substring(1, tag.indexOf(tag.contains(" ") ? ' ' : '>')) + ">");
            }
        }
        out.append(escape(text));
        closing.forEach(out::append);
    }

    private static String safeLink(String href) {
        boolean ok = href.startsWith("https://") || href.startsWith("http://") || href.startsWith("mailto:");
        return ok ? "<a href=\"" + escape(href) + "\">" : null;
    }

    // ---- Plain text / PDF ----

    static List<Block> blocks(JsonNode doc) {
        List<Block> blocks = new ArrayList<>();
        children(doc).forEach(node -> collect(node, blocks, 0));
        return blocks;
    }

    static String toText(JsonNode doc) {
        StringBuilder out = new StringBuilder();
        for (Block block : blocks(doc)) {
            if (block.pageBreak()) continue;
            out.append("  ".repeat(block.indent())).append(block.text()).append('\n');
        }
        return out.toString();
    }

    private static void collect(JsonNode node, List<Block> blocks, int indent) {
        String type = node.path("type").asString("");
        switch (type) {
            case "paragraph" -> blocks.add(new Block(plain(node), 11, false, indent, false));
            case "heading" -> {
                int level = node.path("attrs").path("level").asInt(1);
                blocks.add(new Block(plain(node), level == 1 ? 20 : level == 2 ? 16 : 13, true, indent, false));
            }
            case "bulletList", "orderedList", "taskList" -> {
                int number = 1;
                for (JsonNode item : children(node)) {
                    String marker = type.equals("orderedList") ? (number++) + ". "
                            : type.equals("taskList") ? (item.path("attrs").path("checked").asBoolean(false) ? "[x] " : "[ ] ")
                            : "- ";
                    List<Block> inner = new ArrayList<>();
                    children(item).forEach(child -> collect(child, inner, indent + 1));
                    for (int i = 0; i < inner.size(); i++) {
                        Block b = inner.get(i);
                        blocks.add(i == 0 ? new Block(marker + b.text(), b.size(), b.bold(), indent, false) : b);
                    }
                }
            }
            case "blockquote" -> children(node).forEach(child -> collect(child, blocks, indent + 1));
            case "table" -> {
                for (JsonNode row : children(node)) {
                    List<String> cells = new ArrayList<>();
                    children(row).forEach(cell -> cells.add(plain(cell)));
                    blocks.add(new Block(String.join(" | ", cells), 11, false, indent, false));
                }
            }
            case "horizontalRule" -> blocks.add(new Block("----------------", 11, false, indent, false));
            case "pageBreak" -> blocks.add(new Block("", 11, false, indent, true));
            case "image" -> blocks.add(new Block("[image]", 11, false, indent, false));
            case "codeBlock" -> blocks.add(new Block(plain(node), 10, false, indent, false));
            default -> {
                if (node.has("content")) children(node).forEach(child -> collect(child, blocks, indent));
            }
        }
    }

    private static String plain(JsonNode node) {
        String type = node.path("type").asString("");
        if (type.equals("text")) return node.path("text").asString("");
        if (type.equals("mergeField")) return "{{" + node.path("attrs").path("key").asString("") + "}}";
        if (type.equals("hardBreak")) return " ";
        StringBuilder out = new StringBuilder();
        for (JsonNode child : children(node)) {
            String part = plain(child);
            if (!part.isEmpty() && out.length() > 0 && isBlock(child)) out.append(' ');
            out.append(part);
        }
        return out.toString();
    }

    private static boolean isBlock(JsonNode node) {
        String type = node.path("type").asString("");
        return type.equals("paragraph") || type.equals("heading");
    }

    static byte[] toPdf(JsonNode doc, DocumentDtos.Meta meta) throws IOException {
        float[] size = paperSize(meta);
        float left = mm(margin(meta, "left")), right = mm(margin(meta, "right"));
        float top = mm(margin(meta, "top")), bottom = mm(margin(meta, "bottom"));
        float usable = Math.max(36f, size[0] - left - right);
        PDType1Font regular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
        PDType1Font bold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);

        List<List<String[]>> pages = new ArrayList<>();
        List<String[]> current = new ArrayList<>();
        float y = size[1] - top;
        List<float[]> positions = new ArrayList<>();
        List<List<float[]>> pagePositions = new ArrayList<>();
        for (Block block : blocks(doc)) {
            if (block.pageBreak()) {
                pages.add(current);
                pagePositions.add(positions);
                current = new ArrayList<>();
                positions = new ArrayList<>();
                y = size[1] - top;
                continue;
            }
            PDType1Font font = block.bold() ? bold : regular;
            float indent = block.indent() * 18f;
            float leading = block.size() * 1.35f;
            for (String line : wrap(clean(block.text()), font, block.size(), usable - indent)) {
                if (y - leading < bottom) {
                    pages.add(current);
                    pagePositions.add(positions);
                    current = new ArrayList<>();
                    positions = new ArrayList<>();
                    y = size[1] - top;
                }
                y -= leading;
                current.add(new String[] {line, block.bold() ? "b" : "r"});
                positions.add(new float[] {left + indent, y, block.size()});
            }
            y -= block.size() * 0.5f;
        }
        pages.add(current);
        pagePositions.add(positions);

        try (PDDocument pdf = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (int p = 0; p < pages.size(); p++) {
                PDPage page = new PDPage(new PDRectangle(size[0], size[1]));
                pdf.addPage(page);
                try (PDPageContentStream cs = new PDPageContentStream(pdf, page)) {
                    List<String[]> lines = pages.get(p);
                    for (int i = 0; i < lines.size(); i++) {
                        float[] pos = pagePositions.get(p).get(i);
                        text(cs, lines.get(i)[1].equals("b") ? bold : regular, pos[2], pos[0], pos[1], lines.get(i)[0]);
                    }
                    if (meta.header() != null && !meta.header().isBlank()) {
                        centered(cs, regular, usable, left, size[1] - top / 2, resolve(meta.header(), p + 1, pages.size()));
                    }
                    if (meta.footer() != null && !meta.footer().isBlank()) {
                        centered(cs, regular, usable, left, bottom / 2, resolve(meta.footer(), p + 1, pages.size()));
                    }
                }
            }
            pdf.save(out);
            return out.toByteArray();
        }
    }

    private static void centered(PDPageContentStream cs, PDType1Font font, float usable, float left, float y, String value)
            throws IOException {
        String line = clean(value);
        float width = font.getStringWidth(line) / 1000f * 9;
        text(cs, font, 9, left + Math.max(0, (usable - width) / 2), y, line);
    }

    private static void text(PDPageContentStream cs, PDType1Font font, float size, float x, float y, String value)
            throws IOException {
        cs.beginText();
        cs.setFont(font, size);
        cs.newLineAtOffset(x, y);
        cs.showText(value);
        cs.endText();
    }

    private static List<String> wrap(String text, PDType1Font font, float size, float width) throws IOException {
        List<String> lines = new ArrayList<>();
        StringBuilder line = new StringBuilder();
        for (String rawWord : text.split(" ")) {
            // Words wider than the text area are split so nothing crosses the right margin.
            for (String word : splitToWidth(rawWord, font, size, width)) {
                String candidate = line.isEmpty() ? word : line + " " + word;
                if (!line.isEmpty() && font.getStringWidth(candidate) / 1000f * size > width) {
                    lines.add(line.toString());
                    line = new StringBuilder(word);
                } else {
                    line = new StringBuilder(candidate);
                }
            }
        }
        lines.add(line.toString());
        return lines;
    }

    private static List<String> splitToWidth(String word, PDType1Font font, float size, float width)
            throws IOException {
        List<String> parts = new ArrayList<>();
        StringBuilder part = new StringBuilder();
        for (char c : word.toCharArray()) {
            if (part.length() > 0 && font.getStringWidth(part.toString() + c) / 1000f * size > width) {
                parts.add(part.toString());
                part = new StringBuilder();
            }
            part.append(c);
        }
        parts.add(part.toString());
        return parts;
    }

    private static String clean(String value) {
        StringBuilder out = new StringBuilder();
        for (char c : value.toCharArray()) {
            out.append((c >= 32 && c <= 126) || (c >= 161 && c <= 255) ? c : (c == '\t' ? ' ' : '?'));
        }
        return out.toString();
    }

    private static String resolve(String template, int page, int pages) {
        return template.replace("{page}", String.valueOf(page)).replace("{pages}", String.valueOf(pages));
    }

    private static float[] paperSize(DocumentDtos.Meta meta) {
        float[] mm = switch (meta.pageSize() == null ? "A4" : meta.pageSize()) {
            case "Letter" -> new float[] {215.9f, 279.4f};
            case "Legal" -> new float[] {215.9f, 355.6f};
            case "A5" -> new float[] {148f, 210f};
            default -> new float[] {210f, 297f};
        };
        boolean landscape = "landscape".equals(meta.orientation());
        return landscape ? new float[] {mm(mm[1]), mm(mm[0])} : new float[] {mm(mm[0]), mm(mm[1])};
    }

    private static float margin(DocumentDtos.Meta meta, String side) {
        Number value = meta.margins() == null ? null : meta.margins().get(side);
        return value == null ? 20f : Math.max(0f, Math.min(60f, value.floatValue()));
    }

    private static float mm(float value) {
        return value * 72f / 25.4f;
    }

    // ---- helpers ----

    private static Iterable<JsonNode> children(JsonNode node) {
        return children(node, "content");
    }

    private static Iterable<JsonNode> children(JsonNode node, String field) {
        JsonNode array = node.path(field);
        return array.isArray() ? array : List.<JsonNode>of();
    }

    static String escape(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
