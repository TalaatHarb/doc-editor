package net.talaatharb.doceditor.document;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentVersionRepository extends JpaRepository<DocumentVersion, String> {
    List<DocumentVersion> findAllByDocumentIdOrderByVersionDesc(String documentId);
    Optional<DocumentVersion> findByDocumentIdAndVersion(String documentId, long version);
}
