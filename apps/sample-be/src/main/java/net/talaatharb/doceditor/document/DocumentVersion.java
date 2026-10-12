package net.talaatharb.doceditor.document;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "document_versions")
public class DocumentVersion {
    @Id
    private String id;

    @Column(nullable = false)
    private String documentId;

    @Column(nullable = false)
    private long version;

    @Lob
    @Column(nullable = false)
    private String contentJson;

    @Lob
    @Column(nullable = false)
    private String metaJson;

    @Column(nullable = false)
    private Instant savedAt;

    protected DocumentVersion() {}

    public DocumentVersion(String id, String documentId, long version, String contentJson, String metaJson, Instant savedAt) {
        this.id = id;
        this.documentId = documentId;
        this.version = version;
        this.contentJson = contentJson;
        this.metaJson = metaJson;
        this.savedAt = savedAt;
    }

    public long getVersion() { return version; }
    public String getContentJson() { return contentJson; }
    public String getMetaJson() { return metaJson; }
    public Instant getSavedAt() { return savedAt; }
}
