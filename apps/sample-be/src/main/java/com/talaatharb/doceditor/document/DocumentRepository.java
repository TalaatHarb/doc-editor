package com.talaatharb.doceditor.document;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentRepository extends JpaRepository<Document, String> {
    List<Document> findAllByOrderByUpdatedAtDesc();
}
