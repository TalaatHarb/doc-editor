package com.talaatharb.doceditor.document;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.Test;

class DocumentExporterTest {
    private static final String DOC = """
            {"type":"doc","content":[
              {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Title <1>"}]},
              {"type":"paragraph","content":[
                {"type":"text","text":"Hi ","marks":[{"type":"bold"}]},
                {"type":"text","text":"link","marks":[{"type":"link","attrs":{"href":"javascript:alert(1)"}}]},
                {"type":"mergeField","attrs":{"key":"customer.name"}}]},
              {"type":"pageBreak"},
              {"type":"bulletList","content":[{"type":"listItem","content":[
                {"type":"paragraph","content":[{"type":"text","text":"item"}]}]}]}
            ]}
            """;

    private final JsonMapper mapper = JsonMapper.builder().build();
    private final DocumentDtos.Meta meta = new DocumentDtos.Meta(
            "Doc", "A4", "portrait", java.util.Map.of("top", 20, "right", 20, "bottom", 20, "left", 20), 1,
            "Header", "Page {page} of {pages}");

    @Test
    void htmlEscapesContentAndDropsUnsafeLinks() {
        String html = DocumentExporter.toHtml(mapper.readTree(DOC), meta);
        assertThat(html).contains("<h1>Title &lt;1&gt;</h1>").contains("<strong>Hi </strong>");
        assertThat(html).contains("{{customer.name}}").doesNotContain("javascript:");
    }

    @Test
    void pdfKeepsTextInsideMargins() throws IOException {
        String longWord = "x".repeat(200);
        String words = "lorem ipsum dolor sit amet ".repeat(400);
        JsonNode doc = mapper.readTree("""
                {"type":"doc","content":[
                 {"type":"paragraph","content":[{"type":"text","text":"%s"}]},
                 {"type":"paragraph","content":[{"type":"text","text":"%s"}]}]}
                """.formatted(longWord, words));
        DocumentDtos.Meta wide = new DocumentDtos.Meta("Doc", "A4", "portrait",
                java.util.Map.of("top", 30, "right", 50, "bottom", 35, "left", 40), 1, null, null);
        float pt = 72f / 25.4f;
        try (org.apache.pdfbox.pdmodel.PDDocument pdf =
                     org.apache.pdfbox.Loader.loadPDF(DocumentExporter.toPdf(doc, wide))) {
            assertThat(pdf.getNumberOfPages()).isGreaterThan(1);
            var stripper = new org.apache.pdfbox.text.PDFTextStripper() {
                @Override
                protected void processTextPosition(org.apache.pdfbox.text.TextPosition t) {
                    float pageWidth = getCurrentPage().getMediaBox().getWidth();
                    float pageHeight = getCurrentPage().getMediaBox().getHeight();
                    assertThat(t.getX()).isGreaterThanOrEqualTo(40 * pt - 0.5f);
                    assertThat(t.getX() + t.getWidth()).isLessThanOrEqualTo(pageWidth - 50 * pt + 0.5f);
                    assertThat(t.getY()).isGreaterThanOrEqualTo(30 * pt - 0.5f);
                    assertThat(t.getY()).isLessThanOrEqualTo(pageHeight - 35 * pt + 0.5f);
                }
            };
            stripper.getText(pdf);
        }
    }

    @Test
    void textAndPdfExportsWork() throws IOException {
        JsonNode doc = mapper.readTree(DOC);
        assertThat(DocumentExporter.toText(doc)).contains("Title <1>").contains("- item");
        byte[] pdf = DocumentExporter.toPdf(doc, meta);
        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");
    }
}
