package com.talaatharb.doceditor.document;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.Map;
import tools.jackson.databind.JsonNode;

public final class DocumentDtos {
    private DocumentDtos() {}

    public record Summary(String id, String title, Instant updatedAt, long version) {}

    public record Meta(
            String title,
            String pageSize,
            String orientation,
            Map<String, Integer> margins,
            Integer schemaVersion
    ) {}

    public record Content(String id, JsonNode content, Meta meta, long version) {}

    public record CreateRequest(
            @NotBlank String title,
            Meta meta
    ) {}

    public record SaveRequest(
            @NotNull JsonNode content,
            @NotNull Meta meta,
            long baseVersion
    ) {}

    public record SaveResponse(long version) {}

    public record VersionSummary(long version, Instant savedAt) {}
}
