package com.talaatharb.doceditor.document;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DocumentService {
    private static final String EMPTY_CONTENT = """
            {"type":"doc","content":[{"type":"paragraph"}]}
            """.trim();

    private final DocumentRepository documents;
    private final DocumentVersionRepository versions;
    private final ObjectMapper mapper;

    public DocumentService(
            DocumentRepository documents,
            DocumentVersionRepository versions,
            ObjectMapper mapper
    ) {
        this.documents = documents;
        this.versions = versions;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<DocumentDtos.Summary> list() {
        return documents.findAllByOrderByUpdatedAtDesc().stream().map(this::summary).toList();
    }

    @Transactional
    public DocumentDtos.Summary create(DocumentDtos.CreateRequest request) {
        String title = normalizeTitle(request.title());
        Instant now = Instant.now();
        String content = EMPTY_CONTENT;
        String meta = writeJson(metaFor(title, request.meta()));
        Document document = documents.save(new Document(
                UUID.randomUUID().toString(), title, content, meta, 1, now));
        versions.save(new DocumentVersion(
                UUID.randomUUID().toString(), document.getId(), 1, content, meta, now));
        return summary(document);
    }

    @Transactional(readOnly = true)
    public DocumentDtos.Content load(String id) {
        Document document = findDocument(id);
        return new DocumentDtos.Content(
                document.getId(),
                readJson(document.getContentJson()),
                readMeta(document.getMetaJson()),
                document.getVersion());
    }

    @Transactional
    public DocumentDtos.SaveResponse save(String id, DocumentDtos.SaveRequest request) {
        Document document = findDocument(id);
        if (request.baseVersion() != document.getVersion()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Document version is out of date");
        }
        String content = writeJson(request.content());
        String meta = writeJson(request.meta());
        Instant now = Instant.now();
        long nextVersion = document.getVersion() + 1;
        document.setContentJson(content);
        document.setMetaJson(meta);
        document.setTitle(normalizeTitle(request.meta().title()));
        document.setVersion(nextVersion);
        document.setUpdatedAt(now);
        documents.save(document);
        versions.save(new DocumentVersion(
                UUID.randomUUID().toString(), id, nextVersion, content, meta, now));
        return new DocumentDtos.SaveResponse(nextVersion);
    }

    @Transactional
    public void delete(String id) {
        Document document = findDocument(id);
        versions.deleteAll(versions.findAllByDocumentIdOrderByVersionDesc(id));
        documents.delete(document);
    }

    @Transactional(readOnly = true)
    public List<DocumentDtos.VersionSummary> listVersions(String id) {
        findDocument(id);
        return versions.findAllByDocumentIdOrderByVersionDesc(id).stream()
                .map(version -> new DocumentDtos.VersionSummary(version.getVersion(), version.getSavedAt()))
                .toList();
    }

    @Transactional
    public DocumentDtos.SaveResponse restore(String id, long versionNumber) {
        Document document = findDocument(id);
        DocumentVersion snapshot = versions.findByDocumentIdAndVersion(id, versionNumber)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Version not found"));
        long nextVersion = document.getVersion() + 1;
        Instant now = Instant.now();
        document.setContentJson(snapshot.getContentJson());
        document.setMetaJson(snapshot.getMetaJson());
        document.setTitle(readMeta(snapshot.getMetaJson()).title());
        document.setVersion(nextVersion);
        document.setUpdatedAt(now);
        documents.save(document);
        versions.save(new DocumentVersion(
                UUID.randomUUID().toString(), id, nextVersion,
                snapshot.getContentJson(), snapshot.getMetaJson(), now));
        return new DocumentDtos.SaveResponse(nextVersion);
    }

    private Document findDocument(String id) {
        return documents.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found"));
    }

    private DocumentDtos.Summary summary(Document document) {
        return new DocumentDtos.Summary(
                document.getId(), document.getTitle(), document.getUpdatedAt(), document.getVersion());
    }

    private DocumentDtos.Meta metaFor(String title, DocumentDtos.Meta supplied) {
        if (supplied == null) {
            return new DocumentDtos.Meta(title, "A4", "portrait", Map.of(
                    "top", 20, "right", 20, "bottom", 20, "left", 20), 1);
        }
        return new DocumentDtos.Meta(
                title,
                supplied.pageSize() == null ? "A4" : supplied.pageSize(),
                supplied.orientation() == null ? "portrait" : supplied.orientation(),
                supplied.margins() == null
                        ? Map.of("top", 20, "right", 20, "bottom", 20, "left", 20)
                        : supplied.margins(),
                supplied.schemaVersion() == null ? 1 : supplied.schemaVersion());
    }

    private DocumentDtos.Meta readMeta(String value) {
        try {
            return mapper.readValue(value, DocumentDtos.Meta.class);
        } catch (JacksonException error) {
            throw new IllegalStateException("Stored document metadata is invalid", error);
        }
    }

    private JsonNode readJson(String value) {
        try {
            return mapper.readTree(value);
        } catch (JacksonException error) {
            throw new IllegalStateException("Stored document JSON is invalid", error);
        }
    }

    private String writeJson(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JacksonException error) {
            throw new IllegalArgumentException("Document payload is not valid JSON", error);
        }
    }

    private String normalizeTitle(String title) {
        if (title == null || title.isBlank()) return "Untitled document";
        return title.trim();
    }
}
