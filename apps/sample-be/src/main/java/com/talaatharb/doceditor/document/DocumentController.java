package com.talaatharb.doceditor.document;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {
    private final DocumentService service;

    public DocumentController(DocumentService service) {
        this.service = service;
    }

    @GetMapping
    public List<DocumentDtos.Summary> list() {
        return service.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DocumentDtos.Summary create(@Valid @RequestBody DocumentDtos.CreateRequest request) {
        return service.create(request);
    }

    @GetMapping("/{id}")
    public DocumentDtos.Content load(@PathVariable String id) {
        return service.load(id);
    }

    @PutMapping("/{id}")
    public DocumentDtos.SaveResponse save(
            @PathVariable String id,
            @Valid @RequestBody DocumentDtos.SaveRequest request
    ) {
        return service.save(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        service.delete(id);
    }

    @GetMapping("/{id}/versions")
    public List<DocumentDtos.VersionSummary> versions(@PathVariable String id) {
        return service.listVersions(id);
    }

    @PostMapping("/{id}/versions/{version}/restore")
    public DocumentDtos.SaveResponse restore(@PathVariable String id, @PathVariable long version) {
        return service.restore(id, version);
    }
}
